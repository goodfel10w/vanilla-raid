import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

test.describe('Heatmap', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
    await page.addInitScript(() => {
      localStorage.setItem('raid-auth', JSON.stringify({
        token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
      }));
    });
    await page.goto('/#/heatmap');
    await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
  });

  test('shows two heatmap tables (weekday and weekend)', async ({ page }) => {
    await expect(page.locator('.htable')).toHaveCount(2);
  });

  test('weekday table has 5 rows and weekend table has 2 rows', async ({ page }) => {
    const tables = page.locator('.htable');
    const wdRows = tables.first().locator('tbody tr');
    const weRows = tables.last().locator('tbody tr');
    await expect(wdRows).toHaveCount(5);
    await expect(weRows).toHaveCount(2);
  });

  test('cells show non-zero counts for slots with availability', async ({ page }) => {
    // Both entries available on Montag 18:00 hour → cell should show 2
    const cellTexts = await page.locator('.hcell').allInnerTexts();
    const hasNonZero = cellTexts.some(t => /[1-9]/.test(t));
    expect(hasNonZero).toBe(true);
  });

  test('1h mode is active by default', async ({ page }) => {
    await expect(page.locator('.ht-btn').first()).toHaveClass(/active/);
    await expect(page.locator('.ht-btn').last()).not.toHaveClass(/active/);
  });

  test('toggle to 3h changes headers and back', async ({ page }) => {
    const firstTable = page.locator('.htable').first();
    const getHeaders = () => firstTable.locator('thead th').allTextContents();

    const headers1h = await getHeaders();

    // Switch to 3h
    await page.locator('.ht-btn', { hasText: '3h' }).click();
    await expect(page.locator('.ht-btn', { hasText: '3h' })).toHaveClass(/active/);
    const headers3h = await getHeaders();
    expect(headers3h).not.toEqual(headers1h);

    // Switch back to 1h
    await page.locator('.ht-btn', { hasText: '1h' }).click();
    await expect(page.locator('.ht-btn').first()).toHaveClass(/active/);
    const headersBack = await getHeaders();
    expect(headersBack).toEqual(headers1h);
  });

  test('tooltip appears on cell hover', async ({ page }) => {
    // Find a cell that has data (non-zero)
    const cells = page.locator('.hcell');
    const count = await cells.count();
    let targetCell = null;
    for (let i = 0; i < count; i++) {
      const text = await cells.nth(i).innerText();
      if (/[1-9]/.test(text)) {
        targetCell = cells.nth(i);
        break;
      }
    }
    expect(targetCell).not.toBeNull();
    const tooltip = page.locator('#htooltip');
    // Tooltip hidden initially
    await expect(tooltip).not.toHaveClass(/show/);
    // Hover shows tooltip
    await targetCell.hover();
    await expect(tooltip).toHaveClass(/show/);
  });

  test('heatmap shows section labels', async ({ page }) => {
    await expect(page.locator('.sec-l', { hasText: 'Unter der Woche' })).toBeVisible();
    await expect(page.locator('.sec-l', { hasText: 'Wochenende' })).toBeVisible();
  });
});
