# Security Audit Report

**Date:** 2026-02-23
**Scope:** Full application (frontend, backend APIs, auth system, configuration)
**Auditor:** Automated security review

---

## Executive Summary

The application has **solid security fundamentals** with consistent XSS escaping via the `h()` helper function, proper server-side input validation, and well-structured authorization checks. The audit identified **1 critical issue** (session token in URL query string), **3 high-severity issues**, and several medium/low findings. Fixes for the most impactful issues are included with this report.

---

## Findings

### CRITICAL

#### 1. Session Token Leaked in URL Query String
**File:** `netlify/functions/bnet-callback.mjs:165-167`
**Status:** FIXED

The Battle.net OAuth callback redirected with the session token in a **query parameter** (`?bnet_token=...`) despite the comment saying "URL fragment." Query parameters are:
- Logged in server access logs and CDN logs
- Sent in `Referer` headers to third-party resources (Wowhead, Google Fonts)
- Stored in browser history
- Visible to analytics scripts and browser extensions

**Fix applied:** Changed to use URL fragment (`#bnet_token=...`), which is never sent to the server. Updated frontend to read from both fragment (new) and query param (backward compatibility).

---

### HIGH

#### 2. No Security Headers
**File:** `netlify.toml`
**Status:** FIXED

No security headers were configured. The application was missing:
- `X-Frame-Options` — allows clickjacking attacks via iframe embedding
- `X-Content-Type-Options` — allows MIME-type sniffing attacks
- `Referrer-Policy` — full URLs (including tokens) leaked in Referer headers
- `Permissions-Policy` — unnecessary browser APIs available

**Fix applied:** Added security headers to `netlify.toml`. Note: A Content-Security-Policy header was not added because the application uses inline `<script>` and `<style>` blocks, which would require `'unsafe-inline'` and negate much of CSP's benefit. Migrating to external files would be needed to enable CSP effectively.

#### 3. Battle.net Access Token Stored in Database
**File:** `netlify/functions/bnet-callback.mjs:145`
**Status:** NOT FIXED (architectural)

The Battle.net OAuth access token is stored persistently in the users blob store (`bnetAccessToken` field). If the Netlify Blobs data is compromised, attackers gain access to users' Battle.net accounts (scoped to `openid wow.profile`).

**Recommendation:** Consider encrypting the access token at rest using an environment variable as the encryption key, or fetching characters during the callback only and not storing the token.

#### 4. Third-Party Script Without Integrity Check
**File:** `public/index.html:446`
**Status:** NOT FIXED (accepted risk)

```html
<script src="https://wow.zamimg.com/widgets/power.js"></script>
```

The Wowhead tooltip script is loaded without Subresource Integrity (SRI). If Wowhead's CDN is compromised, arbitrary JavaScript executes in the application's origin with full access to `localStorage` (including session tokens) and all DOM content.

**Recommendation:** This is an accepted risk since Wowhead updates the script frequently (SRI hashes would break). Monitor for alternatives or self-host a pinned version.

---

### MEDIUM

#### 5. Delete Endpoint Accepted Non-Existent IDs
**File:** `netlify/functions/entries.mjs:196-201`
**Status:** FIXED

The DELETE endpoint for entries did not verify the entry existed before deleting. It would return `200 OK` for any ID, making it impossible to distinguish successful deletes from no-ops. The authorization check was also skipped for non-existent entries.

**Fix applied:** Added existence check returning 404 for missing entries.

#### 6. `h()` Escaping Function Crashes on Non-String Input
**File:** `public/index.html:874`
**Status:** FIXED

The HTML escaping function `h(s)` called `.replace()` directly on `s` without coercing to string. If a non-string value (null, undefined, number) was passed, it would throw a TypeError, potentially leaving un-escaped content in the DOM from a partially rendered template.

**Fix applied:** Added `String(s)` coercion.

#### 7. `showModal()` Accepts Raw HTML in Parameters
**File:** `public/index.html:806-816`
**Status:** NOT FIXED (by design)

The `showModal(title, msg, onConfirm)` function injects `title` and `msg` directly into `innerHTML` without escaping. Currently all call sites either use hardcoded strings or properly escape with `h()`, but the function is a **footgun** — any future call that forgets to escape will create an XSS vulnerability.

**Recommendation:** Either escape within `showModal()` itself and use a separate parameter for trusted HTML, or add a code comment documenting that callers must escape user data.

#### 8. OAuth State Tokens Not Rate-Limited
**File:** `netlify/functions/auth.mjs:37-38`
**Status:** NOT FIXED

Each `bnet-login` request creates a new state token in the `oauth-states` blob store. There is no rate limiting, so an attacker could flood the store with state entries. While they expire after 10 minutes and are cleaned up on use, no automated cleanup exists for unused states.

**Recommendation:** Add rate limiting per IP or implement a periodic cleanup of expired states.

---

### LOW

#### 9. Unused Dependency: `bcryptjs`
**File:** `package.json:12`
**Status:** NOT FIXED

`bcryptjs` is listed as a production dependency but is not imported anywhere in the codebase. It appears to be a leftover from the pre-OAuth password-based auth system.

**Recommendation:** Remove with `npm uninstall bcryptjs` to reduce attack surface and bundle size.

#### 10. Bearer Token in localStorage
**File:** `public/index.html:718,722`
**Status:** NOT FIXED (accepted risk)

Session tokens are stored in `localStorage`, which is accessible to any JavaScript running on the page (including the third-party Wowhead script from finding #4). HttpOnly cookies would be more secure but require backend architectural changes.

**Recommendation:** Accept as current design limitation. Mitigate by addressing finding #4 and adding CSP when feasible.

#### 11. DKP Role Matching by Username Prefix
**File:** `netlify/functions/dkp.mjs:44-45`
**Status:** NOT FIXED

The `getRole()` function in the DKP system splits usernames on `#` and matches by prefix. A user with BattleTag `goodfell0w#99999` would match the admin role for `goodfell0w`. This is the intended design (matching BattleTags), but relies on Battle.net guaranteeing uniqueness of the prefix portion. The same pattern exists in `auth-utils.mjs:8-9`.

#### 12. No Rate Limiting on API Endpoints
**Status:** NOT FIXED (infrastructure level)

None of the API endpoints implement rate limiting. An attacker could:
- Enumerate entries via rapid GET requests
- Attempt to flood the data store with POST requests (requires auth)
- Brute-force session tokens (128-bit UUIDs make this impractical)

**Recommendation:** Add Netlify Edge Functions or a CDN-level rate limiter for production.

---

## Positive Findings

The following security practices are well-implemented:

- **XSS Prevention:** The `h()` function properly escapes all 5 HTML special characters and is consistently applied to user-controlled data across all `innerHTML` assignments
- **Server-Side Validation:** All API endpoints validate input types, lengths, and values against whitelists (class names, role names, availability keys, instance names)
- **Authorization:** Ownership checks on edit/delete operations with proper 403 responses; admin checks for privileged operations
- **CSRF Protection:** JSON `Content-Type` with Bearer tokens in headers (not cookies) inherently prevents CSRF
- **URL Parameter Encoding:** `encodeURIComponent()` used correctly for all URL parameter construction
- **onclick Handler Safety:** User data in inline handlers is both HTML-escaped and quote-escaped
- **No eval/Function:** Zero use of `eval()`, `new Function()`, or string arguments to `setTimeout`/`setInterval`
- **Proper Error Handling:** API errors return generic messages; stack traces only logged server-side
- **OAuth State Validation:** CSRF protection via state parameter in OAuth flow with 10-minute expiry
- **Input Truncation:** Character names (50 chars), notes (500 chars), and other fields are server-side truncated

---

## Summary Table

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | CRITICAL | Session token in URL query string | Fixed |
| 2 | HIGH | No security headers | Fixed |
| 3 | HIGH | Battle.net access token stored unencrypted | Not fixed |
| 4 | HIGH | Third-party script without SRI | Accepted risk |
| 5 | MEDIUM | Delete accepts non-existent IDs | Fixed |
| 6 | MEDIUM | `h()` crashes on non-string input | Fixed |
| 7 | MEDIUM | `showModal()` accepts raw HTML | Not fixed |
| 8 | MEDIUM | OAuth states not rate-limited | Not fixed |
| 9 | LOW | Unused `bcryptjs` dependency | Not fixed |
| 10 | LOW | Bearer token in localStorage | Accepted risk |
| 11 | LOW | DKP role prefix matching | By design |
| 12 | LOW | No API rate limiting | Not fixed |
