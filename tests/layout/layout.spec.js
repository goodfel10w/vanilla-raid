import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

test.describe('Layout checks', () => {
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

  test('no horizontal overflow on form view', async ({ page }) => {
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow on roster view', async ({ page }) => {
    await page.click('[data-v="roster"]');
    await expect(page.locator('.entry').first()).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow on heatmap view', async ({ page }) => {
    await page.click('[data-v="heatmap"]');
    await expect(page.locator('.htable').first()).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow on analytics view', async ({ page }) => {
    await page.click('[data-v="analytics"]');
    await expect(page.locator('.role-an-item').first()).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test('all tabs are visible and clickable', async ({ page }) => {
    // 7 tabs for admin users (includes Admin tab), 6 for regular users
    const tabs = page.locator('.tab:not(.hidden)');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(6);
    for (const tab of await tabs.all()) {
      await expect(tab).toBeVisible();
      await expect(tab).toBeEnabled();
    }
  });

  test('form has 9 class chips and spec chips appear after class selection', async ({ page }) => {
    await expect(page.locator('.chip')).toHaveCount(9);
    // Spec chips only appear after selecting a class
    await expect(page.locator('.rchip')).toHaveCount(0);
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    // Krieger has 3 specs: Prot, Arms, Fury
    await expect(page.locator('.rchip')).toHaveCount(3);
  });

  test('heatmap cards have overflow-x auto', async ({ page }) => {
    await page.click('[data-v="heatmap"]');
    await expect(page.locator('.htable').first()).toBeVisible();
    const cards = page.locator('#v-heatmap .card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (const card of await cards.all()) {
      const overflowX = await card.evaluate(el => getComputedStyle(el).overflowX);
      expect(overflowX).toBe('auto');
    }
  });

  test('roster entries fit within container', async ({ page }) => {
    await page.click('[data-v="roster"]');
    await expect(page.locator('.entry').first()).toBeVisible();
    const containerWidth = await page.locator('#v-roster').evaluate(el => el.clientWidth);
    for (const entry of await page.locator('.entry').all()) {
      const entryWidth = await entry.evaluate(el => el.scrollWidth);
      expect(entryWidth).toBeLessThanOrEqual(containerWidth + 1);
    }
  });

  test('analytics bars fit within tracks', async ({ page }) => {
    await page.click('[data-v="analytics"]');
    await expect(page.locator('.bar-row').first()).toBeVisible();
    for (const track of await page.locator('.bar-track').all()) {
      const trackWidth = await track.evaluate(el => el.clientWidth);
      const fillWidth = await track.locator('.bar-fill').evaluate(el => el.clientWidth);
      expect(fillWidth).toBeLessThanOrEqual(trackWidth + 1);
    }
  });
});
