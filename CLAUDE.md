# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW TBC guild raid availability planner. German-language UI. No framework, no build step — pure vanilla HTML/CSS/JS frontend with a Netlify Functions serverless backend. Data stored in Netlify Blobs.

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

**Test architecture:** Tests use `page.route()` to intercept `/api/entries` — no real backend needed. The `setupMockApi(page, initialEntries)` fixture in `tests/fixtures/mock-api.js` provides an in-memory CRUD store. Sample entries are in `tests/fixtures/test-data.js`.

**Projects:** `desktop` (1280×720), `tablet` (768×1024), `mobile` (375×667) run layout/functional tests. A separate `responsive` project runs viewport-switching tests at 375/641/768/1280px (including the 640px CSS breakpoint edge).

**Web server:** Playwright auto-starts `http-server public -p 8888` — no manual setup required.

## Branching

- `dev` is the default branch for all development work
- All changes are committed and pushed to `dev`
- Merge to `master` only on explicit instruction (= production deployment)
- `master` = Production, `dev` = Development

## Architecture

**Two-file application:**

- `public/index.html` — Complete single-page application with embedded CSS and JS. Contains the form, roster, heatmap, and analytics views. All rendering is function-based (`renderForm`, `renderRoster`, `renderHeatmap`, `renderAnalytics`) with global state variables.
- `netlify/functions/entries.mjs` — REST API handler for CRUD operations on raid entries. Routes: `GET /api/entries`, `POST /api/entries`, `DELETE /api/entries?id=<id>`.

**Frontend rendering pattern:** Each view has a `render*()` function that rebuilds `innerHTML` from global state. Tab switching toggles `.hidden` class on `#v-form`, `#v-roster`, `#v-heatmap`, `#v-analytics`. The form calls `syncInputs()` before re-render to preserve user input from live DOM elements — but `renderForm(true)` skips this sync (used by `startEdit` to avoid overwriting pre-filled values).

`netlify.toml` — Build config, publishes `public/` directory.

## Data Model

Entries have: `id` (UUID), `charName`, `className` (German WoW class names), `roles` (Tank/Heiler/DPS array), `availability` (map of `"{Day}_{TimeSlot}"` → `"yes"|"tentative"`), `notes`, `timestamp`.

Valid classes: Druide, Hexenmeister, Jäger, Krieger, Magier, Paladin, Priester, Schamane, Schurke.

Days are German (Montag–Sonntag). Time slots: weekday evenings (`EVE`: 18–20, 20–22, 22–00) plus weekend afternoons (`WEX`: 14–16, 16–18).

## Key Conventions

- All UI text is in German
- XSS protection via `h()` helper function for HTML escaping
- Server-side validation mirrors client-side constants (classes, roles, availability keys/values)
- Raid-ready thresholds: Tank ≥ 2, Healer ≥ 5, DPS ≥ 18 (25-man raid)
- Legacy `true` availability values are normalized to `"yes"` server-side
- Dark theme with WoW-themed gold accents; class and role colors follow WoW conventions
- CSS mobile breakpoint at `max-width: 640px`

## Key Selectors (for tests and DOM manipulation)

- Tabs: `[data-v="form"]`, `.tab.on`
- Views: `#v-form`, `#v-roster`, `#v-heatmap`, `#v-analytics` (toggle `.hidden`)
- Form: `#f-name`, `.chip`, `.rchip`, `.sbtn`, `#f-submit`
- Roster: `.entry`, `.e-name`, `.e-class`, `[data-edit]`, `[data-del]`, `.sort-sel`
- Heatmap: `.htable`, `.hcell`, `.ht-btn`, `.tooltip`
- Analytics: `.bar-row`, `.bar-track`, `.bar-fill`, `.role-an-item`
- Modal: `.modal-bg`, `.modal-cancel`, `.modal-confirm`
- Toast: `#toast.show`

## Customization Points

- **Time slots**: Arrays `EVE` (evening) and `WEX` (weekend extra) in `public/index.html`
- **Classes**: Array `CLS` in `public/index.html`
- **Guild name**: Search and replace `<Vanilla>` in HTML
