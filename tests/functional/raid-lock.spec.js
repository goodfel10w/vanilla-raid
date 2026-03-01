import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY } from '../fixtures/test-data.js';

const MOCK_RAID = {
  id: 'raid-1',
  instance: 'Karazhan',
  date: '2026-03-15',
  time: '20:00',
  maxPlayers: 10,
  notes: '',
  createdBy: 'mock-user-1',
  createdByName: 'Testuser',
  signups: [
    { userId: 'mock-user-2', username: 'Testuser2', charName: 'Heiligschein', className: 'Priester', role: 'Heiler', status: 'accepted', note: '', timestamp: '2026-03-10T11:00:00.000Z' },
  ],
  timestamp: '2026-03-01T10:00:00.000Z',
};

const LOCKED_RAID = {
  ...MOCK_RAID,
  locked: true,
};

async function setupRaidMockApi(page, raids, opts = {}) {
  await setupMockApi(page, [SAMPLE_ENTRY]);

  let raidStore = [...raids];

  await page.route('**/api/raids**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(raidStore),
      });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON();

      // Handle lock/unlock
      if (body.action === 'lock' || body.action === 'unlock') {
        const raid = raidStore.find(r => r.id === body.raidId);
        if (raid) {
          raid.locked = body.action === 'lock';
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(raid || { ok: true }),
        });
        return;
      }

      // Handle signup on locked raid (non-owner)
      if (body.action === 'signup') {
        const raid = raidStore.find(r => r.id === body.raidId);
        if (raid?.locked) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Raid ist gesperrt — Anmeldung nicht möglich' }),
          });
          return;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(raidStore[0] || { ok: true }),
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

test.describe('Raid Locking', () => {
  test.describe('owner sees lock button', () => {
    test.beforeEach(async ({ page }) => {
      await setupRaidMockApi(page, [MOCK_RAID]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1',
        }));
      });
      await page.goto('/#/raids');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-raids')).toBeVisible();
    });

    test('lock button is visible for raid owner', async ({ page }) => {
      const lockBtn = page.locator('.btn-raid-lock');
      await expect(lockBtn).toBeVisible();
      await expect(lockBtn).toContainText('Sperren');
    });

    test('clicking lock button shows confirmation modal', async ({ page }) => {
      const lockBtn = page.locator('.btn-raid-lock');
      await lockBtn.click();

      const modal = page.locator('.modal-bg');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Raid sperren');
      await expect(modal).toContainText('gesperrt werden');
    });

    test('confirming lock sends lock action to API', async ({ page }) => {
      let lockCalled = false;
      let lockBody = null;

      await page.route('**/api/raids**', async (route) => {
        const method = route.request().method();
        if (method === 'POST') {
          const body = route.request().postDataJSON();
          if (body.action === 'lock') {
            lockCalled = true;
            lockBody = body;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...MOCK_RAID, locked: true }),
          });
          return;
        }
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([lockCalled ? { ...MOCK_RAID, locked: true } : MOCK_RAID]),
          });
          return;
        }
        await route.continue();
      });

      const lockBtn = page.locator('.btn-raid-lock');
      await lockBtn.click();
      await page.locator('.modal-confirm').click();

      await expect(page.locator('#toast')).toHaveClass(/show/);
      expect(lockCalled).toBe(true);
      expect(lockBody.raidId).toBe('raid-1');
    });
  });

  test.describe('locked raid display', () => {
    test.beforeEach(async ({ page }) => {
      await setupRaidMockApi(page, [LOCKED_RAID]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1',
        }));
      });
      await page.goto('/#/raids');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-raids')).toBeVisible();
    });

    test('locked raid shows lock indicator', async ({ page }) => {
      const raidCard = page.locator('.raid-card');
      await expect(raidCard).toContainText('Raid gesperrt');
      await expect(raidCard).toContainText('Gesperrt');
    });

    test('owner sees unlock button on locked raid', async ({ page }) => {
      const lockBtn = page.locator('.btn-raid-lock');
      await expect(lockBtn).toBeVisible();
      await expect(lockBtn).toContainText('Entsperren');
    });
  });

  test.describe('non-owner locked raid', () => {
    test.beforeEach(async ({ page }) => {
      await setupRaidMockApi(page, [LOCKED_RAID]);
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
          token: 'mock-token', username: 'Otheruser', userId: 'mock-user-99',
        }));
      });
      await page.goto('/#/raids');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-raids')).toBeVisible();
    });

    test('non-owner cannot see signup button on locked raid', async ({ page }) => {
      const signupBtn = page.locator('.btn-signup');
      await expect(signupBtn).toHaveCount(0);
    });

    test('non-owner sees locked message instead of signup', async ({ page }) => {
      const raidCard = page.locator('.raid-card');
      await expect(raidCard).toContainText('Raid gesperrt');
      await expect(raidCard).toContainText('Anmeldung nicht mehr möglich');
    });

    test('lock button is not visible for non-owners', async ({ page }) => {
      const lockBtn = page.locator('.btn-raid-lock');
      await expect(lockBtn).toHaveCount(0);
    });
  });
});
