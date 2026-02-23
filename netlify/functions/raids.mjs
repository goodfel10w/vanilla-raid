import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession } from "./shared/auth-utils.mjs";
import { buildRaidEmbed } from "./discord.mjs";

const VALID_INSTANCES = [
  "Karazhan", "Gruuls Unterschlupf", "Magtheridons Kammer",
  "Höhle des Schlangenschreins", "Festung der Stürme",
  "Hyjalgipfel", "Schwarzer Tempel", "Zul'Aman", "Sonnenbrunnenplateau",
];
const VALID_ROLES = ["Tank", "Heiler", "DPS"];
const VALID_SIGNUP_STATUS = ["accepted", "tentative", "declined"];
const CLASS_SPECS = {
  "Druide":      [{n:"Balance",r:"DPS"},{n:"Feral Tank",r:"Tank"},{n:"Feral DPS",r:"DPS"},{n:"Resto",r:"Heiler"}],
  "Hexenmeister":[{n:"Affliction",r:"DPS"},{n:"Demonologie",r:"DPS"},{n:"Destruction",r:"DPS"}],
  "Jäger":       [{n:"Beast Mastery",r:"DPS"},{n:"Marksmanship",r:"DPS"},{n:"Survival",r:"DPS"}],
  "Krieger":     [{n:"Prot",r:"Tank"},{n:"Arms",r:"DPS"},{n:"Fury",r:"DPS"}],
  "Magier":      [{n:"Arcane",r:"DPS"},{n:"Fire",r:"DPS"},{n:"Frost",r:"DPS"}],
  "Paladin":     [{n:"Holy",r:"Heiler"},{n:"Prot",r:"Tank"},{n:"Retri",r:"DPS"}],
  "Priester":    [{n:"Disc",r:"Heiler"},{n:"Holy",r:"Heiler"},{n:"Shadow",r:"DPS"}],
  "Schamane":    [{n:"Elemental",r:"DPS"},{n:"Enhancement",r:"DPS"},{n:"Resto",r:"Heiler"}],
  "Schurke":     [{n:"Assassination",r:"DPS"},{n:"Combat",r:"DPS"},{n:"Subtlety",r:"DPS"}],
};

export default async (req) => {
  const store = getStore({ name: "raids", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // GET — list all raids
    if (req.method === "GET") {
      const { blobs } = await store.list();
      const raids = [];
      for (const blob of blobs) {
        const data = await store.get(blob.key, { type: "json" });
        if (data) raids.push(data);
      }
      raids.sort((a, b) => {
        const da = a.date + "T" + a.time;
        const db = b.date + "T" + b.time;
        return da.localeCompare(db);
      });
      return new Response(JSON.stringify(raids), { status: 200, headers });
    }

    // POST — create/update raid OR manage signup
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      const body = await req.json();
      const { action } = body;

      // ── Signup ──
      if (action === "signup") {
        const { raidId, charName, className, role, offeredSpecs, status, note } = body;
        if (!raidId || !charName) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        // Validate offeredSpecs if provided
        let validSpecs = [];
        let finalRole = role || "DPS";
        if (Array.isArray(offeredSpecs) && offeredSpecs.length > 0) {
          const classSpecs = CLASS_SPECS[className] || [];
          const validNames = classSpecs.map(s => s.n);
          if (offeredSpecs.some(s => !validNames.includes(s))) {
            return new Response(JSON.stringify({ error: "Ungültige Spezialisierung" }), { status: 400, headers });
          }
          validSpecs = offeredSpecs;
          // Derive role from first offered spec
          const firstSpec = classSpecs.find(s => s.n === offeredSpecs[0]);
          if (firstSpec) finalRole = firstSpec.r;
        } else if (!role || !VALID_ROLES.includes(role)) {
          return new Response(JSON.stringify({ error: "Rolle oder Spezialisierung fehlt" }), { status: 400, headers });
        }
        if (status && !VALID_SIGNUP_STATUS.includes(status)) {
          return new Response(JSON.stringify({ error: "Ungültiger Status" }), { status: 400, headers });
        }
        const raid = await store.get(raidId, { type: "json" });
        if (!raid) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!raid.signups) raid.signups = [];
        // Remove existing signup from this user (to replace)
        raid.signups = raid.signups.filter(s => s.userId !== user.userId);
        const signup = {
          userId: user.userId,
          username: user.username,
          charName: String(charName).trim().slice(0, 50),
          className: String(className || "").slice(0, 50),
          role: finalRole,
          status: status || "accepted",
          note: String(note || "").trim().slice(0, 200),
          timestamp: new Date().toISOString(),
        };
        if (validSpecs.length) signup.offeredSpecs = validSpecs;
        raid.signups.push(signup);
        await store.setJSON(raidId, raid);
        autoUpdateDiscord(raidId, raid);
        return new Response(JSON.stringify(raid), { status: 200, headers });
      }

      // ── Assign Spec (Raid Leader) ──
      if (action === "assign-spec") {
        const { raidId, targetUserId, assignedSpec } = body;
        if (!raidId || !targetUserId) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const raid = await store.get(raidId, { type: "json" });
        if (!raid) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        // Only raid creator can assign
        if (raid.createdBy !== user.userId) {
          return new Response(JSON.stringify({ error: "Nur der Raid-Ersteller kann Specs zuweisen" }), { status: 403, headers });
        }
        if (!raid.signups) raid.signups = [];
        const signup = raid.signups.find(s => s.userId === targetUserId);
        if (!signup) {
          return new Response(JSON.stringify({ error: "Spieler nicht angemeldet" }), { status: 404, headers });
        }
        if (assignedSpec) {
          // Validate the assigned spec is one of the offered specs
          if (signup.offeredSpecs && !signup.offeredSpecs.includes(assignedSpec)) {
            return new Response(JSON.stringify({ error: "Spec nicht in angebotenen Specs" }), { status: 400, headers });
          }
          signup.assignedSpec = assignedSpec;
          // Update role based on assigned spec
          const classSpecs = CLASS_SPECS[signup.className] || [];
          const sp = classSpecs.find(s => s.n === assignedSpec);
          if (sp) signup.role = sp.r;
        } else {
          // Clear assignment
          delete signup.assignedSpec;
          // Reset role to first offered spec
          if (signup.offeredSpecs && signup.offeredSpecs.length) {
            const classSpecs = CLASS_SPECS[signup.className] || [];
            const sp = classSpecs.find(s => s.n === signup.offeredSpecs[0]);
            if (sp) signup.role = sp.r;
          }
        }
        await store.setJSON(raidId, raid);
        autoUpdateDiscord(raidId, raid);
        return new Response(JSON.stringify(raid), { status: 200, headers });
      }

      // ── Unsignup ──
      if (action === "unsignup") {
        const { raidId } = body;
        if (!raidId) {
          return new Response(JSON.stringify({ error: "Raid-ID fehlt" }), { status: 400, headers });
        }
        const raid = await store.get(raidId, { type: "json" });
        if (!raid) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!raid.signups) raid.signups = [];
        raid.signups = raid.signups.filter(s => s.userId !== user.userId);
        await store.setJSON(raidId, raid);
        autoUpdateDiscord(raidId, raid);
        return new Response(JSON.stringify(raid), { status: 200, headers });
      }

      // ── Create or Update Raid ──
      const { instance, date, time, maxPlayers, notes } = body;

      if (!instance || !date || !time) {
        return new Response(JSON.stringify({ error: "Felder fehlen (Instanz, Datum, Uhrzeit)" }), { status: 400, headers });
      }
      if (!VALID_INSTANCES.includes(instance)) {
        return new Response(JSON.stringify({ error: "Ungültige Instanz" }), { status: 400, headers });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: "Ungültiges Datum" }), { status: 400, headers });
      }
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: "Ungültige Uhrzeit" }), { status: 400, headers });
      }
      const mp = parseInt(maxPlayers) || 25;
      if (mp < 1 || mp > 40) {
        return new Response(JSON.stringify({ error: "Max. Spieler muss zwischen 1 und 40 liegen" }), { status: 400, headers });
      }
      if (notes != null && typeof notes === "string" && notes.length > 500) {
        return new Response(JSON.stringify({ error: "Anmerkungen zu lang" }), { status: 400, headers });
      }

      let id;
      let existingSignups = [];
      if (body.id && typeof body.id === "string") {
        const existing = await store.get(body.id, { type: "json" });
        if (!existing) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (existing.createdBy !== user.userId) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        id = body.id;
        existingSignups = existing.signups || [];
      } else {
        id = randomUUID();
      }

      const raid = {
        id,
        instance,
        date,
        time,
        maxPlayers: mp,
        notes: (notes || "").trim().slice(0, 500),
        createdBy: user.userId,
        createdByName: user.username,
        signups: existingSignups,
        timestamp: new Date().toISOString(),
      };

      await store.setJSON(id, raid);
      if (body.id) autoUpdateDiscord(id, raid);
      return new Response(JSON.stringify(raid), { status: 200, headers });
    }

    // DELETE — remove raid
    if (req.method === "DELETE") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "ID fehlt" }), { status: 400, headers });
      }
      const existing = await store.get(id, { type: "json" });
      if (existing && existing.createdBy && existing.createdBy !== user.userId) {
        return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
      }
      await store.delete(id);
      // Clean up Discord message mapping
      try {
        const discordStore = getStore({ name: "discord-messages", consistency: "strong" });
        await discordStore.delete(id);
      } catch (_) { /* non-fatal */ }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("Raids API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

// Fire-and-forget Discord embed update when a raid changes
async function autoUpdateDiscord(raidId, raid) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const discordStore = getStore({ name: "discord-messages", consistency: "strong" });
    const mapping = await discordStore.get(raidId, { type: "json" });
    if (!mapping?.messageId) return;

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const embed = buildRaidEmbed(raid, siteUrl);
    const res = await fetch(`${webhookUrl}/messages/${mapping.messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (res.status === 404) {
      await discordStore.delete(raidId);
    } else if (res.ok) {
      mapping.updatedAt = new Date().toISOString();
      await discordStore.setJSON(raidId, mapping);
    }
  } catch (err) {
    console.error("Auto-update Discord failed (non-fatal):", err);
  }
}

export const config = {
  path: "/api/raids",
};
