import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession } from "./shared/auth-utils.mjs";

const VALID_INSTANCES = [
  "Karazhan", "Gruuls Unterschlupf", "Magtheridons Kammer",
  "Höhle des Schlangenschreins", "Festung der Stürme",
  "Hyjalgipfel", "Schwarzer Tempel", "Zul'Aman", "Sonnenbrunnenplateau",
];
const VALID_ROLES = ["Tank", "Heiler", "DPS"];
const VALID_SIGNUP_STATUS = ["accepted", "tentative", "declined"];

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
        const { raidId, charName, className, role, status, note } = body;
        if (!raidId || !charName || !role) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        if (!VALID_ROLES.includes(role)) {
          return new Response(JSON.stringify({ error: "Ungültige Rolle" }), { status: 400, headers });
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
        raid.signups.push({
          userId: user.userId,
          username: user.username,
          charName: String(charName).trim().slice(0, 50),
          className: String(className || "").slice(0, 50),
          role,
          status: status || "accepted",
          note: String(note || "").trim().slice(0, 200),
          timestamp: new Date().toISOString(),
        });
        await store.setJSON(raidId, raid);
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
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("Raids API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/raids",
};
