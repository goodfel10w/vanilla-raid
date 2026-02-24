import { getStore } from "@netlify/blobs";
import { encryptToken } from "./shared/auth-utils.mjs";

const DISCORD_API = "https://discord.com/api/v10";

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const origin = url.origin;

  if (error) {
    return Response.redirect(`${origin}/?discord_error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${origin}/?discord_error=missing_params`, 302);
  }

  try {
    const states = getStore({ name: "discord-oauth-states", consistency: "strong" });
    const users = getStore({ name: "users", consistency: "strong" });

    // Validate state (CSRF protection)
    const storedState = await states.get(state, { type: "json" });
    if (!storedState) {
      return Response.redirect(`${origin}/?discord_error=invalid_state`, 302);
    }
    await states.delete(state);

    // Check state expiry (10 min)
    if (Date.now() - new Date(storedState.createdAt).getTime() > 10 * 60 * 1000) {
      return Response.redirect(`${origin}/?discord_error=state_expired`, 302);
    }

    const { sessionToken, userKey } = storedState;
    if (!sessionToken || !userKey) {
      return Response.redirect(`${origin}/?discord_error=invalid_state`, 302);
    }

    // Verify the user session is still valid
    const sessions = getStore({ name: "sessions", consistency: "strong" });
    const session = await sessions.get(sessionToken, { type: "json" });
    if (!session || new Date(session.expiresAt) < new Date()) {
      return Response.redirect(`${origin}/?discord_error=session_expired`, 302);
    }

    const clientId = process.env.DISCORD_CLIENT_ID || process.env.DISCORD_APPLICATION_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = `${origin}/api/discord-callback`;

    // Exchange authorization code for access token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", tokenRes.status, await tokenRes.text());
      return Response.redirect(`${origin}/?discord_error=token_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch Discord user info
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      console.error("Discord user info failed:", userRes.status);
      return Response.redirect(`${origin}/?discord_error=user_failed`, 302);
    }

    const discordUser = await userRes.json();
    const discordId = discordUser.id;
    const discordUsername = discordUser.global_name || discordUser.username;
    const discordAvatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;

    // Check guild membership
    const guildId = process.env.DISCORD_GUILD_ID;
    let isGuildMember = false;
    let guildNickname = null;
    let guildRoles = [];

    if (guildId) {
      try {
        const memberRes = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (memberRes.ok) {
          const member = await memberRes.json();
          isGuildMember = true;
          guildNickname = member.nick || null;
          guildRoles = member.roles || [];
        }
        // 404 = not a member, which is fine
      } catch (e) {
        console.error("Guild membership check error:", e);
      }
    }

    // Update user record with Discord data
    const user = await users.get(userKey, { type: "json" });
    if (!user) {
      return Response.redirect(`${origin}/?discord_error=user_not_found`, 302);
    }

    user.discordId = discordId;
    user.discordUsername = discordUsername;
    user.discordAvatar = discordAvatar;
    user.discordAccessToken = encryptToken(accessToken);
    user.discordGuildMember = isGuildMember;
    user.discordGuildNickname = guildNickname;
    user.discordGuildRoles = guildRoles;
    user.discordLinkedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await users.setJSON(userKey, user);

    // Maintain discord-user-map for slash command character lookup
    const discordMap = getStore({ name: "discord-user-map", consistency: "strong" });
    await discordMap.setJSON(discordId, {
      userId: session.userId,
      userKey,
      discordUsername,
      linkedAt: new Date().toISOString(),
    });

    // Update session with Discord info so validate returns it
    session.discordId = discordId;
    session.discordUsername = discordUsername;
    session.discordGuildMember = isGuildMember;
    await sessions.setJSON(sessionToken, session);

    // Redirect back to app
    return Response.redirect(`${origin}/#discord_linked=1`, 302);
  } catch (err) {
    console.error("Discord OAuth callback error:", err);
    return Response.redirect(`${origin}/?discord_error=server_error`, 302);
  }
};

export const config = {
  path: "/api/discord-callback",
};
