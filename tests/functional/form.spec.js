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

  test('submit remains disabled with name and class but no spec', async ({ page }) => {
    await page.fill('#f-name', 'Testchar');
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await expect(page.locator('#f-submit')).toBeDisabled();
  });

  test('submit enables when name, class, and spec are filled', async ({ page }) => {
    await page.fill('#f-name', 'Testchar');
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await page.locator('.rchip', { hasText: 'Prot' }).click();
    await expect(page.locator('#f-submit')).toBeEnabled();
  });

  test('availability cell cycles: off → yes → tentative → off', async ({ page }) => {
    const cell = page.locator('.tl-cell').first();
    // Initial: off (no .on or .tent class)
    await expect(cell).not.toHaveClass(/\bon\b/);
    await expect(cell).not.toHaveClass(/\btent\b/);
    // Click 1: yes
    await cell.click();
    await expect(cell).toHaveClass(/\bon\b/);
    // Click 2: tentative
    await cell.click();
    await expect(cell).toHaveClass(/\btent\b/);
    // Click 3: off
    await cell.click();
    await expect(cell).not.toHaveClass(/\bon\b/);
    await expect(cell).not.toHaveClass(/\btent\b/);
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

  test('spec chips support multiple selection', async ({ page }) => {
    // First select a class to show spec chips
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    const prot = page.locator('.rchip', { hasText: 'Prot' });
    const arms = page.locator('.rchip', { hasText: 'Arms' });
    await prot.click();
    await expect(prot).toHaveClass(/active/);
    await arms.click();
    await expect(prot).toHaveClass(/active/);
    await expect(arms).toHaveClass(/active/);
    // Deselect prot
    await prot.click();
    await expect(prot).not.toHaveClass(/active/);
    await expect(arms).toHaveClass(/active/);
  });

  test('fill and submit form switches to roster', async ({ page }) => {
    await page.fill('#f-name', 'Testkrieger');
    await page.locator('.chip', { hasText: 'Krieger' }).click();
    await page.locator('.rchip', { hasText: 'Prot' }).click();
    await page.locator('.tl-cell').first().click();
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
