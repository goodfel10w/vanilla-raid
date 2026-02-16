import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore({ name: "raid-entries", consistency: "strong" });
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

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

      const id = body.id || charName.trim().toLowerCase().replace(/[^a-z0-9äöüß]/g, "-") + "-" + Date.now();
      const entry = {
        id,
        charName: charName.trim(),
        className,
        roles,
        availability: availability || {},
        notes: (notes || "").trim(),
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/*",
};
