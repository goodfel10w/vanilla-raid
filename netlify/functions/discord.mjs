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

// English class names for Discord display headers
const CLASS_ENGLISH = {
  Druide: "Druid", Hexenmeister: "Warlock", Jäger: "Hunter",
  Krieger: "Warrior", Magier: "Mage", Paladin: "Paladin",
  Priester: "Priest", Schamane: "Shaman", Schurke: "Rogue",
};

// Unicode emoji fallbacks per class (used when DISCORD_EMOJIS env var not set)
const CLASS_EMOJI_FALLBACK = {
  Druide: "🌿", Hexenmeister: "🔮", Jäger: "🏹",
  Krieger: "⚔️", Magier: "✨", Paladin: "⚜️",
  Priester: "✝️", Schamane: "⚡", Schurke: "🗡️",
};

// Melee DPS specs (for melee/ranged split in composition summary)
const MELEE_DPS_SPECS = new Set([
  "Arms", "Fury",
  "Assassination", "Combat", "Subtlety",
  "Feral DPS",
  "Retri",
  "Enhancement",
]);

// Display order: Tank-capable classes first, then melee DPS, ranged DPS
const CLASS_DISPLAY_ORDER = [
  "Krieger", "Druide", "Paladin", "Schurke", "Jäger",
  "Hexenmeister", "Priester", "Magier", "Schamane",
];

// Custom Discord emoji support
// Priority: DISCORD_EMOJIS env var > Netlify Blob store > Unicode fallbacks
let _emojiCache = null;

// Sync getter — returns cached map (call loadEmojiCache() first in async context)
function getCustomEmojis() {
  if (_emojiCache !== null) return _emojiCache;
  // Sync fallback: check env var only
  try { _emojiCache = JSON.parse(process.env.DISCORD_EMOJIS || "{}"); }
  catch { _emojiCache = {}; }
  return _emojiCache;
}

// Async loader — reads from env var or Netlify Blobs
async function loadEmojiCache() {
  if (_emojiCache !== null) return;
  const envEmojis = process.env.DISCORD_EMOJIS;
  if (envEmojis) {
    try { _emojiCache = JSON.parse(envEmojis); return; } catch { /* fall through */ }
  }
  try {
    const store = getStore({ name: "discord-emojis", consistency: "strong" });
    const map = await store.get("emoji-map", { type: "json" });
    if (map && Object.keys(map).length > 0) { _emojiCache = map; return; }
  } catch { /* fall through */ }
  _emojiCache = {};
}

function getClassEmoji(cls) {
  const custom = getCustomEmojis();
  const en = CLASS_ENGLISH[cls];
  return custom[en] || custom[cls] || custom[CLASS_ICON_SLUG[cls]] || CLASS_EMOJI_FALLBACK[cls] || "▫️";
}

function getSpecEmoji(cls, specName, role) {
  const custom = getCustomEmojis();
  if (custom[specName]) return custom[specName];
  const en = CLASS_ENGLISH[cls];
  if (en && custom[en + "_" + specName]) return custom[en + "_" + specName];
  return ROLE_EMOJI[role] || "⚔️";
}

const DAY_NAMES_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Raid tier mapping
const RAID_TIERS = {
  "Karazhan": "T4", "Gruuls Unterschlupf": "T4", "Magtheridons Kammer": "T4",
  "Höhle des Schlangenschreins": "T5", "Festung der Stürme": "T5",
  "Hyjalgipfel": "T6", "Schwarzer Tempel": "T6",
  "Zul'Aman": "ZA", "Sonnenbrunnenplateau": "T6.5",
};

function fmtDate(ds) {
  const d = new Date(ds + "T00:00:00");
  const dn = DAY_NAMES_SHORT[d.getDay()];
  return dn + ", " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
}

// German relative time countdown
function timeUntil(dateStr, timeStr) {
  const target = new Date(dateStr + "T" + (timeStr || "20:00") + ":00");
  const now = new Date();
  const diffMs = target - now;

  if (diffMs < 0) return "vergangen";

  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffD = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffD === 0 && diffH < 1) return "in Kürze";
  if (diffD === 0) return diffH === 1 ? "in einer Stunde" : `in ${diffH} Stunden`;
  if (diffD === 1) return "morgen";
  if (diffD < 7) return `in ${diffD} Tagen`;
  if (diffD < 14) return "in einer Woche";
  return `in ${diffD} Tagen`;
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
  const signups = (raid.signups || []).filter(s => s.status !== "declined" && s.status !== "benched");
  const benched = (raid.signups || []).filter(s => s.status === "benched");
  const declined = (raid.signups || []).filter(s => s.status === "declined");
  const confirmed = signups.filter(s => s.status === "accepted");
  const tentative = signups.filter(s => s.status === "tentative");
  const total = signups.length;
  const pct = Math.min(100, Math.round(total / raid.maxPlayers * 100));

  const is10 = raid.maxPlayers <= 10;
  const targets = is10 ? RAID_TARGETS_10 : RAID_TARGETS_25;

  // Build global position map (sorted by signup timestamp)
  const sortedSignups = [...signups].sort((a, b) =>
    (a.timestamp || "").localeCompare(b.timestamp || "")
  );
  const positionMap = new Map();
  sortedSignups.forEach((s, i) => { positionMap.set(s, i + 1); });

  // Count by role
  const roleCounts = {};
  ROLES.forEach(r => { roleCounts[r] = 0; });
  signups.forEach(s => { if (roleCounts[s.role] !== undefined) roleCounts[s.role]++; });

  // Melee vs Ranged DPS breakdown
  let meleeDps = 0, rangedDps = 0;
  signups.forEach(s => {
    if (s.role !== "DPS") return;
    const spec = s.assignedSpec || (s.offeredSpecs && s.offeredSpecs[0]) || "";
    if (MELEE_DPS_SPECS.has(spec)) meleeDps++;
    else rangedDps++;
  });

  // Progress bar
  const barLen = 20;
  const filled = Math.round(pct / 100 * barLen);
  const bar = "▓".repeat(filled) + "░".repeat(barLen - filled);

  // Status indicator
  let statusEmoji = "🟡";
  if (total >= raid.maxPlayers) statusEmoji = "🟢";
  if (total > raid.maxPlayers) statusEmoji = "🔴";

  // Countdown
  const countdown = timeUntil(raid.date, raid.time);

  // Compact description
  const descParts = [
    `📅 **${fmtDate(raid.date)}** • 🕒 **${raid.time} Uhr** — *${countdown}*`,
  ];

  if (raid.locked) {
    descParts.push("", "🔒 **Raid gesperrt — Anmeldung geschlossen**");
  }

  // Deadline display
  if (raid.deadline) {
    const dl = new Date(raid.deadline);
    const dlDate = dl.toISOString().slice(0, 10);
    const dlTime = dl.toTimeString().slice(0, 5);
    const dlCountdown = timeUntil(dlDate, dlTime);
    const dlFormatted = fmtDate(dlDate) + ", " + dlTime + " Uhr";
    if (dlCountdown === "vergangen") {
      descParts.push(`⏰ **Anmeldeschluss:** ~~${dlFormatted}~~ — *abgelaufen*`);
    } else {
      descParts.push(`⏰ **Anmeldeschluss:** ${dlFormatted} — *${dlCountdown}*`);
    }
  }

  descParts.push(
    "",
    `${statusEmoji} **${confirmed.length}** sicher${tentative.length ? ` + **${tentative.length}** unsicher` : ""} von **${raid.maxPlayers}** Plätzen`,
    `\`${bar}\` ${pct}%`,
  );

  // Composition summary with melee/ranged split
  if (signups.length > 0) {
    descParts.push(
      "",
      `🛡️ **${roleCounts.Tank}** Tank · ⚔️ **${meleeDps}** Nahkampf · 🏹 **${rangedDps}** Fernkampf · 💚 **${roleCounts.Heiler}** Heiler`,
    );
  }

  if (raid.description) {
    const desc = raid.description.length > 300 ? raid.description.slice(0, 300) + "…" : raid.description;
    descParts.push("", `📋 ${desc}`);
  }

  if (raid.notes) {
    descParts.push("", `📝 *„${raid.notes}"*`);
  }

  if (siteUrl) {
    descParts.push("", `🔗 **[Jetzt anmelden!](${siteUrl}#/raids/${raid.id})**`);
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

  // Separator between role targets and class signups
  if (signups.length > 0) {
    fields.push({ name: "─── Anmeldungen ───", value: ZWS, inline: false });
  }

  // Class-grouped signup list (grouped by class with icons)
  let classFieldCount = 0;
  CLASS_DISPLAY_ORDER.forEach(cls => {
    const clsSignups = signups.filter(s => s.className === cls);
    if (!clsSignups.length) return;

    const emoji = getClassEmoji(cls);
    const enName = CLASS_ENGLISH[cls];

    const lines = clsSignups.map(s => {
      const pos = positionMap.get(s) || "";
      const tent = s.status === "tentative" ? " 🔸" : "";
      const conf = s.status === "confirmed" ? " ✅" : "";
      const spec = s.assignedSpec || (s.offeredSpecs && s.offeredSpecs.length ? s.offeredSpecs[0] : "");
      const specEmoji = spec ? getSpecEmoji(cls, spec, s.role) : (ROLE_EMOJI[s.role] || "⚔️");
      const specLabel = spec || s.role || "";
      return `${specEmoji} \`${pos}\` **${s.charName}** *${specLabel}*${tent}${conf}`;
    });

    fields.push({
      name: `${emoji} ${enName} (${clsSignups.length})`,
      value: truncField(lines.join("\n")),
      inline: true,
    });
    classFieldCount++;
  });

  // Pad last row of inline class fields to align in groups of 3
  const remainder = classFieldCount % 3;
  if (remainder > 0) {
    for (let i = 0; i < 3 - remainder; i++) {
      fields.push({ name: ZWS, value: ZWS, inline: true });
    }
  }

  // Full-width rows: Benched, Declined
  if (benched.length) {
    const emoji = getCustomEmojis()["Bench"] || "💺";
    const names = benched.map(s => {
      const clsEmoji = s.className ? getClassEmoji(s.className) + " " : "";
      return `${clsEmoji}${s.charName}`;
    });
    fields.push({
      name: `💺 Bank (${benched.length})`,
      value: truncField(names.join(", ")),
      inline: false,
    });
  }

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

  // Title with tier badge
  const tier = RAID_TIERS[raid.instance];
  const title = tier ? `⚔️  ${raid.instance}  ·  ${tier}` : `⚔️  ${raid.instance}`;

  // Author with creator name
  const authorName = raid.createdByName
    ? `<Vanilla> Raid-Planer  ·  👑 ${raid.createdByName}`
    : "<Vanilla> Raid-Planer";

  const embed = {
    author: {
      name: authorName,
      icon_url: `${WOW_ICONS}/class/64/warrior.png`,
    },
    title,
    description: descParts.join("\n"),
    color,
    fields,
    thumbnail: {
      url: RAID_THUMBNAILS[raid.instance] || `${WH_ICONS}/inv_misc_head_dragon_01.jpg`,
    },
    footer: {
      text: `Erstellt von ${raid.createdByName || "Unbekannt"} • Aktualisiert`,
      icon_url: `${WOW_ICONS}/class/64/warrior.png`,
    },
    timestamp: new Date().toISOString(),
  };

  return embed;
}

function buildRaidButtons(raidId, locked) {
  return [{
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: 3, // SUCCESS (green)
        label: locked ? "Gesperrt" : "Anmelden",
        emoji: { name: locked ? "🔒" : "✅" },
        custom_id: `raid_signup:${raidId}:accepted`,
        disabled: !!locked,
      },
      {
        type: 2,
        style: 2, // SECONDARY (gray)
        label: "Vielleicht",
        emoji: { name: "🔸" },
        custom_id: `raid_signup:${raidId}:tentative`,
        disabled: !!locked,
      },
      {
        type: 2,
        style: 4, // DANGER (red)
        label: "Absagen",
        emoji: { name: "❌" },
        custom_id: `raid_signup:${raidId}:declined`,
        disabled: !!locked,
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

    // ── Setup emojis (no raidId needed) ──
    if (action === "setup-emojis") {
      return await handleSetupEmojis(user, headers);
    }

    if (!action || !raidId) {
      return new Response(JSON.stringify({ error: "Action und Raid-ID erforderlich" }), { status: 400, headers });
    }

    // Load emoji cache from Blobs before building embeds
    await loadEmojiCache();

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
      const buttons = buildRaidButtons(raidId, raid.locked);

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
  const buttons = buildRaidButtons(raidId, raid.locked);

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

// ── Auto-upload WoW icons as Discord server emojis ──
async function handleSetupEmojis(user, headers) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId) {
    return new Response(JSON.stringify({
      error: "DISCORD_BOT_TOKEN und DISCORD_GUILD_ID müssen konfiguriert sein",
    }), { status: 400, headers });
  }

  const DISCORD_API = "https://discord.com/api/v10";

  // Build list of icons to upload: 9 class + 27 spec icons
  const toUpload = [];

  // Class icons
  for (const [cls, slug] of Object.entries(CLASS_ICON_SLUG)) {
    const en = CLASS_ENGLISH[cls];
    toUpload.push({
      name: `wow_${slug}`,
      url: `${WOW_ICONS}/class/64/${slug}.png`,
      mapKey: en, // e.g. "Warrior"
    });
  }

  // Spec icons (deduplicate by icon path)
  const seenPaths = new Set();
  for (const [cls, specs] of Object.entries(SPEC_ICONS)) {
    const en = CLASS_ENGLISH[cls];
    for (const [specName, iconPath] of Object.entries(specs)) {
      if (seenPaths.has(iconPath)) {
        // Shared icon (e.g. Feral Tank/DPS) — still map the spec name
        const existingEntry = toUpload.find(e => e.iconPath === iconPath);
        if (existingEntry) {
          existingEntry.extraMapKeys = existingEntry.extraMapKeys || [];
          existingEntry.extraMapKeys.push(`${en}_${specName}`);
        }
        continue;
      }
      seenPaths.add(iconPath);
      const emojiName = `wow_${iconPath.replace("/", "_")}`;
      toUpload.push({
        name: emojiName,
        url: `${WOW_ICONS}/spec/${iconPath}.png`,
        mapKey: `${en}_${specName}`,
        iconPath,
      });
    }
  }

  // Check existing guild emojis to avoid re-uploading
  let existingEmojis = [];
  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/emojis`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (res.ok) existingEmojis = await res.json();
  } catch { /* continue */ }

  const existingByName = {};
  existingEmojis.forEach(e => { existingByName[e.name] = e; });

  // Fetch all icon images in parallel from CDN
  const imageResults = await Promise.allSettled(
    toUpload.map(async (entry) => {
      const res = await fetch(entry.url);
      if (!res.ok) throw new Error(`CDN ${res.status} for ${entry.url}`);
      const buf = await res.arrayBuffer();
      return { ...entry, base64: Buffer.from(buf).toString("base64") };
    })
  );

  const emojiMap = {};
  const uploaded = [];
  const skipped = [];
  const errors = [];

  for (const result of imageResults) {
    if (result.status === "rejected") {
      errors.push(result.reason.message);
      continue;
    }
    const entry = result.value;

    // Check if already exists on server
    if (existingByName[entry.name]) {
      const existing = existingByName[entry.name];
      const emojiStr = `<:${existing.name}:${existing.id}>`;
      emojiMap[entry.mapKey] = emojiStr;
      if (entry.extraMapKeys) entry.extraMapKeys.forEach(k => { emojiMap[k] = emojiStr; });
      skipped.push(entry.name);
      continue;
    }

    // Upload to Discord
    try {
      const discordRes = await fetch(`${DISCORD_API}/guilds/${guildId}/emojis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({
          name: entry.name,
          image: `data:image/png;base64,${entry.base64}`,
        }),
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        if (discordRes.status === 429) {
          // Rate limited — save what we have so far and report
          errors.push(`Rate-Limit bei ${entry.name} — bitte später erneut ausführen`);
          break;
        }
        errors.push(`${entry.name}: ${discordRes.status} ${errText.slice(0, 100)}`);
        continue;
      }

      const emoji = await discordRes.json();
      const emojiStr = `<:${emoji.name}:${emoji.id}>`;
      emojiMap[entry.mapKey] = emojiStr;
      if (entry.extraMapKeys) entry.extraMapKeys.forEach(k => { emojiMap[k] = emojiStr; });
      uploaded.push(entry.name);
    } catch (e) {
      errors.push(`${entry.name}: ${e.message}`);
    }
  }

  // Store emoji map in Netlify Blobs
  if (Object.keys(emojiMap).length > 0) {
    const store = getStore({ name: "discord-emojis", consistency: "strong" });
    // Merge with existing map (in case of partial uploads)
    let existing = {};
    try { existing = (await store.get("emoji-map", { type: "json" })) || {}; } catch { /* ok */ }
    const merged = { ...existing, ...emojiMap };
    await store.setJSON("emoji-map", merged);
    // Reset cache so next request picks up new emojis
    _emojiCache = null;
  }

  return new Response(JSON.stringify({
    ok: true,
    uploaded: uploaded.length,
    skipped: skipped.length,
    errors,
    total: Object.keys(emojiMap).length,
  }), { status: 200, headers });
}

// Exported helpers for raids.mjs and discord-interactions.mjs
export { buildRaidEmbed, buildRaidButtons };

export const config = {
  path: "/api/discord",
};
