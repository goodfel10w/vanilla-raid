import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

// Helper: seed auth as admin (username "Testuser" — mock config has "testuser" as admin)
function seedAuth(page) {
  return page.addInitScript(() => {
    localStorage.setItem('raid-auth', JSON.stringify({
      token: 'mock-token', username: 'Testuser', userId: 'mock-user-1'
    }));
  });
}

// Helper: navigate to DKP tab and wait for render
async function gotoDkp(page) {
  await page.goto('/');
  await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
  await page.click('[data-v="dkp"]');
  await expect(page.locator('#v-dkp')).toBeVisible();
}

test.describe('DKP', () => {
  // ─── Admin access (default mock user is admin) ───
  test.describe('admin access', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('DKP tab shows overview by default', async ({ page }) => {
      await expect(page.locator('#v-dkp')).toContainText('DKP-Übersicht');
    });

    test('admin sees all action buttons', async ({ page }) => {
      const bar = page.locator('.dkp-actions-bar');
      await expect(bar.locator('button', { hasText: 'Übersicht' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Beute' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Verfall' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toBeVisible();
    });

    test('empty overview shows hint text', async ({ page }) => {
      await expect(page.locator('#v-dkp')).toContainText('Noch keine DKP-Einträge');
    });

    test('CSV export button is present', async ({ page }) => {
      await expect(page.locator('.dkp-toolbar-btn', { hasText: 'CSV Export' })).toBeVisible();
    });
  });

  // ─── Officer access ───
  test.describe('officer access', () => {
    test.beforeEach(async ({ page }) => {
      // Override DKP config to make Testuser an officer (not admin)
      await page.route('**/api/dkp**', async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              balances: [],
              transactions: [],
              config: {
                roles: { testuser: 'officer', someadmin: 'admin' },
                defaultDecayPercent: 15,
                maxDkpAmount: 10000,
                allowNegativeBalance: true,
                startingBalance: 0,
                transactionLimit: 50,
                reasonMaxLength: 200,
              },
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      });
      // Set up other mocks (entries, auth, raids)
      await page.route('**/api/entries**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
      await page.route('**/api/auth', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ username: 'Testuser', userId: 'mock-user-1' }),
        });
      });
      await page.route('**/api/raids**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('officer sees Award and Spend but not Decay/Settings', async ({ page }) => {
      const bar = page.locator('.dkp-actions-bar');
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Beute' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Verfall' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toHaveCount(0);
    });
  });

  // ─── No role (regular user) ───
  test.describe('no DKP role', () => {
    test.beforeEach(async ({ page }) => {
      // Override DKP config with empty roles for the test user
      await page.route('**/api/dkp**', async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              balances: [],
              transactions: [],
              config: {
                roles: { someadmin: 'admin' },
                defaultDecayPercent: 15,
                maxDkpAmount: 10000,
                allowNegativeBalance: true,
                startingBalance: 0,
                transactionLimit: 50,
                reasonMaxLength: 200,
              },
            }),
          });
          return;
        }
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Nur Admins und Offiziere dürfen DKP verwalten' }),
        });
      });
      await page.route('**/api/entries**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      });
      await page.route('**/api/auth', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'Testuser', userId: 'mock-user-1' }) });
      });
      await page.route('**/api/raids**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      });
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('regular user sees only Overview button', async ({ page }) => {
      const bar = page.locator('.dkp-actions-bar');
      await expect(bar.locator('button', { hasText: 'Übersicht' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Beute' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Verfall' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toHaveCount(0);
    });
  });

  // ─── Award DKP ───
  test.describe('award DKP', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('award view shows player chips from roster entries', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await expect(page.locator('#v-dkp')).toContainText('DKP vergeben');
      // Both sample entries should appear as selectable chips
      await expect(page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' })).toBeVisible();
      await expect(page.locator('.dkp-pchip', { hasText: 'Heiligschein' })).toBeVisible();
    });

    test('selecting players toggles chip active state', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      const chip = page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' });
      await expect(chip).not.toHaveClass(/active/);
      await chip.click();
      await expect(page.locator('.dkp-pchip.active', { hasText: 'Thrallmächtig' })).toBeVisible();
      // Click again to deselect
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await expect(page.locator('.dkp-pchip.active', { hasText: 'Thrallmächtig' })).toHaveCount(0);
    });

    test('select all toggles all players', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.click('.dkp-selectall');
      // All chips should be active
      const activeChips = page.locator('.dkp-pchip.active');
      await expect(activeChips).toHaveCount(2);
      // Click again to deselect all
      await page.click('.dkp-selectall');
      await expect(page.locator('.dkp-pchip.active')).toHaveCount(0);
    });

    test('submit button is disabled without required fields', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await expect(page.locator('.btn-p', { hasText: 'Vergeben' })).toBeDisabled();
    });

    test('awarding DKP shows toast and updates overview', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');

      // Select a player
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();

      // Fill amount and reason
      await page.fill('#dkp-award-amount', '50');
      await page.fill('#dkp-award-reason', 'Gruul Kill');

      // Preview should show calculation
      await expect(page.locator('#v-dkp')).toContainText('1 Spieler × 50 DKP');

      // Submit
      await page.click('.btn-p:has-text("Vergeben")');

      // Toast confirmation
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Should switch back to overview with the player listed
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('#v-dkp')).toContainText('Thrallmächtig');
      await expect(page.locator('#v-dkp')).toContainText('+50');
    });

    test('awarding DKP to multiple players', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');

      // Select all
      await page.click('.dkp-selectall');
      await page.fill('#dkp-award-amount', '25');
      await page.fill('#dkp-award-reason', 'Raid attendance');

      // Preview
      await expect(page.locator('#v-dkp')).toContainText('2 Spieler × 25 DKP = 50 DKP');

      // Submit
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Both players in overview
      await expect(page.locator('.dkp-standings tbody tr')).toHaveCount(2);
    });
  });

  // ─── Spend DKP ───
  test.describe('spend DKP', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // First award some DKP so there's a balance to spend
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await page.fill('#dkp-award-amount', '100');
      await page.fill('#dkp-award-reason', 'Initial grant');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('spend view shows player dropdown with balance', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Beute")');
      await expect(page.locator('#v-dkp')).toContainText('Beute verteilen');
      // Player dropdown should have Thrallmächtig with 100 DKP
      const select = page.locator('#dkp-spend-player');
      await expect(select).toBeVisible();
      await expect(select).toContainText('Thrallmächtig (100 DKP)');
    });

    test('spending DKP deducts from balance', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Beute")');

      // Select player, amount, item
      await page.selectOption('#dkp-spend-player', 'Thrallmächtig');
      await page.fill('#dkp-spend-amount', '30');
      await page.fill('#dkp-spend-item', '[Dragonspine Trophy]');

      // Submit
      await page.click('.btn-p:has-text("Beute verbuchen")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Overview should show 70 DKP (100 - 30)
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('#v-dkp')).toContainText('+70');
    });

    test('spend submit is disabled without player and amount', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Beute")');
      await expect(page.locator('.btn-p', { hasText: 'Beute verbuchen' })).toBeDisabled();
    });
  });

  // ─── Decay ───
  test.describe('decay', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP first
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await page.fill('#dkp-award-amount', '200');
      await page.fill('#dkp-award-reason', 'Setup');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('decay view shows percentage input and preview', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Verfall")');
      await expect(page.locator('#v-dkp')).toContainText('Wöchentlicher Verfall');
      await expect(page.locator('#dkp-decay-pct')).toBeVisible();
      // Preview should show decay impact
      await expect(page.locator('.dkp-decay-preview')).toBeVisible();
      await expect(page.locator('.dkp-decay-preview')).toContainText('Thrallmächtig');
    });

    test('applying decay reduces balances', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Verfall")');

      // Default 15% decay on 200 DKP = 30 lost = 170 remaining
      await page.click('.btn-p:has-text("Verfall anwenden")');

      // Confirm modal
      await expect(page.locator('.modal-bg')).toBeVisible();
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toHaveClass(/show/);
      // Back to overview, balance should be 170
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('#v-dkp')).toContainText('+170');
    });
  });

  // ─── Undo ───
  test.describe('undo', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await page.fill('#dkp-award-amount', '75');
      await page.fill('#dkp-award-reason', 'Boss kill');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('undo button is visible when transactions exist', async ({ page }) => {
      await expect(page.locator('.dkp-undo')).toBeVisible();
    });

    test('undo reverses the last transaction', async ({ page }) => {
      // Click undo
      await page.click('.dkp-undo');

      // Confirm modal
      await expect(page.locator('.modal-bg')).toBeVisible();
      await expect(page.locator('.modal-bg')).toContainText('Thrallmächtig');
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('rückgängig');

      // Balance should be back to 0
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('.dkp-bal')).toContainText('0');
    });
  });

  // ─── Settings ───
  test.describe('settings', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, []);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('settings view shows config fields', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Einstellungen")');
      await expect(page.locator('#v-dkp')).toContainText('DKP-Einstellungen');
      await expect(page.locator('#cfg-decay')).toBeVisible();
      await expect(page.locator('#cfg-max')).toBeVisible();
      await expect(page.locator('#cfg-start')).toBeVisible();
      await expect(page.locator('#cfg-neg')).toBeVisible();
    });

    test('saving config shows confirmation', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Einstellungen")');
      await page.fill('#cfg-decay', '20');
      await page.click('.btn-p:has-text("Speichern")');
      await expect(page.locator('#toast')).toContainText('gespeichert');
    });

    test('role management shows current admin', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Einstellungen")');
      // "testuser" should be listed as admin
      await expect(page.locator('.dkp-role-list')).toContainText('testuser');
      await expect(page.locator('.dkp-role-badge')).toContainText('Admin');
    });

    test('adding a new officer role', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Einstellungen")');
      await page.fill('#dkp-role-user', 'NewOfficer');
      // Officer is already selected by default
      await page.click('.dkp-role-add .btn-p');
      await expect(page.locator('#toast')).toContainText('Offizier');
      // New officer should appear in the list
      await expect(page.locator('.dkp-role-list')).toContainText('newofficer');
    });
  });

  // ─── Player detail ───
  test.describe('player detail', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP to create a player entry
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await page.fill('#dkp-award-amount', '60');
      await page.fill('#dkp-award-reason', 'Boss kill');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('clicking a player row opens detail view', async ({ page }) => {
      // Click on the player row in the standings table
      await page.locator('.dkp-standings tbody tr').first().click();
      await expect(page.locator('.dkp-player-detail')).toBeVisible();
      await expect(page.locator('.dkp-detail-name')).toContainText('Thrallmächtig');
      await expect(page.locator('.dkp-detail-bal')).toContainText('+60 DKP');
    });

    test('detail view shows earned stats', async ({ page }) => {
      await page.locator('.dkp-standings tbody tr').first().click();
      await expect(page.locator('.dkp-detail-stats')).toContainText('+60');
      await expect(page.locator('.dkp-detail-stats')).toContainText('Verdient');
    });

    test('close button returns to overview', async ({ page }) => {
      await page.locator('.dkp-standings tbody tr').first().click();
      await expect(page.locator('.dkp-player-detail')).toBeVisible();
      await page.click('.dkp-detail-close');
      await expect(page.locator('.dkp-player-detail')).toHaveCount(0);
      await expect(page.locator('.dkp-standings')).toBeVisible();
    });
  });

  // ─── Transaction history ───
  test.describe('transactions', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('awarding DKP creates a transaction in overview', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await page.fill('#dkp-award-amount', '40');
      await page.fill('#dkp-award-reason', 'Kara clear');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Transaction should appear in overview
      await expect(page.locator('.dkp-tx')).toHaveCount(1);
      await expect(page.locator('.dkp-tx-type')).toContainText('Verdient');
      await expect(page.locator('.dkp-tx-name')).toContainText('Thrallmächtig');
      await expect(page.locator('.dkp-tx-reason')).toContainText('Kara clear');
      await expect(page.locator('.dkp-tx-amount')).toContainText('+40');
    });
  });

  // ─── Not logged in ───
  test.describe('not logged in', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      // No auth seeding — simulate no session
      await page.route('**/api/auth', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === 'validate') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Sitzung ungültig' }),
          });
          return;
        }
        await route.continue();
      });
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await page.click('[data-v="dkp"]');
      await expect(page.locator('#v-dkp')).toBeVisible();
    });

    test('DKP overview is readable without login', async ({ page }) => {
      await expect(page.locator('#v-dkp')).toContainText('DKP-Übersicht');
    });

    test('no action buttons shown for unauthenticated user', async ({ page }) => {
      const bar = page.locator('.dkp-actions-bar');
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Beute' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Verfall' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toHaveCount(0);
    });
  });

  // ─── Sorting ───
  test.describe('sorting', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award different amounts to two players
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallmächtig' }).click();
      await page.fill('#dkp-award-amount', '100');
      await page.fill('#dkp-award-reason', 'Test');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Heiligschein' }).click();
      await page.fill('#dkp-award-amount', '50');
      await page.fill('#dkp-award-reason', 'Test2');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('default sort is by DKP descending', async ({ page }) => {
      const rows = page.locator('.dkp-standings tbody tr');
      await expect(rows).toHaveCount(2);
      // First row should be Thrallmächtig (100 DKP)
      await expect(rows.first()).toContainText('Thrallmächtig');
      await expect(rows.last()).toContainText('Heiligschein');
    });

    test('clicking player header sorts by name', async ({ page }) => {
      // Click "Spieler" column header
      await page.locator('.dkp-standings thead th', { hasText: 'Spieler' }).click();
      const rows = page.locator('.dkp-standings tbody tr');
      // Ascending alphabetical: Heiligschein before Thrallmächtig
      await expect(rows.first()).toContainText('Heiligschein');
    });
  });
});
