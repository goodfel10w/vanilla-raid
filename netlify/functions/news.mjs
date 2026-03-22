import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
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

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  const store = getStore({ name: "news-posts", consistency: "strong" });

  // ── GET: list all news posts (public) ──
  if (req.method === "GET") {
    try {
      const { blobs } = await store.list();
      const posts = [];
      for (const blob of blobs) {
        const post = await store.get(blob.key, { type: "json" }).catch(() => null);
        if (post) posts.push(post);
      }
      // Pinned first, then by createdAt descending
      posts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      return json(200, posts);
    } catch (err) {
      console.error("News GET error:", err);
      return json(500, { error: "Fehler beim Laden der Neuigkeiten" });
    }
  }

  // ── Auth required for POST/DELETE ──
  const user = await validateSession(req);
  if (!user) return json(401, { error: "Nicht angemeldet" });

  const canManage = user.isAdmin || (await isDkpOfficerOrAdmin(user.username));
  if (!canManage) return json(403, { error: "Keine Berechtigung" });

  // ── DELETE ──
  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json(400, { error: "ID fehlt" });
    try {
      await store.delete(id);
      return json(200, { ok: true });
    } catch (err) {
      console.error("News DELETE error:", err);
      return json(500, { error: "Fehler beim Löschen" });
    }
  }

  // ── POST: create or update ──
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Ungültige Anfrage" });
    }

    const { id, title, content, pinned } = body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return json(400, { error: "Titel ist erforderlich" });
    }
    if (title.length > 200) {
      return json(400, { error: "Titel darf maximal 200 Zeichen lang sein" });
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return json(400, { error: "Inhalt ist erforderlich" });
    }
    if (content.length > 5000) {
      return json(400, { error: "Inhalt darf maximal 5000 Zeichen lang sein" });
    }

    const now = new Date().toISOString();

    if (id) {
      // Update existing
      const existing = await store.get(id, { type: "json" }).catch(() => null);
      if (!existing) return json(404, { error: "Beitrag nicht gefunden" });
      existing.title = title.trim();
      existing.content = content.trim();
      existing.pinned = !!pinned;
      existing.updatedAt = now;
      await store.setJSON(id, existing);
      return json(200, existing);
    } else {
      // Create new
      const newId = randomUUID();
      const post = {
        id: newId,
        title: title.trim(),
        content: content.trim(),
        author: user.username,
        pinned: !!pinned,
        createdAt: now,
        updatedAt: now,
      };
      await store.setJSON(newId, post);
      return json(201, post);
    }
  }

  return json(405, { error: "Method not allowed" });
};

export const config = { path: "/api/news" };
