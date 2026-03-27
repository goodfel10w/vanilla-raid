import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession } from "./shared/auth-utils.mjs";

const VALID_CLASSES = ["Druide","Hexenmeister","Jäger","Krieger","Magier","Paladin","Priester","Schamane","Schurke"];
const VALID_ROLES = ["Tank","Heiler","DPS"];
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
const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

// 15-min slots from 12:00 to 23:45 (same for all days)
const SLOTS = [];
for (let hh = 12; hh < 24; hh++) {
  for (let mm = 0; mm < 60; mm += 15) {
    SLOTS.push(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
  }
}

const VALID_AVAIL_KEYS = new Set();
for (const d of DAYS) {
  for (const s of SLOTS) VALID_AVAIL_KEYS.add(d + "_" + s);
}

// Legacy range keys (for migration of existing data on POST)
function migrateLegacyKey(key) {
  const sep = key.indexOf('_');
  if (sep < 0) return [];
  const day = key.substring(0, sep);
  const slot = key.substring(sep + 1);
  if (!slot.includes('–')) return [key]; // already new format
  const [startStr, endStr] = slot.split('–');
  const [sh, sm] = startStr.split(':').map(Number);
  let [eh, em] = endStr.split(':').map(Number);
  if (eh === 0 && em === 0) eh = 24;
  const keys = [];
  for (let t = sh * 60 + sm; t < eh * 60 + em; t += 15) {
    const tk = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    keys.push(day + '_' + tk);
  }
  return keys;
}

export default async (req, context) => {
  const store = getStore({ name: "raid-entries", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // GET — list all entries
    if (req.method === "GET") {
      const { blobs } = await store.list();
      const entries = [];
      for (const blob of blobs) {
        const data = await store.get(blob.key, { type: "json" });
        if (data) entries.push(data);
      }
      entries.sort((a, b) => (a.charName || "").localeCompare(b.charName || ""));
      return new Response(JSON.stringify(entries), { status: 200, headers });
    }

    // POST — create or update entry
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      const body = await req.json();

      // Admin action: unlink userId from an entry
      if (body.action === "unlink-user" && body.id) {
        if (!user.isAdmin) {
          return new Response(JSON.stringify({ error: "Nur Admins erlaubt" }), { status: 403, headers });
        }
        const existing = await store.get(body.id, { type: "json" });
        if (!existing) {
          return new Response(JSON.stringify({ error: "Eintrag nicht gefunden" }), { status: 404, headers });
        }
        delete existing.userId;
        await store.setJSON(body.id, existing);
        return new Response(JSON.stringify({ ok: true, entry: existing }), { status: 200, headers });
      }

      const { charName, className, specs, roles, availability, notes } = body;

      if (!charName || !className) {
        return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
      }

      if (typeof charName !== "string" || charName.trim().length === 0 || charName.trim().length > 50) {
        return new Response(JSON.stringify({ error: "Charaktername ungültig" }), { status: 400, headers });
      }
      if (!VALID_CLASSES.includes(className)) {
        return new Response(JSON.stringify({ error: "Ungültige Klasse" }), { status: 400, headers });
      }
      // Validate specs (new format) or roles (legacy format)
      const classSpecs = CLASS_SPECS[className] || [];
      const validSpecNames = classSpecs.map(s => s.n);
      let finalSpecs = [];
      let finalRoles = [];
      if (Array.isArray(specs) && specs.length > 0) {
        if (specs.some(s => !validSpecNames.includes(s))) {
          return new Response(JSON.stringify({ error: "Ungültige Spezialisierung" }), { status: 400, headers });
        }
        finalSpecs = specs;
        const roleSet = new Set();
        specs.forEach(s => { const sp = classSpecs.find(c => c.n === s); if (sp) roleSet.add(sp.r); });
        finalRoles = VALID_ROLES.filter(r => roleSet.has(r));
      } else if (Array.isArray(roles) && roles.length > 0) {
        // Legacy: accept plain roles without specs
        if (roles.some(r => !VALID_ROLES.includes(r))) {
          return new Response(JSON.stringify({ error: "Ungültige Rolle" }), { status: 400, headers });
        }
        finalRoles = roles;
      } else {
        return new Response(JSON.stringify({ error: "Spezialisierung oder Rolle fehlt" }), { status: 400, headers });
      }
      if (notes != null && typeof notes !== "string") {
        return new Response(JSON.stringify({ error: "Anmerkungen ungültig" }), { status: 400, headers });
      }
      if (typeof notes === "string" && notes.length > 500) {
        return new Response(JSON.stringify({ error: "Anmerkungen zu lang" }), { status: 400, headers });
      }

      // Sanitize availability: accept "yes", "tentative"; normalize legacy true → "yes"; migrate legacy range keys
      const VALID_AVAIL_VALUES = new Set(["yes", "tentative"]);
      const cleanAvail = {};
      if (availability && typeof availability === "object" && !Array.isArray(availability)) {
        for (const [k, v] of Object.entries(availability)) {
          const val = v === true ? "yes" : v;
          if (!VALID_AVAIL_VALUES.has(val)) continue;
          // Migrate legacy range keys or validate new format keys
          const expandedKeys = migrateLegacyKey(k);
          for (const ek of expandedKeys) {
            if (VALID_AVAIL_KEYS.has(ek)) cleanAvail[ek] = val;
          }
        }
      }

      // For updates, verify the entry exists; for new entries, generate a UUID
      let id;
      if (body.id && typeof body.id === "string") {
        const existing = await store.get(body.id, { type: "json" });
        if (existing) {
          // Ownership check: admin can edit any entry; others can only edit own or legacy entries
          if (existing.userId && existing.userId !== user.userId && !user.isAdmin) {
            return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
          }
          id = body.id;
        } else {
          return new Response(JSON.stringify({ error: "Eintrag nicht gefunden" }), { status: 404, headers });
        }
      } else {
        id = randomUUID();
      }

      const entry = {
        id,
        charName: charName.trim().slice(0, 50),
        className,
        specs: finalSpecs.length ? finalSpecs : undefined,
        roles: finalRoles,
        availability: cleanAvail,
        notes: (notes || "").trim().slice(0, 500),
        userId: user.userId,
        timestamp: new Date().toISOString(),
      };

      await store.setJSON(id, entry);
      return new Response(JSON.stringify(entry), { status: 200, headers });
    }

    // DELETE — remove entry (single by id, or all if admin with ?all=true)
    if (req.method === "DELETE") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      const all = url.searchParams.get("all");

      // Admin: delete all entries
      if (all === "true") {
        if (!user.isAdmin) {
          return new Response(JSON.stringify({ error: "Nur Admins erlaubt" }), { status: 403, headers });
        }
        const { blobs } = await store.list();
        let deleted = 0;
        for (const blob of blobs) {
          await store.delete(blob.key);
          deleted++;
        }
        return new Response(JSON.stringify({ ok: true, deleted }), { status: 200, headers });
      }

      if (!id) {
        return new Response(JSON.stringify({ error: "ID fehlt" }), { status: 400, headers });
      }
      const existing = await store.get(id, { type: "json" });
      if (!existing) {
        return new Response(JSON.stringify({ error: "Eintrag nicht gefunden" }), { status: 404, headers });
      }
      if (existing.userId && existing.userId !== user.userId && !user.isAdmin) {
        return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
      }
      await store.delete(id);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/entries",
};
