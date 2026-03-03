import { test, expect } from '@playwright/test';
import { setupMockApi, navigateTo } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY } from '../fixtures/test-data.js';

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page, [SAMPLE_ENTRY]);
    await page.addInitScript(() => {
      localStorage.setItem('raid-auth', JSON.stringify({
        token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
      }));
    });
    await page.goto('/#/form');
    await expect(page.locator('header #counter')).toHaveText(/\d+ Raider/);
  });

  test('form view is shown by default', async ({ page }) => {
    await expect(page.locator('#v-form')).toBeVisible();
  });

  test('switch to roster tab', async ({ page }) => {
    await navigateTo(page, '/roster');
    await expect(page.locator('#v-roster')).toBeVisible();
  });

  test('switch to heatmap tab', async ({ page }) => {
    await navigateTo(page, '/heatmap');
    await expect(page.locator('#v-heatmap')).toBeVisible();
  });

  test('switch to analytics tab', async ({ page }) => {
    await navigateTo(page, '/analytics');
    await expect(page.locator('#v-analytics')).toBeVisible();
  });

  test('switch back to form from another tab', async ({ page }) => {
    await navigateTo(page, '/roster');
    await expect(page.locator('#v-roster')).toBeVisible();
    await navigateTo(page, '/form');
    await expect(page.locator('#v-form')).toBeVisible();
  });

  test('cycle through all 6 tabs', async ({ page }) => {
    const views = ['form', 'raids', 'roster', 'heatmap', 'analytics', 'dkp'];
    for (const v of views) {
      await navigateTo(page, '/' + v);
      await expect(page.locator(`#v-${v}`)).toBeVisible();
    }
  });
});
