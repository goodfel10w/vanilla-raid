import { getStore } from "@netlify/blobs";
import { createPublicKey, verify } from "node:crypto";
import { buildRaidEmbed, buildRaidButtons } from "./discord.mjs";

const DISCORD_API = "https://discord.com/api/v10";
const VALID_ROLES = ["Tank", "Heiler", "DPS"];

// Discord interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const AUTOCOMPLETE = 4;
const MODAL_SUBMIT = 5;

// Discord interaction response types
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_UPDATE = 6;
const UPDATE_MESSAGE = 7;
const AUTOCOMPLETE_RESULT = 8;
const MODAL = 9;

// Class specs (same as raids.mjs)
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

const DAY_NAMES_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const ROLE_EMOJI = { Tank: "🛡️", Heiler: "💚", DPS: "⚔️" };

function fmtDate(ds) {
  const d = new Date(ds + "T00:00:00");
  const dn = DAY_NAMES_SHORT[d.getDay()];
  return dn + ", " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".";
}

// ── Ed25519 signature verification using Node.js crypto ──
function verifySignature(publicKeyHex, signature, timestamp, body) {
  try {
    // Ed25519 SPKI DER prefix (RFC 8410)
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const keyBytes = Buffer.from(publicKeyHex, "hex");
    const derKey = Buffer.concat([spkiPrefix, keyBytes]);

    const key = createPublicKey({ key: derKey, format: "der", type: "spki" });
    const sig = Buffer.from(signature, "hex");
    const msg = Buffer.from(timestamp + body);

    return verify(null, msg, key, sig);
  } catch {
    return false;
  }
}

export default async (req) => {
  const headers = { "Content-Type": "application/json" };

  // Only POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return new Response("Not configured", { status: 500 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp || !verifySignature(publicKey, signature, timestamp, rawBody)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  // ── PING ──
  if (interaction.type === PING) {
    return new Response(JSON.stringify({ type: PONG }), { status: 200, headers });
  }

  // ── AUTOCOMPLETE ──
  if (interaction.type === AUTOCOMPLETE) {
    return await handleAutocomplete(interaction, headers);
  }

  // ── SLASH COMMANDS ──
  if (interaction.type === APPLICATION_COMMAND) {
    if (interaction.data.name === "signup") {
      return await handleSignupCommand(interaction, headers);
    }
    return ephemeral("Unbekannter Befehl.", headers);
  }

  // ── BUTTON clicks ──
  if (interaction.type === MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id;

    // Format: raid_signup:{raidId}:{status}
    if (customId.startsWith("raid_signup:")) {
      const parts = customId.split(":");
      const raidId = parts[1];
      const status = parts[2]; // accepted, tentative, declined

      if (status === "declined") {
        // For decline: check if user has existing signup, remove it
        return await handleDecline(interaction, raidId, headers);
      }

      // For signup/tentative: show modal asking for character details
      return new Response(JSON.stringify({
        type: MODAL,
        data: {
          title: status === "tentative" ? "Vielleicht-Anmeldung" : "Raid-Anmeldung",
          custom_id: `raid_modal:${raidId}:${status}`,
          components: [
            {
              type: 1, // ACTION_ROW
              components: [{
                type: 4, // TEXT_INPUT
                custom_id: "char_name",
                label: "Charaktername",
                style: 1, // SHORT
                required: true,
                placeholder: "z.B. Thrallmächtig",
                max_length: 50,
              }],
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "role",
                label: "Rolle",
                style: 1,
                required: true,
                placeholder: "Tank, Heiler oder DPS",
                max_length: 10,
              }],
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "note",
                label: "Notiz (optional)",
                style: 2, // PARAGRAPH
                required: false,
                placeholder: "z.B. Kann erst um 20:30",
                max_length: 200,
              }],
            },
          ],
        },
      }), { status: 200, headers });
    }

    // Unknown component
    return new Response(JSON.stringify({
      type: CHANNEL_MESSAGE,
      data: { content: "Unbekannte Aktion.", flags: 64 },
    }), { status: 200, headers });
  }

  // ── MODAL submissions ──
  if (interaction.type === MODAL_SUBMIT) {
    const customId = interaction.data.custom_id;

    // Format: raid_modal:{raidId}:{status}
    if (customId.startsWith("raid_modal:")) {
      const parts = customId.split(":");
      const raidId = parts[1];
      const status = parts[2];

      // Extract form values
      const fields = {};
      for (const row of interaction.data.components) {
        for (const comp of row.components) {
          fields[comp.custom_id] = comp.value || "";
        }
      }

      return await handleModalSignup(interaction, raidId, status, fields, headers);
    }

    return new Response(JSON.stringify({
      type: CHANNEL_MESSAGE,
      data: { content: "Unbekannte Aktion.", flags: 64 },
    }), { status: 200, headers });
  }

  // Fallback
  return new Response(JSON.stringify({
    type: CHANNEL_MESSAGE,
    data: { content: "Nicht unterstützt.", flags: 64 },
  }), { status: 200, headers });
};

// ══════════════════════════════
//  AUTOCOMPLETE
// ══════════════════════════════

async function handleAutocomplete(interaction, headers) {
  const focused = findFocusedOption(interaction.data.options);
  if (!focused) {
    return new Response(JSON.stringify({ type: AUTOCOMPLETE_RESULT, data: { choices: [] } }), { status: 200, headers });
  }

  if (focused.name === "raid") {
    return await autocompleteRaid(focused.value || "", headers);
  }

  if (focused.name === "charakter") {
    const discordUser = interaction.member?.user || interaction.user;
    return await autocompleteCharacter(discordUser.id, focused.value || "", headers);
  }

  return new Response(JSON.stringify({ type: AUTOCOMPLETE_RESULT, data: { choices: [] } }), { status: 200, headers });
}

function findFocusedOption(options) {
  if (!options) return null;
  for (const opt of options) {
    if (opt.focused) return opt;
    if (opt.options) {
      const nested = findFocusedOption(opt.options);
      if (nested) return nested;
    }
  }
  return null;
}

async function autocompleteRaid(query, headers) {
  try {
    const store = getStore({ name: "raids", consistency: "strong" });
    const { blobs } = await store.list();

    const today = new Date().toISOString().slice(0, 10);
    const raids = [];

    // Load raids in parallel
    const loaded = await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })));
    for (const raid of loaded) {
      if (!raid || raid.date < today) continue; // Skip past raids
      raids.push(raid);
    }

    // Sort by date
    raids.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const lower = query.toLowerCase();
    const filtered = raids.filter(r =>
      !lower || r.instance.toLowerCase().includes(lower) || r.date.includes(lower)
    );

    const choices = filtered.slice(0, 25).map(r => {
      const signupCount = (r.signups || []).filter(s => s.status !== "declined").length;
      return {
        name: `${r.instance} — ${fmtDate(r.date)} ${r.time} Uhr (${signupCount}/${r.maxPlayers})`,
        value: r.id,
      };
    });

    return new Response(JSON.stringify({ type: AUTOCOMPLETE_RESULT, data: { choices } }), { status: 200, headers });
  } catch (err) {
    console.error("Raid autocomplete error:", err);
    return new Response(JSON.stringify({ type: AUTOCOMPLETE_RESULT, data: { choices: [] } }), { status: 200, headers });
  }
}

async function autocompleteCharacter(discordId, query, headers) {
  try {
    // Look up linked website user
    const discordMap = getStore({ name: "discord-user-map", consistency: "strong" });
    const mapping = await discordMap.get(discordId, { type: "json" });

    if (!mapping?.userId) {
      // Not linked — return empty with a hint
      return new Response(JSON.stringify({
        type: AUTOCOMPLETE_RESULT,
        data: { choices: [{ name: "⚠️ Discord nicht verknüpft — auf der Website verbinden", value: "__unlinked__" }] },
      }), { status: 200, headers });
    }

    // Load all entries and filter by userId
    const entryStore = getStore({ name: "raid-entries", consistency: "strong" });
    const { blobs } = await entryStore.list();
    const entries = await Promise.all(blobs.map(b => entryStore.get(b.key, { type: "json" })));

    const userEntries = entries.filter(e => e && e.userId === mapping.userId);

    const lower = query.toLowerCase();
    const filtered = userEntries.filter(e =>
      !lower || e.charName.toLowerCase().includes(lower) || e.className.toLowerCase().includes(lower)
    );

    const choices = filtered.slice(0, 25).map(e => {
      const specs = e.specs?.length ? ` — ${e.specs.join("/")}` : "";
      const roles = e.roles?.length ? ` (${e.roles.join("/")})` : "";
      return {
        name: `${e.charName} (${e.className}${specs}${roles})`.slice(0, 100),
        value: e.id,
      };
    });

    if (!choices.length) {
      choices.push({ name: "Keine Charaktere gefunden — auf der Website erstellen", value: "__no_chars__" });
    }

    return new Response(JSON.stringify({ type: AUTOCOMPLETE_RESULT, data: { choices } }), { status: 200, headers });
  } catch (err) {
    console.error("Character autocomplete error:", err);
    return new Response(JSON.stringify({ type: AUTOCOMPLETE_RESULT, data: { choices: [] } }), { status: 200, headers });
  }
}

// ══════════════════════════════
//  /signup SLASH COMMAND
// ══════════════════════════════

async function handleSignupCommand(interaction, headers) {
  const discordUser = interaction.member?.user || interaction.user;
  const discordId = discordUser.id;
  const discordName = discordUser.global_name || discordUser.username;

  // Extract options
  const opts = {};
  for (const opt of interaction.data.options || []) {
    opts[opt.name] = opt.value;
  }

  const raidId = opts.raid;
  const characterId = opts.charakter;
  const roleOverride = opts.rolle;
  const status = opts.status || "accepted";
  const note = opts.notiz || "";

  if (!raidId) {
    return ephemeral("Bitte wähle einen Raid aus.", headers);
  }

  try {
    const raidStore = getStore({ name: "raids", consistency: "strong" });
    const raid = await raidStore.get(raidId, { type: "json" });
    if (!raid) {
      return ephemeral("Raid nicht gefunden.", headers);
    }

    // Try to resolve character from website entries
    let charName = discordName;
    let className = "";
    let role = roleOverride || "DPS";
    let offeredSpecs = [];
    let linkedUserId = null;

    if (characterId && characterId !== "__unlinked__" && characterId !== "__no_chars__") {
      const entryStore = getStore({ name: "raid-entries", consistency: "strong" });
      const entry = await entryStore.get(characterId, { type: "json" });

      if (entry) {
        charName = entry.charName;
        className = entry.className || "";
        offeredSpecs = entry.specs || [];
        linkedUserId = entry.userId;

        // Derive role from specs if no explicit override
        if (!roleOverride && offeredSpecs.length && className) {
          const classSpecs = CLASS_SPECS[className] || [];
          const firstSpec = classSpecs.find(s => s.n === offeredSpecs[0]);
          if (firstSpec) role = firstSpec.r;
        }
        // Fall back to entry's roles
        if (!roleOverride && !offeredSpecs.length && entry.roles?.length) {
          role = entry.roles[0];
        }
      }
    }

    if (!raid.signups) raid.signups = [];

    // Determine userId: use linked website userId if available, else discord_{id}
    const userId = linkedUserId || `discord_${discordId}`;

    // Remove existing signup from this user (both discord and linked website id)
    raid.signups = raid.signups.filter(s =>
      s.userId !== userId && s.userId !== `discord_${discordId}`
    );

    // Handle decline
    if (status === "declined") {
      raid.signups.push({
        userId,
        username: discordName,
        charName,
        className,
        role,
        status: "declined",
        note: String(note).trim().slice(0, 200),
        discordId,
        discordUsername: discordName,
        timestamp: new Date().toISOString(),
      });

      await raidStore.setJSON(raidId, raid);

      return ephemeral(
        `❌ Du hast für **${raid.instance}** (${fmtDate(raid.date)}) abgesagt.`,
        headers,
      );
    }

    // Build signup
    const signup = {
      userId,
      username: discordName,
      charName,
      className,
      role,
      status,
      note: String(note).trim().slice(0, 200),
      discordId,
      discordUsername: discordName,
      timestamp: new Date().toISOString(),
    };
    if (offeredSpecs.length) signup.offeredSpecs = offeredSpecs;

    raid.signups.push(signup);
    await raidStore.setJSON(raidId, raid);

    // Update Discord embed if posted
    await tryUpdateEmbed(raidId, raid);

    const statusText = status === "tentative" ? "🔸 Vielleicht" : "✅ Angemeldet";
    const roleEmoji = ROLE_EMOJI[role] || "";
    const classInfo = className ? ` (${className})` : "";
    const specInfo = offeredSpecs.length ? ` — ${offeredSpecs.join("/")}` : "";

    return ephemeral(
      `${statusText} für **${raid.instance}** (${fmtDate(raid.date)} ${raid.time} Uhr)\n` +
      `${roleEmoji} **${charName}**${classInfo}${specInfo}`,
      headers,
    );
  } catch (err) {
    console.error("Signup command error:", err);
    return ephemeral("Fehler beim Anmelden. Bitte versuche es erneut.", headers);
  }
}

// Fire-and-forget: update the Discord embed message if it was posted
async function tryUpdateEmbed(raidId, raid) {
  try {
    const discordStore = getStore({ name: "discord-messages", consistency: "strong" });
    const mapping = await discordStore.get(raidId, { type: "json" });
    if (!mapping?.messageId) return;

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const embed = buildRaidEmbed(raid, siteUrl);
    const buttons = buildRaidButtons(raidId);

    if (botToken && mapping.channelId) {
      await fetch(`${DISCORD_API}/channels/${mapping.channelId}/messages/${mapping.messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
        body: JSON.stringify({ embeds: [embed], components: buttons }),
      });
    } else if (webhookUrl) {
      await fetch(`${webhookUrl}/messages/${mapping.messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }
  } catch (err) {
    console.error("tryUpdateEmbed error (non-fatal):", err);
  }
}

// ══════════════════════════════
//  BUTTON MODAL SIGNUP (existing)
// ══════════════════════════════

async function handleModalSignup(interaction, raidId, status, fields, headers) {
  const discordUser = interaction.member?.user || interaction.user;
  const discordId = discordUser.id;
  const discordName = discordUser.global_name || discordUser.username;

  const charName = String(fields.char_name || "").trim().slice(0, 50);
  const roleInput = String(fields.role || "").trim();
  const note = String(fields.note || "").trim().slice(0, 200);

  if (!charName) {
    return ephemeral("Bitte gib einen Charakternamen an.", headers);
  }

  // Normalize role input
  const roleLower = roleInput.toLowerCase();
  let role = "DPS";
  if (roleLower === "tank") role = "Tank";
  else if (roleLower === "heiler" || roleLower === "heal" || roleLower === "healer") role = "Heiler";
  else if (roleLower === "dps" || roleLower === "dd") role = "DPS";
  else if (!VALID_ROLES.includes(roleInput)) {
    return ephemeral(`Ungültige Rolle: "${roleInput}". Bitte Tank, Heiler oder DPS angeben.`, headers);
  } else {
    role = roleInput;
  }

  try {
    const raidStore = getStore({ name: "raids", consistency: "strong" });
    const raid = await raidStore.get(raidId, { type: "json" });
    if (!raid) {
      return ephemeral("Raid nicht gefunden.", headers);
    }

    if (!raid.signups) raid.signups = [];

    // Check if this Discord user has a linked website account
    let userId = `discord_${discordId}`;
    let className = "";
    try {
      const discordMap = getStore({ name: "discord-user-map", consistency: "strong" });
      const mapping = await discordMap.get(discordId, { type: "json" });
      if (mapping?.userId) {
        // Look up the character by name in the user's entries
        const entryStore = getStore({ name: "raid-entries", consistency: "strong" });
        const { blobs } = await entryStore.list();
        const entries = await Promise.all(blobs.map(b => entryStore.get(b.key, { type: "json" })));
        const match = entries.find(e =>
          e && e.userId === mapping.userId &&
          e.charName.toLowerCase() === charName.toLowerCase()
        );
        if (match) {
          userId = match.userId || userId;
          className = match.className || "";
        }
      }
    } catch (_) { /* non-fatal — fall back to discord-only signup */ }

    // Remove existing signup from this Discord user
    raid.signups = raid.signups.filter(s =>
      s.userId !== userId && s.userId !== `discord_${discordId}`
    );

    raid.signups.push({
      userId,
      username: discordName,
      charName,
      className,
      role,
      status: status || "accepted",
      note,
      discordId,
      discordUsername: discordName,
      timestamp: new Date().toISOString(),
    });

    await raidStore.setJSON(raidId, raid);

    // Update the embed in-place
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const embed = buildRaidEmbed(raid, siteUrl);
    const buttons = buildRaidButtons(raidId);

    // Respond with updated message (updates the embed the button was on)
    return new Response(JSON.stringify({
      type: UPDATE_MESSAGE,
      data: {
        embeds: [embed],
        components: buttons,
      },
    }), { status: 200, headers });
  } catch (err) {
    console.error("Signup error:", err);
    return ephemeral("Fehler beim Anmelden. Bitte versuche es erneut.", headers);
  }
}

// ── Handle decline ──
async function handleDecline(interaction, raidId, headers) {
  const discordUser = interaction.member?.user || interaction.user;
  const discordId = discordUser.id;
  const discordName = discordUser.global_name || discordUser.username;
  const userId = `discord_${discordId}`;

  try {
    const raidStore = getStore({ name: "raids", consistency: "strong" });
    const raid = await raidStore.get(raidId, { type: "json" });
    if (!raid) {
      return ephemeral("Raid nicht gefunden.", headers);
    }

    if (!raid.signups) raid.signups = [];

    const existing = raid.signups.find(s => s.userId === userId);
    if (existing) {
      // Mark existing signup as declined
      existing.status = "declined";
      existing.timestamp = new Date().toISOString();
    } else {
      // Create a declined entry
      raid.signups.push({
        userId,
        username: discordName,
        charName: discordName,
        className: "",
        role: "DPS",
        status: "declined",
        note: "",
        discordId,
        discordUsername: discordName,
        timestamp: new Date().toISOString(),
      });
    }

    await raidStore.setJSON(raidId, raid);

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const embed = buildRaidEmbed(raid, siteUrl);
    const buttons = buildRaidButtons(raidId);

    return new Response(JSON.stringify({
      type: UPDATE_MESSAGE,
      data: {
        embeds: [embed],
        components: buttons,
      },
    }), { status: 200, headers });
  } catch (err) {
    console.error("Decline error:", err);
    return ephemeral("Fehler beim Absagen. Bitte versuche es erneut.", headers);
  }
}

function ephemeral(message, headers) {
  return new Response(JSON.stringify({
    type: CHANNEL_MESSAGE,
    data: { content: message, flags: 64 },
  }), { status: 200, headers });
}

export const config = {
  path: "/api/discord-interactions",
};
