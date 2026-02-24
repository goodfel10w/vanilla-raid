import { getStore } from "@netlify/blobs";
import { validateSession } from "./shared/auth-utils.mjs";

const VALID_INSTANCES = [
  "Karazhan", "Gruuls Unterschlupf", "Magtheridons Kammer",
  "Höhle des Schlangenschreins", "Festung der Stürme",
  "Hyjalgipfel", "Schwarzer Tempel", "Zul'Aman", "Sonnenbrunnenplateau",
];

// WoW class colors for embed accent
const CLASS_COLORS = {
  Druide: 0xFF7C0A, Hexenmeister: 0x8788EE, Jäger: 0xAAD372,
  Krieger: 0xC69B6D, Magier: 0x3FC7EB, Paladin: 0xF48CBA,
  Priester: 0xFFFFFF, Schamane: 0x0070DD, Schurke: 0xFFF468,
};

const ROLE_EMOJI = { Tank: "🛡️", Heiler: "💚", DPS: "⚔️" };
const ROLES = ["Tank", "Heiler", "DPS"];

const DAY_NAMES_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function fmtDate(ds) {
  const d = new Date(ds + "T00:00:00");
  const dn = DAY_NAMES_SHORT[d.getDay()];
  return dn + ", " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
}

// Role targets for raid composition
const RAID_TARGETS_25 = { Tank: 2, Heiler: 5, DPS: 18 };
const RAID_TARGETS_10 = { Tank: 2, Heiler: 2, DPS: 6 };

function buildRaidEmbed(raid, siteUrl) {
  const signups = (raid.signups || []).filter(s => s.status !== "declined");
  const declined = (raid.signups || []).filter(s => s.status === "declined");
  const confirmed = signups.filter(s => s.status === "accepted");
  const tentative = signups.filter(s => s.status === "tentative");
  const total = signups.length;
  const pct = Math.min(100, Math.round(total / raid.maxPlayers * 100));

  const is10 = raid.maxPlayers <= 10;
  const targets = is10 ? RAID_TARGETS_10 : RAID_TARGETS_25;

  // Count by role
  const roleCounts = {};
  ROLES.forEach(r => { roleCounts[r] = 0; });
  signups.forEach(s => { if (roleCounts[s.role] !== undefined) roleCounts[s.role]++; });

  // Count classes
  const classCounts = {};
  signups.forEach(s => { if (s.className) classCounts[s.className] = (classCounts[s.className] || 0) + 1; });

  // Progress bar (text-based, more detailed)
  const barLen = 20;
  const filled = Math.round(pct / 100 * barLen);
  const bar = "▓".repeat(filled) + "░".repeat(barLen - filled);

  // Status indicator
  let statusEmoji = "🟡";
  if (total >= raid.maxPlayers) statusEmoji = "🟢";
  if (total > raid.maxPlayers) statusEmoji = "🔴";

  // Role status line with target indicators
  const roleStatus = ROLES.map(role => {
    const ct = roleCounts[role];
    const tgt = targets[role];
    const icon = ct >= tgt ? "✅" : ct >= tgt - 1 ? "⚠️" : "❌";
    return `${ROLE_EMOJI[role]} **${ct}**/${tgt} ${role} ${icon}`;
  }).join("\n");

  // Description with clear sections
  const descParts = [
    `### 📅 ${fmtDate(raid.date)} • 🕒 ${raid.time} Uhr`,
    "",
    `${statusEmoji} **${confirmed.length}** sicher${tentative.length ? ` + **${tentative.length}** unsicher` : ""} von **${raid.maxPlayers}** Plätzen`,
    `\`${bar}\` ${pct}%`,
    "",
    `**Rollenverteilung:**`,
    roleStatus,
  ];

  if (raid.notes) {
    descParts.push("", `📝 *„${raid.notes}"*`);
  }

  // Build signup list per role with better formatting
  const fields = [];
  ROLES.forEach(role => {
    const rs = signups.filter(s => s.role === role);
    if (!rs.length) return;
    const lines = rs.map(s => {
      const tent = s.status === "tentative" ? " 🔸" : "";
      const cls = s.className ? ` \`${s.className}\`` : "";
      const specInfo = s.assignedSpec
        ? ` ✅ **${s.assignedSpec}**`
        : s.offeredSpecs && s.offeredSpecs.length
        ? ` *(${s.offeredSpecs.join(" / ")})*`
        : "";
      return `> **${s.charName}**${cls}${specInfo}${tent}`;
    });
    fields.push({
      name: `${ROLE_EMOJI[role]} ${role} — ${rs.length}/${targets[role]}`,
      value: lines.join("\n"),
      inline: true,
    });
  });

  // Class breakdown as compact field
  const clsEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  if (clsEntries.length) {
    const clsLines = clsEntries.map(([cls, ct]) => `\`${ct}×\` ${cls}`);
    fields.push({
      name: "📊 Klassenverteilung",
      value: clsLines.join(" • "),
      inline: false,
    });
  }

  // Declined
  if (declined.length) {
    const lines = declined.map(s => `~~${s.charName}~~`);
    fields.push({
      name: `❌ Abgesagt (${declined.length})`,
      value: "> " + lines.join(", "),
      inline: false,
    });
  }

  // Bench suggestion if oversigned
  if (total > raid.maxPlayers) {
    const overCount = total - raid.maxPlayers;
    fields.push({
      name: `💤 Überzählig (${overCount})`,
      value: `*${overCount} Spieler müssen auf die Bank — Raidleiter entscheidet.*`,
      inline: false,
    });
  }

  // If no signups yet
  if (!signups.length && !declined.length) {
    fields.push({
      name: "Anmeldungen",
      value: "*Noch keine Anmeldungen — sei der Erste!*",
      inline: false,
    });
  }

  // Determine embed color based on fill
  let color = 0xC9A84C; // gold default
  if (total >= raid.maxPlayers) color = 0x66BB6A; // green = full
  if (total > raid.maxPlayers) color = 0xE57373; // red = over

  const embed = {
    title: `⚔️  ${raid.instance}`,
    description: descParts.join("\n"),
    color,
    fields,
    footer: {
      text: `Erstellt von ${raid.createdByName} • <Vanilla> Raid-Planer`,
    },
    timestamp: new Date().toISOString(),
  };

  // Add link to sign up
  if (siteUrl) {
    embed.description += `\n\n🔗 **[Jetzt anmelden!](${siteUrl}#raids)**`;
  }

  return embed;
}

export default async (req) => {
  const headers = { "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const user = await validateSession(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers });
    }

    const body = await req.json();
    const { action, raidId } = body;

    if (!action || !raidId) {
      return new Response(JSON.stringify({ error: "Action und Raid-ID erforderlich" }), { status: 400, headers });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: "Discord-Webhook nicht konfiguriert" }), { status: 500, headers });
    }

    const raidStore = getStore({ name: "raids", consistency: "strong" });
    const discordStore = getStore({ name: "discord-messages", consistency: "strong" });
    const raid = await raidStore.get(raidId, { type: "json" });

    if (!raid) {
      return new Response(JSON.stringify({ error: "Raid nicht gefunden" }), { status: 404, headers });
    }

    // Determine site URL for the signup link
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";

    if (action === "post") {
      // Check if already posted
      const existing = await discordStore.get(raidId, { type: "json" });
      if (existing?.messageId) {
        // Update instead
        return await updateDiscordMessage(webhookUrl, existing.messageId, raid, siteUrl, discordStore, raidId, headers);
      }

      const embed = buildRaidEmbed(raid, siteUrl);
      const discordRes = await fetch(webhookUrl + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        console.error("Discord webhook error:", errText);
        return new Response(JSON.stringify({ error: "Discord-Nachricht konnte nicht gesendet werden" }), { status: 502, headers });
      }

      const discordMsg = await discordRes.json();

      // Store the Discord message ID for future updates
      await discordStore.setJSON(raidId, {
        messageId: discordMsg.id,
        channelId: discordMsg.channel_id,
        postedAt: new Date().toISOString(),
        postedBy: user.username,
      });

      return new Response(JSON.stringify({ ok: true, messageId: discordMsg.id }), { status: 200, headers });
    }

    if (action === "update") {
      const existing = await discordStore.get(raidId, { type: "json" });
      if (!existing?.messageId) {
        return new Response(JSON.stringify({ error: "Raid wurde noch nicht in Discord gepostet" }), { status: 400, headers });
      }

      return await updateDiscordMessage(webhookUrl, existing.messageId, raid, siteUrl, discordStore, raidId, headers);
    }

    return new Response(JSON.stringify({ error: "Unbekannte Action" }), { status: 400, headers });
  } catch (err) {
    console.error("Discord API error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

async function updateDiscordMessage(webhookUrl, messageId, raid, siteUrl, discordStore, raidId, headers) {
  const embed = buildRaidEmbed(raid, siteUrl);
  const discordRes = await fetch(`${webhookUrl}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [embed],
    }),
  });

  if (!discordRes.ok) {
    // If message was deleted, remove the mapping
    if (discordRes.status === 404) {
      await discordStore.delete(raidId);
      return new Response(JSON.stringify({ error: "Discord-Nachricht wurde gelöscht. Bitte erneut posten." }), { status: 404, headers });
    }
    const errText = await discordRes.text();
    console.error("Discord update error:", errText);
    return new Response(JSON.stringify({ error: "Discord-Nachricht konnte nicht aktualisiert werden" }), { status: 502, headers });
  }

  // Update stored metadata
  const existing = await discordStore.get(raidId, { type: "json" });
  if (existing) {
    existing.updatedAt = new Date().toISOString();
    await discordStore.setJSON(raidId, existing);
  }

  return new Response(JSON.stringify({ ok: true, messageId }), { status: 200, headers });
}

// Exported helper for raids.mjs to call
export { buildRaidEmbed };

export const config = {
  path: "/api/discord",
};
