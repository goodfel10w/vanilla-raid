import { getStore } from "@netlify/blobs";
import { validateSession, isSiteAdmin } from "./shared/auth-utils.mjs";

const DKP_CONFIG_KEY = "dkp-settings";

async function loadRoles() {
  const configStore = getStore({ name: "dkp-config", consistency: "strong" });
  const cfg = await configStore.get(DKP_CONFIG_KEY, { type: "json" });
  return cfg?.roles || {};
}

function getUserRole(username, roles) {
  if (!username) return null;
  const lower = username.toLowerCase();
  if (roles[lower]) return roles[lower];
  const prefix = lower.split("#")[0];
  if (prefix !== lower && roles[prefix]) return roles[prefix];
  return null;
}

function hasAdminAccess(username, roles) {
  if (isSiteAdmin(username)) return true;
  const role = getUserRole(username, roles);
  return role === "admin" || role === "officer";
}

export default async (req) => {
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const user = await validateSession(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
  }

  const roles = await loadRoles();

  if (!hasAdminAccess(user.username, roles)) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
  }

  try {
    // GET — list all registered users
    if (req.method === "GET") {
      const users = getStore({ name: "users", consistency: "strong" });
      const { blobs } = await users.list();
      const userList = [];
      for (const blob of blobs) {
        const data = await users.get(blob.key, { type: "json" });
        if (data) {
          const uname = data.username || data.battleTag || "";
          userList.push({
            id: data.id,
            username: uname,
            battleTag: data.battleTag || uname,
            bnetId: data.bnetId || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            role: getUserRole(uname, roles) || null,
            isSiteAdmin: isSiteAdmin(uname),
          });
        }
      }
      userList.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
      return new Response(JSON.stringify({ users: userList }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("Admin API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/admin",
};
