import { getStore } from "@netlify/blobs";
import { validateSession } from "./shared/auth-utils.mjs";

const VALID_CLASSES = ["Druide","Hexenmeister","Jäger","Krieger","Magier","Paladin","Priester","Schamane","Schurke"];
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
const DAYS_SET = new Set(DAYS);

// 15-min slots from 12:00 to 23:45
const VALID_AVAIL_KEYS = new Set();
for (const d of DAYS) {
  for (let hh = 12; hh < 24; hh++) {
    for (let mm = 0; mm < 60; mm += 15) {
      VALID_AVAIL_KEYS.add(d + "_" + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
    }
  }
}

function isValidWeekKey(week) {
  if (!week || typeof week !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(week);
}

export default async (req) => {
  const signupStore = getStore({ name: "kara-signups", consistency: "strong" });
  const entryStore = getStore({ name: "raid-entries", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // GET — retrieve all signups for a given week (public)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const week = url.searchParams.get("week");
      if (!isValidWeekKey(week)) {
        return new Response(JSON.stringify({ error: "Ungueltige Woche" }), { status: 400, headers });
      }
      const data = await signupStore.get(week, { type: "json" }).catch(() => null);
      if (!data) {
        return new Response(JSON.stringify({ signups: [] }), { status: 200, headers });
      }
      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    // POST — create or update own signup
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }

      const body = await req.json();
      const { week, entryId, spec, days, customSlots, useCustomTimes } = body;

      if (!isValidWeekKey(week)) {
        return new Response(JSON.stringify({ error: "Ungueltige Woche" }), { status: 400, headers });
      }
      if (!entryId || typeof entryId !== "string") {
        return new Response(JSON.stringify({ error: "Entry-ID fehlt" }), { status: 400, headers });
      }

      // Verify entry exists and belongs to this user
      const { blobs } = await entryStore.list();
      let entry = null;
      for (const blob of blobs) {
        const e = await entryStore.get(blob.key, { type: "json" });
        if (e && e.id === entryId) {
          entry = e;
          break;
        }
      }
      if (!entry) {
        return new Response(JSON.stringify({ error: "Entry nicht gefunden" }), { status: 404, headers });
      }
      if (entry.userId && entry.userId !== user.userId && !user.isAdmin) {
        return new Response(JSON.stringify({ error: "Keine Berechtigung fuer diesen Entry" }), { status: 403, headers });
      }

      // Validate class and spec
      if (!VALID_CLASSES.includes(entry.className)) {
        return new Response(JSON.stringify({ error: "Ungueltige Klasse" }), { status: 400, headers });
      }
      const validSpecs = CLASS_SPECS[entry.className] || [];
      const specDef = validSpecs.find(s => s.n === spec);
      if (!specDef) {
        return new Response(JSON.stringify({ error: "Ungueltiger Spec fuer diese Klasse" }), { status: 400, headers });
      }

      // Validate days
      if (!Array.isArray(days) || days.length === 0 || days.length > 7) {
        return new Response(JSON.stringify({ error: "Mindestens ein Tag erforderlich" }), { status: 400, headers });
      }
      for (const d of days) {
        if (!DAYS_SET.has(d)) {
          return new Response(JSON.stringify({ error: `Ungueltiger Tag: ${d}` }), { status: 400, headers });
        }
      }

      // Validate custom slots if provided
      let validatedSlots = undefined;
      if (useCustomTimes && customSlots && typeof customSlots === "object") {
        validatedSlots = {};
        for (const [key, val] of Object.entries(customSlots)) {
          if (!VALID_AVAIL_KEYS.has(key)) continue; // skip invalid keys
          if (val !== "yes" && val !== "tentative") continue;
          validatedSlots[key] = val;
        }
      }

      const signup = {
        entryId,
        userId: user.userId,
        charName: entry.charName,
        className: entry.className,
        spec,
        role: specDef.r,
        days,
        customSlots: validatedSlots,
        useCustomTimes: !!useCustomTimes,
        timestamp: new Date().toISOString(),
      };

      // Load existing signups for this week
      const existing = await signupStore.get(week, { type: "json" }).catch(() => null);
      const signups = existing?.signups || [];

      // Replace existing signup by same user, or add new
      const idx = signups.findIndex(s => s.userId === user.userId);
      if (idx >= 0) {
        signups[idx] = signup;
      } else {
        signups.push(signup);
      }

      await signupStore.setJSON(week, { signups, updatedAt: new Date().toISOString() });
      return new Response(JSON.stringify({ ok: true, signup }), { status: 200, headers });
    }

    // DELETE — remove own signup
    if (req.method === "DELETE") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }

      const url = new URL(req.url);
      const week = url.searchParams.get("week");
      if (!isValidWeekKey(week)) {
        return new Response(JSON.stringify({ error: "Ungueltige Woche" }), { status: 400, headers });
      }

      const existing = await signupStore.get(week, { type: "json" }).catch(() => null);
      if (!existing || !existing.signups) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      const signups = existing.signups.filter(s => s.userId !== user.userId);
      await signupStore.setJSON(week, { signups, updatedAt: new Date().toISOString() });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Methode nicht erlaubt" }), { status: 405, headers });
  } catch (err) {
    console.error("Kara-signups function error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler" }), { status: 500, headers });
  }
};
