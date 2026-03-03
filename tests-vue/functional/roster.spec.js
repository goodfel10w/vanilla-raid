import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

test.describe('Roster', () => {
  test.describe('with entries', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
        }));
      });
      await page.goto('/#/roster');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
    });

    test('shows all entries', async ({ page }) => {
      await expect(page.locator('.entry')).toHaveCount(2);
    });

    test('displays entry name and class', async ({ page }) => {
      const names = await page.locator('.e-name').allTextContents();
      expect(names.some(n => n.includes('Thrallm\u00e4chtig'))).toBe(true);
      expect(names.some(n => n.includes('Heiligschein'))).toBe(true);
      const classes = await page.locator('.e-class').allTextContents();
      expect(classes).toContain('Krieger');
      expect(classes).toContain('Priester');
    });

    test('role summary cards show correct counts', async ({ page }) => {
      const rcards = page.locator('.rcard');
      await expect(rcards).toHaveCount(3);
      // Tank: 1, Heiler: 1, DPS: 1
      const counts = await rcards.locator('.num').allTextContents();
      expect(counts).toEqual(['1', '1', '1']);
    });

    test('sorting by name orders alphabetically', async ({ page }) => {
      await page.selectOption('.sort-sel', 'name');
      const names = await page.locator('.e-name').allTextContents();
      // Heiligschein < Thrallm\u00e4chtig
      expect(names[0]).toContain('Heiligschein');
      expect(names[1]).toContain('Thrallm\u00e4chtig');
    });

    test('sorting by class orders by CLS array', async ({ page }) => {
      await page.selectOption('.sort-sel', 'class');
      const names = await page.locator('.e-name').allTextContents();
      // Krieger (index 3) before Priester (index 6)
      expect(names[0]).toContain('Thrallm\u00e4chtig');
      expect(names[1]).toContain('Heiligschein');
    });

    test('sorting by role orders Tank > Heiler > DPS', async ({ page }) => {
      await page.selectOption('.sort-sel', 'role');
      const names = await page.locator('.e-name').allTextContents();
      // Tank (Thrallm\u00e4chtig) before Heiler (Heiligschein)
      expect(names[0]).toContain('Thrallm\u00e4chtig');
      expect(names[1]).toContain('Heiligschein');
    });

    test('own entry shows edit/delete buttons', async ({ page }) => {
      // SAMPLE_ENTRY has userId mock-user-1 = our user
      const ownEntry = page.locator('.entry', { has: page.locator('.e-name', { hasText: 'Thrallm\u00e4chtig' }) });
      await expect(ownEntry.locator('[data-edit]')).toBeVisible();
      await expect(ownEntry.locator('[data-del]')).toBeVisible();
    });

    test('other user entry hides edit/delete buttons', async ({ page }) => {
      // SAMPLE_ENTRY_2 has userId mock-user-2 = different user
      const otherEntry = page.locator('.entry', { has: page.locator('.e-name', { hasText: 'Heiligschein' }) });
      await expect(otherEntry.locator('[data-edit]')).toHaveCount(0);
      await expect(otherEntry.locator('[data-del]')).toHaveCount(0);
    });

    test('delete with modal confirm removes entry', async ({ page }) => {
      // Only own entry (Thrallm\u00e4chtig) has delete button
      await page.locator('[data-del]').first().click();
      await expect(page.locator('.modal-bg')).toBeVisible();
      await expect(page.locator('.modal-title')).toHaveText(/l\u00f6schen/i);
      await page.click('.modal-confirm');
      await expect(page.locator('.modal-bg')).toHaveCount(0);
      await expect(page.locator('.entry')).toHaveCount(1);
    });

    test('delete with modal cancel keeps entry', async ({ page }) => {
      await page.locator('[data-del]').first().click();
      await expect(page.locator('.modal-bg')).toBeVisible();
      await page.click('.modal-cancel');
      await expect(page.locator('.modal-bg')).toHaveCount(0);
      await expect(page.locator('.entry')).toHaveCount(2);
    });

    test('edit pre-fills form with entry data', async ({ page }) => {
      // Click edit on SAMPLE_ENTRY specifically (by id)
      await page.locator(`[data-edit="${SAMPLE_ENTRY.id}"]`).click();
      // Vue router navigates to /form?edit=id
      await expect(page.locator('#v-form')).toBeVisible();
      // Name is pre-filled
      await expect(page.locator('#f-name')).toHaveValue(SAMPLE_ENTRY.charName);
      // Class chip is active
      await expect(page.locator('.chip.active')).toContainText(SAMPLE_ENTRY.className);
      // Submit button says "Aktualisieren"
      await expect(page.locator('#f-submit')).toHaveText('Aktualisieren');
    });

    test('CSV export button is visible', async ({ page }) => {
      await expect(page.locator('.btn-export')).toBeVisible();
      await expect(page.locator('.btn-export')).toContainText('CSV Export');
    });
  });

  test.describe('empty state', () => {
    test('shows empty message when no entries', async ({ page }) => {
      await setupMockApi(page, []);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
        }));
      });
      await page.goto('/#/roster');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await expect(page.locator('.empty')).toContainText('Noch keine Eintr\u00e4ge');
      // No CSV export button when empty
      await expect(page.locator('.btn-export')).toHaveCount(0);
    });
  });
});
