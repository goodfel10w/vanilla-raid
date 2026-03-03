import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-vue',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
      testIgnore: '**/responsive/**',
    },
    {
      name: 'tablet',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } },
      testIgnore: '**/responsive/**',
    },
    {
      name: 'mobile',
      use: { browserName: 'chromium', viewport: { width: 375, height: 667 } },
      testIgnore: '**/responsive/**',
    },
    {
      name: 'responsive',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
      testMatch: '**/responsive/**',
    },
  ],
  webServer: {
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
