import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';

test.describe('Form', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page, []);
    await page.addInitScript(() => {
      localStorage.setItem('raid-auth', JSON.stringify({
        token: 'mock-token', username: 'Testuser', userId: 'mock-user-1'
      }));
    });
    await page.goto('/');
    await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
  });

  test('submit is disabled without required fields', async ({ page }) => {
    await expect(page.locator('#f-submit')).toBeDisabled();
  });

  test('submit remains disabled with only name', async ({ page }) => {
    await page.fill('#f-name', 'Testchar');
    await expect(page.locator('#f-submit')).toBeDisabled();
  });

  test('submit remains disabled with name and class but no role', async ({ page }) => {
    await page.fill('#f-name', 'Testchar');
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await expect(page.locator('#f-submit')).toBeDisabled();
  });

  test('submit enables when name, class, and role are filled', async ({ page }) => {
    await page.fill('#f-name', 'Testchar');
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await page.locator('.rchip', { hasText: 'Tank' }).click();
    await expect(page.locator('#f-submit')).toBeEnabled();
  });

  test('availability button cycles: off \u2192 yes \u2192 tentative \u2192 off', async ({ page }) => {
    const btn = page.locator('.sbtn').first();
    // Initial: off
    await expect(btn).toHaveText('\u2014');
    await expect(btn).not.toHaveClass(/\bon\b/);
    await expect(btn).not.toHaveClass(/\btent\b/);
    // Click 1: yes
    await btn.click();
    await expect(btn).toHaveText('\u2713');
    await expect(btn).toHaveClass(/\bon\b/);
    // Click 2: tentative
    await btn.click();
    await expect(btn).toHaveText('?');
    await expect(btn).toHaveClass(/\btent\b/);
    // Click 3: off
    await btn.click();
    await expect(btn).toHaveText('\u2014');
    await expect(btn).not.toHaveClass(/\bon\b/);
    await expect(btn).not.toHaveClass(/\btent\b/);
  });

  test('class chip selection toggles active state', async ({ page }) => {
    const chip = page.locator('.chip', { hasText: 'Magier' });
    await expect(chip).not.toHaveClass(/active/);
    await chip.click();
    await expect(chip).toHaveClass(/active/);
    // Selecting another deselects the first
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await expect(chip).not.toHaveClass(/active/);
    await expect(page.locator('.chip', { hasText: 'Krieger' })).toHaveClass(/active/);
  });

  test('role chips support multiple selection', async ({ page }) => {
    const tank = page.locator('.rchip', { hasText: 'Tank' });
    const healer = page.locator('.rchip', { hasText: 'Heiler' });
    await tank.click();
    await expect(tank).toHaveClass(/active/);
    await healer.click();
    await expect(tank).toHaveClass(/active/);
    await expect(healer).toHaveClass(/active/);
    // Deselect tank
    await tank.click();
    await expect(tank).not.toHaveClass(/active/);
    await expect(healer).toHaveClass(/active/);
  });

  test('fill and submit form switches to roster', async ({ page }) => {
    await page.fill('#f-name', 'Testkrieger');
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await page.locator('.rchip', { hasText: 'Tank' }).click();
    await page.locator('.sbtn').first().click();
    await page.click('#f-submit');
    // After submit, switches to roster view
    await expect(page.locator('#v-roster')).toBeVisible();
    await expect(page.locator('#v-form')).toBeHidden();
    // Toast appears
    await expect(page.locator('#toast')).toHaveClass(/show/);
    // Entry is shown in roster
    await expect(page.locator('.e-name')).toHaveText('Testkrieger');
  });
});
