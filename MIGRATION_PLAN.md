# Vue 3 + shadcn-vue Migration Plan

## Context

The WoW TBC guild raid planner is currently a **monolithic vanilla JS SPA** — a single `public/index.html` (5,275 lines) with all CSS, HTML, and JavaScript inlined. No build step, no framework, no modules. State is managed via global variables with full innerHTML re-renders. While functional, this architecture limits maintainability, testability, and developer experience.

**Goal:** Migrate to **Vue 3 + shadcn-vue** with a modern stack (Vite, Pinia, vue-router, TypeScript, Tailwind CSS) while preserving every feature, the WoW-themed dark UI, German-language text, and the existing backend (Netlify Functions, unchanged). The migration follows a **test-driven approach** with both Vitest component tests and ported Playwright E2E tests.

**Structure:** The Vue app lives in a new `src/` directory. Vite builds to `dist/`. The old `public/index.html` is preserved until final cutover. Each phase below is a self-contained spec for an AI agent.

---

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
| Component Tests | Vitest + Vue Test Utils + @testing-library/vue |
| E2E Tests | Playwright (ported from existing 136 tests) |
| Deploy | Netlify (Vite build output) |
| Backend | Netlify Functions (unchanged) |

---

## Current Feature Inventory

| View | Route | Complexity | Key Features |
|------|-------|-----------|--------------|
| Dashboard | `#/dashboard` | Low | Entry count, quick stats |
| Form | `#/form` | High | Class/spec chips, availability grid (7×48), BNet char picker, drag-to-paint |
| Roster | `#/roster` | Medium | Entry list, sort, edit/delete, CSV export, role summary cards |
| Heatmap | `#/heatmap` | Medium | Aggregation table, 1h/3h/4h modes, tooltips, raid-ready indicators |
| Analytics | `#/analytics` | Low | Role/class bars, best times, player ranking |
| Raids | `#/raids`, `#/raids/:id` | High | List/week/month calendar, signup, locking, spec assignment, Discord posting |
| Kara Planner | `#/kara` | High | Drag-drop groups, auto-suggest, linking, time slots, export |
| DKP | `#/dkp`, `#/dkp/player/:name` | High | 6 sub-views, standings, award/spend/decay, transactions, role management |
| Admin | `#/admin` | Medium | Stats, user management, entries, purge operations |

**Tests:** 11 Playwright spec files, 136 tests × 4 viewport projects = ~544 test runs.

---

## Phase Overview

| # | Phase | Scope | Est. Files |
|---|-------|-------|-----------|
| 1 | Project Scaffolding | Vite + Vue + TS + Tailwind + shadcn-vue setup | ~15 |
| 2 | Design System & Theme | Tailwind config, WoW tokens, base components | ~20 |
| 3 | Core Infrastructure | Router, Pinia stores, API layer, auth | ~15 |
| 4 | Layout Shell | App shell, sidebar, bottom nav, responsive layout | ~10 |
| 5 | Shared Components | Modal, toast, chips, cards, tables, forms | ~15 |
| 6 | Dashboard View | Port dashboard with stats | ~5 |
| 7 | Form View | Class/spec chips, availability grid, submission | ~10 |
| 8 | Roster View | Entry list, sort, edit/delete, CSV export | ~8 |
| 9 | Heatmap & Analytics | Heatmap modes, tooltips, analytics charts | ~10 |
| 10 | Raids View | Raid list, calendar, signup, locking, form | ~15 |
| 11 | DKP View | Standings, player detail, award/spend/decay/settings | ~12 |
| 12 | Kara Planner | Drag-drop groups, auto-suggest, linking, export | ~8 |
| 13 | Admin View | Stats, user/entry management, purge | ~6 |
| 14 | E2E Test Migration | Port all 11 Playwright spec files | ~15 |
| 15 | Final Integration & Cutover | Build config, Netlify deploy, cleanup | ~5 |

---

## Phase 1: Project Scaffolding

**Goal:** Initialize the Vue 3 + Vite project in `src/` with TypeScript, Tailwind CSS, and shadcn-vue. Verify the dev server runs and builds cleanly.

**Deliverables:**
```
src/
  main.ts                  # Vue app entry
  App.vue                  # Root component (placeholder)
  vite-env.d.ts            # Vite type declarations
  env.d.ts                 # Import meta env types
vite.config.ts             # Vite config (base, proxy /api → netlify dev)
tsconfig.json              # Strict TS config
tsconfig.app.json          # App-specific TS config
tailwind.config.ts         # Tailwind config (stub, extended in Phase 2)
postcss.config.js          # PostCSS with Tailwind
src/assets/
  main.css                 # Tailwind directives + base styles
components.json            # shadcn-vue config
package.json               # Updated deps (vue, vite, tailwind, shadcn-vue, pinia, vue-router, vitest, etc.)
vitest.config.ts           # Vitest setup for component tests
```

**Steps:**
1. Run `npm create vite@latest` with Vue + TypeScript template in `src/` (or scaffold manually)
2. Install dependencies: `vue`, `vue-router`, `pinia`, `@vueuse/core`, `tailwindcss`, `@tailwindcss/vite`, `radix-vue`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-vue-next`
3. Install dev deps: `vitest`, `@vue/test-utils`, `@testing-library/vue`, `jsdom`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`
4. Initialize shadcn-vue with `npx shadcn-vue@latest init`
5. Configure Vite proxy: `/api` → `http://localhost:8888` (Netlify dev)
6. Configure Vite build output to `dist/`
7. Add `dev:vue` and `build:vue` scripts to package.json
8. Add a smoke vitest test: `src/__tests__/app.spec.ts` — mounts App.vue, checks it renders

**Acceptance Criteria:**
- `npm run dev:vue` starts Vite dev server
- `npm run build:vue` produces `dist/index.html`
- `npx vitest run` passes the smoke test
- No TypeScript errors

**Key Decision:** Vite proxy config must forward `/api/*` to the Netlify Functions backend so the existing API layer works unchanged.

---

## Phase 2: Design System & Theme

**Goal:** Replicate the WoW-themed dark UI in Tailwind CSS. Create the design token system and base shadcn-vue component overrides.

**Deliverables:**
```
src/assets/main.css               # CSS variables, @layer base styles, font imports
tailwind.config.ts                 # Full theme: colors, fonts, spacing, breakpoints
src/lib/utils.ts                   # cn() helper (clsx + tailwind-merge)
src/lib/constants.ts               # CLS, CLASS_SPECS, ROLES, DAYS, SLOTS, TBC_RAIDS (typed)
src/components/ui/                 # shadcn-vue base components (button, card, badge, input, etc.)
src/__tests__/constants.spec.ts    # Unit tests for constants (class count, slot count, etc.)
```

**Design Tokens to Migrate (from `public/index.html` lines 12-20):**
```css
--gold: #c9a84c          --gold-l: #f0d878       --gold-d: #a8873a
--bg: #0a0a12            --bg2: #12101f
--card: rgba(255,255,255,0.025)   --bdr: rgba(255,255,255,0.06)
--tx: #e0ddd4  --tx2: #8a8098  --tx3: #6a6278  --tx4: #5a5268  --tx5: #3a3548
--tank: #5b9bd5          --heal: #66bb6a         --dps: #e57373
--grn: #66bb6a  --ylw: #e5c244  (+ bg/border variants)
```

**WoW Class Colors (9 classes):**
- Druide: #ff7c0a, Hexenmeister: #8788ee, Jäger: #aad372, Krieger: #c69b6d
- Magier: #3fc7eb, Paladin: #f48cba, Priester: #ffffff, Schamane: #0070dd, Schurke: #fff468

**Fonts:** Cinzel (headings, serif), Nunito Sans (body, sans-serif) — loaded from Google Fonts.

**Steps:**
1. Map all CSS variables to Tailwind `theme.extend.colors` entries
2. Configure fonts in Tailwind config + Google Fonts import in `main.css`
3. Set up dark gradient background as base body style
4. Create `cn()` utility in `src/lib/utils.ts`
5. Type and export all constants from `src/lib/constants.ts`:
   - `CLS`: array of `{ name: string, color: string, icon: string }` (9 WoW classes)
   - `CLASS_SPECS`: `Record<string, { name: string, role: 'Tank'|'Heiler'|'DPS' }[]>`
   - `ROLES`: `['Tank', 'Heiler', 'DPS']`
   - `DAYS`: German day names
   - `SLOTS`: 48 time slots (12:00–23:45 in 15-min increments)
   - `TBC_RAIDS`: array of raid instance objects
6. Initialize shadcn-vue components: Button, Card, Badge, Input, Label, Select, Dialog, Table, Tooltip, Tabs, Separator, DropdownMenu, Checkbox, ScrollArea
7. Override shadcn-vue component styles for WoW theme (gold gradients, dark backgrounds)

**Acceptance Criteria:**
- Vitest tests pass for constants (9 classes, 7 days, 48 slots, correct spec-role mappings)
- shadcn-vue components render with WoW theme (gold buttons, dark cards)
- No Tailwind purge issues — all token classes available

---

## Phase 3: Core Infrastructure

**Goal:** Build the API layer, Pinia stores, authentication system, and router. This is the nervous system of the app.

**Deliverables:**
```
src/lib/api.ts                     # Typed fetch wrapper (get, post, del)
src/stores/entries.ts              # Entries store (CRUD, list)
src/stores/raids.ts                # Raids store (CRUD, signups)
src/stores/dkp.ts                  # DKP store (balances, transactions, config, actions)
src/stores/auth.ts                 # Auth store (session, OAuth, Discord, roles)
src/stores/ui.ts                   # UI store (sidebar, form state, sort state)
src/router/index.ts                # vue-router hash-mode routes
src/lib/utils.ts                   # h() XSS escape, cc() class color, specsToRoles(), collapseRanges(), linkItems(), formatDate(), timeAgo()
src/__tests__/api.spec.ts          # API layer tests (mocked fetch)
src/__tests__/stores/*.spec.ts     # Store unit tests
src/__tests__/utils.spec.ts        # Utility function tests
```

**API Layer (`src/lib/api.ts`):**
- `api.get(url)` — GET with Bearer token from auth store
- `api.post(url, data)` — POST JSON with Bearer token
- `api.del(url)` — DELETE with Bearer token
- Auto-clear auth on 401 responses
- TypeScript interfaces for all request/response shapes

**Stores:**

`auth.ts` — Pinia store:
- State: `user`, `bnetCharacters`
- Actions: `validate()`, `bnetLogin()`, `discordLink()`, `discordUnlink()`, `logout()`, `loadBnetCharacters()`, `restoreSession()` (from localStorage)
- Getters: `isLoggedIn`, `isAdmin`, `dkpRole`, `isDkpAdmin`, `isDkpOfficer`

`entries.ts` — Pinia store:
- State: `entries[]`
- Actions: `load()`, `save(data)`, `delete(id)`

`raids.ts` — Pinia store:
- State: `raids[]`
- Actions: `load()`, `save(data)`, `delete(id)`, `signup()`, `lock()`, `unlock()`

`dkp.ts` — Pinia store:
- State: `balances[]`, `transactions[]`, `config`
- Actions: `load()`, `award()`, `spend()`, `decay()`, `undo()`, `editTransaction()`, `deleteTransaction()`, `adjustBalance()`, `editPlayer()`, `deletePlayer()`, `saveConfig()`, `manageRoles()`
- Getters: `sortedBalances`, `playerTransactions(name)`

`ui.ts` — Pinia store:
- State: `sidebarExpanded`, `dkpView`, `dkpPlayerDetail`, `dkpSortCol`, `dkpSortDir`, `formState`

**Router (`src/router/index.ts`):**
- Hash mode (`createWebHashHistory()`)
- Routes: `/dashboard`, `/form`, `/raids`, `/raids/:id`, `/roster`, `/heatmap`, `/analytics`, `/kara`, `/dkp`, `/dkp/player/:name`, `/admin`
- Lazy-loaded view components
- Default route: `/dashboard`

**Utility Functions (`src/lib/utils.ts`):**
Port from `public/index.html`:
- `h(s)` — HTML escape (line 1351)
- `cc(className)` — class color lookup
- `specsToRoles(cls, specs)` — infer roles from specs
- `collapseRanges(avail, day)` — aggregate 15-min slots to ranges
- `migrateLegacyAvail(av)` — legacy availability format migration
- `linkItems(text)` — `[Item Name]` → Wowhead tooltip links
- `formatDate(iso)` — German date formatting
- `timeAgo(iso)` — relative time display

**Acceptance Criteria:**
- All store unit tests pass (CRUD operations, auth flow, DKP calculations)
- API layer tests pass with mocked fetch
- Utility function tests pass (XSS escape, role inference, range collapse)
- Router navigates between placeholder views without errors

---

## Phase 4: Layout Shell

**Goal:** Build the responsive app shell — sidebar navigation (desktop), bottom nav (mobile), header, and auth bar.

**Deliverables:**
```
src/App.vue                        # Layout shell: sidebar + main + bottom nav
src/components/layout/
  TheSidebar.vue                   # Desktop sidebar nav (≥768px)
  TheBottomNav.vue                 # Mobile bottom nav (<768px)
  TheMoreSheet.vue                 # Mobile "Mehr" bottom sheet
  TheHeader.vue                    # Guild header + counter
  TheAuthBar.vue                   # Login/logout + Discord status
src/__tests__/components/layout/
  TheSidebar.spec.ts
  TheBottomNav.spec.ts
  TheAuthBar.spec.ts
```

**Navigation Items:**
- Dashboard (always), Eintragen (always), Raids (always), Aufstellung (always), Heatmap (always), Auswertung (always), DKP (always), Kara Gruppen (conditional), Admin (conditional on admin role)

**Mobile Bottom Nav (5 items):**
- Dashboard, Eintragen, Raids, DKP, Mehr

**Auth Bar UI:**
- Logged out: "Mit Battle.net anmelden" button
- Logged in: Username + role badge + Discord status + logout button

**Steps:**
1. Build `App.vue` with CSS grid layout: sidebar (240px) + main content area
2. Sidebar: vertical nav with route links, auth bar at bottom, active route highlighting
3. Bottom nav: 5 fixed items, "Mehr" opens a slide-up sheet with remaining nav items
4. Auth bar: reactive to auth store state, Battle.net login button triggers OAuth flow
5. Responsive: sidebar hidden below 768px, bottom nav shown below 768px
6. Header: guild name "‹Vanilla›", title "Raid-Planer — TBC", entry counter

**Acceptance Criteria:**
- Component tests: sidebar renders all nav items, bottom nav renders 5 items, auth bar toggles login/logout
- Desktop: sidebar visible, bottom nav hidden
- Mobile: sidebar hidden, bottom nav visible
- Router links navigate correctly
- Auth bar reflects store state changes

---

## Phase 5: Shared Components

**Goal:** Build all reusable UI components used across multiple views.

**Deliverables:**
```
src/components/shared/
  ConfirmModal.vue                 # Confirmation dialog (shadcn Dialog)
  AppToast.vue                     # Toast notifications (shadcn Toast or custom)
  ClassChipSelector.vue            # 9 WoW class chips (single-select)
  SpecChipSelector.vue             # Spec chips per class (multi-select)
  RoleBadge.vue                    # Tank/Heiler/DPS badge with color
  ClassIcon.vue                    # WoW class icon image
  AvailabilityGrid.vue             # 7-day × 48-slot timeline grid with drag-to-paint
  DataTable.vue                    # Sortable data table (wraps shadcn Table)
  EmptyState.vue                   # "No data" placeholder
  PlayerChip.vue                   # Player name with class color
src/__tests__/components/shared/
  ClassChipSelector.spec.ts
  SpecChipSelector.spec.ts
  AvailabilityGrid.spec.ts
  ConfirmModal.spec.ts
```

**Key Component Details:**

`ClassChipSelector.vue`:
- Props: `modelValue: string | null` (selected class name)
- Emits: `update:modelValue`
- Renders 9 chips with WoW class colors and icons
- Single-select behavior (radio group semantics)

`SpecChipSelector.vue`:
- Props: `className: string`, `modelValue: string[]` (selected specs)
- Emits: `update:modelValue`
- Dynamically shows specs for selected class from CLASS_SPECS
- Multi-select with role color coding

`AvailabilityGrid.vue`:
- Props: `modelValue: Record<string, 'yes'|'tentative'>` (availability map)
- Emits: `update:modelValue`
- 7 days × 48 slots grid with horizontal scroll
- Click cycles: empty → yes (green) → tentative (yellow) → empty
- Drag-to-paint with mouse and touch support
- Hour column markers

`ConfirmModal.vue`:
- Uses shadcn `Dialog` component
- Props: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`
- Emits: `confirm`, `cancel`
- Gold-themed styling

**Acceptance Criteria:**
- All component tests pass
- ClassChipSelector: selects class, emits correctly, shows all 9 classes
- SpecChipSelector: shows specs for selected class, multi-select works
- AvailabilityGrid: click cycling works, drag-to-paint works, emits correct availability map
- ConfirmModal: opens, confirms, cancels

---

## Phase 6: Dashboard View

**Goal:** Port the dashboard overview page.

**Deliverables:**
```
src/views/DashboardView.vue
src/__tests__/views/DashboardView.spec.ts
```

**Features:**
- Entry count display
- Quick stats: role distribution summary (Tank/Heiler/DPS counts)
- Class distribution overview
- Recent activity / last updated info
- Links to key views (Eintragen, Raids, DKP)

**Acceptance Criteria:**
- Component test: renders with mock store data, shows correct counts
- Empty state when no entries

---

## Phase 7: Form View

**Goal:** Port the character entry form — the most complex input view.

**Deliverables:**
```
src/views/FormView.vue
src/composables/useFormSubmit.ts     # Form submission logic
src/composables/useBnetCharPicker.ts # Battle.net character picker
src/__tests__/views/FormView.spec.ts
src/__tests__/composables/useFormSubmit.spec.ts
```

**Features:**
- Character name input (text field)
- Battle.net character picker dropdown (auto-fills name + class)
- Class chip selector (ClassChipSelector component)
- Spec chip selector (SpecChipSelector component, appears after class selected)
- Availability grid (AvailabilityGrid component)
- Notes textarea
- Submit button ("Eintragen" for new, "Aktualisieren" for edit)
- Edit mode: pre-fills all fields from existing entry
- Validation: name required, class required, at least one spec required
- Auth gate: prompt to login if not authenticated

**Data Flow:**
1. User fills form → local reactive state
2. Submit → `entriesStore.save({ charName, className, specs, roles, availability, notes })`
3. On success → toast, navigate to roster, reload data
4. On edit → pre-populate from `entries.find(e => e.id === editId)`

**Acceptance Criteria:**
- Component test: renders form, selects class → shows specs, submits valid data
- Component test: edit mode pre-fills correctly
- Component test: validation blocks empty submission
- Composable test: useFormSubmit calls API correctly

---

## Phase 8: Roster View

**Goal:** Port the roster / entry list view.

**Deliverables:**
```
src/views/RosterView.vue
src/components/roster/
  RoleSummaryCards.vue               # Tank/Heiler/DPS count cards
  EntryCard.vue                      # Individual entry display
src/__tests__/views/RosterView.spec.ts
src/__tests__/components/roster/EntryCard.spec.ts
```

**Features:**
- Role summary cards: 3 cards showing Tank/Heiler/DPS counts with class breakdown
- Entry list with:
  - Character name (class-colored), class, specs/roles, availability ranges, notes
  - Edit/Delete buttons (only for owner or admin)
- Sort dropdown: by name, class, role
- CSV export button (downloads all entries)
- Empty state when no entries
- Ownership logic: `entry.userId === currentUser.userId` or admin

**Acceptance Criteria:**
- Component test: renders entries, sort changes order, CSV export generates correct output
- EntryCard test: shows edit/delete for owner, hides for non-owner
- Empty state displays when entries array is empty

---

## Phase 9: Heatmap & Analytics Views

**Goal:** Port both data visualization views.

**Deliverables:**
```
src/views/HeatmapView.vue
src/views/AnalyticsView.vue
src/composables/useHeatmapData.ts    # heatData(), heatData3h(), heatData4h()
src/composables/useAnalyticsData.ts  # Role/class distribution, best times, rankings
src/__tests__/views/HeatmapView.spec.ts
src/__tests__/views/AnalyticsView.spec.ts
src/__tests__/composables/useHeatmapData.spec.ts
```

**Heatmap Features:**
- Mode toggle: 1h / 3h / 4h
- Two tables: weekdays (Mon-Fri) + weekend (Sat-Sun)
- Heat cells: color intensity by player count, green outline when raid-ready
- Hover tooltip: player list with role breakdown for time slot
- Top 5 best raid windows display

**Analytics Features:**
- Role distribution: Tank/Heiler/DPS progress bars with counts and percentages
- Class distribution: horizontal bars ranked by count, class-colored
- Best raid times: top 3 hourly slots with role breakdown + player list
- Player availability ranking: horizontal bars showing slot count per player

**Acceptance Criteria:**
- Heatmap test: renders with mock data, mode toggle changes display, tooltips show correct data
- Analytics test: role distribution math correct, class bars sorted, player ranking correct
- Composable tests: heatData calculations verified against known inputs

---

## Phase 10: Raids View

**Goal:** Port the raid management view — list, calendar, detail, signup, creation.

**Deliverables:**
```
src/views/RaidsView.vue
src/views/RaidDetailView.vue
src/components/raids/
  RaidCard.vue                       # Raid card in list view
  RaidCalendarWeek.vue               # Weekly calendar grid
  RaidCalendarMonth.vue              # Monthly calendar grid
  RaidForm.vue                       # Create/edit raid form
  RaidComposition.vue                # Role composition panel
  RaidSignupRow.vue                  # Individual signup display
  SignupModal.vue                    # Signup dialog
src/composables/useRaidSignup.ts
src/__tests__/views/RaidsView.spec.ts
src/__tests__/views/RaidDetailView.spec.ts
src/__tests__/components/raids/RaidCard.spec.ts
```

**Features:**
- View modes: List (default), Week calendar, Month calendar
- Filter: All / 10er / 25er raids
- Raid cards: instance, date/time, player count, signup progress bar, role breakdown
- Raid detail (`#/raids/:id`): full signup list by role, composition panel, bench list
- Signup flow: modal with character selection + spec override + status
- Raid locking: owner can lock/unlock, locked raids block signups
- Raid form: create/edit with instance, date, time, maxPlayers, deadline, notes, description
- Discord posting: button to push raid embed to Discord webhook
- Past raids: greyed out, at bottom

**Acceptance Criteria:**
- Component test: renders raid list, filters by size, view mode switches
- Detail test: shows signups by role, lock blocks signup UI
- Signup test: modal opens, submits correct payload
- Form test: validates required fields, creates raid

---

## Phase 11: DKP View

**Goal:** Port the DKP loot system — the most feature-rich view with 6 sub-views.

**Deliverables:**
```
src/views/DkpView.vue
src/views/DkpPlayerDetailView.vue
src/components/dkp/
  DkpActionsBar.vue                  # Sub-view navigation tabs
  DkpStandings.vue                   # Standings table with sort + search
  DkpPlayerDetail.vue                # Player transaction history
  DkpAwardForm.vue                   # Award DKP form (officer+)
  DkpSpendForm.vue                   # Spend DKP form (officer+)
  DkpDecayForm.vue                   # Decay form (admin)
  DkpSettings.vue                    # Config + role management (admin)
  DkpTransactionRow.vue              # Transaction display
src/__tests__/views/DkpView.spec.ts
src/__tests__/components/dkp/DkpStandings.spec.ts
src/__tests__/components/dkp/DkpAwardForm.spec.ts
```

**Features:**
- Sub-view navigation: Overview, Mein DKP, Vergeben (Award), Ausgeben (Spend), Verfall (Decay), Einstellungen (Settings)
- Role-gated tabs: Award/Spend for officer+, Decay/Settings for admin
- Standings: sortable table (rank, player, class, balance), search, CSV export
- Player detail (`#/dkp/player/:name`): balance card, stats (earned/spent/decayed), transaction list
- Award: multi-player chip selector, amount, reason, preview total
- Spend: player dropdown (with balance), amount, item name (Wowhead linking)
- Decay: percentage input, preview affected players
- Settings: config form (decay%, max DKP, negative balances, etc.) + role management (add/remove admin/officer)
- Undo: revert last transaction (admin only)
- Transaction rows: type badge (earn=green, spend=red, decay=yellow, adjust=gold), edit/delete (admin)

**Key DKP API Patterns:**
- Award sends `{ action: 'award', players: [{ name, className }], amount, reason }`
- Spend sends `{ action: 'spend', playerName, amount, reason }`
- Decay sends `{ action: 'decay', percent }`
- Undo sends `{ action: 'undo', transactionId }`

**Acceptance Criteria:**
- Standings test: renders, sorts by all columns, search filters, CSV exports
- Award test: multi-select players, submit sends correct payload
- Spend test: player dropdown, amount validation, balance check
- Decay test: percentage preview, confirms before executing
- Settings test: role management CRUD, config saves
- Undo test: reverts transaction, updates balance

---

## Phase 12: Kara Planner View

**Goal:** Port the Karazhan group distribution planner.

**Deliverables:**
```
src/views/KaraView.vue
src/components/kara/
  KaraPool.vue                       # Unassigned player pool
  KaraGroup.vue                      # Single Kara group (10-player)
  KaraPlayer.vue                     # Draggable player card
  KaraTimeSuggestions.vue            # Time slot suggestions
src/composables/useKaraDragDrop.ts   # Drag-and-drop logic
src/composables/useKaraAutoSuggest.ts # Auto-distribution algorithm
src/composables/useKaraPersistence.ts # localStorage per ID-week
src/__tests__/views/KaraView.spec.ts
src/__tests__/composables/useKaraAutoSuggest.spec.ts
```

**Features:**
- 3 Kara groups (10-player each) + unassigned pool
- Drag-and-drop players between pool and groups
- Pin players (lock in group)
- Link players (colored connection lines, max 8 colors)
- Time slot assignment per group
- Auto-suggest: balanced role distribution + availability matching
- ID-week navigation (prev/next week)
- Persistence: localStorage keyed by `kara_YYYY_MM_DD`
- Export: Markdown format for Discord posting
- Reset button

**Acceptance Criteria:**
- Component test: renders pool + 3 groups, player cards draggable
- Auto-suggest test: produces balanced groups with correct role distribution
- Persistence test: saves/loads from localStorage correctly
- Export test: generates valid Markdown

---

## Phase 13: Admin View

**Goal:** Port the admin dashboard.

**Deliverables:**
```
src/views/AdminView.vue
src/components/admin/
  AdminOverview.vue                  # Stats cards + readiness
  AdminUsers.vue                     # User list + management
  AdminEntries.vue                   # Entry management
  AdminManage.vue                    # Purge operations
src/__tests__/views/AdminView.spec.ts
```

**Features:**
- Admin-only access gate (redirect if not admin)
- Overview: stats cards (raider count, user count, role totals), class/role distribution, raid readiness gauge
- Users: user list with roles, delete user
- Entries: all entries with edit/delete
- Manage: purge buttons (users, entries) with confirmation modals

**Acceptance Criteria:**
- Component test: admin access gate works, stats render with mock data
- Non-admin sees access denied message
- Purge operations show confirmation before executing

---

## Phase 14: E2E Test Migration

**Goal:** Port all 11 Playwright spec files to work with the Vue app. Keep existing test logic but update selectors and navigation patterns.

**Deliverables:**
```
tests-vue/                           # New test directory for Vue app tests
  fixtures/
    mock-api.js                      # Ported mock API (same interceptors, Vue app routes)
    test-data.js                     # Same test data (reuse directly)
  functional/
    form.spec.js                     # 8 tests
    auth.spec.js                     # 18 tests
    roster.spec.js                   # 13 tests
    tabs.spec.js                     # 6 tests
    heatmap.spec.js                  # 9 tests
    analytics.spec.js                # 10 tests
    dkp.spec.js                      # 42 tests
    discord.spec.js                  # 8 tests
    raid-lock.spec.js                # 8 tests
  layout/
    layout.spec.js                   # 9 tests
  responsive/
    responsive.spec.js               # 5 tests
playwright-vue.config.ts             # Playwright config for Vue app (Vite dev server)
```

**Migration Strategy:**
1. Copy existing test files to `tests-vue/`
2. Update `setupMockApi()` if selectors changed (but keep same API mock routes)
3. Update selectors to match Vue component output (prefer `data-testid` attributes added in Phases 6-13)
4. Update Playwright config: web server → `npm run dev:vue` on different port
5. Keep hash-based navigation (`page.goto('/#/dashboard')`)
6. Keep auth seeding via localStorage injection
7. Run and fix each spec file one at a time

**Important:** During Phases 6-13, every Vue component should include `data-testid` attributes matching existing selectors where possible (e.g., `data-testid="f-name"`, `data-testid="entry"`, `data-testid="dkp-standings"`).

**Acceptance Criteria:**
- All 136 tests pass across all 4 viewport projects
- Mock API intercepts work identically to original
- Auth seeding works with Vue app's auth store hydration
- No test logic changes — only selector/navigation updates

---

## Phase 15: Final Integration & Cutover

**Goal:** Production-ready build, Netlify deployment config, cleanup.

**Deliverables:**
```
netlify.toml                         # Updated: build command → npm run build:vue, publish → dist
public/index.html                    # Archived or removed
vite.config.ts                       # Production optimizations (chunk splitting, compression)
src/router/index.ts                  # Add 404 catch-all redirect to dashboard
CLAUDE.md                            # Updated with new architecture docs
```

**Steps:**
1. Update `netlify.toml`: `command = "npm run build:vue"`, `publish = "dist"`
2. Configure Vite for production: chunk splitting (vendor, views), asset hashing
3. Ensure Netlify Functions redirects work (`/api/*` → functions)
4. Add `_redirects` or `netlify.toml` redirect for SPA hash routing
5. Run full test suite: `npx vitest run` (component tests) + `npx playwright test` (E2E)
6. Verify build output size is reasonable
7. Archive `public/index.html` (move to `archive/` or delete)
8. Update CLAUDE.md with new project structure, commands, architecture

**Acceptance Criteria:**
- `npm run build:vue` produces optimized output in `dist/`
- All component tests pass (`npx vitest run`)
- All E2E tests pass (`npx playwright test --config=playwright-vue.config.ts`)
- Netlify deployment works (functions + frontend)
- No regressions vs original app

---

## Cross-Cutting Concerns (All Phases)

### Selector Compatibility Strategy (CRITICAL)

The existing Playwright tests rely on specific CSS classes and IDs. Vue components **MUST** render elements with these exact selectors. Do NOT use `data-testid` as a replacement — preserve the original class/ID selectors directly on the rendered elements.

**Why:** The mock API (`tests/fixtures/mock-api.js`) intercepts at network level and works unchanged. The test data (`tests/fixtures/test-data.js`) is reusable as-is. The only thing that changes is DOM selectors — and those must match.

**Global selectors (Layout/Auth/Feedback):**
- `#counter` — entry count text
- `#auth-bar`, `.auth-user`, `.btn-bnet`, `.btn-logout`, `[data-action="logout"]`
- `.auth-hint` — login hint in form view
- `#toast` with `.show` class when visible
- `.modal-bg`, `.modal-title`, `.modal-cancel`, `.modal-confirm`

**Navigation selectors:**
- `#v-form`, `#v-raids`, `#v-roster`, `#v-heatmap`, `#v-analytics`, `#v-kara`, `#v-dkp`, `#v-admin` — view wrapper IDs
- `.tab` — nav items (desktop and mobile)

**Form selectors:**
- `#f-name`, `#f-submit`, `#f-char-pick`
- `.chip` / `.chip.active` — class chips
- `.rchip` / `.rchip.active` — spec chips
- `.tl-cell`, `.tl-cell.on`, `.tl-cell.tent` — timeline grid cells

**Roster selectors:**
- `.entry`, `.e-name`, `.e-class`, `.rcard`, `.rcard .num`
- `[data-edit]`, `[data-del]`, `.sort-sel`, `.btn-export`, `.empty`

**Heatmap selectors:**
- `.htable`, `.hcell`, `.ht-btn` / `.ht-btn.active`
- `#htooltip` / `#htooltip.show`, `.sec-l`

**Analytics selectors:**
- `.role-an-item`, `.role-an-item .big`
- `.bar-row`, `.bar-lbl`, `.bar-track`, `.bar-fill`
- `.bs-card`, `.bs-role`, `.pbar-row`, `.pbar-name`, `.pbar-val`, `.flex-info`

**DKP selectors (30+):**
- `.dkp-actions-bar`, `.dkp-standings`, `.dkp-pchip` / `.dkp-pchip.active`, `.dkp-selectall`
- `#dkp-award-amount`, `#dkp-award-reason`, `#dkp-spend-player`, `#dkp-spend-amount`, `#dkp-spend-item`
- `#dkp-decay-pct`, `.dkp-decay-preview`, `.dkp-bal`, `.dkp-undo`
- `.dkp-tx`, `.dkp-tx-type`, `.dkp-tx-name`, `.dkp-tx-reason`, `.dkp-tx-amount`
- `.dkp-tx-filter`, `.dkp-tx-btn`, `.dkp-tx-btn.dkp-tx-del`
- `#dkp-search-input`, `.dkp-player-detail`, `.dkp-detail-name`, `.dkp-detail-bal`
- `.dkp-detail-stats`, `.dkp-detail-close`, `.dkp-detail-actions`, `.dkp-detail-action`
- `.dkp-toolbar-btn`, `#cfg-decay`, `#cfg-max`, `#cfg-start`, `#cfg-neg`
- `.dkp-role-list`, `.dkp-role-badge`, `#dkp-role-user`, `.dkp-my-btn`
- `#dkp-edit-amount`, `#dkp-edit-reason`, `#dkp-adj-balance`, `#dkp-adj-reason`, `#dkp-edit-class`

**Raid selectors:**
- `.btn-discord`, `.raid-card` / `.raid-card.past`, `.btn-raid-lock`, `.btn-signup`
- `.raid-inst`, `.raid-meta`, `.raid-signups`

### View Visibility: Hidden-Class vs Router-Based

**Breaking change to address in E2E tests:** The old app uses `.hidden` CSS class to toggle views (all views exist in DOM simultaneously). Vue router only mounts the active view. Tests that check `toBeHidden()` on inactive view containers must change to `toHaveCount(0)`:

```js
// OLD (vanilla): await expect(page.locator('#v-form')).toBeHidden();
// NEW (Vue):     await expect(page.locator('#v-form')).toHaveCount(0);
```

Search all test files for `.toBeHidden()` on `#v-*` selectors and update during Phase 14.

### TypeScript Types

Define in `src/types/index.ts` (single file, re-exported):
- `WowClassName` — union of 9 German class names
- `Role` — `'Tank' | 'Heiler' | 'DPS'`
- `DayName` — union of 7 German day names
- `AvailabilityMap` — `Record<string, 'yes' | 'tentative'>`
- `Entry`, `Raid`, `RaidSignup`, `DkpBalance`, `DkpTransaction`, `DkpConfig`, `AuthUser`, `BnetCharacter`

### German Text

All UI strings remain in German, hardcoded in templates. No i18n framework needed for this migration.

### XSS Protection

Vue's template engine auto-escapes by default. Never use `v-html` with user-supplied data. The `h()` utility is only needed for rare manual HTML string construction.

### Wowhead Tooltip Integration

Load `https://wow.zamimg.com/widgets/power.js` in `index.html`. After route changes, call `$WowheadPower.refreshLinks()` if the global exists. The `linkItems()` utility generates Wowhead-compatible links from `[Item Name]` syntax.

### Auth Persistence

Pinia auth store reads from `localStorage['raid-auth']` on init, validates via `/api/auth { action: 'validate' }`, and clears on 401/logout. OAuth callback tokens from URL hash/query params are handled in `initAuth()`.

---

## Verification Plan

After each phase, run:
1. **TypeScript:** `npx vue-tsc --noEmit` — no type errors
2. **Component tests:** `npx vitest run` — all pass
3. **Dev server:** `npm run dev:vue` — app loads, navigates, renders
4. **Build:** `npm run build:vue` — produces valid output

After Phase 14+:
5. **E2E tests:** `npx playwright test --config=playwright-vue.config.ts` — all 136 tests pass across 4 viewports

Final (Phase 15):
6. **Full regression:** Compare Vue app behavior with original `public/index.html` side-by-side
7. **Netlify deploy preview:** Verify functions + frontend work together
