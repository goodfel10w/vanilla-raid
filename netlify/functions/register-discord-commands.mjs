import { validateSession, isSiteAdmin } from "./shared/auth-utils.mjs";

const DISCORD_API = "https://discord.com/api/v10";

const SIGNUP_COMMAND = {
  name: "signup",
  description: "Für einen Raid anmelden",
  options: [
    {
      name: "raid",
      description: "Welcher Raid?",
      type: 3, // STRING
      required: true,
      autocomplete: true,
    },
    {
      name: "charakter",
      description: "Dein Charakter (aus der Website, falls verknüpft)",
      type: 3,
      required: false,
      autocomplete: true,
    },
    {
      name: "rolle",
      description: "Deine Rolle (wird vom Charakter übernommen wenn leer)",
      type: 3,
      required: false,
      choices: [
        { name: "Tank 🛡️", value: "Tank" },
        { name: "Heiler 💚", value: "Heiler" },
        { name: "DPS ⚔️", value: "DPS" },
      ],
    },
    {
      name: "status",
      description: "Anmeldestatus (Standard: Sicher)",
      type: 3,
      required: false,
      choices: [
        { name: "Sicher ✅", value: "accepted" },
        { name: "Vielleicht 🔸", value: "tentative" },
        { name: "Absage ❌", value: "declined" },
      ],
    },
    {
      name: "notiz",
      description: "Optionale Notiz (z.B. Kann erst um 20:30)",
      type: 3,
      required: false,
    },
  ],
};

export default async (req) => {
  const headers = { "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // Admin-only endpoint
  const user = await validateSession(req);
  if (!user || !user.isAdmin) {
    return new Response(JSON.stringify({ error: "Nur Admins" }), { status: 403, headers });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APPLICATION_ID;
  if (!botToken || !appId) {
    return new Response(JSON.stringify({ error: "DISCORD_BOT_TOKEN und DISCORD_APPLICATION_ID erforderlich" }), { status: 500, headers });
  }

  try {
    // Register global command (takes up to 1 hour to propagate)
    // For instant testing, use guild commands instead
    const body = await req.json().catch(() => ({}));
    const guildId = body.guildId || process.env.DISCORD_GUILD_ID;

    let url;
    if (guildId) {
      // Guild command — instant propagation
      url = `${DISCORD_API}/applications/${appId}/guilds/${guildId}/commands`;
    } else {
      // Global command — up to 1h propagation
      url = `${DISCORD_API}/applications/${appId}/commands`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(SIGNUP_COMMAND),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Discord command registration error:", data);
      return new Response(JSON.stringify({ error: "Registrierung fehlgeschlagen", discord: data }), { status: 502, headers });
    }

    return new Response(JSON.stringify({
      ok: true,
      command: data,
      scope: guildId ? `Guild ${guildId}` : "Global (bis zu 1h Wartezeit)",
    }), { status: 200, headers });
  } catch (err) {
    console.error("Register command error:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/register-discord-commands",
};
