import { getStore } from "@netlify/blobs";
import { validateSession, isSiteAdmin } from "./shared/auth-utils.mjs";

// Check if user is a DKP officer or admin (via dkp-config roles)
async function isDkpOfficerOrAdmin(username) {
  if (!username) return false;
  if (isSiteAdmin(username)) return true;
  try {
    const cfgStore = getStore({ name: "dkp-config", consistency: "strong" });
    const cfg = await cfgStore.get("dkp-settings", { type: "json" });
    if (!cfg || !cfg.roles) return false;
    const lower = username.toLowerCase();
    const role = cfg.roles[lower];
    if (role === "admin" || role === "officer") return true;
    const prefix = lower.split("#")[0];
    if (prefix !== lower && cfg.roles[prefix]) {
      const r = cfg.roles[prefix];
      return r === "admin" || r === "officer";
    }
  } catch (_) { /* non-fatal */ }
  return false;
}

// Validate week string format YYYY-MM-DD
function isValidWeekKey(week) {
  if (!week || typeof week !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(week);
}

export default async (req) => {
  const store = getStore({ name: "kara-groups", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // GET — retrieve kara state for a given week
    if (req.method === "GET") {
      const url = new URL(req.url);
      const week = url.searchParams.get("week");
      if (!isValidWeekKey(week)) {
        return new Response(JSON.stringify({ error: "Ungueltige Woche" }), { status: 400, headers });
      }
      const data = await store.get(week, { type: "json" }).catch(() => null);
      if (!data) {
        return new Response(JSON.stringify({ groups: [], links: [], groupSlots: [] }), { status: 200, headers });
      }
      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    // POST — save kara state for a given week
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      // Check officer/admin permission
      if (!await isDkpOfficerOrAdmin(user.username)) {
        return new Response(JSON.stringify({ error: "Keine Berechtigung (Officer/Admin erforderlich)" }), { status: 403, headers });
      }

      const body = await req.json();
      const { week, groups, links, groupSlots } = body;

      if (!isValidWeekKey(week)) {
        return new Response(JSON.stringify({ error: "Ungueltige Woche" }), { status: 400, headers });
      }
      if (!Array.isArray(groups)) {
        return new Response(JSON.stringify({ error: "Gruppen fehlen" }), { status: 400, headers });
      }
      if (groups.length > 5) {
        return new Response(JSON.stringify({ error: "Maximal 5 Gruppen" }), { status: 400, headers });
      }

      const now = new Date().toISOString();
      const state = {
        groups: groups || [],
        links: Array.isArray(links) ? links : [],
        groupSlots: Array.isArray(groupSlots) ? groupSlots : [],
        updatedBy: user.username,
        updatedAt: now,
      };

      await store.setJSON(week, state);
      return new Response(JSON.stringify({ ok: true, updatedBy: user.username, updatedAt: now }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Methode nicht erlaubt" }), { status: 405, headers });
  } catch (err) {
    console.error("Kara function error:", err);
    return new Response(JSON.stringify({ error: "Interner Fehler" }), { status: 500, headers });
  }
};
