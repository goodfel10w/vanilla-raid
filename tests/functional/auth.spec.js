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
        if (body.action === 'login') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token', username: body.username, userId: 'mock-user-1' }) });
          return;
        }
        if (body.action === 'register') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token', username: body.username, userId: 'mock-user-1' }) });
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

    test('auth bar shows login button', async ({ page }) => {
      await expect(page.locator('#auth-bar button')).toHaveText('Anmelden');
    });

    test('form view shows login hint instead of form', async ({ page }) => {
      await expect(page.locator('.auth-hint')).toBeVisible();
      await expect(page.locator('.auth-hint')).toContainText('Bitte melde dich an');
      await expect(page.locator('#f-name')).toHaveCount(0);
    });

    test('roster is readable without login', async ({ page }) => {
      await page.click('[data-v="roster"]');
      await expect(page.locator('.entry')).toHaveCount(2);
      await expect(page.locator('.e-name').first()).toBeVisible();
    });

    test('heatmap is readable without login', async ({ page }) => {
      await page.click('[data-v="heatmap"]');
      await expect(page.locator('.htable')).toHaveCount(2);
    });

    test('analytics is readable without login', async ({ page }) => {
      await page.click('[data-v="analytics"]');
      await expect(page.locator('.role-an-item')).toHaveCount(3);
    });

    test('no edit/delete buttons without login', async ({ page }) => {
      await page.click('[data-v="roster"]');
      await expect(page.locator('.entry')).toHaveCount(2);
      await expect(page.locator('[data-edit]')).toHaveCount(0);
      await expect(page.locator('[data-del]')).toHaveCount(0);
    });

    test('login overlay opens when auth bar button clicked', async ({ page }) => {
      await page.locator('#auth-bar button').click();
      await expect(page.locator('.auth-overlay')).toBeVisible();
      await expect(page.locator('.auth-box h2')).toHaveText('Anmelden');
    });

    test('login overlay can be closed', async ({ page }) => {
      await page.locator('#auth-bar button').click();
      await expect(page.locator('.auth-overlay')).toBeVisible();
      await page.locator('.auth-close').click();
      await expect(page.locator('.auth-overlay')).not.toBeVisible();
    });

    test('login overlay tabs switch between login and register', async ({ page }) => {
      await page.locator('#auth-bar button').click();
      await expect(page.locator('.auth-box h2')).toHaveText('Anmelden');
      // No password repeat field in login mode
      await expect(page.locator('#auth-pass2')).toHaveCount(0);
      // Switch to register
      await page.locator('.auth-tab', { hasText: 'Registrieren' }).click();
      await expect(page.locator('.auth-box h2')).toHaveText('Registrieren');
      // Password repeat field present
      await expect(page.locator('#auth-pass2')).toBeVisible();
    });

    test('login with valid credentials works', async ({ page }) => {
      await page.locator('#auth-bar button').click();
      await page.fill('#auth-user', 'Testuser');
      await page.fill('#auth-pass', 'password123');
      await page.locator('.auth-box .btn-p').click();
      // Overlay closes
      await expect(page.locator('.auth-overlay')).not.toBeVisible();
      // Auth bar shows username
      await expect(page.locator('.auth-user')).toHaveText('Testuser');
      // Toast
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('register with mismatched passwords shows error', async ({ page }) => {
      await page.locator('#auth-bar button').click();
      await page.locator('.auth-tab', { hasText: 'Registrieren' }).click();
      await page.fill('#auth-user', 'Newuser');
      await page.fill('#auth-pass', 'password123');
      await page.fill('#auth-pass2', 'different');
      await page.locator('.auth-box .btn-p').click();
      await expect(page.locator('#auth-err')).toContainText('stimmen nicht');
    });

    test('register with matching passwords works', async ({ page }) => {
      await page.locator('#auth-bar button').click();
      await page.locator('.auth-tab', { hasText: 'Registrieren' }).click();
      await page.fill('#auth-user', 'Newuser');
      await page.fill('#auth-pass', 'password123');
      await page.fill('#auth-pass2', 'password123');
      await page.locator('.auth-box .btn-p').click();
      // Overlay closes
      await expect(page.locator('.auth-overlay')).not.toBeVisible();
      // Auth bar shows username
      await expect(page.locator('.auth-user')).toHaveText('Newuser');
    });

    test('form login hint button opens auth overlay', async ({ page }) => {
      await page.locator('.auth-hint button').click();
      await expect(page.locator('.auth-overlay')).toBeVisible();
    });
  });

  test.describe('logged in', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1'
        }));
      });
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
    });

    test('auth bar shows username and logout button', async ({ page }) => {
      await expect(page.locator('.auth-user')).toHaveText('Testuser');
      await expect(page.locator('.btn-logout')).toHaveText('Abmelden');
    });

    test('form view shows the form (not login hint)', async ({ page }) => {
      await expect(page.locator('#f-name')).toBeVisible();
      await expect(page.locator('.auth-hint')).toHaveCount(0);
    });

    test('own entries show edit/delete buttons', async ({ page }) => {
      await page.click('[data-v="roster"]');
      // SAMPLE_ENTRY has userId mock-user-1 = our user
      const ownEntry = page.locator('.entry', { has: page.locator('.e-name', { hasText: 'Thrallm\u00e4chtig' }) });
      await expect(ownEntry.locator('[data-edit]')).toBeVisible();
      await expect(ownEntry.locator('[data-del]')).toBeVisible();
    });

    test('other user entries hide edit/delete buttons', async ({ page }) => {
      await page.click('[data-v="roster"]');
      // SAMPLE_ENTRY_2 has userId mock-user-2 = different user
      const otherEntry = page.locator('.entry', { has: page.locator('.e-name', { hasText: 'Heiligschein' }) });
      await expect(otherEntry.locator('[data-edit]')).toHaveCount(0);
      await expect(otherEntry.locator('[data-del]')).toHaveCount(0);
    });

    test('logout returns to not-logged-in state', async ({ page }) => {
      await page.locator('.btn-logout').click();
      // Auth bar shows login button
      await expect(page.locator('#auth-bar button')).toHaveText('Anmelden');
      // Form shows login hint
      await page.click('[data-v="form"]');
      await expect(page.locator('.auth-hint')).toBeVisible();
      // Toast
      await expect(page.locator('#toast')).toContainText('Abgemeldet');
    });

    test('session survives page reload via localStorage', async ({ page }) => {
      // Reload page
      await page.reload();
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      // Still logged in
      await expect(page.locator('.auth-user')).toHaveText('Testuser');
      await expect(page.locator('#f-name')).toBeVisible();
    });
  });
});
