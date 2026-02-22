import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY } from '../fixtures/test-data.js';

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page, [SAMPLE_ENTRY]);
    await page.addInitScript(() => {
      localStorage.setItem('raid-auth', JSON.stringify({
        token: 'mock-token', username: 'Testuser', userId: 'mock-user-1'
      }));
    });
    await page.goto('/');
    await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
  });

  test('form view is shown by default', async ({ page }) => {
    await expect(page.locator('#v-form')).toBeVisible();
    await expect(page.locator('#v-raids')).toBeHidden();
    await expect(page.locator('#v-roster')).toBeHidden();
    await expect(page.locator('#v-heatmap')).toBeHidden();
    await expect(page.locator('#v-analytics')).toBeHidden();
    await expect(page.locator('[data-v="form"]')).toHaveClass(/\bon\b/);
  });

  test('switch to roster tab', async ({ page }) => {
    await page.click('[data-v="roster"]');
    await expect(page.locator('#v-roster')).toBeVisible();
    await expect(page.locator('#v-form')).toBeHidden();
    await expect(page.locator('[data-v="roster"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('[data-v="form"]')).not.toHaveClass(/\bon\b/);
  });

  test('switch to heatmap tab', async ({ page }) => {
    await page.click('[data-v="heatmap"]');
    await expect(page.locator('#v-heatmap')).toBeVisible();
    await expect(page.locator('#v-form')).toBeHidden();
    await expect(page.locator('[data-v="heatmap"]')).toHaveClass(/\bon\b/);
  });

  test('switch to analytics tab', async ({ page }) => {
    await page.click('[data-v="analytics"]');
    await expect(page.locator('#v-analytics')).toBeVisible();
    await expect(page.locator('#v-form')).toBeHidden();
    await expect(page.locator('[data-v="analytics"]')).toHaveClass(/\bon\b/);
  });

  test('switch back to form from another tab', async ({ page }) => {
    await page.click('[data-v="roster"]');
    await expect(page.locator('#v-roster')).toBeVisible();
    await page.click('[data-v="form"]');
    await expect(page.locator('#v-form')).toBeVisible();
    await expect(page.locator('#v-roster')).toBeHidden();
  });

  test('cycle through all 5 tabs', async ({ page }) => {
    const views = ['form', 'raids', 'roster', 'heatmap', 'analytics'];
    for (const v of views) {
      await page.click(`[data-v="${v}"]`);
      await expect(page.locator(`#v-${v}`)).toBeVisible();
      for (const other of views.filter(x => x !== v)) {
        await expect(page.locator(`#v-${other}`)).toBeHidden();
      }
    }
  });
});
