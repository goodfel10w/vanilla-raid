import { getStore } from "@netlify/blobs";

// Site-wide admins matched case-insensitively against BattleTag prefix (before #)
const SITE_ADMINS = ["goodfell0w"];

export function isSiteAdmin(username) {
  if (!username) return false;
  const lower = username.toLowerCase();
  return SITE_ADMINS.some(a => lower === a || lower.startsWith(a + "#"));
}

export async function validateSession(req) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  if (!token) return null;

  const sessions = getStore({ name: "sessions", consistency: "strong" });
  const session = await sessions.get(token, { type: "json" });
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    await sessions.delete(token);
    return null;
  }

  return {
    userId: session.userId,
    username: session.username,
    isAdmin: isSiteAdmin(session.username),
  };
}
