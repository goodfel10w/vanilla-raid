import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { validateSession } from "./shared/auth-utils.mjs";

export default async (req, context) => {
  const balanceStore = getStore({ name: "dkp-balances", consistency: "strong" });
  const txStore = getStore({ name: "dkp-transactions", consistency: "strong" });
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // GET — list all balances and recent transactions
    if (req.method === "GET") {
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

      return new Response(JSON.stringify({ balances, transactions: transactions.slice(0, 50) }), { status: 200, headers });
    }

    // POST — various DKP actions
    if (req.method === "POST") {
      const user = await validateSession(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
      }

      const body = await req.json();
      const { action } = body;

      // Award DKP to players
      if (action === "award") {
        const { players, amount, reason } = body;
        if (!Array.isArray(players) || players.length === 0) {
          return new Response(JSON.stringify({ error: "Mindestens ein Spieler erforderlich" }), { status: 400, headers });
        }
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0 || parsedAmount > 10000) {
          return new Response(JSON.stringify({ error: "Betrag muss zwischen 1 und 10.000 liegen" }), { status: 400, headers });
        }
        if (typeof reason !== "string" || reason.trim().length === 0 || reason.length > 200) {
          return new Response(JSON.stringify({ error: "Grund erforderlich (max. 200 Zeichen)" }), { status: 400, headers });
        }

        for (const p of players) {
          if (!p.name || typeof p.name !== "string" || p.name.trim().length === 0) {
            return new Response(JSON.stringify({ error: "Ungültiger Spielername" }), { status: 400, headers });
          }
        }

        const results = [];
        for (const p of players) {
          const key = p.name.trim().toLowerCase();
          const existing = await balanceStore.get(key, { type: "json" }) || { playerName: p.name.trim(), className: p.className || "", balance: 0 };
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
            reason: reason.trim().slice(0, 200),
            createdBy: user.username,
            timestamp: new Date().toISOString(),
          });
          results.push(existing);
        }

        return new Response(JSON.stringify({ ok: true, balances: results }), { status: 200, headers });
      }

      // Spend DKP (loot distribution)
      if (action === "spend") {
        const { playerName, amount, itemName } = body;
        if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
          return new Response(JSON.stringify({ error: "Spieler erforderlich" }), { status: 400, headers });
        }
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0 || parsedAmount > 10000) {
          return new Response(JSON.stringify({ error: "Betrag muss zwischen 1 und 10.000 liegen" }), { status: 400, headers });
        }

        const key = playerName.trim().toLowerCase();
        const existing = await balanceStore.get(key, { type: "json" });
        if (!existing) {
          return new Response(JSON.stringify({ error: "Spieler nicht im DKP-System gefunden" }), { status: 404, headers });
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
          reason: (itemName || "Loot").trim().slice(0, 200),
          createdBy: user.username,
          timestamp: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ ok: true, balance: existing }), { status: 200, headers });
      }

      // Decay — reduce all balances by a percentage
      if (action === "decay") {
        const percent = Number(body.percent);
        if (!percent || percent <= 0 || percent > 100) {
          return new Response(JSON.stringify({ error: "Prozent muss zwischen 1 und 100 liegen" }), { status: 400, headers });
        }

        const { blobs } = await balanceStore.list();
        const results = [];
        for (const blob of blobs) {
          const data = await balanceStore.get(blob.key, { type: "json" });
          if (!data) continue;
          const decayAmount = Math.round(data.balance * percent / 100);
          if (decayAmount === 0) { results.push(data); continue; }

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
