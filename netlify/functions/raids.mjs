import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession, isSiteAdmin } from "./shared/auth-utils.mjs";
import { buildRaidEmbed, buildRaidButtons } from "./discord.mjs";

// ── Audit log helper ──
async function writeAuditLog(raidId, { action, performedBy, targetPlayer, details }) {
  try {
    const logStore = getStore({ name: "raid-audit-logs", consistency: "strong" });
    const existing = await logStore.get(raidId, { type: "json" }).catch(() => null);
    const logs = Array.isArray(existing) ? existing : [];
    logs.push({
      id: randomUUID(),
      raidId,
      action,
      performedBy: performedBy || "System",
      targetPlayer: targetPlayer || undefined,
      details: details || undefined,
      timestamp: new Date().toISOString(),
    });
    // Keep max 200 entries per raid
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    await logStore.setJSON(raidId, logs);
  } catch (err) {
    console.error("Audit log write failed (non-fatal):", err);
  }
}

// Check if user is a DKP officer or admin (via dkp-config roles)
async function isDkpOfficerOrAdmin(username) {
  if (!username) return false;
  if (isSiteAdmin(username)) return true;
  try {
    const cfgStore = getStore({ name: "dkp-config", consistency: "strong" });
    const cfg = await cfgStore.get("dkp-settings", { type: "json" });
    if (!cfg || !cfg.roles) return false;
    const lower = username.toLowerCase();
    const role = cfg.roles[lower];
    if (role === "admin" || role === "officer") return true;
    const prefix = lower.split("#")[0];
    if (prefix !== lower && cfg.roles[prefix]) {
      const r = cfg.roles[prefix];
      return r === "admin" || r === "officer";
    }
  } catch (_) { /* non-fatal */ }
  return false;
}

// Check if user can manage this raid (owner, site admin, or officer)
async function canManageRaid(user, raid) {
  if (raid.createdBy === user.userId) return true;
  if (user.isAdmin) return true;
  return isDkpOfficerOrAdmin(user.username);
}

// ── Atomic update helper (retry-with-verification to prevent race conditions) ──
// Reads raid, applies updateFn, writes, then re-reads to verify the change stuck.
// If a concurrent write overwrote ours, retries with fresh state.
// updateFn can return { _abort: true, ...rest } to stop without writing (e.g. target not found).
async function atomicUpdate(store, raidId, updateFn, verifyFn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raid = await store.get(raidId, { type: "json" });
    if (!raid) return null;
    if (!raid.signups) raid.signups = [];

    const meta = updateFn(raid);
    if (meta && meta._abort) return { raid, meta, aborted: true };

    await store.setJSON(raidId, raid);

    // Re-read to verify our write wasn't overwritten by a concurrent request
    const fresh = await store.get(raidId, { type: "json" });
    if (verifyFn(fresh)) {
      return { raid: fresh, meta };
    }
    // Verification failed — another concurrent write overwrote ours, retry
  }
  // All retries exhausted
  return null;
}

const VALID_INSTANCES = [
  "Karazhan", "Gruuls Unterschlupf", "Magtheridons Kammer",
  "Höhle des Schlangenschreins", "Festung der Stürme",
  "Hyjalgipfel", "Schwarzer Tempel", "Zul'Aman", "Sonnenbrunnenplateau",
];
const VALID_ROLES = ["Tank", "Heiler", "DPS"];
const VALID_SIGNUP_STATUS = ["accepted", "tentative", "declined", "benched", "confirmed"];
const CLASS_SPECS = {
  "Druide":      [{n:"Balance",r:"DPS"},{n:"Feral Tank",r:"Tank"},{n:"Feral DPS",r:"DPS"},{n:"Resto",r:"Heiler"}],
  "Hexenmeister":[{n:"Affliction",r:"DPS"},{n:"Demonologie",r:"DPS"},{n:"Destruction",r:"DPS"}],
  "Jäger":       [{n:"Beast Mastery",r:"DPS"},{n:"Marksmanship",r:"DPS"},{n:"Survival",r:"DPS"}],
  "Krieger":     [{n:"Prot",r:"Tank"},{n:"Arms",r:"DPS"},{n:"Fury",r:"DPS"}],
  "Magier":      [{n:"Arcane",r:"DPS"},{n:"Fire",r:"DPS"},{n:"Frost",r:"DPS"}],
  "Paladin":     [{n:"Holy",r:"Heiler"},{n:"Prot",r:"Tank"},{n:"Retri",r:"DPS"}],
  "Priester":    [{n:"Disc",r:"Heiler"},{n:"Holy",r:"Heiler"},{n:"Shadow",r:"DPS"}],
  "Schamane":    [{n:"Elemental",r:"DPS"},{n:"Enhancement",r:"DPS"},{n:"Resto",r:"Heiler"}],
  "Schurke":     [{n:"Assassination",r:"DPS"},{n:"Combat",r:"DPS"},{n:"Subtlety",r:"DPS"}],
};

export default async (req) => {
  const store = getStore({ name: "raids", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // GET — list all raids
    if (req.method === "GET") {
      const { blobs } = await store.list();
      const raids = [];
      for (const blob of blobs) {
        const data = await store.get(blob.key, { type: "json" });
        if (data) raids.push(data);
      }
      raids.sort((a, b) => {
        const da = a.date + "T" + a.time;
        const db = b.date + "T" + b.time;
        return da.localeCompare(db);
      });
      return new Response(JSON.stringify(raids), { status: 200, headers });
    }

    // POST — create/update raid OR manage signup
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      const body = await req.json();
      const { action } = body;

      // ── Get audit log for a raid (organizers only) ──
      if (action === "get-log") {
        const { raidId } = body;
        if (!raidId) {
          return new Response(JSON.stringify({ error: "Raid-ID fehlt" }), { status: 400, headers });
        }
        const raid = await store.get(raidId, { type: "json" });
        if (!raid) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, raid)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const logStore = getStore({ name: "raid-audit-logs", consistency: "strong" });
        const logs = await logStore.get(raidId, { type: "json" }).catch(() => []);
        return new Response(JSON.stringify(Array.isArray(logs) ? logs : []), { status: 200, headers });
      }

      // ── Lock / Unlock ──
      if (action === "lock" || action === "unlock") {
        const { raidId } = body;
        if (!raidId) {
          return new Response(JSON.stringify({ error: "Raid-ID fehlt" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const targetLocked = action === "lock";
        const result = await atomicUpdate(
          store, raidId,
          (raid) => { raid.locked = targetLocked; },
          (fresh) => !!fresh.locked === targetLocked,
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        const { raid: updatedRaid } = result;
        writeAuditLog(raidId, {
          action: action === "lock" ? "raid-locked" : "raid-unlocked",
          performedBy: user.username,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Signup ──
      if (action === "signup") {
        const { raidId, charName, className, role, offeredSpecs, status, note } = body;
        if (!raidId || !charName) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        // Validate offeredSpecs if provided
        let validSpecs = [];
        let finalRole = role || "DPS";
        if (Array.isArray(offeredSpecs) && offeredSpecs.length > 0) {
          const classSpecs = CLASS_SPECS[className] || [];
          const validNames = classSpecs.map(s => s.n);
          if (offeredSpecs.some(s => !validNames.includes(s))) {
            return new Response(JSON.stringify({ error: "Ungültige Spezialisierung" }), { status: 400, headers });
          }
          validSpecs = offeredSpecs;
          // Derive role from first offered spec
          const firstSpec = classSpecs.find(s => s.n === offeredSpecs[0]);
          if (firstSpec) finalRole = firstSpec.r;
        } else if (!role || !VALID_ROLES.includes(role)) {
          return new Response(JSON.stringify({ error: "Rolle oder Spezialisierung fehlt" }), { status: 400, headers });
        }
        if (status && !VALID_SIGNUP_STATUS.includes(status)) {
          return new Response(JSON.stringify({ error: "Ungültiger Status" }), { status: 400, headers });
        }
        // Pre-check: raid exists, locked, deadline (before retry loop)
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        const isOrganizer = await canManageRaid(user, preCheck);
        if (preCheck.locked && !isOrganizer) {
          return new Response(JSON.stringify({ error: "Raid ist gesperrt — Anmeldung nicht möglich" }), { status: 403, headers });
        }
        if (preCheck.deadline && !isOrganizer) {
          const now = new Date();
          const dl = new Date(preCheck.deadline);
          if (now > dl) {
            return new Response(JSON.stringify({ error: "Anmeldefrist abgelaufen" }), { status: 403, headers });
          }
        }
        const signup = {
          userId: user.userId,
          username: user.username,
          charName: String(charName).trim().slice(0, 50),
          className: String(className || "").slice(0, 50),
          role: finalRole,
          status: status || "accepted",
          note: String(note || "").trim().slice(0, 200),
          timestamp: new Date().toISOString(),
        };
        if (validSpecs.length) signup.offeredSpecs = validSpecs;
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const prevSignup = raid.signups.find(s => s.userId === user.userId);
            const isResignup = !!prevSignup;
            const prevStatus = prevSignup?.status;
            raid.signups = raid.signups.filter(s => s.userId !== user.userId);
            raid.signups.push(signup);
            return { isResignup, prevStatus };
          },
          (fresh) => fresh.signups?.some(s => s.userId === user.userId),
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Anmeldung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        const { raid: updatedRaid, meta } = result;
        if (meta.isResignup) {
          writeAuditLog(raidId, {
            action: "signup-changed",
            performedBy: user.username,
            targetPlayer: signup.charName,
            details: meta.prevStatus !== signup.status ? `${meta.prevStatus} → ${signup.status}` : undefined,
          });
        } else {
          writeAuditLog(raidId, {
            action: "signup",
            performedBy: user.username,
            targetPlayer: signup.charName,
            details: `${signup.className} / ${signup.status}`,
          });
        }
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Assign Spec (Raid Leader) ──
      if (action === "assign-spec") {
        const { raidId, targetUserId, assignedSpec } = body;
        if (!raidId || !targetUserId) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        // Pre-check permissions
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const signup = raid.signups.find(s => s.userId === targetUserId);
            if (!signup) return { _abort: true, error: "Spieler nicht angemeldet", status: 404 };
            const prevSpec = signup.assignedSpec;
            if (assignedSpec) {
              if (signup.offeredSpecs && !signup.offeredSpecs.includes(assignedSpec)) {
                return { _abort: true, error: "Spec nicht in angebotenen Specs", status: 400 };
              }
              signup.assignedSpec = assignedSpec;
              const classSpecs = CLASS_SPECS[signup.className] || [];
              const sp = classSpecs.find(s => s.n === assignedSpec);
              if (sp) signup.role = sp.r;
            } else {
              delete signup.assignedSpec;
              if (signup.offeredSpecs && signup.offeredSpecs.length) {
                const classSpecs = CLASS_SPECS[signup.className] || [];
                const sp = classSpecs.find(s => s.n === signup.offeredSpecs[0]);
                if (sp) signup.role = sp.r;
              }
            }
            return { charName: signup.charName, prevSpec };
          },
          (fresh) => {
            const s = fresh.signups?.find(s => s.userId === targetUserId);
            if (!s) return false;
            return assignedSpec ? s.assignedSpec === assignedSpec : !s.assignedSpec;
          },
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        if (result.aborted) {
          return new Response(JSON.stringify({ error: result.meta.error }), { status: result.meta.status || 400, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "assign-spec",
          performedBy: user.username,
          targetPlayer: meta.charName,
          details: assignedSpec ? `${meta.prevSpec || '–'} → ${assignedSpec}` : "Zuweisung entfernt",
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Unsignup ──
      if (action === "unsignup") {
        const { raidId } = body;
        if (!raidId) {
          return new Response(JSON.stringify({ error: "Raid-ID fehlt" }), { status: 400, headers });
        }
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const removed = raid.signups.find(s => s.userId === user.userId);
            raid.signups = raid.signups.filter(s => s.userId !== user.userId);
            return { removedCharName: removed?.charName || user.username };
          },
          (fresh) => !fresh.signups?.some(s => s.userId === user.userId),
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Abmeldung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "unsignup",
          performedBy: user.username,
          targetPlayer: meta.removedCharName,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Organizer: bench a player ──
      if (action === "bench") {
        const { raidId, targetUserId } = body;
        if (!raidId || !targetUserId) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const signup = raid.signups.find(s => s.userId === targetUserId);
            if (!signup) return { _abort: true, error: "Spieler nicht angemeldet", status: 404 };
            signup.status = "benched";
            signup.benchedBy = user.username;
            return { charName: signup.charName };
          },
          (fresh) => fresh.signups?.find(s => s.userId === targetUserId)?.status === "benched",
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        if (result.aborted) {
          return new Response(JSON.stringify({ error: result.meta.error }), { status: result.meta.status || 400, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "bench",
          performedBy: user.username,
          targetPlayer: meta.charName,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Organizer: confirm a player ──
      if (action === "confirm") {
        const { raidId, targetUserId } = body;
        if (!raidId || !targetUserId) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const signup = raid.signups.find(s => s.userId === targetUserId);
            if (!signup) return { _abort: true, error: "Spieler nicht angemeldet", status: 404 };
            signup.status = "confirmed";
            return { charName: signup.charName };
          },
          (fresh) => fresh.signups?.find(s => s.userId === targetUserId)?.status === "confirmed",
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        if (result.aborted) {
          return new Response(JSON.stringify({ error: result.meta.error }), { status: result.meta.status || 400, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "confirm",
          performedBy: user.username,
          targetPlayer: meta.charName,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Organizer: unconfirm a player (back to accepted) ──
      if (action === "unconfirm") {
        const { raidId, targetUserId } = body;
        if (!raidId || !targetUserId) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const signup = raid.signups.find(s => s.userId === targetUserId);
            if (!signup) return { _abort: true, error: "Spieler nicht angemeldet", status: 404 };
            signup.status = "accepted";
            return { charName: signup.charName };
          },
          (fresh) => fresh.signups?.find(s => s.userId === targetUserId)?.status === "accepted",
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        if (result.aborted) {
          return new Response(JSON.stringify({ error: result.meta.error }), { status: result.meta.status || 400, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "unconfirm",
          performedBy: user.username,
          targetPlayer: meta.charName,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Organizer: confirm entire lineup suggestion ──
      if (action === "confirm-lineup") {
        const { raidId, userIds } = body;
        if (!raidId || !Array.isArray(userIds)) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const idSet = new Set(userIds);
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const confirmedNames = [];
            for (const signup of raid.signups) {
              if (idSet.has(signup.userId)) {
                signup.status = "confirmed";
                confirmedNames.push(signup.charName);
              }
            }
            return { confirmedNames };
          },
          (fresh) => {
            if (!fresh.signups) return false;
            return userIds.every(uid => {
              const s = fresh.signups.find(s => s.userId === uid);
              return !s || s.status === "confirmed";
            });
          },
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "confirm-lineup",
          performedBy: user.username,
          details: `${meta.confirmedNames.length} Spieler bestaetigt`,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Organizer: remove a player from raid ──
      if (action === "remove-signup") {
        const { raidId, targetUserId } = body;
        if (!raidId || !targetUserId) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            const removedPlayer = raid.signups.find(s => s.userId === targetUserId);
            raid.signups = raid.signups.filter(s => s.userId !== targetUserId);
            return { removedCharName: removedPlayer?.charName || targetUserId };
          },
          (fresh) => !fresh.signups?.some(s => s.userId === targetUserId),
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        const { raid: updatedRaid, meta } = result;
        writeAuditLog(raidId, {
          action: "remove-signup",
          performedBy: user.username,
          targetPlayer: meta.removedCharName,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Organizer: sign up another player ──
      if (action === "signup-other") {
        const { raidId, charName, className, role, status, note, targetUserId } = body;
        if (!raidId || !charName || !role) {
          return new Response(JSON.stringify({ error: "Felder fehlen" }), { status: 400, headers });
        }
        const preCheck = await store.get(raidId, { type: "json" });
        if (!preCheck) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, preCheck)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        if (!VALID_ROLES.includes(role)) {
          return new Response(JSON.stringify({ error: "Ungültige Rolle" }), { status: 400, headers });
        }
        if (status && !VALID_SIGNUP_STATUS.includes(status)) {
          return new Response(JSON.stringify({ error: "Ungültiger Status" }), { status: 400, headers });
        }
        const uid = targetUserId || ("manual-" + randomUUID());
        const cleanCharName = String(charName).trim().slice(0, 50);
        const result = await atomicUpdate(
          store, raidId,
          (raid) => {
            raid.signups = raid.signups.filter(s => s.userId !== uid);
            raid.signups.push({
              userId: uid,
              username: "",
              charName: cleanCharName,
              className: String(className || "").slice(0, 50),
              role,
              status: status || "accepted",
              note: String(note || "").trim().slice(0, 200),
              addedBy: user.username,
              timestamp: new Date().toISOString(),
            });
          },
          (fresh) => fresh.signups?.some(s => s.userId === uid),
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Anmeldung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        const { raid: updatedRaid } = result;
        writeAuditLog(raidId, {
          action: "signup-other",
          performedBy: user.username,
          targetPlayer: cleanCharName,
          details: `${className || ""} / ${role}`,
        });
        autoUpdateDiscord(raidId, updatedRaid);
        return new Response(JSON.stringify(updatedRaid), { status: 200, headers });
      }

      // ── Create or Update Raid ──
      const { instance, date, time, maxPlayers, notes, description, deadline } = body;

      if (!instance || !date || !time) {
        return new Response(JSON.stringify({ error: "Felder fehlen (Instanz, Datum, Uhrzeit)" }), { status: 400, headers });
      }
      if (!VALID_INSTANCES.includes(instance)) {
        return new Response(JSON.stringify({ error: "Ungültige Instanz" }), { status: 400, headers });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: "Ungültiges Datum" }), { status: 400, headers });
      }
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: "Ungültige Uhrzeit" }), { status: 400, headers });
      }
      const mp = parseInt(maxPlayers) || 25;
      if (mp < 1 || mp > 40) {
        return new Response(JSON.stringify({ error: "Max. Spieler muss zwischen 1 und 40 liegen" }), { status: 400, headers });
      }
      if (notes != null && typeof notes === "string" && notes.length > 500) {
        return new Response(JSON.stringify({ error: "Anmerkungen zu lang" }), { status: 400, headers });
      }
      if (description != null && typeof description === "string" && description.length > 2000) {
        return new Response(JSON.stringify({ error: "Beschreibung zu lang (max. 2000 Zeichen)" }), { status: 400, headers });
      }
      // Validate deadline (optional datetime string)
      let cleanDeadline = null;
      if (deadline && typeof deadline === "string" && deadline.trim()) {
        const dlDate = new Date(deadline);
        if (isNaN(dlDate.getTime())) {
          return new Response(JSON.stringify({ error: "Ungültige Anmeldefrist" }), { status: 400, headers });
        }
        cleanDeadline = dlDate.toISOString();
      }

      let id;
      let existingLocked = false;
      if (body.id && typeof body.id === "string") {
        const existing = await store.get(body.id, { type: "json" });
        if (!existing) {
          return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
        }
        if (!await canManageRaid(user, existing)) {
          return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
        }
        id = body.id;
        existingLocked = existing.locked || false;
      } else {
        id = randomUUID();
      }

      if (body.id) {
        // Update existing raid: use atomicUpdate to preserve concurrent signups
        const result = await atomicUpdate(
          store, id,
          (raid) => {
            raid.instance = instance;
            raid.date = date;
            raid.time = time;
            raid.maxPlayers = mp;
            raid.deadline = cleanDeadline || undefined;
            raid.locked = existingLocked || undefined;
            raid.notes = (notes || "").trim().slice(0, 500);
            raid.description = (description || "").trim().slice(0, 2000);
            raid.createdBy = user.userId;
            raid.createdByName = user.username;
            raid.timestamp = new Date().toISOString();
          },
          (fresh) => fresh.instance === instance && fresh.date === date && fresh.time === time,
        );
        if (!result) {
          return new Response(JSON.stringify({ error: "Aenderung fehlgeschlagen, bitte erneut versuchen" }), { status: 409, headers });
        }
        autoUpdateDiscord(id, result.raid);
        return new Response(JSON.stringify(result.raid), { status: 200, headers });
      } else {
        // Create new raid
        const raid = {
          id,
          instance,
          date,
          time,
          maxPlayers: mp,
          deadline: cleanDeadline || undefined,
          notes: (notes || "").trim().slice(0, 500),
          description: (description || "").trim().slice(0, 2000),
          createdBy: user.userId,
          createdByName: user.username,
          signups: [],
          timestamp: new Date().toISOString(),
        };
        await store.setJSON(id, raid);
        return new Response(JSON.stringify(raid), { status: 200, headers });
      }
    }

    // DELETE — remove raid
    if (req.method === "DELETE") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "ID fehlt" }), { status: 400, headers });
      }
      const existing = await store.get(id, { type: "json" });
      if (existing && existing.createdBy && !await canManageRaid(user, existing)) {
        return new Response(JSON.stringify({ error: "Keine Berechtigung" }), { status: 403, headers });
      }
      await store.delete(id);
      // Clean up Discord message mapping and audit logs
      try {
        const discordStore = getStore({ name: "discord-messages", consistency: "strong" });
        await discordStore.delete(id);
      } catch (_) { /* non-fatal */ }
      try {
        const logStore = getStore({ name: "raid-audit-logs", consistency: "strong" });
        await logStore.delete(id);
      } catch (_) { /* non-fatal */ }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("Raids API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

// Fire-and-forget Discord embed update when a raid changes
async function autoUpdateDiscord(raidId, raid) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const discordStore = getStore({ name: "discord-messages", consistency: "strong" });
    const mapping = await discordStore.get(raidId, { type: "json" });
    if (!mapping?.messageId) return;

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const embed = buildRaidEmbed(raid, siteUrl);
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const buttons = buildRaidButtons(raidId, raid.locked);

    let res;
    if (botToken && mapping.channelId) {
      // Update via bot API (preserves interactive buttons)
      res = await fetch(`https://discord.com/api/v10/channels/${mapping.channelId}/messages/${mapping.messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({ embeds: [embed], components: buttons }),
      });
    } else {
      res = await fetch(`${webhookUrl}/messages/${mapping.messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }

    if (res.status === 404) {
      await discordStore.delete(raidId);
    } else if (res.ok) {
      mapping.updatedAt = new Date().toISOString();
      await discordStore.setJSON(raidId, mapping);
    }
  } catch (err) {
    console.error("Auto-update Discord failed (non-fatal):", err);
  }
}

export const config = {
  path: "/api/raids",
};
