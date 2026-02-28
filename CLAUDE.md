# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW TBC guild raid planner with DKP loot system and Discord integration. German-language UI. No framework, no build step — pure vanilla HTML/CSS/JS frontend with a Netlify Functions serverless backend. Data stored in Netlify Blobs.

## Development Commands

```bash
npm install                # Install dependencies (serverless functions + dev tools)
netlify dev                # Local dev server (requires netlify-cli globally installed)
netlify deploy --prod      # Deploy to production (only after merge to master)
```

There is no build step or linter.

## Testing

Playwright E2E tests run against a static server with mocked API routes (no Netlify account needed).

```bash
npm test                   # Run all tests across 3 viewports (desktop/tablet/mobile)
npm run test:headed        # Run tests with visible browser
npm run test:ui            # Interactive Playwright UI mode
npx playwright test tests/functional/form.spec.js              # Run a single test file
npx playwright test --project=desktop                          # Run one viewport only
npx playwright test -g "edit pre-fills"                        # Run tests matching name
npx playwright test tests/functional/form.spec.js --project=mobile  # Single file + viewport
```

**Test architecture:** Tests use `page.route()` to intercept all API endpoints — no real backend needed. The `setupMockApi(page, initialEntries)` fixture in `tests/fixtures/mock-api.js` provides in-memory CRUD stores for entries, DKP (balances/transactions/config), and raids, plus mock auth endpoints (Battle.net login, Discord link/unlink, validate, logout). Sample entries are in `tests/fixtures/test-data.js`. All tests that need auth seed `localStorage` with `page.addInitScript()` before `page.goto()`.

**Mocked endpoints:** `/api/entries`, `/api/auth`, `/api/bnet-characters`, `/api/dkp`, `/api/raids`

**Projects:** `desktop` (1280×720), `tablet` (768×1024), `mobile` (375×667) run layout/functional tests. A separate `responsive` project runs viewport-switching tests at 375/641/768/1280px (including the 640px CSS breakpoint edge).

**Test files:** `tests/functional/` — form, roster, heatmap, analytics, auth, tabs, dkp, discord, raid-lock. `tests/layout/` — layout. `tests/responsive/` — responsive.

**Web server:** Playwright auto-starts `http-server public -p 8888` — no manual setup required.

## Branching

- `dev` is the default branch for all development work
- All changes are committed and pushed to `dev`
- Merge to `master` only on explicit instruction (= production deployment)
- `master` = Production, `dev` = Development

## Architecture

**Application files:**

- `public/index.html` — Complete single-page application with embedded CSS and JS. Contains 8 views: form (Eintragen), raids, roster (Aufstellung), heatmap, analytics (Auswertung), Kara groups, DKP, and admin. All rendering is function-based with global state variables.
- `netlify/functions/entries.mjs` — REST API for character raid-availability entries. Routes: `GET /api/entries`, `POST /api/entries`, `DELETE /api/entries?id=<id>` (or `?all=true` for admin bulk delete).
- `netlify/functions/auth.mjs` — Auth orchestrator: Battle.net OAuth URL generation (`bnet-login`), Discord OAuth URL generation (`discord-link`/`discord-unlink`), session validate/logout, admin purge-users.
- `netlify/functions/raids.mjs` — Raid scheduling CRUD with signup management. Routes: `GET /api/raids`, `POST /api/raids` (create/update/signup actions), `DELETE /api/raids?id=<id>`. Auto-updates Discord embed on changes.
- `netlify/functions/dkp.mjs` — DKP loot system. Routes: `GET /api/dkp` (balances/transactions/config, optional `?player=<name>`), `POST /api/dkp` (award/spend/decay/undo/edit-transaction/delete-transaction/adjust-balance/edit-player/delete-player/save-config/manage-roles).
- `netlify/functions/discord.mjs` — Discord embed builder and poster. Actions: post/update raid embeds, setup-emojis (auto-upload WoW class icons as custom Discord emojis).
- `netlify/functions/discord-interactions.mjs` — Discord slash command and button handler. Ed25519 signature verification. Supports `/signup` command with autocomplete, raid signup buttons with modals, character matching via guild nickname.
- `netlify/functions/bnet-callback.mjs` — Battle.net OAuth callback: code exchange, character fetch (filtered by faction/realm), user record creation, session creation. Returns token via URL fragment.
- `netlify/functions/bnet-characters.mjs` — Fresh WoW character import from Battle.net API. `GET /api/bnet-characters`. Falls back to cached characters if token expired.
- `netlify/functions/discord-callback.mjs` — Discord OAuth callback: account linking, guild membership check, Discord user map for slash command lookups.
- `netlify/functions/admin.mjs` — Admin user list. `GET /api/admin`. Returns all registered users with metadata (admin/officer role only).
- `netlify/functions/register-discord-commands.mjs` — Registers `/signup` slash command with Discord (guild-scoped or global).
- `netlify/functions/shared/auth-utils.mjs` — Shared utilities: `validateSession(req)`, `encryptToken`/`decryptToken` (AES-256-GCM), `isSiteAdmin(username)` (prefix-matched against hardcoded list).

**Frontend rendering pattern:** Each view has a `render*()` function that rebuilds `innerHTML` from global state. Tab switching toggles `.hidden` class on `#v-form`, `#v-raids`, `#v-roster`, `#v-heatmap`, `#v-analytics`, `#v-kara`, `#v-dkp`, `#v-admin`. The form calls `syncInputs()` before re-render to preserve user input from live DOM elements — but `renderForm(true)` skips this sync (used by `startEdit` to avoid overwriting pre-filled values).

`netlify.toml` — Build config, publishes `public/` directory.

## Data Model

**Entries** have: `id` (UUID), `charName`, `className` (German WoW class names), `specs[]` (class-specific specs, derives roles), `roles[]` (legacy fallback: Tank/Heiler/DPS array), `availability` (map of `"{Day}_{HH:MM}"` → `"yes"|"tentative"`), `notes`, `userId` (owner's UUID), `timestamp`.

Valid classes: Druide, Hexenmeister, Jäger, Krieger, Magier, Paladin, Priester, Schamane, Schurke.

Days are German (Montag–Sonntag). Time slots: 15-minute increments from 12:00 to 23:45 (48 slots per day). Keys formatted as `"{Day}_{HH:MM}"` (e.g. `"Mittwoch_20:15"`). Legacy range keys (e.g. `"Montag_18:00–20:00"`) are expanded server-side.

**Raids** have: `id` (UUID), `instance` (from 9 TBC raids), `date` (YYYY-MM-DD), `time` (HH:MM), `maxPlayers`, `deadline` (ISO), `locked`, `notes`, `description`, `createdBy`, `createdByName`, `signups[]`, `timestamp`.

**Raid signups** have: `userId`, `username`, `charName`, `className`, `role`, `offeredSpecs[]`, `assignedSpec`, `status` (accepted/tentative/declined/benched/confirmed), `note`, `discordId`, `discordUsername`, `benchedBy`, `addedBy`, `timestamp`.

**DKP balances** have: `playerName`, `className`, `balance` (numeric), `lastUpdated`.

**DKP transactions** have: `id`, `playerName`, `type` (earn/spend/decay/adjust), `amount` (+/−), `reason`, `createdBy`, `timestamp`, `editedBy`, `editedAt`.

**DKP config**: `roles` (map of username → "admin"/"officer"), `defaultDecayPercent`, `maxDkpAmount`, `allowNegativeBalance`, `startingBalance`, `transactionLimit`, `reasonMaxLength`.

**Users** have: `id`, `username` (BattleTag), `bnetId`, `battleTag`, `bnetAccessToken` (encrypted), `characters[]` ({ name, realm, className, level }), `discordId`, `discordUsername`, `discordAvatar`, `discordAccessToken` (encrypted), `discordGuildMember`, `discordGuildNickname`, `discordGuildRoles`, `discordLinkedAt`, `createdAt`, `updatedAt`.

## Authentication

Battle.net OAuth 2.0 SSO — no username/password. Reading (GET) is public; creating, editing, and deleting requires login.

**Auth flow:** `POST /api/auth { action: "bnet-login" }` → returns Battle.net OAuth URL → user redirected to Battle.net → callback at `/api/bnet-callback` exchanges code for access token, fetches BattleTag + characters, creates user/session → redirects to app with `#bnet_token=<sessionToken>` in URL fragment.

**Discord account linking:** `POST /api/auth { action: "discord-link" }` (requires active session) → Discord OAuth → `/api/discord-callback` → stores Discord ID, username, guild membership on user record. `discord-unlink` action removes Discord data.

**Token encryption:** AES-256-GCM via `auth-utils.mjs` for Battle.net and Discord access tokens. Requires `TOKEN_ENCRYPTION_KEY` env var.

**Netlify Blob stores:**
- `"users"` — Key: `username.toLowerCase()`, Value: user record (see Data Model)
- `"sessions"` — Key: UUID token, Value: `{ userId, username, bnetId, discordId, discordUsername, discordGuildMember, createdAt, expiresAt }`
- `"oauth-states"` — Battle.net CSRF tokens (10-min expiry, max 50 pending)
- `"discord-oauth-states"` — Discord CSRF tokens
- `"discord-user-map"` — Maps Discord ID → user for slash command lookups

**Ownership rules:**
- Users can only edit/delete their own entries (`entry.userId === currentUser.userId`)
- Legacy entries without `userId` can be edited/deleted by any logged-in user (and get the editor's `userId` on save)
- Admins (site admin via `isSiteAdmin`) can edit any entry
- Edit/delete buttons are only rendered for entries the current user owns (or legacy entries)

**Frontend auth state:** `currentUser` global (`{ token, username, userId, discordLinked, discordUsername, discordGuildMember }` or `null`). Persisted in `localStorage` key `"raid-auth"`. Validated on page load via `/api/auth` `validate` action.

**Test auth seeding:** Tests use `page.addInitScript()` to set `localStorage` with mock auth data before page load. The mock API intercepts `/api/auth` and returns success for validate/bnet-login/discord-link/discord-unlink/logout.

## DKP System

Standard DKP with configurable weekly decay. Admin/officer role-based permissions (matched by BattleTag prefix, e.g. "goodfell0w" matches "goodfell0w#12345").

**Actions:** award (multi-player), spend (loot), decay (% across all), adjust-balance, undo, edit-transaction, delete-transaction, edit-player (rename, cascades to transactions), delete-player (optional cascade), save-config, manage-roles.

**Stores:** `dkp-balances` (key: playerName.toLowerCase()), `dkp-transactions` (key: UUID), `dkp-config` (key: "dkp-settings").

**UI features:** `[Item]` syntax converted to Wowhead tooltip links. CSV export. Undo/edit/delete transactions. Player detail view with transaction history.

## Discord Integration

Raid info posted as rich Discord embeds with class-grouped signups, role breakdowns, progress bars, and interactive buttons (Signup/Tentative/Decline).

**Bot features:**
- Auto-upload WoW class/spec icons as custom Discord emojis (fetched from CDN, stored in `discord-emojis` blob)
- Slash command `/signup` with autocomplete for raids and characters
- Button-triggered signup modals with character pre-fill from guild nickname
- Embed auto-updates on raid signup changes (fire-and-forget)
- Posted message tracking in `discord-messages` blob store

**Env vars:** `DISCORD_BOT_TOKEN`, `DISCORD_WEBHOOK_URL` (fallback), `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY` (interaction verification), `DISCORD_CLIENT_ID`/`DISCORD_APPLICATION_ID`, `DISCORD_CLIENT_SECRET`.

## Raid Management

CRUD for raids across 9 TBC instances: Karazhan (10), Gruuls Unterschlupf (25), Magtheridons Kammer (25), Höhle des Schlangenschreins (25), Festung der Stürme (25), Hyjalgipfel (25), Schwarzer Tempel (25), Zul'Aman (10), Sonnenbrunnenplateau (25).

**Features:** Player signup with character, spec, role, status (accepted/tentative/declined/benched/confirmed). Raid locking (blocks signups except for creator). Signup deadline enforcement. Manual signup by organizer. Karazhan group planner (auto-balances 10-man groups by role). Monthly calendar view.

**Stores:** `raids` (key: UUID), `discord-messages` (key: raid ID → message/channel tracking).

## Key Conventions

- All UI text is in German
- XSS protection via `h()` helper function for HTML escaping
- Server-side validation mirrors client-side constants (classes, roles, specs, availability keys/values)
- Raid-ready thresholds: Tank ≥ 2, Healer ≥ 5, DPS ≥ 18 (25-man raid)
- Legacy `true` availability values are normalized to `"yes"` server-side
- Dark theme with WoW-themed gold accents; class and role colors follow WoW conventions
- CSS mobile breakpoint at `max-width: 640px`
- All Netlify Blob stores use `consistency: "strong"`

**Required env vars (backend):** `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`, `BNET_REGION` (default: "eu"), `BNET_REALM` (default: "thunderstrike"), `BNET_FACTION` (default: "ALLIANCE"), `TOKEN_ENCRYPTION_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_ID`/`DISCORD_APPLICATION_ID`, `DISCORD_CLIENT_SECRET`.

## Key Selectors (for tests and DOM manipulation)

- Tabs: `[data-v="form"]`, `[data-v="raids"]`, `[data-v="roster"]`, `[data-v="heatmap"]`, `[data-v="analytics"]`, `[data-v="kara"]`, `[data-v="dkp"]`, `[data-v="admin"]`, `.tab.on`
- Views: `#v-form`, `#v-raids`, `#v-roster`, `#v-heatmap`, `#v-analytics`, `#v-kara`, `#v-dkp`, `#v-admin` (toggle `.hidden`)
- Form: `#f-name`, `.chip`, `.rchip`, `.sbtn`, `#f-submit`
- Roster: `.entry`, `.e-name`, `.e-class`, `[data-edit]`, `[data-del]`, `.sort-sel`
- Heatmap: `.htable`, `.hcell`, `.ht-btn`, `.tooltip`
- Analytics: `.bar-row`, `.bar-track`, `.bar-fill`, `.role-an-item`
- Raids: `.raid-signup-name`, `.raid-tab-toggle`, `.raid-inst`, `.cal-raid`, `.cal-raid-time`
- DKP: `.dkp-bal`, `.dkp-tx-amount`, `.dkp-decay-preview`, `.dkp-detail-bal`, `.dkp-detail-stat`
- Kara groups: `.kara-group-count`, `.kara-role`
- Discord: `.btn-discord`, `.dc-ico`, `.discord-posted`
- Modal: `.modal-bg`, `.modal-cancel`, `.modal-confirm`
- Toast: `#toast.show`
- Auth bar: `#auth-bar`, `.auth-user`, `.btn-logout`, `.btn-bnet`
- Auth overlay: `#auth-overlay`, `.auth-overlay`, `.auth-box`

## Customization Points

- **Raid instances**: `TBC_RAIDS` array in `public/index.html`
- **Time slots**: Generated programmatically — 15-min increments from 12:00 to 23:45
- **Classes**: Array `CLS` in `public/index.html`
- **Guild name**: Search and replace `<Vanilla>` in HTML
