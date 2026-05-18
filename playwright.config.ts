import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: process.env.CI
    ? [{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'webkit-tablet', use: { ...devices['iPad Pro 11'] } },
      ],
});
