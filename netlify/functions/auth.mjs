import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession, isSiteAdmin } from "./shared/auth-utils.mjs";

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

      // Purge expired states (older than 10 min) to prevent store bloat from abandoned logins
      try {
        const { blobs } = await states.list();
        const expiry = Date.now() - 10 * 60 * 1000;
        for (const blob of blobs) {
          const s = await states.get(blob.key, { type: "json" });
          if (s && new Date(s.createdAt).getTime() < expiry) {
            await states.delete(blob.key);
          }
        }
        // Rate limit: reject if too many pending states (> 50 active)
        const { blobs: remaining } = await states.list();
        if (remaining.length > 50) {
          return new Response(JSON.stringify({ error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." }), { status: 429, headers });
        }
      } catch (e) {
        console.error("State cleanup error:", e);
      }

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

      // Look up user record for Discord link status
      const users = getStore({ name: "users", consistency: "strong" });
      let discordLinked = false;
      let discordUsername = null;
      let discordGuildMember = false;

      // Find user by bnetId or userId
      const auth = req.headers.get("authorization");
      const token = auth?.slice(7);
      const sess = token ? await sessions.get(token, { type: "json" }) : null;
      if (sess) {
        const userKey = sess.bnetId ? `bnet_${sess.bnetId}` : null;
        if (userKey) {
          const user = await users.get(userKey, { type: "json" });
          if (user?.discordId) {
            discordLinked = true;
            discordUsername = user.discordUsername || null;
            discordGuildMember = user.discordGuildMember || false;
          }
        }
      }

      return new Response(JSON.stringify({
        username: session.username,
        userId: session.userId,
        isAdmin: session.isAdmin || false,
        discordLinked,
        discordUsername,
        discordGuildMember,
      }), { status: 200, headers });
    }

    // ── Purge users — admin only ──
    if (action === "purge-users") {
      const session = await validateSession(req);
      if (!session || !session.isAdmin) {
        return new Response(JSON.stringify({ error: "Nur Admins erlaubt" }), { status: 403, headers });
      }

      const users = getStore({ name: "users", consistency: "strong" });
      const { blobs: userBlobs } = await users.list();
      let deletedUsers = 0;
      for (const blob of userBlobs) {
        const user = await users.get(blob.key, { type: "json" });
        if (user && !isSiteAdmin(user.username) && !isSiteAdmin(user.battleTag)) {
          await users.delete(blob.key);
          deletedUsers++;
        }
      }

      // Delete all non-admin sessions
      const { blobs: sessionBlobs } = await sessions.list();
      let deletedSessions = 0;
      for (const blob of sessionBlobs) {
        const sess = await sessions.get(blob.key, { type: "json" });
        if (sess && !isSiteAdmin(sess.username)) {
          await sessions.delete(blob.key);
          deletedSessions++;
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        deletedUsers,
        deletedSessions,
      }), { status: 200, headers });
    }

    // ── Discord Link — generate Discord OAuth URL ──
    if (action === "discord-link") {
      const session = await validateSession(req);
      if (!session) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }

      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) {
        return new Response(JSON.stringify({ error: "Discord OAuth nicht konfiguriert" }), { status: 500, headers });
      }

      const origin = new URL(req.url).origin;
      const redirectUri = `${origin}/api/discord-callback`;
      const state = randomUUID();

      // Get session token to pass to callback
      const auth = req.headers.get("authorization");
      const sessionToken = auth?.slice(7);
      const sess = sessionToken ? await sessions.get(sessionToken, { type: "json" }) : null;
      const userKey = sess?.bnetId ? `bnet_${sess.bnetId}` : null;

      if (!userKey) {
        return new Response(JSON.stringify({ error: "Benutzer nicht gefunden" }), { status: 400, headers });
      }

      // Store state with session reference
      const discordStates = getStore({ name: "discord-oauth-states", consistency: "strong" });

      // Purge expired states (older than 10 min)
      try {
        const { blobs } = await discordStates.list();
        const expiry = Date.now() - 10 * 60 * 1000;
        for (const blob of blobs) {
          const s = await discordStates.get(blob.key, { type: "json" });
          if (s && new Date(s.createdAt).getTime() < expiry) {
            await discordStates.delete(blob.key);
          }
        }
      } catch (e) {
        console.error("Discord state cleanup error:", e);
      }

      await discordStates.setJSON(state, {
        createdAt: new Date().toISOString(),
        sessionToken,
        userKey,
      });

      const authUrl = `https://discord.com/oauth2/authorize?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify guilds.members.read",
        state,
      }).toString();

      return new Response(JSON.stringify({ url: authUrl }), { status: 200, headers });
    }

    // ── Discord Unlink — remove Discord account ──
    if (action === "discord-unlink") {
      const session = await validateSession(req);
      if (!session) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }

      const auth = req.headers.get("authorization");
      const sessionToken = auth?.slice(7);
      const sess = sessionToken ? await sessions.get(sessionToken, { type: "json" }) : null;
      const userKey = sess?.bnetId ? `bnet_${sess.bnetId}` : null;

      if (!userKey) {
        return new Response(JSON.stringify({ error: "Benutzer nicht gefunden" }), { status: 400, headers });
      }

      const users = getStore({ name: "users", consistency: "strong" });
      const user = await users.get(userKey, { type: "json" });
      if (user) {
        // Remove discord-user-map entry for slash command lookup
        if (user.discordId) {
          const discordMap = getStore({ name: "discord-user-map", consistency: "strong" });
          await discordMap.delete(user.discordId).catch(() => {});
        }
        delete user.discordId;
        delete user.discordUsername;
        delete user.discordAvatar;
        delete user.discordAccessToken;
        delete user.discordGuildMember;
        delete user.discordGuildNickname;
        delete user.discordGuildRoles;
        delete user.discordLinkedAt;
        user.updatedAt = new Date().toISOString();
        await users.setJSON(userKey, user);
      }

      // Clear Discord info from session
      if (sess) {
        delete sess.discordId;
        delete sess.discordUsername;
        delete sess.discordGuildMember;
        await sessions.setJSON(sessionToken, sess);
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
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
