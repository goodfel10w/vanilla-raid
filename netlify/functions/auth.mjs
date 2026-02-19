import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { validateSession } from "./shared/auth-utils.mjs";

const USERNAME_RE = /^[a-zA-Z0-9_äöüÄÖÜß]{3,20}$/;
const SESSION_DAYS = 7;

export default async (req) => {
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const users = getStore({ name: "users", consistency: "strong" });
    const sessions = getStore({ name: "sessions", consistency: "strong" });

    // ── Register ──
    if (action === "register") {
      const username = (body.username || "").trim();
      const password = body.password || "";

      if (!USERNAME_RE.test(username)) {
        return new Response(JSON.stringify({ error: "Benutzername muss 3–20 Zeichen lang sein (Buchstaben, Zahlen, _)" }), { status: 400, headers });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Passwort muss mindestens 6 Zeichen lang sein" }), { status: 400, headers });
      }

      const key = username.toLowerCase();
      const existing = await users.get(key, { type: "json" });
      if (existing) {
        return new Response(JSON.stringify({ error: "Benutzername bereits vergeben" }), { status: 409, headers });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();
      const user = { id: userId, username, passwordHash, createdAt: new Date().toISOString() };
      await users.setJSON(key, user);

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await sessions.setJSON(token, { userId, username, createdAt: new Date().toISOString(), expiresAt });

      return new Response(JSON.stringify({ token, username, userId }), { status: 200, headers });
    }

    // ── Login ──
    if (action === "login") {
      const username = (body.username || "").trim();
      const password = body.password || "";

      const key = username.toLowerCase();
      const user = await users.get(key, { type: "json" });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return new Response(JSON.stringify({ error: "Benutzername oder Passwort falsch" }), { status: 401, headers });
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await sessions.setJSON(token, { userId: user.id, username: user.username, createdAt: new Date().toISOString(), expiresAt });

      return new Response(JSON.stringify({ token, username: user.username, userId: user.id }), { status: 200, headers });
    }

    // ── Logout ──
    if (action === "logout") {
      const auth = req.headers.get("authorization");
      if (auth && auth.startsWith("Bearer ")) {
        const token = auth.slice(7);
        if (token) await sessions.delete(token);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    // ── Validate ──
    if (action === "validate") {
      const session = await validateSession(req);
      if (!session) {
        return new Response(JSON.stringify({ error: "Sitzung ungültig" }), { status: 401, headers });
      }
      return new Response(JSON.stringify({ username: session.username, userId: session.userId }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unbekannte Aktion" }), { status: 400, headers });
  } catch (err) {
    console.error("Auth error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/auth",
};
