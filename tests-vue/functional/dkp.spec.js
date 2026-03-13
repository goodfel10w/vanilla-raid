import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

// Helper: seed auth as admin (username "Testuser" - mock config has "testuser" as admin)
function seedAuth(page) {
  return page.addInitScript(() => {
    localStorage.setItem('raid-auth', JSON.stringify({
      token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
    }));
  });
}

// Helper: navigate to DKP tab and wait for render
async function gotoDkp(page) {
  await page.goto('/#/dkp');
  await expect(page.locator('header #counter')).toHaveText(/\d+ Raider/);
  await expect(page.locator('#v-dkp')).toBeVisible();
}

test.describe('DKP', () => {
  // --- Admin access (default mock user is admin) ---
  test.describe('admin access', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('DKP tab shows overview by default', async ({ page }) => {
      await expect(page.locator('#v-dkp')).toContainText('DKP-\u00dcbersicht');
    });

    test('admin sees all action buttons', async ({ page }) => {
      const bar = page.locator('.dkp-actions-bar');
      await expect(bar.locator('button', { hasText: '\u00dcbersicht' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Beute' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Verfall' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toBeVisible();
    });

    test('empty overview shows hint text', async ({ page }) => {
      await expect(page.locator('#v-dkp')).toContainText('Noch keine DKP-Eintr\u00e4ge');
    });

    test('CSV export button is present', async ({ page }) => {
      await expect(page.locator('.dkp-toolbar-btn', { hasText: 'CSV Export' })).toBeVisible();
    });
  });

  // --- Officer access ---
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

  // --- No role (regular user) ---
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
          body: JSON.stringify({ error: 'Nur Admins und Offiziere d\u00fcrfen DKP verwalten' }),
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
      await expect(bar.locator('button', { hasText: '\u00dcbersicht' })).toBeVisible();
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Beute' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Verfall' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toHaveCount(0);
    });
  });

  // --- Award DKP ---
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
      await expect(page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' })).toBeVisible();
      await expect(page.locator('.dkp-pchip', { hasText: 'Heiligschein' })).toBeVisible();
    });

    test('selecting players toggles chip active state', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      const chip = page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' });
      await expect(chip).not.toHaveClass(/active/);
      await chip.click();
      await expect(page.locator('.dkp-pchip.active', { hasText: 'Thrallm\u00e4chtig' })).toBeVisible();
      // Click again to deselect
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await expect(page.locator('.dkp-pchip.active', { hasText: 'Thrallm\u00e4chtig' })).toHaveCount(0);
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
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();

      // Fill amount and reason
      await page.fill('#dkp-award-amount', '50');
      await page.fill('#dkp-award-reason', 'Gruul Kill');

      // Preview should show calculation
      await expect(page.locator('#v-dkp')).toContainText('1 Spieler \u00d7 50 DKP');

      // Submit
      await page.click('.btn-p:has-text("Vergeben")');

      // Toast confirmation
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Should switch back to overview with the player listed
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('#v-dkp')).toContainText('Thrallm\u00e4chtig');
      await expect(page.locator('#v-dkp')).toContainText('+50');
    });

    test('awarding DKP to multiple players', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');

      // Select all
      await page.click('.dkp-selectall');
      await page.fill('#dkp-award-amount', '25');
      await page.fill('#dkp-award-reason', 'Raid attendance');

      // Preview
      await expect(page.locator('#v-dkp')).toContainText('2 Spieler \u00d7 25 DKP = 50 DKP');

      // Submit
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Both players in overview
      await expect(page.locator('.dkp-standings tbody tr')).toHaveCount(2);
    });
  });

  // --- Spend DKP ---
  test.describe('spend DKP', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // First award some DKP so there's a balance to spend
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '100');
      await page.fill('#dkp-award-reason', 'Initial grant');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('spend view shows player dropdown with balance', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Beute")');
      await expect(page.locator('#v-dkp')).toContainText('Beute verteilen');
      // Player dropdown should have Thrallm\u00e4chtig with 100 DKP
      const select = page.locator('#dkp-spend-player');
      await expect(select).toBeVisible();
      await expect(select).toContainText('Thrallm\u00e4chtig (100 DKP)');
    });

    test('spending DKP deducts from balance', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Beute")');

      // Select player, amount, item
      await page.selectOption('#dkp-spend-player', 'Thrallm\u00e4chtig');
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

  // --- Decay ---
  test.describe('decay', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP first
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '200');
      await page.fill('#dkp-award-reason', 'Setup');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('decay view shows percentage input and preview', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Verfall")');
      await expect(page.locator('#v-dkp')).toContainText('W\u00f6chentlicher Verfall');
      await expect(page.locator('#dkp-decay-pct')).toBeVisible();
      // Preview should show decay impact
      await expect(page.locator('.dkp-decay-preview')).toBeVisible();
      await expect(page.locator('.dkp-decay-preview')).toContainText('Thrallm\u00e4chtig');
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

  // --- Undo ---
  test.describe('undo', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
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
      await expect(page.locator('.modal-bg')).toContainText('Thrallm\u00e4chtig');
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('r\u00fcckg\u00e4ngig');

      // Balance should be back to 0
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('.dkp-bal')).toContainText('0');
    });
  });

  // --- Settings ---
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

    // Role management has moved to Admin panel (AdminRoles component)
  });

  // --- Player detail ---
  test.describe('player detail', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP to create a player entry
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '60');
      await page.fill('#dkp-award-reason', 'Boss kill');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('clicking a player row opens detail view', async ({ page }) => {
      // Click on the player row in the standings table
      await page.locator('.dkp-standings tbody tr').first().click();
      await expect(page.locator('.dkp-player-detail')).toBeVisible();
      await expect(page.locator('.dkp-detail-name')).toContainText('Thrallm\u00e4chtig');
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

  // --- Transaction history ---
  test.describe('transactions', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('awarding DKP creates a transaction in overview', async ({ page }) => {
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '40');
      await page.fill('#dkp-award-reason', 'Kara clear');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Transaction should appear in overview
      await expect(page.locator('.dkp-tx')).toHaveCount(1);
      await expect(page.locator('.dkp-tx-type')).toContainText('Verdient');
      await expect(page.locator('.dkp-tx-name')).toContainText('Thrallm\u00e4chtig');
      await expect(page.locator('.dkp-tx-reason')).toContainText('Kara clear');
      await expect(page.locator('.dkp-tx-amount')).toContainText('+40');
    });
  });

  // --- Not logged in ---
  test.describe('not logged in', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      // No auth seeding - simulate no session
      await page.route('**/api/auth', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action === 'validate') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Sitzung ung\u00fcltig' }),
          });
          return;
        }
        await route.continue();
      });
      await page.goto('/#/dkp');
      await expect(page.locator('header #counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('#v-dkp')).toBeVisible();
    });

    test('DKP overview is readable without login', async ({ page }) => {
      await expect(page.locator('#v-dkp')).toContainText('DKP-\u00dcbersicht');
    });

    test('no action buttons shown for unauthenticated user', async ({ page }) => {
      const bar = page.locator('.dkp-actions-bar');
      await expect(bar.locator('button', { hasText: 'Vergeben' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Beute' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Verfall' })).toHaveCount(0);
      await expect(bar.locator('button', { hasText: 'Einstellungen' })).toHaveCount(0);
    });
  });

  // --- Sorting ---
  test.describe('sorting', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award different amounts to two players
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
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
      // First row should be Thrallm\u00e4chtig (100 DKP)
      await expect(rows.first()).toContainText('Thrallm\u00e4chtig');
      await expect(rows.last()).toContainText('Heiligschein');
    });

    test('clicking player header sorts by name', async ({ page }) => {
      // Click "Spieler" column header
      await page.locator('.dkp-standings thead th', { hasText: 'Spieler' }).click();
      const rows = page.locator('.dkp-standings tbody tr');
      // Ascending alphabetical: Heiligschein before Thrallm\u00e4chtig
      await expect(rows.first()).toContainText('Heiligschein');
    });
  });

  // --- Search / Filter ---
  test.describe('search and filter', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP to both players
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.click('.dkp-selectall');
      await page.fill('#dkp-award-amount', '50');
      await page.fill('#dkp-award-reason', 'Test award');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('search bar filters standings by player name', async ({ page }) => {
      await expect(page.locator('.dkp-standings tbody tr')).toHaveCount(2);
      await page.fill('#dkp-search-input', 'Thrall');
      await expect(page.locator('.dkp-standings tbody tr')).toHaveCount(1);
      await expect(page.locator('.dkp-standings tbody tr').first()).toContainText('Thrallm\u00e4chtig');
    });

    test('search shows "no results" for non-matching query', async ({ page }) => {
      await page.fill('#dkp-search-input', 'zzzzzzz');
      await expect(page.locator('#v-dkp')).toContainText('Keine Treffer');
    });

    test('transaction type filter buttons work', async ({ page }) => {
      // Should have "Verdient" transactions
      await expect(page.locator('.dkp-tx')).toHaveCount(2);

      // Filter to "Beute" - should show none
      await page.click('.dkp-tx-filter:has-text("Beute")');
      await expect(page.locator('#v-dkp .card:last-child')).toContainText('Keine Transaktionen in dieser Kategorie');

      // Filter back to "Alle"
      await page.click('.dkp-tx-filter:has-text("Alle")');
      await expect(page.locator('.dkp-tx')).toHaveCount(2);
    });
  });

  // --- Transaction Management (Admin) ---
  test.describe('transaction management', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '100');
      await page.fill('#dkp-award-reason', 'Initial');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('edit button appears on transactions for admin', async ({ page }) => {
      await expect(page.locator('.dkp-tx-btn').first()).toBeVisible();
    });

    test('edit transaction updates amount and reason', async ({ page }) => {
      // Wait for initial toast to disappear
      await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 6000 });

      // Click edit button (pencil icon)
      await page.locator('.dkp-tx-btn').first().click();
      await expect(page.locator('.modal-bg')).toBeVisible();

      // Change amount and reason
      await page.fill('#dkp-edit-amount', '75');
      await page.fill('#dkp-edit-reason', 'Adjusted amount');
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('aktualisiert');

      // Balance should reflect the change (75 instead of 100)
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('#v-dkp')).toContainText('+75');
    });

    test('delete transaction removes it and adjusts balance', async ({ page }) => {
      // Wait for initial toast to disappear
      await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 6000 });

      // Click delete button (X icon)
      await page.locator('.dkp-tx-btn.dkp-tx-del').first().click();
      await expect(page.locator('.modal-bg')).toBeVisible();
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('gel\u00f6scht');

      // Balance should be back to 0
      await expect(page.locator('.dkp-standings')).toBeVisible();
      await expect(page.locator('.dkp-bal')).toContainText('0');
    });
  });

  // --- Player Management (Admin) ---
  test.describe('player management', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);

      // Award DKP to create player
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '100');
      await page.fill('#dkp-award-reason', 'Setup');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);
    });

    test('player detail shows admin action buttons', async ({ page }) => {
      await page.locator('.dkp-standings tbody tr').first().click();
      await expect(page.locator('.dkp-detail-actions')).toBeVisible();
      await expect(page.locator('.dkp-detail-action', { hasText: 'DKP anpassen' })).toBeVisible();
      await expect(page.locator('.dkp-detail-action', { hasText: 'Bearbeiten' })).toBeVisible();
      await expect(page.locator('.dkp-detail-action.danger', { hasText: 'Spieler l\u00f6schen' })).toBeVisible();
    });

    test('adjust balance changes player DKP directly', async ({ page }) => {
      // Wait for initial toast to disappear
      await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 6000 });

      await page.locator('.dkp-standings tbody tr').first().click();
      await page.click('.dkp-detail-action:has-text("DKP anpassen")');
      await expect(page.locator('.modal-bg')).toBeVisible();

      await page.fill('#dkp-adj-balance', '250');
      await page.fill('#dkp-adj-reason', 'Bonus');
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('250');
      // Detail view should show updated balance
      await expect(page.locator('.dkp-detail-bal')).toContainText('+250 DKP');
    });

    test('edit player allows changing class', async ({ page }) => {
      // Wait for initial toast to disappear
      await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 6000 });

      await page.locator('.dkp-standings tbody tr').first().click();
      await page.click('.dkp-detail-action:has-text("Bearbeiten")');
      await expect(page.locator('.modal-bg')).toBeVisible();

      // Change class to Magier
      await page.selectOption('#dkp-edit-class', 'Magier');
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('aktualisiert');
    });

    test('delete player removes from DKP system', async ({ page }) => {
      // Wait for initial toast to disappear
      await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 6000 });

      await page.locator('.dkp-standings tbody tr').first().click();
      await page.click('.dkp-detail-action.danger');
      await expect(page.locator('.modal-bg')).toBeVisible();
      await page.click('.modal-confirm');

      await expect(page.locator('#toast')).toContainText('entfernt');
      // Should be back to overview with empty standings
      await expect(page.locator('#v-dkp')).toContainText('Noch keine DKP-Eintr\u00e4ge');
    });
  });

  // --- My DKP ---
  test.describe('my DKP', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY]);
      await seedAuth(page);
      await gotoDkp(page);
    });

    test('Mein DKP button appears when user has DKP balance matching username', async ({ page }) => {
      // Award DKP to "Testuser" (matching the mock auth username)
      await page.click('.dkp-actions-bar button:has-text("Vergeben")');

      // First we need a player with a name matching the username
      // The mock user is "Testuser" - we need a balance matching that
      // Let's award to Thrallm\u00e4chtig first (no match)
      await page.locator('.dkp-pchip', { hasText: 'Thrallm\u00e4chtig' }).click();
      await page.fill('#dkp-award-amount', '50');
      await page.fill('#dkp-award-reason', 'Test');
      await page.click('.btn-p:has-text("Vergeben")');
      await expect(page.locator('#toast')).toHaveClass(/show/);

      // Mein DKP should not appear (no match for "Testuser")
      // But the entry has userId matching, so it may match via entries
      // The SAMPLE_ENTRY has userId 'mock-user-1' which matches our auth
      await expect(page.locator('.dkp-my-btn')).toBeVisible();
    });
  });
});
