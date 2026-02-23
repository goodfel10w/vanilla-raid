import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

const SESSION_DAYS = 7;
const BNET_REGION = process.env.BNET_REGION || "eu";
const BNET_REALM = process.env.BNET_REALM || "thunderstrike";
const BNET_FACTION = process.env.BNET_FACTION || "ALLIANCE";

// Region → OAuth base URL
const OAUTH_BASE = `https://${BNET_REGION}.battle.net/oauth`;
const API_BASE = `https://${BNET_REGION}.api.blizzard.com`;

// English WoW class ID → German class name (TBC classes only)
const CLASS_MAP = {
  1: "Krieger",
  2: "Paladin",
  3: "Jäger",
  4: "Schurke",
  5: "Priester",
  7: "Schamane",
  8: "Magier",
  9: "Hexenmeister",
  11: "Druide",
};

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Determine site origin for redirect
  const origin = url.origin;

  if (error) {
    return Response.redirect(`${origin}/?auth_error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${origin}/?auth_error=missing_params`, 302);
  }

  try {
    const states = getStore({ name: "oauth-states", consistency: "strong" });
    const sessions = getStore({ name: "sessions", consistency: "strong" });
    const users = getStore({ name: "users", consistency: "strong" });

    // Validate state to prevent CSRF
    const storedState = await states.get(state, { type: "json" });
    if (!storedState) {
      return Response.redirect(`${origin}/?auth_error=invalid_state`, 302);
    }
    await states.delete(state);

    // Check state expiry (10 min max)
    if (Date.now() - new Date(storedState.createdAt).getTime() > 10 * 60 * 1000) {
      return Response.redirect(`${origin}/?auth_error=state_expired`, 302);
    }

    const clientId = process.env.BNET_CLIENT_ID;
    const clientSecret = process.env.BNET_CLIENT_SECRET;
    const redirectUri = `${origin}/api/bnet-callback`;

    // Exchange authorization code for access token
    const tokenRes = await fetch(`${OAUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenRes.status, await tokenRes.text());
      return Response.redirect(`${origin}/?auth_error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch Battle.net user info (BattleTag + ID)
    const userInfoRes = await fetch(`${OAUTH_BASE}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      console.error("UserInfo failed:", userInfoRes.status);
      return Response.redirect(`${origin}/?auth_error=userinfo_failed`, 302);
    }

    const userInfo = await userInfoRes.json();
    const bnetId = String(userInfo.id);
    const battleTag = userInfo.battletag || `User#${bnetId}`;

    // Fetch WoW characters from Classic TBC profile
    let characters = [];
    try {
      const charsRes = await fetch(
        `${API_BASE}/profile/user/wow?namespace=profile-classic-${BNET_REGION}&locale=de_DE`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (charsRes.ok) {
        const charsData = await charsRes.json();
        // Extract characters from all WoW accounts, filtered by faction and realm
        for (const account of charsData.wow_accounts || []) {
          for (const char of account.characters || []) {
            const faction = char.faction?.type;
            const realmSlug = char.realm?.slug || "";
            if (BNET_FACTION && faction !== BNET_FACTION) continue;
            if (BNET_REALM && realmSlug !== BNET_REALM) continue;

            const germanClass = CLASS_MAP[char.playable_class?.id];
            if (germanClass) {
              characters.push({
                name: char.name,
                realm: char.realm?.name || realmSlug,
                className: germanClass,
                level: char.level || 0,
              });
            }
          }
        }
        // Sort by level descending, then name
        characters.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
      }
    } catch (e) {
      console.error("Character fetch error:", e);
      // Non-fatal: continue without characters
    }

    // Create or update user record
    const userKey = `bnet_${bnetId}`;
    const existingUser = await users.get(userKey, { type: "json" });
    const userId = existingUser?.id || randomUUID();
    const user = {
      id: userId,
      username: battleTag,
      bnetId,
      battleTag,
      bnetAccessToken: accessToken,
      characters,
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await users.setJSON(userKey, user);

    // Create session
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await sessions.setJSON(sessionToken, {
      userId,
      username: battleTag,
      bnetId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    // Redirect back to app with session token in URL fragment (#)
    // Fragment is NOT sent to the server on subsequent requests, not logged in access logs,
    // and not included in Referer headers — unlike query parameters (?).
    return Response.redirect(
      `${origin}/#bnet_token=${encodeURIComponent(sessionToken)}`,
      302
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return Response.redirect(`${origin}/?auth_error=server_error`, 302);
  }
};

export const config = {
  path: "/api/bnet-callback",
};
