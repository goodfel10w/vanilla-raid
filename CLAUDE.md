# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW TBC guild raid availability planner. German-language UI. No framework, no build step — pure vanilla HTML/CSS/JS frontend with a Netlify Functions serverless backend. Data stored in Netlify Blobs.

## Development Commands

```bash
npm install                # Install dependencies (for serverless functions)
netlify dev                # Local dev server (requires netlify-cli globally installed)
netlify deploy --prod      # Deploy to production (only after merge to master)
```

There is no build step, linter, or test suite.

## Branching

- `dev` is the default branch for all development work
- All changes are committed and pushed to `dev`
- Merge to `master` only on explicit instruction (= production deployment)
- `master` = Production, `dev` = Development

## Architecture

**Two-file application:**

- `public/index.html` — Complete single-page application with embedded CSS and JS. Contains the form, roster, heatmap, and analytics views. All rendering is function-based (`renderForm`, `renderRoster`, `renderHeatmap`, `renderAnalytics`) with global state variables.
- `netlify/functions/entries.mjs` — REST API handler for CRUD operations on raid entries. Routes: `GET /api/entries`, `POST /api/entries`, `DELETE /api/entries?id=<id>`.

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

## Customization Points (from README)

- **Time slots**: Arrays `EVE` (evening) and `WEX` (weekend extra) in `public/index.html`
- **Classes**: Array `CLS` in `public/index.html`
- **Guild name**: Search and replace `<Vanilla>` in HTML
