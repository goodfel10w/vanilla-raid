import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession } from "./shared/auth-utils.mjs";

const BNET_REGION = process.env.BNET_REGION || "eu";
const OAUTH_BASE = `https://${BNET_REGION}.battle.net/oauth`;

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

    const sessions = getStore({ name: "sessions", consistency: "strong" });

    // ── Battle.net Login — generate OAuth URL ──
    if (action === "bnet-login") {
      const clientId = process.env.BNET_CLIENT_ID;
      if (!clientId) {
        return new Response(JSON.stringify({ error: "Battle.net OAuth nicht konfiguriert" }), { status: 500, headers });
      }

      const origin = new URL(req.url).origin;
      const redirectUri = `${origin}/api/bnet-callback`;
      const state = randomUUID();

      // Store state for CSRF validation
      const states = getStore({ name: "oauth-states", consistency: "strong" });
      await states.setJSON(state, { createdAt: new Date().toISOString() });

      const authUrl = `${OAUTH_BASE}/authorize?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid wow.profile",
        state,
      }).toString();

      return new Response(JSON.stringify({ url: authUrl }), { status: 200, headers });
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
