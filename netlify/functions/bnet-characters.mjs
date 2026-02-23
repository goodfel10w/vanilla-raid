import { getStore } from "@netlify/blobs";
import { validateSession } from "./shared/auth-utils.mjs";

const BNET_REGION = process.env.BNET_REGION || "eu";
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
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const session = await validateSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
  }

  try {
    const users = getStore({ name: "users", consistency: "strong" });

    // Find user by session's bnetId or userId
    // Sessions created by bnet-callback store bnetId
    const sessions = getStore({ name: "sessions", consistency: "strong" });
    const auth = req.headers.get("authorization");
    const token = auth.slice(7);
    const sessionData = await sessions.get(token, { type: "json" });

    if (!sessionData?.bnetId) {
      return new Response(JSON.stringify({ characters: [] }), { status: 200, headers });
    }

    const userKey = `bnet_${sessionData.bnetId}`;
    const user = await users.get(userKey, { type: "json" });

    if (!user?.bnetAccessToken) {
      return new Response(JSON.stringify({ characters: [] }), { status: 200, headers });
    }

    // Fetch fresh character data from Battle.net API
    const charsRes = await fetch(
      `${API_BASE}/profile/user/wow?namespace=profile-${BNET_REGION}&locale=de_DE`,
      { headers: { Authorization: `Bearer ${user.bnetAccessToken}` } }
    );

    if (!charsRes.ok) {
      // Token may have expired — return cached characters if available
      if (user.characters?.length) {
        return new Response(JSON.stringify({ characters: user.characters, cached: true }), { status: 200, headers });
      }
      return new Response(JSON.stringify({ characters: [], error: "Battle.net-Token abgelaufen" }), { status: 200, headers });
    }

    const charsData = await charsRes.json();
    const characters = [];
    for (const account of charsData.wow_accounts || []) {
      for (const char of account.characters || []) {
        const germanClass = CLASS_MAP[char.playable_class?.id];
        if (germanClass) {
          characters.push({
            name: char.name,
            realm: char.realm?.name || char.realm?.slug || "",
            className: germanClass,
            level: char.level || 0,
          });
        }
      }
    }
    characters.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

    // Cache characters on user record
    user.characters = characters;
    user.updatedAt = new Date().toISOString();
    await users.setJSON(userKey, user);

    return new Response(JSON.stringify({ characters }), { status: 200, headers });
  } catch (err) {
    console.error("Characters API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/bnet-characters",
};
