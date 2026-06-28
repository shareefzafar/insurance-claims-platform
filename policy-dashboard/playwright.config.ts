import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration
 *
 * Runs tests against the local dev server (or staging URL in CI).
 * Captures video + screenshot on failure for debugging.
 *
 * CI/CD integration:
 *   GitHub Actions: npx playwright install --with-deps
 *                   npx playwright test --reporter=html
 *                   Upload HTML report as artefact
 */
export default defineConfig({
  testDir:   './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],  // fail if test.only committed
  retries:   process.env['CI'] ? 2 : 0,
  workers:   process.env['CI'] ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL:       'http://localhost:3000',
    trace:         'on-first-retry',   // capture trace on first retry
    screenshot:    'only-on-failure',  // screenshot on test failure
    video:         'on-first-retry',   // video on first retry
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Start the dev server before running E2E tests
  webServer: {
    command: 'npm run dev',
    url:     'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
  },
});
