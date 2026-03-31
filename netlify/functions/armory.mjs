import { getStore } from "@netlify/blobs";

const BNET_REGION = process.env.BNET_REGION || "eu";
const BNET_REALM = process.env.BNET_REALM || "thunderstrike";
const OAUTH_BASE = `https://${BNET_REGION}.battle.net/oauth`;
const API_BASE = `https://${BNET_REGION}.api.blizzard.com`;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// English WoW class ID → German class name
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

// In-memory cache for client credentials token (lives as long as the function instance)
let cachedAppToken = null;
let appTokenExpiresAt = 0;

async function getAppToken() {
  if (cachedAppToken && Date.now() < appTokenExpiresAt) {
    return cachedAppToken;
  }

  const clientId = process.env.BNET_CLIENT_ID;
  const clientSecret = process.env.BNET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Battle.net credentials not configured");
  }

  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedAppToken = data.access_token;
  // Expire 5 minutes early to avoid edge cases
  appTokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return cachedAppToken;
}

async function fetchBlizzardApi(path, token) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${separator}namespace=profile-classic-${BNET_REGION}&locale=de_DE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function mapEquipment(equipData) {
  if (!equipData?.equipped_items) return [];
  return equipData.equipped_items.map((item) => ({
    slot: item.slot?.type || item.slot?.name || "unknown",
    slotName: item.slot?.name || item.slot?.type || "",
    name: item.name || "",
    quality: item.quality?.type || "COMMON",
    qualityName: item.quality?.name || "",
    itemLevel: item.level?.value || 0,
    itemId: item.item?.id || 0,
  }));
}

function mapProfile(profileData, equipmentItems) {
  const avgIlvl =
    equipmentItems.length > 0
      ? Math.round(
          equipmentItems.reduce((sum, i) => sum + i.itemLevel, 0) /
            equipmentItems.length
        )
      : 0;

  return {
    name: profileData.name,
    level: profileData.level || 0,
    className: CLASS_MAP[profileData.character_class?.id] || profileData.character_class?.name || "",
    classId: profileData.character_class?.id || 0,
    race: profileData.race?.name || "",
    gender: profileData.gender?.name || "",
    guild: profileData.guild?.name || null,
    realm: profileData.realm?.name || BNET_REALM,
    realmSlug: profileData.realm?.slug || BNET_REALM,
    faction: profileData.faction?.name || "",
    averageItemLevel: avgIlvl,
    equipment: equipmentItems,
    lastUpdated: new Date().toISOString(),
  };
}

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  const url = new URL(req.url);
  const charName = url.searchParams.get("name");
  const realm = url.searchParams.get("realm") || BNET_REALM;

  if (!charName) {
    return new Response(
      JSON.stringify({ error: "Parameter 'name' is required" }),
      { status: 400, headers }
    );
  }

  // Blizzard API expects lowercase character name and realm slug
  const nameLower = charName.toLowerCase();
  const realmSlug = realm.toLowerCase().replace(/\s+/g, "-");
  const cacheKey = `${realmSlug}_${nameLower}`;

  try {
    // Check blob cache first
    const cache = getStore({ name: "armory-cache", consistency: "strong" });
    const cached = await cache.get(cacheKey, { type: "json" }).catch(() => null);

    if (cached && Date.now() - new Date(cached.lastUpdated).getTime() < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached), { status: 200, headers });
    }

    // Fetch from Blizzard API
    const token = await getAppToken();

    const [profileData, equipData] = await Promise.all([
      fetchBlizzardApi(`/profile/wow/character/${realmSlug}/${nameLower}`, token),
      fetchBlizzardApi(`/profile/wow/character/${realmSlug}/${nameLower}/equipment`, token),
    ]);

    if (!profileData) {
      return new Response(
        JSON.stringify({ error: "Charakter nicht gefunden" }),
        { status: 404, headers }
      );
    }

    const equipmentItems = mapEquipment(equipData);
    const profile = mapProfile(profileData, equipmentItems);

    // Cache the result
    await cache.setJSON(cacheKey, profile).catch(() => {});

    return new Response(JSON.stringify(profile), { status: 200, headers });
  } catch (err) {
    console.error("Armory API error:", err);
    return new Response(
      JSON.stringify({ error: "Fehler beim Abrufen der Armory-Daten" }),
      { status: 500, headers }
    );
  }
};

export const config = {
  path: "/api/armory",
};
