import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY } from '../fixtures/test-data.js';

const MOCK_RAID = {
  id: 'raid-1',
  instance: 'Karazhan',
  date: '2026-03-15',
  time: '20:00',
  maxPlayers: 10,
  notes: 'Consumables mitbringen',
  createdBy: 'mock-user-1',
  createdByName: 'Testuser',
  signups: [
    { userId: 'mock-user-1', username: 'Testuser', charName: 'Thrallm\u00e4chtig', className: 'Krieger', role: 'Tank', status: 'accepted', note: '', timestamp: '2026-03-10T10:00:00.000Z' },
    { userId: 'mock-user-2', username: 'Testuser2', charName: 'Heiligschein', className: 'Priester', role: 'Heiler', status: 'accepted', note: '', timestamp: '2026-03-10T11:00:00.000Z' },
    { userId: 'mock-user-3', username: 'Testuser3', charName: 'Frostpfeil', className: 'Magier', role: 'DPS', status: 'tentative', note: 'Vielleicht etwas sp\u00e4ter', timestamp: '2026-03-10T12:00:00.000Z' },
  ],
  timestamp: '2026-03-01T10:00:00.000Z',
};

async function setupRaidMockApi(page, raids = [MOCK_RAID]) {
  // Set up standard mock API for entries/auth
  await setupMockApi(page, [SAMPLE_ENTRY]);

  // Override raids route with actual raid data
  await page.route('**/api/raids**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(raids),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

test.describe('Discord Integration', () => {
  test.describe('logged in as raid owner', () => {
    test.beforeEach(async ({ page }) => {
      await setupRaidMockApi(page);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
        }));
      });
      await page.goto('/#/raids');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-raids')).toBeVisible();
    });

    test('Discord button is visible on raid card for owner', async ({ page }) => {
      const discordBtn = page.locator('.btn-discord');
      await expect(discordBtn).toBeVisible();
      await expect(discordBtn).toContainText('Discord');
    });

    test('Discord button has Discord icon', async ({ page }) => {
      const discordBtn = page.locator('.btn-discord');
      const svg = discordBtn.locator('svg');
      await expect(svg).toBeVisible();
    });

    test('clicking Discord button calls /api/discord endpoint', async ({ page }) => {
      let discordApiCalled = false;
      let discordBody = null;

      await page.route('**/api/discord', async (route) => {
        discordApiCalled = true;
        discordBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, messageId: 'discord-msg-123' }),
        });
      });

      const discordBtn = page.locator('.btn-discord');
      await discordBtn.click();

      // Wait for the toast to appear
      await expect(page.locator('#toast')).toHaveClass(/show/);
      await expect(page.locator('#toast')).toContainText('Discord');

      expect(discordApiCalled).toBe(true);
      expect(discordBody.action).toBe('post');
      expect(discordBody.raidId).toBe('raid-1');
    });

    test('Discord button shows loading state while posting', async ({ page }) => {
      await page.route('**/api/discord', async (route) => {
        // Delay response to see loading state
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, messageId: 'discord-msg-123' }),
        });
      });

      const discordBtn = page.locator('.btn-discord');
      await discordBtn.click();

      // Button should show "Senden..." while loading
      await expect(discordBtn).toContainText('Senden...');
      await expect(discordBtn).toBeDisabled();

      // After response, button should return to normal
      await expect(discordBtn).toContainText('Discord', { timeout: 5000 });
      await expect(discordBtn).toBeEnabled();
    });

    test('Discord button shows error toast on failure', async ({ page }) => {
      await page.route('**/api/discord', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Discord-Webhook nicht konfiguriert' }),
        });
      });

      const discordBtn = page.locator('.btn-discord');
      await discordBtn.click();

      await expect(page.locator('#toast')).toHaveClass(/show/);
      await expect(page.locator('#toast')).toContainText('Discord-Webhook nicht konfiguriert');
    });

    test('Discord button sends auth header', async ({ page }) => {
      let authHeader = null;

      await page.route('**/api/discord', async (route) => {
        authHeader = route.request().headers()['authorization'];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, messageId: 'msg-1' }),
        });
      });

      await page.locator('.btn-discord').click();
      await expect(page.locator('#toast')).toHaveClass(/show/);

      expect(authHeader).toBe('Bearer mock-token');
    });
  });

  test.describe('not logged in', () => {
    test.beforeEach(async ({ page }) => {
      await setupRaidMockApi(page);
      // Override auth to simulate logged-out state
      await page.route('**/api/auth', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === 'validate') {
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Sitzung ung\u00fcltig' }) });
          return;
        }
        await route.continue();
      });
      await page.goto('/#/raids');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-raids')).toBeVisible();
    });

    test('Discord button is NOT visible when not logged in', async ({ page }) => {
      const discordBtn = page.locator('.btn-discord');
      await expect(discordBtn).toHaveCount(0);
    });
  });

  test.describe('logged in as non-owner', () => {
    test.beforeEach(async ({ page }) => {
      await setupRaidMockApi(page);
      // Override auth to return a different userId (not the raid creator)
      await page.route('**/api/auth', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === 'validate') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ username: 'Otheruser', userId: 'mock-user-99' }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      });
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Otheruser', userId: 'mock-user-99', discordLinked: true, discordUsername: 'Otheruser#9999', discordGuildMember: true
        }));
      });
      await page.goto('/#/raids');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-raids')).toBeVisible();
    });

    test('Discord button is NOT visible for non-owners', async ({ page }) => {
      const discordBtn = page.locator('.btn-discord');
      await expect(discordBtn).toHaveCount(0);
    });
  });
});
