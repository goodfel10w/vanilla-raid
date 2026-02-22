import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

const viewports = [
  { name: 'mobile 375px', width: 375, height: 667 },
  { name: '641px breakpoint edge', width: 641, height: 800 },
  { name: 'tablet 768px', width: 768, height: 1024 },
  { name: 'desktop 1280px', width: 1280, height: 720 },
];

for (const vp of viewports) {
  test.describe(`Responsive at ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1'
        }));
      });
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
    });

    test('no horizontal overflow on all views', async ({ page }) => {
      const views = ['form', 'roster', 'heatmap', 'analytics'];
      for (const v of views) {
        await page.click(`[data-v="${v}"]`);
        // Wait for content to render
        await page.waitForTimeout(100);
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(overflow, `horizontal overflow on ${v} at ${vp.width}px`).toBe(false);
      }
    });

    test('form submit works', async ({ page }) => {
      await page.fill('#f-name', 'ResponsiveTest');
      await page.locator('.chip', { hasText: 'Magier' }).click();
      await page.locator('.rchip', { hasText: 'DPS' }).click();
      await page.click('#f-submit');
      await expect(page.locator('#v-roster')).toBeVisible();
      await expect(page.locator('.e-name', { hasText: 'ResponsiveTest' })).toBeVisible();
    });

    test('tab switching works', async ({ page }) => {
      for (const v of ['roster', 'heatmap', 'analytics', 'form']) {
        await page.click(`[data-v="${v}"]`);
        await expect(page.locator(`#v-${v}`)).toBeVisible();
      }
    });

    test('delete modal displays and dismisses', async ({ page }) => {
      await page.click('[data-v="roster"]');
      // Only own entries show delete button
      await page.locator('[data-del]').first().click();
      await expect(page.locator('.modal-bg')).toBeVisible();
      await expect(page.locator('.modal')).toBeVisible();
      // Check modal fits viewport
      const modalWidth = await page.locator('.modal').evaluate(el => el.offsetWidth);
      expect(modalWidth).toBeLessThanOrEqual(vp.width);
      // Dismiss
      await page.click('.modal-cancel');
      await expect(page.locator('.modal-bg')).toHaveCount(0);
    });

    test('all tabs remain visible', async ({ page }) => {
      const tabs = page.locator('.tab');
      await expect(tabs).toHaveCount(6);
      for (const tab of await tabs.all()) {
        await expect(tab).toBeVisible();
      }
    });
  });
}
