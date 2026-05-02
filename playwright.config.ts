import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/personas',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'https://www.amafahelectronics.com',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
