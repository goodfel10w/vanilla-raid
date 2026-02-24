import { getStore } from "@netlify/blobs";
import { createPublicKey, verify } from "node:crypto";
import { buildRaidEmbed, buildRaidButtons } from "./discord.mjs";

const DISCORD_API = "https://discord.com/api/v10";
const VALID_ROLES = ["Tank", "Heiler", "DPS"];

// Discord interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const MODAL_SUBMIT = 5;

// Discord interaction response types
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_UPDATE = 6;
const UPDATE_MESSAGE = 7;
const MODAL = 9;

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

      return await handleSignup(interaction, raidId, status, fields, headers);
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

// ── Handle signup/tentative modal submission ──
async function handleSignup(interaction, raidId, status, fields, headers) {
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

    // Use discord_{id} as userId to distinguish from website users
    const userId = `discord_${discordId}`;

    // Remove existing signup from this Discord user
    raid.signups = raid.signups.filter(s => s.userId !== userId);

    raid.signups.push({
      userId,
      username: discordName,
      charName,
      className: "",
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
