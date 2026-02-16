import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

const VALID_CLASSES = ["Druide","Hexenmeister","Jäger","Krieger","Magier","Paladin","Priester","Schamane","Schurke"];
const VALID_ROLES = ["Tank","Heiler","DPS"];
const DAYS_WD = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const DAYS_WE = ["Samstag","Sonntag"];
const EVE = ["18:00–20:00","20:00–22:00","22:00–00:00"];
const WEX = ["14:00–16:00","16:00–18:00"];

const VALID_AVAIL_KEYS = new Set();
for (const d of [...DAYS_WD, ...DAYS_WE]) {
  const slots = DAYS_WE.includes(d) ? [...WEX, ...EVE] : EVE;
  for (const s of slots) VALID_AVAIL_KEYS.add(d + "_" + s);
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
      const body = await req.json();
      const { charName, className, roles, availability, notes } = body;

      if (!charName || !className || !roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
      }

      if (typeof charName !== "string" || charName.trim().length === 0 || charName.trim().length > 50) {
        return new Response(JSON.stringify({ error: "Charaktername ungültig" }), { status: 400, headers });
      }
      if (!VALID_CLASSES.includes(className)) {
        return new Response(JSON.stringify({ error: "Ungültige Klasse" }), { status: 400, headers });
      }
      if (!Array.isArray(roles) || roles.length === 0 || roles.some(r => !VALID_ROLES.includes(r))) {
        return new Response(JSON.stringify({ error: "Ungültige Rolle" }), { status: 400, headers });
      }
      if (notes != null && typeof notes !== "string") {
        return new Response(JSON.stringify({ error: "Anmerkungen ungültig" }), { status: 400, headers });
      }
      if (typeof notes === "string" && notes.length > 500) {
        return new Response(JSON.stringify({ error: "Anmerkungen zu lang" }), { status: 400, headers });
      }

      // Sanitize availability: only keep valid keys with truthy values
      const cleanAvail = {};
      if (availability && typeof availability === "object" && !Array.isArray(availability)) {
        for (const [k, v] of Object.entries(availability)) {
          if (VALID_AVAIL_KEYS.has(k) && v) cleanAvail[k] = true;
        }
      }

      // For updates, verify the entry exists; for new entries, generate a UUID
      let id;
      if (body.id && typeof body.id === "string") {
        const existing = await store.get(body.id, { type: "json" });
        if (existing) {
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
        roles,
        availability: cleanAvail,
        notes: (notes || "").trim().slice(0, 500),
        timestamp: new Date().toISOString(),
      };

      await store.setJSON(id, entry);
      return new Response(JSON.stringify(entry), { status: 200, headers });
    }

    // DELETE — remove entry
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "ID fehlt" }), { status: 400, headers });
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
  path: "/api/*",
};
