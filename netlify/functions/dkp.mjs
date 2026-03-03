import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession, isSiteAdmin } from "./shared/auth-utils.mjs";

const DEFAULT_CONFIG = {
  roles: { "goodfell0w": "admin" },
  defaultDecayPercent: 50,
  maxDkpAmount: 10000,
  allowNegativeBalance: false,
  startingBalance: 0,
  transactionLimit: 50,
  reasonMaxLength: 200,
  minBid: 5,
  raidAttendanceDkp: 10,
  raidPartialDkp: 5,
  raidBenchDkp: 10,
  bossKillDkp: 5,
  startingBonus: 20,
};

const CONFIG_KEY = "dkp-settings";

async function loadConfig(configStore) {
  const stored = await configStore.get(CONFIG_KEY, { type: "json" });
  const cfg = { ...DEFAULT_CONFIG, ...(stored || {}) };

  // Migration: convert legacy adminUsername to roles map
  if (cfg.adminUsername && (!cfg.roles || Object.keys(cfg.roles).length === 0)) {
    cfg.roles = { [cfg.adminUsername.toLowerCase()]: "admin" };
    delete cfg.adminUsername;
    await configStore.setJSON(CONFIG_KEY, cfg);
  }
  delete cfg.adminUsername; // never expose legacy field

  // Bootstrap: ensure default admin exists when roles are empty
  if (!cfg.roles || Object.keys(cfg.roles).length === 0) {
    cfg.roles = { ...DEFAULT_CONFIG.roles };
    await configStore.setJSON(CONFIG_KEY, cfg);
  }

  return cfg;
}

function getRole(username, cfg) {
  if (!username || !cfg.roles) return null;
  const lower = username.toLowerCase();
  // Exact match first (full BattleTag or plain name)
  if (cfg.roles[lower]) return cfg.roles[lower];
  // Prefix match: "goodfell0w" matches "goodfell0w#12345"
  const prefix = lower.split("#")[0];
  if (prefix !== lower && cfg.roles[prefix]) return cfg.roles[prefix];
  return null;
}

function isAdmin(username, cfg) {
  if (isSiteAdmin(username)) return true;
  return getRole(username, cfg) === "admin";
}

function hasAccess(username, cfg) {
  if (isSiteAdmin(username)) return true;
  const role = getRole(username, cfg);
  return role === "admin" || role === "officer";
}

export default async (req, context) => {
  const balanceStore = getStore({ name: "dkp-balances", consistency: "strong" });
  const txStore = getStore({ name: "dkp-transactions", consistency: "strong" });
  const configStore = getStore({ name: "dkp-config", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const cfg = await loadConfig(configStore);

    // GET — list balances, transactions, config
    if (req.method === "GET") {
      const url = new URL(req.url);
      const playerFilter = url.searchParams.get("player");

      const { blobs: balBlobs } = await balanceStore.list();
      const balances = [];
      for (const blob of balBlobs) {
        const data = await balanceStore.get(blob.key, { type: "json" });
        if (data) balances.push(data);
      }
      balances.sort((a, b) => b.balance - a.balance);

      const { blobs: txBlobs } = await txStore.list();
      const transactions = [];
      for (const blob of txBlobs) {
        const data = await txStore.get(blob.key, { type: "json" });
        if (data) transactions.push(data);
      }
      transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // If player filter, return all transactions for that player
      if (playerFilter) {
        const playerTx = transactions.filter(
          (t) => t.playerName.toLowerCase() === playerFilter.toLowerCase()
        );
        return new Response(JSON.stringify({ transactions: playerTx }), { status: 200, headers });
      }

      const limit = cfg.transactionLimit || 50;
      return new Response(
        JSON.stringify({ balances, transactions: transactions.slice(0, limit), config: cfg }),
        { status: 200, headers }
      );
    }

    // POST — various DKP actions
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }

      const body = await req.json();
      const { action } = body;

      // ── Save config — admin only ──
      if (action === "save-config") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Einstellungen ändern" }),
            { status: 403, headers }
          );
        }

        const newCfg = { ...cfg };
        if (body.defaultDecayPercent !== undefined) {
          const v = Number(body.defaultDecayPercent);
          if (v >= 1 && v <= 100) newCfg.defaultDecayPercent = v;
        }
        if (body.maxDkpAmount !== undefined) {
          const v = Number(body.maxDkpAmount);
          if (v >= 1 && v <= 100000) newCfg.maxDkpAmount = v;
        }
        if (body.allowNegativeBalance !== undefined) {
          newCfg.allowNegativeBalance = !!body.allowNegativeBalance;
        }
        if (body.startingBalance !== undefined) {
          const v = Number(body.startingBalance);
          if (v >= 0 && v <= 100000) newCfg.startingBalance = v;
        }
        if (body.transactionLimit !== undefined) {
          const v = Number(body.transactionLimit);
          if (v >= 10 && v <= 500) newCfg.transactionLimit = v;
        }
        if (body.reasonMaxLength !== undefined) {
          const v = Number(body.reasonMaxLength);
          if (v >= 50 && v <= 500) newCfg.reasonMaxLength = v;
        }
        if (body.minBid !== undefined) {
          const v = Number(body.minBid);
          if (v >= 1 && v <= 1000) newCfg.minBid = v;
        }
        if (body.raidAttendanceDkp !== undefined) {
          const v = Number(body.raidAttendanceDkp);
          if (v >= 0 && v <= 1000) newCfg.raidAttendanceDkp = v;
        }
        if (body.raidPartialDkp !== undefined) {
          const v = Number(body.raidPartialDkp);
          if (v >= 0 && v <= 1000) newCfg.raidPartialDkp = v;
        }
        if (body.raidBenchDkp !== undefined) {
          const v = Number(body.raidBenchDkp);
          if (v >= 0 && v <= 1000) newCfg.raidBenchDkp = v;
        }
        if (body.bossKillDkp !== undefined) {
          const v = Number(body.bossKillDkp);
          if (v >= 0 && v <= 1000) newCfg.bossKillDkp = v;
        }
        if (body.startingBonus !== undefined) {
          const v = Number(body.startingBonus);
          if (v >= 0 && v <= 10000) newCfg.startingBonus = v;
        }

        await configStore.setJSON(CONFIG_KEY, newCfg);
        return new Response(JSON.stringify({ ok: true, config: newCfg }), { status: 200, headers });
      }

      // ── Manage roles — admin only ──
      if (action === "manage-roles") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Rollen verwalten" }),
            { status: 403, headers }
          );
        }

        const { username, role, remove } = body;
        if (!username || typeof username !== "string" || username.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: "Benutzername erforderlich" }),
            { status: 400, headers }
          );
        }

        const key = username.trim().toLowerCase();
        const newCfg = { ...cfg, roles: { ...cfg.roles } };

        if (remove) {
          // Prevent removing yourself as admin
          if (key === user.username.toLowerCase()) {
            return new Response(
              JSON.stringify({ error: "Du kannst dich nicht selbst entfernen" }),
              { status: 400, headers }
            );
          }
          delete newCfg.roles[key];
        } else {
          if (role !== "admin" && role !== "officer") {
            return new Response(
              JSON.stringify({ error: "Ungültige Rolle (admin oder officer)" }),
              { status: 400, headers }
            );
          }
          // Prevent demoting yourself from admin
          if (key === user.username.toLowerCase() && role !== "admin") {
            return new Response(
              JSON.stringify({ error: "Du kannst dich nicht selbst herunterstufen" }),
              { status: 400, headers }
            );
          }
          newCfg.roles[key] = role;
        }

        // Ensure at least one admin remains
        const adminCount = Object.values(newCfg.roles).filter((r) => r === "admin").length;
        if (adminCount === 0) {
          return new Response(
            JSON.stringify({ error: "Es muss mindestens ein Admin existieren" }),
            { status: 400, headers }
          );
        }

        await configStore.setJSON(CONFIG_KEY, newCfg);
        return new Response(JSON.stringify({ ok: true, config: newCfg }), { status: 200, headers });
      }

      // ── Undo transaction — admin only ──
      if (action === "undo") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Transaktionen rückgängig machen" }),
            { status: 403, headers }
          );
        }

        const { transactionId } = body;
        if (!transactionId) {
          return new Response(
            JSON.stringify({ error: "Transaktions-ID erforderlich" }),
            { status: 400, headers }
          );
        }

        const tx = await txStore.get(transactionId, { type: "json" });
        if (!tx) {
          return new Response(
            JSON.stringify({ error: "Transaktion nicht gefunden" }),
            { status: 404, headers }
          );
        }

        // Reverse the balance change
        const key = tx.playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (existing) {
          existing.balance -= tx.amount; // subtract what was added (or add back what was subtracted)
          existing.lastUpdated = new Date().toISOString();
          await balanceStore.setJSON(key, existing);
        }

        // Delete the transaction
        await txStore.delete(transactionId);

        return new Response(
          JSON.stringify({ ok: true, reversed: tx, balance: existing }),
          { status: 200, headers }
        );
      }

      // ── Award / Spend / Decay require at least officer ──
      if (!hasAccess(user.username, cfg)) {
        return new Response(
          JSON.stringify({ error: "Nur Admins und Offiziere dürfen DKP verwalten" }),
          { status: 403, headers }
        );
      }

      const maxReason = cfg.reasonMaxLength || 200;

      // ── Award DKP to players ──
      if (action === "award") {
        const { players, amount, reason } = body;
        if (!Array.isArray(players) || players.length === 0) {
          return new Response(
            JSON.stringify({ error: "Mindestens ein Spieler erforderlich" }),
            { status: 400, headers }
          );
        }
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0 || parsedAmount > cfg.maxDkpAmount) {
          return new Response(
            JSON.stringify({
              error: `Betrag muss zwischen 1 und ${cfg.maxDkpAmount.toLocaleString("de-DE")} liegen`,
            }),
            { status: 400, headers }
          );
        }
        if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > maxReason) {
          return new Response(
            JSON.stringify({ error: `Grund erforderlich (max. ${maxReason} Zeichen)` }),
            { status: 400, headers }
          );
        }

        for (const p of players) {
          if (!p.name || typeof p.name !== "string" || p.name.trim().length === 0) {
            return new Response(
              JSON.stringify({ error: "Ungültiger Spielername" }),
              { status: 400, headers }
            );
          }
        }

        const results = [];
        for (const p of players) {
          const key = p.name.trim().toLowerCase();
          const existing = (await balanceStore.get(key, { type: "json" })) || {
            playerName: p.name.trim(),
            className: p.className || "",
            balance: cfg.startingBalance,
            hasReceivedStartingBonus: false,
          };
          existing.playerName = p.name.trim();
          if (p.className) existing.className = p.className;
          existing.balance += parsedAmount;
          existing.lastUpdated = new Date().toISOString();
          await balanceStore.setJSON(key, existing);

          const txId = randomUUID();
          await txStore.setJSON(txId, {
            id: txId,
            playerName: p.name.trim(),
            type: "earn",
            amount: parsedAmount,
            reason: reason.trim().slice(0, maxReason),
            createdBy: user.username,
            timestamp: new Date().toISOString(),
          });
          results.push(existing);
        }

        return new Response(JSON.stringify({ ok: true, balances: results }), { status: 200, headers });
      }

      // ── Spend DKP (loot distribution) ──
      if (action === "spend") {
        const { playerName, amount, itemName } = body;
        if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: "Spieler erforderlich" }),
            { status: 400, headers }
          );
        }
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0 || parsedAmount > cfg.maxDkpAmount) {
          return new Response(
            JSON.stringify({
              error: `Betrag muss zwischen 1 und ${cfg.maxDkpAmount.toLocaleString("de-DE")} liegen`,
            }),
            { status: 400, headers }
          );
        }

        const key = playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Spieler nicht im DKP-System gefunden" }),
            { status: 404, headers }
          );
        }

        if (!cfg.allowNegativeBalance && existing.balance - parsedAmount < 0) {
          return new Response(
            JSON.stringify({
              error: `Nicht genug DKP (${existing.balance} vorhanden, ${parsedAmount} benötigt)`,
            }),
            { status: 400, headers }
          );
        }

        existing.balance -= parsedAmount;
        existing.lastUpdated = new Date().toISOString();
        await balanceStore.setJSON(key, existing);

        const txId = randomUUID();
        await txStore.setJSON(txId, {
          id: txId,
          playerName: playerName.trim(),
          type: "spend",
          amount: -parsedAmount,
          reason: (itemName || "Loot").trim().slice(0, maxReason),
          createdBy: user.username,
          timestamp: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ ok: true, balance: existing }), { status: 200, headers });
      }

      // ── Decay — admin only ──
      if (action === "decay") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen den Verfall anwenden" }),
            { status: 403, headers }
          );
        }

        const percent = Number(body.percent);
        if (!percent || percent <= 0 || percent > 100) {
          return new Response(
            JSON.stringify({ error: "Prozent muss zwischen 1 und 100 liegen" }),
            { status: 400, headers }
          );
        }

        const { blobs } = await balanceStore.list();
        const results = [];
        for (const blob of blobs) {
          const data = await balanceStore.get(blob.key, { type: "json" });
          if (!data) continue;
          const decayAmount = Math.round(data.balance * percent / 100);
          if (decayAmount === 0) {
            results.push(data);
            continue;
          }

          data.balance -= decayAmount;
          data.lastUpdated = new Date().toISOString();
          await balanceStore.setJSON(blob.key, data);

          const txId = randomUUID();
          await txStore.setJSON(txId, {
            id: txId,
            playerName: data.playerName,
            type: "decay",
            amount: -decayAmount,
            reason: `${percent}% Verfall`,
            createdBy: user.username,
            timestamp: new Date().toISOString(),
          });
          results.push(data);
        }

        return new Response(JSON.stringify({ ok: true, balances: results }), { status: 200, headers });
      }

      // ── Edit transaction — admin only ──
      if (action === "edit-transaction") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Transaktionen bearbeiten" }),
            { status: 403, headers }
          );
        }

        const { transactionId, amount, reason } = body;
        if (!transactionId) {
          return new Response(
            JSON.stringify({ error: "Transaktions-ID erforderlich" }),
            { status: 400, headers }
          );
        }

        const tx = await txStore.get(transactionId, { type: "json" });
        if (!tx) {
          return new Response(
            JSON.stringify({ error: "Transaktion nicht gefunden" }),
            { status: 404, headers }
          );
        }

        const oldAmount = tx.amount;
        let newAmount = oldAmount;

        if (amount !== undefined) {
          const parsed = Number(amount);
          if (isNaN(parsed) || parsed === 0) {
            return new Response(
              JSON.stringify({ error: "Ungültiger Betrag" }),
              { status: 400, headers }
            );
          }
          // For spend/decay, amount is stored negative; for earn, positive
          if (tx.type === "earn") {
            if (parsed <= 0 || parsed > cfg.maxDkpAmount) {
              return new Response(
                JSON.stringify({ error: `Betrag muss zwischen 1 und ${cfg.maxDkpAmount} liegen` }),
                { status: 400, headers }
              );
            }
            newAmount = parsed;
          } else {
            if (parsed <= 0 || parsed > cfg.maxDkpAmount) {
              return new Response(
                JSON.stringify({ error: `Betrag muss zwischen 1 und ${cfg.maxDkpAmount} liegen` }),
                { status: 400, headers }
              );
            }
            newAmount = -parsed;
          }
        }

        if (reason !== undefined) {
          if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > maxReason) {
            return new Response(
              JSON.stringify({ error: `Grund erforderlich (max. ${maxReason} Zeichen)` }),
              { status: 400, headers }
            );
          }
          tx.reason = reason.trim().slice(0, maxReason);
        }

        // Adjust player balance by the difference
        if (newAmount !== oldAmount) {
          const diff = newAmount - oldAmount;
          const key = tx.playerName.trim().toLowerCase();
          const existing = await balanceStore.get(key, { type: "json" });
          if (existing) {
            existing.balance += diff;
            existing.lastUpdated = new Date().toISOString();
            await balanceStore.setJSON(key, existing);
          }
          tx.amount = newAmount;
        }

        tx.editedBy = user.username;
        tx.editedAt = new Date().toISOString();
        await txStore.setJSON(transactionId, tx);

        return new Response(
          JSON.stringify({ ok: true, transaction: tx }),
          { status: 200, headers }
        );
      }

      // ── Delete transaction — admin only ──
      if (action === "delete-transaction") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Transaktionen löschen" }),
            { status: 403, headers }
          );
        }

        const { transactionId } = body;
        if (!transactionId) {
          return new Response(
            JSON.stringify({ error: "Transaktions-ID erforderlich" }),
            { status: 400, headers }
          );
        }

        const tx = await txStore.get(transactionId, { type: "json" });
        if (!tx) {
          return new Response(
            JSON.stringify({ error: "Transaktion nicht gefunden" }),
            { status: 404, headers }
          );
        }

        // Reverse the balance change
        const key = tx.playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (existing) {
          existing.balance -= tx.amount;
          existing.lastUpdated = new Date().toISOString();
          await balanceStore.setJSON(key, existing);
        }

        await txStore.delete(transactionId);

        return new Response(
          JSON.stringify({ ok: true, reversed: tx, balance: existing }),
          { status: 200, headers }
        );
      }

      // ── Adjust balance — admin only ──
      if (action === "adjust-balance") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Bilanzen anpassen" }),
            { status: 403, headers }
          );
        }

        const { playerName, newBalance, reason } = body;
        if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: "Spieler erforderlich" }),
            { status: 400, headers }
          );
        }

        const parsedBalance = Number(newBalance);
        if (isNaN(parsedBalance)) {
          return new Response(
            JSON.stringify({ error: "Ungültiger Betrag" }),
            { status: 400, headers }
          );
        }

        const key = playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Spieler nicht im DKP-System gefunden" }),
            { status: 404, headers }
          );
        }

        const diff = parsedBalance - existing.balance;
        existing.balance = parsedBalance;
        existing.lastUpdated = new Date().toISOString();
        await balanceStore.setJSON(key, existing);

        // Log the adjustment as a transaction
        const txId = randomUUID();
        await txStore.setJSON(txId, {
          id: txId,
          playerName: playerName.trim(),
          type: "adjust",
          amount: diff,
          reason: ((reason || "Manuelle Anpassung").trim()).slice(0, maxReason),
          createdBy: user.username,
          timestamp: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ ok: true, balance: existing }),
          { status: 200, headers }
        );
      }

      // ── Edit player — admin only ──
      if (action === "edit-player") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Spieler bearbeiten" }),
            { status: 403, headers }
          );
        }

        const { playerName, newName, newClassName } = body;
        if (!playerName || typeof playerName !== "string") {
          return new Response(
            JSON.stringify({ error: "Spieler erforderlich" }),
            { status: 400, headers }
          );
        }

        const key = playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Spieler nicht im DKP-System gefunden" }),
            { status: 404, headers }
          );
        }

        if (newClassName !== undefined) {
          existing.className = newClassName;
        }

        if (newName && newName.trim() !== playerName.trim()) {
          const newKey = newName.trim().toLowerCase();
          // Check target doesn't already exist
          const conflict = await balanceStore.get(newKey, { type: "json" });
          if (conflict) {
            return new Response(
              JSON.stringify({ error: "Ein Spieler mit diesem Namen existiert bereits" }),
              { status: 400, headers }
            );
          }

          existing.playerName = newName.trim();
          existing.lastUpdated = new Date().toISOString();
          await balanceStore.setJSON(newKey, existing);
          await balanceStore.delete(key);

          // Update all transactions for this player
          const { blobs: txBlobs } = await txStore.list();
          for (const blob of txBlobs) {
            const tx = await txStore.get(blob.key, { type: "json" });
            if (tx && tx.playerName.trim().toLowerCase() === key) {
              tx.playerName = newName.trim();
              await txStore.setJSON(blob.key, tx);
            }
          }
        } else {
          existing.lastUpdated = new Date().toISOString();
          await balanceStore.setJSON(key, existing);
        }

        return new Response(
          JSON.stringify({ ok: true, balance: existing }),
          { status: 200, headers }
        );
      }

      // ── Delete player — admin only ──
      if (action === "delete-player") {
        if (!isAdmin(user.username, cfg)) {
          return new Response(
            JSON.stringify({ error: "Nur Admins dürfen Spieler löschen" }),
            { status: 403, headers }
          );
        }

        const { playerName, deleteTransactions } = body;
        if (!playerName || typeof playerName !== "string") {
          return new Response(
            JSON.stringify({ error: "Spieler erforderlich" }),
            { status: 400, headers }
          );
        }

        const key = playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Spieler nicht im DKP-System gefunden" }),
            { status: 404, headers }
          );
        }

        await balanceStore.delete(key);

        // Optionally delete all transactions for this player
        if (deleteTransactions) {
          const { blobs: txBlobs } = await txStore.list();
          for (const blob of txBlobs) {
            const tx = await txStore.get(blob.key, { type: "json" });
            if (tx && tx.playerName.trim().toLowerCase() === key) {
              await txStore.delete(blob.key);
            }
          }
        }

        return new Response(
          JSON.stringify({ ok: true }),
          { status: 200, headers }
        );
      }

      return new Response(JSON.stringify({ error: "Unbekannte Aktion" }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    console.error("DKP API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/dkp",
};
