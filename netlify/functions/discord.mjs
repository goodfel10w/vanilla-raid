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

// WoW icon CDNs
const WOW_ICONS = "https://cdn.jsdelivr.net/gh/orourkek/Wow-Icons@master/images";
const WH_ICONS = "https://wow.zamimg.com/images/wow/icons/large";

// Class name → icon path slug (matches frontend CLS array)
const CLASS_ICON_SLUG = {
  Druide: "druid", Hexenmeister: "warlock", Jäger: "hunter",
  Krieger: "warrior", Magier: "mage", Paladin: "paladin",
  Priester: "priest", Schamane: "shaman", Schurke: "rogue",
};

// Spec name → icon path (className → specName → path)
const SPEC_ICONS = {
  Druide: { Balance: "druid/balance", "Feral Tank": "druid/feral", "Feral DPS": "druid/feral", Resto: "druid/restoration" },
  Hexenmeister: { Affliction: "warlock/affliction", Demonologie: "warlock/demonology", Destruction: "warlock/destruction" },
  Jäger: { "Beast Mastery": "hunter/beastmastery", Marksmanship: "hunter/marksman", Survival: "hunter/survival" },
  Krieger: { Prot: "warrior/protection", Arms: "warrior/arms", Fury: "warrior/fury" },
  Magier: { Arcane: "mage/arcane", Fire: "mage/fire", Frost: "mage/frost" },
  Paladin: { Holy: "paladin/holy", Prot: "paladin/protection", Retri: "paladin/retribution" },
  Priester: { Disc: "priest/discipline", Holy: "priest/holy", Shadow: "priest/shadow" },
  Schamane: { Elemental: "shaman/elemental", Enhancement: "shaman/enhancement", Resto: "shaman/restoration" },
  Schurke: { Assassination: "rogue/assassination", Combat: "rogue/combat", Subtlety: "rogue/subtlety" },
};

// Raid instance → Wowhead achievement/boss icon for thumbnail
const RAID_THUMBNAILS = {
  "Karazhan": `${WH_ICONS}/achievement_boss_princemalchezaar_02.jpg`,
  "Gruuls Unterschlupf": `${WH_ICONS}/achievement_boss_gruulthedragonkiller.jpg`,
  "Magtheridons Kammer": `${WH_ICONS}/achievement_boss_magtheridon.jpg`,
  "Höhle des Schlangenschreins": `${WH_ICONS}/achievement_boss_ladyvashj.jpg`,
  "Festung der Stürme": `${WH_ICONS}/achievement_boss_kabormagistrate.jpg`,
  "Hyjalgipfel": `${WH_ICONS}/achievement_boss_archimonde.jpg`,
  "Schwarzer Tempel": `${WH_ICONS}/achievement_boss_illidan.jpg`,
  "Zul'Aman": `${WH_ICONS}/achievement_boss_zuljin.jpg`,
  "Sonnenbrunnenplateau": `${WH_ICONS}/achievement_boss_kiljaeden.jpg`,
};

function clsIconUrl(cls) {
  const slug = CLASS_ICON_SLUG[cls];
  return slug ? `${WOW_ICONS}/class/64/${slug}.png` : "";
}

function specIconUrl(cls, specName) {
  const path = SPEC_ICONS[cls]?.[specName];
  return path ? `${WOW_ICONS}/spec/${path}.png` : "";
}

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

// Zero-width space for empty inline field padding
const ZWS = "\u200b";

// Discord embed limits
const MAX_FIELD_VALUE = 1024;

// Truncate a field value to fit Discord's 1024-char limit
function truncField(str, max = MAX_FIELD_VALUE) {
  if (str.length <= max) return str;
  const suffix = "\n*… und mehr*";
  const lines = str.split("\n");
  let result = "";
  for (const line of lines) {
    if ((result + "\n" + line + suffix).length > max) break;
    result += (result ? "\n" : "") + line;
  }
  return result + suffix;
}

// Map Discord HTTP status codes to actionable German hints
function discordErrorHint(status, body) {
  const detail = body ? ` (${body.slice(0, 150)})` : "";
  switch (status) {
    case 400: return "Ungültige Daten (Embed zu groß oder fehlerhaft)" + detail;
    case 401: return "Bot-Token ungültig oder abgelaufen" + detail;
    case 403: return "Bot hat keine Berechtigung — prüfe: Nachrichten senden, Links einbetten, Nachrichtenverlauf lesen" + detail;
    case 404: return "Kanal oder Webhook nicht gefunden — DISCORD_CHANNEL_ID korrekt?" + detail;
    case 429: return "Rate-Limit erreicht — bitte kurz warten";
    default: return (body || "Unbekannter Fehler").slice(0, 200);
  }
}

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

  // Progress bar
  const barLen = 20;
  const filled = Math.round(pct / 100 * barLen);
  const bar = "▓".repeat(filled) + "░".repeat(barLen - filled);

  // Status indicator
  let statusEmoji = "🟡";
  if (total >= raid.maxPlayers) statusEmoji = "🟢";
  if (total > raid.maxPlayers) statusEmoji = "🔴";

  // Compact description — keep it short, details go in fields
  const descParts = [
    `📅 **${fmtDate(raid.date)}** • 🕒 **${raid.time} Uhr**`,
    "",
    `${statusEmoji} **${confirmed.length}** sicher${tentative.length ? ` + **${tentative.length}** unsicher` : ""} von **${raid.maxPlayers}** Plätzen`,
    `\`${bar}\` ${pct}%`,
  ];

  if (raid.notes) {
    descParts.push("", `📝 *„${raid.notes}"*`);
  }

  if (siteUrl) {
    descParts.push("", `🔗 **[Jetzt anmelden!](${siteUrl}#raids)**`);
  }

  // ── Fields ──
  const fields = [];

  // Row 1: Role targets (3 inline columns)
  ROLES.forEach(role => {
    const ct = roleCounts[role];
    const tgt = targets[role];
    const icon = ct >= tgt ? "✅" : ct >= tgt - 1 ? "⚠️" : "❌";
    const barLen2 = 8;
    const roleFill = Math.min(barLen2, Math.round(ct / tgt * barLen2));
    const roleBar = "█".repeat(roleFill) + "░".repeat(barLen2 - roleFill);
    fields.push({
      name: `${ROLE_EMOJI[role]} ${role} ${icon}`,
      value: `**${ct}** / ${tgt}\n\`${roleBar}\``,
      inline: true,
    });
  });

  // Row 2: Signup lists per role (3 inline columns — always 3 for alignment)
  ROLES.forEach(role => {
    const rs = signups.filter(s => s.role === role);
    if (!rs.length) {
      fields.push({ name: ZWS, value: `*— keine —*`, inline: true });
      return;
    }
    const lines = rs.map(s => {
      const tent = s.status === "tentative" ? " 🔸" : "";
      const specInfo = s.assignedSpec
        ? ` ✅ **${s.assignedSpec}**`
        : s.offeredSpecs && s.offeredSpecs.length
        ? ` *(${s.offeredSpecs.join("/")})*`
        : "";
      return `**${s.charName}**${specInfo}${tent}`;
    });
    fields.push({
      name: `Anmeldungen ${role}`,
      value: truncField(lines.join("\n")),
      inline: true,
    });
  });

  // Row 3: Class breakdown split into 3 columns for wider layout
  const clsEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  if (clsEntries.length) {
    // Split classes into up to 3 columns
    const colSize = Math.ceil(clsEntries.length / 3);
    for (let col = 0; col < 3; col++) {
      const chunk = clsEntries.slice(col * colSize, (col + 1) * colSize);
      if (!chunk.length) {
        fields.push({ name: ZWS, value: ZWS, inline: true });
        continue;
      }
      const clsLines = chunk.map(([cls, ct]) => `\`${ct}×\` ${cls}`);
      fields.push({
        name: col === 0 ? "📊 Klassenverteilung" : ZWS,
        value: clsLines.join("\n"),
        inline: true,
      });
    }
  }

  // Full-width rows: Declined, Bench
  if (declined.length) {
    const names = declined.map(s => `~~${s.charName}~~`);
    fields.push({
      name: `❌ Abgesagt (${declined.length})`,
      value: truncField(names.join(", ")),
      inline: false,
    });
  }

  if (total > raid.maxPlayers) {
    const overCount = total - raid.maxPlayers;
    fields.push({
      name: `💤 Überzählig (${overCount})`,
      value: `*${overCount} Spieler müssen auf die Bank — Raidleiter entscheidet.*`,
      inline: false,
    });
  }

  // Empty state
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

  // Find the most common class for footer icon
  const topClass = clsEntries.length ? clsEntries[0][0] : null;

  const embed = {
    author: {
      name: "<Vanilla> Raid-Planer",
      icon_url: `${WOW_ICONS}/class/64/warrior.png`,
    },
    title: `⚔️  ${raid.instance}`,
    description: descParts.join("\n"),
    color,
    fields,
    thumbnail: {
      url: RAID_THUMBNAILS[raid.instance] || `${WH_ICONS}/inv_misc_head_dragon_01.jpg`,
    },
    footer: {
      text: `Erstellt von ${raid.createdByName}`,
      icon_url: topClass ? clsIconUrl(topClass) : `${WOW_ICONS}/class/64/warrior.png`,
    },
    timestamp: new Date().toISOString(),
  };

  return embed;
}

function buildRaidButtons(raidId) {
  return [{
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: 3, // SUCCESS (green)
        label: "Anmelden",
        emoji: { name: "✅" },
        custom_id: `raid_signup:${raidId}:accepted`,
      },
      {
        type: 2,
        style: 2, // SECONDARY (gray)
        label: "Vielleicht",
        emoji: { name: "🔸" },
        custom_id: `raid_signup:${raidId}:tentative`,
      },
      {
        type: 2,
        style: 4, // DANGER (red)
        label: "Absagen",
        emoji: { name: "❌" },
        custom_id: `raid_signup:${raidId}:declined`,
      },
    ],
  }];
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
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const channelId = process.env.DISCORD_CHANNEL_ID;
      const buttons = buildRaidButtons(raidId);

      let discordMsg;

      if (botToken && channelId) {
        // Post via bot API — supports interactive buttons
        const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${botToken}`,
          },
          body: JSON.stringify({
            embeds: [embed],
            components: buttons,
          }),
        });

        if (!discordRes.ok) {
          const errText = await discordRes.text();
          console.error("Discord bot post error:", discordRes.status, errText);
          return new Response(JSON.stringify({
            error: `Discord-Fehler ${discordRes.status}: ${discordErrorHint(discordRes.status, errText)}`,
          }), { status: 502, headers });
        }
        discordMsg = await discordRes.json();
      } else {
        // Fallback: webhook (no interactive buttons)
        const discordRes = await fetch(webhookUrl + "?wait=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [embed],
          }),
        });

        if (!discordRes.ok) {
          const errText = await discordRes.text();
          console.error("Discord webhook error:", discordRes.status, errText);
          return new Response(JSON.stringify({
            error: `Discord-Fehler ${discordRes.status}: ${discordErrorHint(discordRes.status, errText)}`,
          }), { status: 502, headers });
        }
        discordMsg = await discordRes.json();
      }

      // Store the Discord message ID for future updates
      await discordStore.setJSON(raidId, {
        messageId: discordMsg.id,
        channelId: discordMsg.channel_id || channelId,
        postedAt: new Date().toISOString(),
        postedBy: user.username,
        usedBot: !!(botToken && channelId),
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
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const mapping = await discordStore.get(raidId, { type: "json" });
  const buttons = buildRaidButtons(raidId);

  let discordRes;
  if (botToken && mapping?.channelId) {
    // Update via bot API (preserves interactive buttons)
    discordRes = await fetch(`https://discord.com/api/v10/channels/${mapping.channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({
        embeds: [embed],
        components: buttons,
      }),
    });
  } else {
    // Fallback: webhook update
    discordRes = await fetch(`${webhookUrl}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
  }

  if (!discordRes.ok) {
    // If message was deleted, remove the mapping
    if (discordRes.status === 404) {
      await discordStore.delete(raidId);
      return new Response(JSON.stringify({ error: "Discord-Nachricht wurde gelöscht. Bitte erneut posten." }), { status: 404, headers });
    }
    const errText = await discordRes.text();
    console.error("Discord update error:", discordRes.status, errText);
    return new Response(JSON.stringify({
      error: `Discord-Fehler ${discordRes.status}: ${discordErrorHint(discordRes.status, errText)}`,
    }), { status: 502, headers });
  }

  // Update stored metadata
  const existing = await discordStore.get(raidId, { type: "json" });
  if (existing) {
    existing.updatedAt = new Date().toISOString();
    await discordStore.setJSON(raidId, existing);
  }

  return new Response(JSON.stringify({ ok: true, messageId }), { status: 200, headers });
}

// Exported helpers for raids.mjs and discord-interactions.mjs
export { buildRaidEmbed, buildRaidButtons };

export const config = {
  path: "/api/discord",
};
