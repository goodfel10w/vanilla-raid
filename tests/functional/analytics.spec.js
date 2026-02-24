import { test, expect } from '@playwright/test';
import { setupMockApi } from '../fixtures/mock-api.js';
import { SAMPLE_ENTRY, SAMPLE_ENTRY_2 } from '../fixtures/test-data.js';

test.describe('Analytics', () => {
  test.describe('with entries', () => {
    test.beforeEach(async ({ page }) => {
      await setupMockApi(page, [SAMPLE_ENTRY, SAMPLE_ENTRY_2]);
      await page.addInitScript(() => {
        localStorage.setItem('raid-auth', JSON.stringify({
          token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true
        }));
      });
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await page.click('[data-v="analytics"]');
    });

    test('shows 3 role distribution items', async ({ page }) => {
      const items = page.locator('.role-an-item');
      await expect(items).toHaveCount(3);
    });

    test('role counts are correct', async ({ page }) => {
      // Tank: 1 (SAMPLE_ENTRY), Heiler: 1 (SAMPLE_ENTRY_2), DPS: 1 (SAMPLE_ENTRY_2)
      const counts = await page.locator('.role-an-item .big').allTextContents();
      expect(counts).toEqual(['1', '1', '1']);
    });

    test('shows class distribution bars', async ({ page }) => {
      // 2 classes: Krieger and Priester
      const bars = page.locator('.bar-row');
      await expect(bars).toHaveCount(2);
      const labels = await bars.locator('.bar-lbl').allTextContents();
      expect(labels).toContain('Krieger');
      expect(labels).toContain('Priester');
    });

    test('shows best raid times section', async ({ page }) => {
      const bsCards = await page.locator('.bs-card').count();
      expect(bsCards).toBeGreaterThanOrEqual(1);
    });

    test('best raid times show role breakdown', async ({ page }) => {
      const firstSlot = page.locator('.bs-card').first();
      const roles = firstSlot.locator('.bs-role');
      await expect(roles).toHaveCount(3); // Tank, Heiler, DPS sections
    });

    test('shows player availability ranking', async ({ page }) => {
      const prows = page.locator('.pbar-row');
      await expect(prows).toHaveCount(2);
      const names = await prows.locator('.pbar-name').allTextContents();
      expect(names).toContain('Thrallm\u00e4chtig');
      expect(names).toContain('Heiligschein');
    });

    test('shows multi-spec info', async ({ page }) => {
      // SAMPLE_ENTRY_2 has 2 specs, SAMPLE_ENTRY has 1
      await expect(page.locator('.flex-info')).toContainText('1 Spieler mit Mehrfach-Spec');
      await expect(page.locator('.flex-info')).toContainText('1 nur ein Spec');
    });

    test('class bars have fills within track bounds', async ({ page }) => {
      for (const track of await page.locator('.bar-track').all()) {
        const trackWidth = await track.evaluate(el => el.clientWidth);
        const fillWidth = await track.locator('.bar-fill').evaluate(el => el.clientWidth);
        expect(fillWidth).toBeLessThanOrEqual(trackWidth + 1);
      }
    });

    test('player ranking shows slot counts', async ({ page }) => {
      const vals = await page.locator('.pbar-val').allTextContents();
      vals.forEach(v => expect(v).toMatch(/\d+ Slots/));
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
      await page.goto('/');
      await expect(page.locator('#counter')).toHaveText(/\d+ Raider/);
      await page.click('[data-v="analytics"]');
      await expect(page.locator('.empty')).toHaveText('Noch keine Daten f\u00fcr die Auswertung.');
    });
  });
});
