# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW TBC guild raid planner with DKP loot system and Discord integration. German-language UI. Vue 3 + Vite frontend with Netlify Functions serverless backend. Data stored in Netlify Blobs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript (strict) |
| Build | Vite 6 |
| Routing | vue-router 4 (hash mode) |
| State | Pinia |
| UI Components | shadcn-vue (Radix Vue + Tailwind CSS) |
| Styling | Tailwind CSS 4 + CSS variables for WoW theme tokens |
| Component Tests | Vitest + Vue Test Utils |
| E2E Tests | Playwright (4 viewport projects) |
| Deploy | Netlify (Vite build output) |
| Backend | Netlify Functions (unchanged from vanilla version) |

## Development Commands

```bash
npm install                # Install dependencies
npm run dev:vue            # Start Vite dev server (port 5173)
npm run build:vue          # TypeScript check + production build → dist/
npm run preview:vue        # Preview production build
npm run test:unit          # Run Vitest component/unit tests (261 tests)
npm run test:vue           # Run Playwright E2E tests against Vue app
npm test                   # Run legacy Playwright tests (against old public/index.html)
netlify dev                # Full local dev with backend (requires env vars)
```

## Testing

### Unit Tests (Vitest)
```bash
npm run test:unit                              # Run all 261 tests
npx vitest run src/__tests__/utils.spec.ts     # Run single test file
npx vitest --watch                             # Watch mode
```

Tests are in `src/__tests__/` mirroring the source structure. Use `@vue/test-utils` for component mounting.

### E2E Tests (Playwright)
```bash
npm run test:vue                               # All tests, all viewports
npx playwright test --config=playwright-vue.config.ts --project=desktop  # Desktop only
npx playwright test --config=playwright-vue.config.ts -g "edit"          # Pattern match
```

**Test architecture:** Tests use `page.route()` to intercept all API endpoints — no real backend needed. Mock API in `tests-vue/fixtures/mock-api.js` provides in-memory CRUD. Auth seeded via `localStorage` with `page.addInitScript()`.

**Projects:** `desktop` (1280×720), `tablet` (768×1024), `mobile` (375×667), `responsive` (viewport-switching).

**Navigation:** Use hash-based navigation (`page.goto('/#/view')`). Do NOT use `page.click('[data-v="X"]')` — it fails on mobile.

## Branching

- `feature/vue-migration` — Vue 3 migration branch
- `dev` is the default branch for development
- Merge to `master` only on explicit instruction (= production deployment)

## Frontend Architecture

### Directory Structure
```
src/
  main.ts                  # App entry point
  App.vue                  # Root layout (sidebar + main + bottom nav)
  assets/main.css          # Tailwind CSS + WoW design tokens
  components/
    layout/                # TheSidebar, TheBottomNav, TheMoreSheet, TheHeader, TheAuthBar
    shared/                # ConfirmModal, ClassChipSelector, SpecChipSelector, AvailabilityGrid, etc.
    ui/                    # shadcn-vue base components (Button, Card, Dialog, etc.)
    roster/                # RoleSummaryCards, EntryCard
    raids/                 # RaidCard, RaidForm, SignupModal
    dkp/                   # DkpStandings, DkpAwardForm, DkpSpendForm, DkpDecayForm, DkpSettings, etc.
    kara/                  # KaraPool, KaraGroup, KaraPlayer
    admin/                 # AdminOverview, AdminEntries, AdminManage
  composables/             # useToast, useFormSubmit, useBnetCharPicker, useHeatmapData, useAnalyticsData, useRaidSignup, useKaraDragDrop, useKaraAutoSuggest, useKaraPersistence
  lib/
    api.ts                 # Typed fetch wrapper (get/post/del with Bearer token)
    constants.ts           # CLS, CLASS_SPECS, ROLES, DAYS, SLOTS, TBC_RAIDS (typed)
    utils.ts               # cn(), h(), cc(), specsToRoles(), collapseRanges(), linkItems(), formatDate(), timeAgo()
  router/index.ts          # vue-router hash-mode routes
  stores/
    auth.ts                # Auth store (session, OAuth, Discord)
    entries.ts             # Entries store (CRUD)
    raids.ts               # Raids store (CRUD, signups)
    dkp.ts                 # DKP store (balances, transactions, config, actions)
    ui.ts                  # UI store (sidebar, form state, sort state)
  types/index.ts           # TypeScript interfaces (Entry, Raid, DkpBalance, etc.)
  views/                   # 11 view components (lazy-loaded by router)
```

### Pinia Stores

- **auth** — `user`, `bnetCharacters`, `isLoggedIn`, `isAdmin`. Actions: `validate()`, `bnetLogin()`, `logout()`, `discordLink()`
- **entries** — `entries[]`, `loading`. Actions: `load()`, `save()`, `remove()`
- **raids** — `raids[]`, `loading`. Actions: `load()`, `save()`, `remove()`
- **dkp** — `balances[]`, `transactions[]`, `config`. Actions: `load()`, `award()`, `spend()`, `decay()`, `undo()`, `editTransaction()`, `deleteTransaction()`, `adjustBalance()`, `saveConfig()`, `manageRoles()`
- **ui** — `dkpView`, `dkpPlayerDetail`, `dkpSortCol/Dir`, `dkpSearchQuery`, `formState`

### Routes (Hash Mode)

`#/dashboard`, `#/form`, `#/roster`, `#/heatmap`, `#/analytics`, `#/raids`, `#/raids/:id`, `#/kara`, `#/dkp`, `#/dkp/player/:name`, `#/admin`

Default: `#/dashboard`

### Responsive Layout

- **Desktop (≥768px):** Persistent sidebar (240px) + main content area
- **Mobile (<768px):** Sidebar hidden, bottom nav with 5 items: Dashboard, Eintragen, Raids, DKP, Mehr

## Backend (Netlify Functions)

Backend is **untouched** by the Vue migration. All API contracts remain the same.

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

**Frontend auth state:** Stored in auth Pinia store and persisted to `localStorage["raid-auth"]`. Validated on page load via `/api/auth { action: "validate" }`.

**Ownership:** Users edit/delete only their own entries (`entry.userId === user.userId`). Legacy entries without `userId` are editable by any logged-in user. Admins can edit any entry.

**DKP roles:** Admin and officer roles are stored in `dkp.config.roles` (map of username → "admin"/"officer"). Matched by BattleTag prefix (e.g. "goodfell0w" matches "goodfell0w#12345").

## Key Selectors (Preserved for E2E Tests)

- **Views:** `#v-form`, `#v-raids`, `#v-roster`, `#v-heatmap`, `#v-analytics`, `#v-kara`, `#v-dkp`, `#v-admin` (only active view in DOM — Vue router mounts one at a time)
- **Navigation:** `.tab` (nav items), `.tab.on` (active)
- **Form:** `#f-name`, `.chip`/`.chip.active`, `.rchip`/`.rchip.active`, `#f-submit`, `.tl-cell`/`.tl-cell.on`/`.tl-cell.tent`
- **Roster:** `.entry`, `.e-name`, `.e-class`, `[data-edit]`, `[data-del]`, `.rcard`, `.sort-sel`, `.btn-export`
- **Heatmap:** `.htable`, `.hcell`, `.ht-btn`, `#htooltip`
- **Analytics:** `.bar-row`, `.bar-fill`, `.role-an-item`
- **DKP:** `.dkp-standings`, `.dkp-bal`, `.dkp-pchip`, `[data-dkp-sort]`, `[data-dkp-player]`, `#dkp-search-input`, `.dkp-player-detail`, `.dkp-detail-name`, `.dkp-detail-bal`, `.dkp-undo`, `.dkp-tx`
- **Modal:** `.modal-bg`, `.modal-cancel`, `.modal-confirm`
- **Toast:** `#toast`, `#toast.show`
- **Auth:** `#auth-bar`, `.btn-bnet`, `.btn-logout`, `.auth-user`, `.auth-hint`

## Key Conventions

- All UI text in German
- Vue template auto-escaping handles XSS; `h()` utility for manual HTML construction
- Dark WoW-themed UI with gold accents; class/role colors follow WoW conventions
- Mobile breakpoint: `max-width: 767px`
- Vue components use `<script setup lang="ts">` with Composition API
- Stores reload data after mutations (e.g., `await load()` after `save()`)

**Required env vars (backend):** `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
