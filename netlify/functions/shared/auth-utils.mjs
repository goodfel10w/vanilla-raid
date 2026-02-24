import { getStore } from "@netlify/blobs";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// Site-wide admins matched case-insensitively against BattleTag prefix (before #)
const SITE_ADMINS = ["goodfell0w"];

// ── Token encryption helpers ──
// Encrypts sensitive tokens before storing in blob store.
// Uses AES-256-GCM with a key derived from TOKEN_ENCRYPTION_KEY env var.
// Falls back to plaintext if no key is configured (backward compatible).
function getEncryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plaintext) {
  const key = getEncryptionKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext) prefixed with "enc:" marker
  return "enc:" + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(stored) {
  if (!stored || !stored.startsWith("enc:")) return stored; // plaintext or null
  const key = getEncryptionKey();
  if (!key) return null; // encrypted but no key configured — cannot decrypt
  const buf = Buffer.from(stored.slice(4), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, null, "utf8") + decipher.final("utf8");
}

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
