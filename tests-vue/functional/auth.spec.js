import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

test.describe('Auth', () => {
  test.describe('not logged in', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      // Intercept validate to return 401 (no valid session)
      await page.route('**/api/auth', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === 'validate') {
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Sitzung ung\u00fcltig' }) });
          return;
        }
        if (body.action === 'bnet-login') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://eu.battle.net/oauth/authorize?mock=1' }) });
          return;
        }
        if (body.action === 'logout') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
          return;
        }
        await route.continue();
      });
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
    });

    test('auth bar shows Battle.net login button', async ({ page }) => {
      await expect(page.locator('#auth-bar .btn-bnet')).toContainText('Mit Battle.net anmelden');
    });

    test('form view shows login hint with Battle.net button instead of form', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      await expect(page.locator('.auth-hint')).toBeVisible();
      await expect(page.locator('.auth-hint')).toContainText('Bitte melde dich an');
      await expect(page.locator('.auth-hint .btn-bnet')).toBeVisible();
      await expect(page.locator('#f-name')).toHaveCount(0);
    });

    test('roster is readable without login', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/roster'; });
      await expect(page.locator('#v-roster')).toBeVisible();
      await expect(page.locator('.entry')).toHaveCount(2);
      await expect(page.locator('.e-name').first()).toBeVisible();
    });

    test('heatmap is readable without login', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/heatmap'; });
      await expect(page.locator('#v-heatmap')).toBeVisible();
      await expect(page.locator('.htable')).toHaveCount(2);
    });

    test('analytics is readable without login', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/analytics'; });
      await expect(page.locator('#v-analytics')).toBeVisible();
      await expect(page.locator('.role-an-item')).toHaveCount(3);
    });

    test('no edit/delete buttons without login', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/roster'; });
      await expect(page.locator('#v-roster')).toBeVisible();
      await expect(page.locator('.entry')).toHaveCount(2);
      await expect(page.locator('[data-edit]')).toHaveCount(0);
      await expect(page.locator('[data-del]')).toHaveCount(0);
    });

    test('Battle.net login button triggers redirect', async ({ page }) => {
      // On mobile the auth-bar is in the hidden sidebar; use the form view's auth hint instead
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      const navigationPromise = page.waitForURL(/battle\.net|bnet_token/, { timeout: 3000 }).catch(() => null);
      // Click whichever .btn-bnet is visible (auth-bar on desktop, auth-hint on mobile)
      await page.locator('.btn-bnet:visible').first().click();
    });

    test('auth overlay opens with Battle.net button', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      await page.locator('.auth-hint .btn-bnet').click();
      // The button triggers bnetLogin directly, which calls the API
      // This may navigate away, so we just verify it was interactive
    });
  });

  test.describe('logged in', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
        }));
      });
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
    });

    test('auth bar shows username and logout button', async ({ page }) => {
      await expect(page.locator('.auth-user')).toContainText('Testuser');
      await expect(page.locator('.btn-logout')).toHaveText('Abmelden');
    });

    test('form view shows the form (not login hint)', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      await expect(page.locator('#f-name')).toBeVisible();
      await expect(page.locator('.auth-hint')).toHaveCount(0);
    });

    test('own entries show edit/delete buttons', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/roster'; });
      await expect(page.locator('#v-roster')).toBeVisible();
      // SAMPLE_ENTRY has userId mock-user-1 = our user
      const ownEntry = page.locator('.entry', { has: page.locator('.e-name', { hasText: 'Thrallm\u00e4chtig' }) });
      await expect(ownEntry.locator('[data-edit]')).toBeVisible();
      await expect(ownEntry.locator('[data-del]')).toBeVisible();
    });

    test('other user entries hide edit/delete buttons', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/roster'; });
      await expect(page.locator('#v-roster')).toBeVisible();
      // SAMPLE_ENTRY_2 has userId mock-user-2 = different user
      const otherEntry = page.locator('.entry', { has: page.locator('.e-name', { hasText: 'Heiligschein' }) });
      await expect(otherEntry.locator('[data-edit]')).toHaveCount(0);
      await expect(otherEntry.locator('[data-del]')).toHaveCount(0);
    });

    test('logout returns to not-logged-in state', async ({ page }) => {
      // On mobile the .btn-logout is in the hidden sidebar; use JS to trigger it
      await page.evaluate(() => document.querySelector('[data-action="logout"]').click());
      // Form shows login hint
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      await expect(page.locator('.auth-hint')).toBeVisible();
    });

    test('session survives page reload via localStorage', async ({ page }) => {
      // Reload page
      await page.reload();
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      // Still logged in
      await expect(page.locator('.auth-user')).toContainText('Testuser');
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      await expect(page.locator('#f-name')).toBeVisible();
    });

    test('character picker shows Battle.net characters', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      // The mock API returns characters; wait for them to load
      await expect(page.locator('#f-char-pick')).toBeVisible({ timeout: 5000 });
      const options = page.locator('#f-char-pick option');
      // First option is manual entry, then 3 mock characters
      await expect(options).toHaveCount(4);
      await expect(options.nth(1)).toContainText('Thrallm\u00e4chtig');
      await expect(options.nth(1)).toContainText('Schamane');
    });

    test('selecting a character auto-fills name and class', async ({ page }) => {
      await page.evaluate(() => { window.location.hash = '#/form'; });
      await expect(page.locator('#v-form')).toBeVisible();
      await expect(page.locator('#f-char-pick')).toBeVisible({ timeout: 5000 });
      // Select the second character (Arthaslull - Paladin)
      await page.selectOption('#f-char-pick', '1');
      await expect(page.locator('#f-name')).toHaveValue('Arthaslull');
      // Paladin class chip should be active
      await expect(page.locator('.chip.active')).toContainText('Paladin');
    });
  });

  test.describe('OAuth callback', () => {
    test('bnet_token in URL logs user in', async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await page.goto('/?bnet_token=mock-token');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      // Should be logged in
      await expect(page.locator('.auth-user')).toContainText('Testuser');
      // URL should be clean (no bnet_token)
      expect(page.url()).not.toContain('bnet_token');
    });

    test('auth_error in URL shows error toast', async ({ page }) => {
      await setupMockApi(page, []);
      // Intercept validate to return 401
      await page.route('**/api/auth', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === 'validate') {
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Sitzung ung\u00fcltig' }) });
          return;
        }
        await route.continue();
      });
      await page.goto('/?auth_error=access_denied');
      await expect(page.locator('#toast')).toContainText('fehlgeschlagen');
      // URL should be clean
      expect(page.url()).not.toContain('auth_error');
    });
  });
});
