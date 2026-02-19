import { getStore } from "@netlify/blobs";

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

  return { userId: session.userId, username: session.username };
}
