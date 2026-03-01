# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW TBC guild raid planner with DKP loot system and Discord integration. German-language UI. No framework, no build step — pure vanilla ES modules frontend with a Netlify Functions serverless backend. Data stored in Netlify Blobs.

## Development Commands

```bash
npm install                # Install dependencies (Playwright + http-server for tests)
netlify dev                # Local dev server with backend (requires netlify-cli + env vars)
npx http-server public -p 8888  # Frontend-only dev server (no backend, API calls fail)
```

There is no build step or linter.

## Testing

Playwright E2E tests run against a static server with mocked API routes (no Netlify account needed).

```bash
npm test                   # Run all 407 tests across 4 projects (desktop/tablet/mobile/responsive)
npm run test:headed        # Run tests with visible browser
npm run test:ui            # Interactive Playwright UI mode
npx playwright test tests/functional/form.spec.js              # Run a single test file
npx playwright test --project=desktop                          # Run one viewport only
npx playwright test -g "edit pre-fills"                        # Run tests matching name
npx playwright test tests/functional/form.spec.js --project=mobile  # Single file + viewport
```

**Test architecture:** Tests use `page.route()` to intercept all API endpoints — no real backend needed. The `setupMockApi(page, initialEntries)` fixture in `tests/fixtures/mock-api.js` provides in-memory CRUD stores for entries, DKP (balances/transactions/config), and raids, plus mock auth endpoints. Sample entries are in `tests/fixtures/test-data.js`. Tests that need auth seed `localStorage` with `page.addInitScript()` before `page.goto()`.

**Projects:** `desktop` (1280×720), `tablet` (768×1024), `mobile` (375×667), `responsive` (viewport-switching at 375/641/768/1280px).

**Test navigation:** Tests use hash-based navigation (`page.goto('/#/view')` or `page.evaluate(() => { window.location.hash = '#/view'; })`) because sidebar tabs are hidden on mobile. Do NOT use `page.click('[data-v="X"]')` for navigation — it fails on mobile.

**Web server:** Playwright auto-starts `http-server public -p 8888` — no manual setup required.

## Branching

- `dev` is the default branch for all development work
- Merge to `master` only on explicit instruction (= production deployment)

## Frontend Architecture

The frontend is a modular ES module SPA served from `public/`. No bundler — the browser loads modules directly.

### Core Modules (`public/js/`)

- **app.js** — Entry point: registers routes, loads data from API, sets up auth event delegation, initializes router. `loadData()` fetches entries, raids, and DKP on startup and after mutations.
- **state.js** — Centralized reactive state store. `getState(path)`, `update(path, value)`, `subscribe(path, callback)`. Paths are dot-separated (`'dkp.balances'`, `'auth.user'`, `'ui.dkpView'`). Subscribers are notified when any path in the hierarchy changes.
- **router.js** — Hash-based SPA router. Routes registered via `route(pattern, loader)` with dynamic segments (`:id`, `:name`). Views are lazy-loaded and cached. View CSS is lazy-loaded from `/styles/views/`. Uses View Transition API where available.
- **api.js** — Fetch wrapper: `api.get()`, `api.post()`, `api.del()`. Auto-attaches Bearer token from state. Handles 401 session expiry by clearing auth.
- **auth.js** — Battle.net OAuth flow, Discord linking, session validate/restore from localStorage. `initAuth()` runs on startup. `renderAuthBar()` renders login/logout UI.
- **constants.js** — `CLS` (9 German WoW classes with colors), `CLASS_SPECS` (class→spec mappings with roles), `ROLES`, `DAYS`, `SLOTS` (48 per day, 15-min from 12:00–23:45), `TBC_RAIDS`.
- **utils.js** — `h()` (HTML escape), `cc()` (class color), `specsToRoles()`, `collapseRanges()`, `migrateLegacyAvail()`, `linkItems()` ([Item]→Wowhead tooltip), `formatDate()`, `timeAgo()`.

### View Lifecycle

Each view module exports `render(container, params)` and optionally `unmount()`:

```
1. Router matches hash → lazy-imports view module
2. If previous view has unmount(), call it (cleans up state subscriptions)
3. View CSS loaded via <link> injection (one-time per view)
4. render(container, params) called — builds HTML, subscribes to state
5. State changes trigger re-render via subscriber callbacks
6. On route change → unmount() → new view render()
```

Views rebuild `container.innerHTML` on each render and re-attach event listeners. Form views call `syncInputs()` before re-render to preserve user input.

### State Shape

```
entries[]              — Character availability entries
raids[]                — Scheduled raids
dkp.balances[]         — DKP balance per player
dkp.transactions[]     — DKP transaction history
dkp.config             — Decay %, roles, limits
auth.user              — { token, username, userId, discordLinked, ... } or null
auth.bnetCharacters[]  — WoW characters from Battle.net
ui.dkpView             — 'overview' | 'award' | 'spend' | 'decay' | 'settings'
ui.dkpPlayerDetail     — player name when in detail view, null otherwise
ui.dkpSortCol/Dir      — Table sort state
ui.form                — Form field state { name, cls, specs, roles, avail, notes }
ui.sidebarExpanded     — Sidebar collapse state
```

### Navigation

- **Desktop (≥768px):** Persistent sidebar with all nav items + auth bar
- **Mobile (<768px):** Sidebar hidden (`display: none`), bottom nav with 5 items: Dashboard, Eintragen, Raids, DKP, Mehr. "Mehr" opens a bottom sheet with remaining views.
- Hash routes: `#/dashboard`, `#/form`, `#/raids`, `#/raids/:id`, `#/roster`, `#/heatmap`, `#/analytics`, `#/kara`, `#/dkp`, `#/dkp/player/:name`, `#/admin`
- Default route: `#/dashboard`

### CSS Architecture (`public/styles/`)

Layered CSS loaded via `<link>` tags in `index.html`:
- **tokens.css** — Design tokens: color primitives, WoW class colors, spacing scale, fluid typography (`clamp()`), role colors (Tank/Healer/DPS)
- **reset.css** — Box-sizing, margin reset
- **base.css** — Dark gradient body, Cinzel/Nunito Sans fonts, focus styles, scrollbar
- **layout.css** — Grid shell (sidebar + main + bottom nav), responsive breakpoints
- **components.css** — Buttons, cards, chips, modals, tables, forms, progress bars
- **views/*.css** — Per-view styles, lazy-loaded by router on first visit

## Backend (Netlify Functions)

Backend is **untouched** by the UX rebuild. All API contracts remain the same.

- `netlify/functions/entries.mjs` — `GET/POST/DELETE /api/entries`
- `netlify/functions/auth.mjs` — `POST /api/auth` (validate, bnet-login, discord-link/unlink, logout)
- `netlify/functions/raids.mjs` — `GET/POST/DELETE /api/raids`
- `netlify/functions/dkp.mjs` — `GET/POST /api/dkp` (award, spend, decay, undo, edit-transaction, delete-transaction, adjust-balance, edit-player, delete-player, save-config, manage-roles)
- `netlify/functions/bnet-callback.mjs` — Battle.net OAuth callback
- `netlify/functions/bnet-characters.mjs` — `GET /api/bnet-characters`
- `netlify/functions/discord-callback.mjs` — Discord OAuth callback
- `netlify/functions/discord.mjs` — Discord embed posting
- `netlify/functions/admin.mjs` — `GET /api/admin`
- `netlify/functions/shared/auth-utils.mjs` — `validateSession()`, token encryption, `isSiteAdmin()`

## Data Model

**Entries:** `{ id, charName, className, specs[], roles[], availability: { "Day_HH:MM": "yes"|"tentative" }, notes, userId, timestamp }`

Valid classes: Druide, Hexenmeister, Jäger, Krieger, Magier, Paladin, Priester, Schamane, Schurke. Days: German (Montag–Sonntag). Slots: 15-min increments 12:00–23:45 as `"Day_HH:MM"` keys.

**Raids:** `{ id, instance, date, time, maxPlayers, deadline, locked, notes, description, createdBy, signups[], timestamp }`

**DKP balances:** `{ playerName, className, balance, lastUpdated }`. **DKP transactions:** `{ id, playerName, type, amount, reason, createdBy, timestamp }`.

**DKP API specifics:** Award sends `players: [{ name, className }]` (not plain strings). Undo sends `{ action: 'undo', transactionId }`. Adjust sends `{ action: 'adjust-balance', playerName, newBalance, reason }`.

## Authentication

Battle.net OAuth 2.0 SSO. Reading is public; mutations require login.

**Frontend auth state:** Stored in `auth.user` state path and persisted to `localStorage["raid-auth"]`. Validated on page load via `/api/auth { action: "validate" }`.

**Ownership:** Users edit/delete only their own entries (`entry.userId === user.userId`). Legacy entries without `userId` are editable by any logged-in user. Admins can edit any entry.

**DKP roles:** Admin and officer roles are stored in `dkp.config.roles` (map of username → "admin"/"officer"). Matched by BattleTag prefix (e.g. "goodfell0w" matches "goodfell0w#12345").

## Key Selectors

- **Views:** `#v-form`, `#v-raids`, `#v-roster`, `#v-heatmap`, `#v-analytics`, `#v-kara`, `#v-dkp`, `#v-admin` (only active view is in DOM)
- **Navigation:** `.nav-item.tab` (sidebar), `.bottom-nav-item.tab` (bottom nav), `.more-sheet-item` (more sheet). Active tab has `.on` class.
- **Form:** `#f-name`, `.chip` (class), `.rchip` (spec), `#f-submit`
- **Roster:** `.entry`, `.e-name`, `.e-class`, `[data-edit]`, `[data-del]`
- **Heatmap:** `.htable`, `.hcell`, `.ht-btn`
- **Analytics:** `.bar-row`, `.bar-track`, `.bar-fill`, `.role-an-item`
- **DKP:** `.dkp-standings`, `.dkp-bal`, `.dkp-pchip`, `.dkp-detail-bal`, `.dkp-detail-stat`, `[data-dkp-sort]`, `[data-dkp-player]`
- **Modal:** `.modal-bg` (dialog element), `.modal-cancel`, `.modal-confirm`
- **Toast:** `#toast`, `#toast.show` (visible)
- **Auth:** `#auth-bar`, `.btn-bnet`, `.btn-logout`, `.auth-user`, `.auth-hint`

## Key Conventions

- All UI text in German
- XSS protection via `h()` for all user-supplied data in HTML
- Dark WoW-themed UI with gold accents; class/role colors follow WoW conventions
- Mobile breakpoint: `max-width: 767px` (layout.css), `max-width: 640px` (components.css)
- Views re-render entirely on state change (no DOM diffing)
- Event listeners re-attached after each render
- `loadData()` in app.js is called after every mutation to refresh state from API
- Modal uses native `<dialog>` element. `onConfirm` runs before `close()` — form values must be read synchronously before any `await`

**Required env vars (backend):** `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
