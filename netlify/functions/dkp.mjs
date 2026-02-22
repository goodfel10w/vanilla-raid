import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession } from "./shared/auth-utils.mjs";

const DEFAULT_CONFIG = {
  roles: {},               // { "username": "admin"|"officer" }
  defaultDecayPercent: 15,
  maxDkpAmount: 10000,
  allowNegativeBalance: true,
  startingBalance: 0,
  transactionLimit: 50,
  reasonMaxLength: 200,
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

  return cfg;
}

function getRole(username, cfg) {
  if (!username || !cfg.roles) return null;
  return cfg.roles[username.toLowerCase()] || null;
}

function isAdmin(username, cfg) {
  return getRole(username, cfg) === "admin";
}

function hasAccess(username, cfg) {
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
