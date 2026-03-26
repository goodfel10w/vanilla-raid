import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.RAID_DKP_API_URL || "https://vanilla-raid.netlify.app";
const AUTH_TOKEN = process.env.RAID_DKP_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error("RAID_DKP_AUTH_TOKEN environment variable is required");
  process.exit(1);
}

// --- API helpers ---

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// --- Formatting helpers ---

const WOW_CLASSES = [
  "Druide", "Hexenmeister", "Jäger", "Krieger",
  "Magier", "Paladin", "Priester", "Schamane", "Schurke",
];

function formatDate(iso) {
  if (!iso) return "?";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatRaidSummary(raid) {
  const date = formatDate(raid.date);
  const signupCount = (raid.signups || []).filter(
    (s) => s.status !== "declined" && s.status !== "benched"
  ).length;
  const locked = raid.locked ? " [LOCKED]" : "";
  return `${raid.instance} - ${date} ${raid.time || ""} (${signupCount}/${raid.maxPlayers} signups)${locked} [id: ${raid.id}]`;
}

function formatSignups(signups) {
  if (!signups || signups.length === 0) return "No signups.";
  const active = signups.filter((s) => s.status !== "declined");
  if (active.length === 0) return "No active signups.";

  const byRole = { Tank: [], Heiler: [], DPS: [] };
  for (const s of active) {
    const role = s.role || "DPS";
    const bucket = byRole[role] || byRole.DPS;
    const statusTag = s.status === "tentative" ? " (tentative)" :
                      s.status === "benched" ? " (bench)" :
                      s.status === "bench" ? " (bench)" : "";
    bucket.push(`  ${s.charName} (${s.className}${s.spec ? "/" + s.spec : ""})${statusTag}`);
  }

  const lines = [];
  for (const [role, players] of Object.entries(byRole)) {
    if (players.length > 0) {
      lines.push(`${role} (${players.length}):`);
      lines.push(...players);
    }
  }
  return lines.join("\n");
}

function formatStandings(balances) {
  if (!balances || balances.length === 0) return "No DKP records found.";
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);
  const lines = sorted.map(
    (b, i) => `${i + 1}. ${b.playerName} (${b.className}) — ${b.balance} DKP`
  );
  return lines.join("\n");
}

function formatTransactions(transactions) {
  if (!transactions || transactions.length === 0) return "No transactions found.";
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  const lines = sorted.map((tx) => {
    const sign = tx.amount >= 0 ? "+" : "";
    const edited = tx.editedBy ? " (edited)" : "";
    return `[${tx.id.slice(0, 8)}] ${formatDate(tx.timestamp)} ${tx.type} ${sign}${tx.amount} — ${tx.reason} (by ${tx.createdBy})${edited}`;
  });
  return lines.join("\n");
}

// --- MCP Server ---

const server = new McpServer({
  name: "raid-dkp",
  version: "1.0.0",
});

// Tool: List raids
server.tool(
  "dkp_list_raids",
  "List recent raids with signup counts. Use to find raid IDs for awarding DKP.",
  {},
  async () => {
    const data = await apiGet("/api/raids");
    const raids = Array.isArray(data) ? data : data.raids || [];
    // Sort by date descending
    raids.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = raids.slice(0, 10);
    const text = recent.length > 0
      ? recent.map(formatRaidSummary).join("\n")
      : "No raids found.";
    return { content: [{ type: "text", text }] };
  }
);

// Tool: View raid details
server.tool(
  "dkp_view_raid",
  "View raid details including all signups grouped by role. Use to see who attended before awarding DKP.",
  { raid_id: z.string().describe("Raid ID to view") },
  async ({ raid_id }) => {
    const data = await apiGet("/api/raids");
    const raids = Array.isArray(data) ? data : data.raids || [];
    const raid = raids.find((r) => r.id === raid_id);
    if (!raid) return { content: [{ type: "text", text: `Raid ${raid_id} not found.` }] };

    const lines = [
      `Raid: ${raid.instance}`,
      `Date: ${formatDate(raid.date)} ${raid.time || ""}`,
      `Max: ${raid.maxPlayers}`,
      raid.notes ? `Notes: ${raid.notes}` : null,
      raid.description ? `Description: ${raid.description}` : null,
      `Locked: ${raid.locked ? "Yes" : "No"}`,
      "",
      "--- Signups ---",
      formatSignups(raid.signups),
    ].filter(Boolean);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// Tool: Award DKP
server.tool(
  "dkp_award",
  "Award DKP points to one or more players (e.g., after a boss kill). Requires officer role.",
  {
    players: z.array(
      z.object({
        name: z.string().describe("Character name"),
        className: z.enum(WOW_CLASSES).describe("WoW class (German)"),
      })
    ).min(1).describe("Players to award DKP to"),
    amount: z.number().int().min(1).describe("DKP amount to award"),
    reason: z.string().min(1).max(200).describe("Reason for award (e.g., boss name, raid completion)"),
  },
  async ({ players, amount, reason }) => {
    const result = await apiPost("/api/dkp", {
      action: "award",
      players,
      amount,
      reason,
    });
    const names = players.map((p) => p.name).join(", ");
    return {
      content: [{ type: "text", text: `Awarded ${amount} DKP to ${players.length} player(s): ${names}\nReason: ${reason}` }],
    };
  }
);

// Tool: Award DKP to raid participants
server.tool(
  "dkp_award_raid",
  "Award DKP to all active participants of a specific raid (excludes declined/benched). Convenience wrapper.",
  {
    raid_id: z.string().describe("Raid ID to award DKP for"),
    amount: z.number().int().min(1).describe("DKP amount per player"),
    reason: z.string().min(1).max(200).describe("Reason (e.g., 'Gruul Full Clear')"),
    exclude: z.array(z.string()).optional().describe("Player names to exclude from award"),
  },
  async ({ raid_id, amount, reason, exclude }) => {
    // Fetch raid
    const data = await apiGet("/api/raids");
    const raids = Array.isArray(data) ? data : data.raids || [];
    const raid = raids.find((r) => r.id === raid_id);
    if (!raid) return { content: [{ type: "text", text: `Raid ${raid_id} not found.` }] };

    const excludeSet = new Set((exclude || []).map((n) => n.toLowerCase()));
    const active = (raid.signups || []).filter(
      (s) => s.status !== "declined" && s.status !== "benched" && s.status !== "bench" &&
             !excludeSet.has(s.charName.toLowerCase())
    );

    if (active.length === 0) {
      return { content: [{ type: "text", text: "No eligible participants found in this raid." }] };
    }

    const players = active.map((s) => ({ name: s.charName, className: s.className }));
    await apiPost("/api/dkp", { action: "award", players, amount, reason });

    const names = players.map((p) => p.name).join(", ");
    return {
      content: [{
        type: "text",
        text: `Awarded ${amount} DKP to ${players.length} raid participant(s) from ${raid.instance} (${formatDate(raid.date)}):\n${names}\nReason: ${reason}`,
      }],
    };
  }
);

// Tool: Spend DKP (record loot)
server.tool(
  "dkp_spend",
  "Deduct DKP from a player for receiving loot. Records the item as the transaction reason.",
  {
    player_name: z.string().describe("Player receiving the item"),
    amount: z.number().int().min(1).describe("DKP cost of the item"),
    item_name: z.string().min(1).max(200).describe("Item name (e.g., '[Dragonspine Trophy]')"),
  },
  async ({ player_name, amount, item_name }) => {
    await apiPost("/api/dkp", {
      action: "spend",
      playerName: player_name,
      amount,
      itemName: item_name,
    });
    return {
      content: [{ type: "text", text: `${player_name} spent ${amount} DKP on ${item_name}` }],
    };
  }
);

// Tool: View standings
server.tool(
  "dkp_standings",
  "View current DKP standings for all players, sorted by balance.",
  {
    class_filter: z.enum([...WOW_CLASSES, "all"]).optional().describe("Filter by class (optional)"),
  },
  async ({ class_filter }) => {
    const data = await apiGet("/api/dkp");
    let balances = data.balances || [];
    if (class_filter && class_filter !== "all") {
      balances = balances.filter((b) => b.className === class_filter);
    }
    return { content: [{ type: "text", text: formatStandings(balances) }] };
  }
);

// Tool: Player history
server.tool(
  "dkp_player_history",
  "View a player's DKP transaction history.",
  { player_name: z.string().describe("Player name") },
  async ({ player_name }) => {
    const data = await apiGet(`/api/dkp?player=${encodeURIComponent(player_name)}`);
    const balance = (data.balances || []).find(
      (b) => b.playerName.toLowerCase() === player_name.toLowerCase()
    );
    const transactions = data.transactions || [];

    const lines = [];
    if (balance) {
      lines.push(`${balance.playerName} (${balance.className}) — Current balance: ${balance.balance} DKP`);
      lines.push("");
    }
    lines.push("--- Transactions ---");
    lines.push(formatTransactions(transactions));
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// Tool: Undo transaction
server.tool(
  "dkp_undo",
  "Undo/reverse a DKP transaction. Requires admin role.",
  { transaction_id: z.string().describe("Transaction ID to undo (use full UUID or the short ID from history)") },
  async ({ transaction_id }) => {
    // If short ID given, try to find full ID
    let fullId = transaction_id;
    if (transaction_id.length < 36) {
      const data = await apiGet("/api/dkp");
      const tx = (data.transactions || []).find((t) => t.id.startsWith(transaction_id));
      if (!tx) {
        return { content: [{ type: "text", text: `Transaction starting with '${transaction_id}' not found.` }] };
      }
      fullId = tx.id;
    }
    await apiPost("/api/dkp", { action: "undo", transactionId: fullId });
    return { content: [{ type: "text", text: `Transaction ${fullId} undone successfully.` }] };
  }
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
