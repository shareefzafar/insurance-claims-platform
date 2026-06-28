import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:       './tests/e2e',
  fullyParallel: true,
  forbidOnly:    !!process.env.CI,
  retries:       process.env.CI ? 2 : 0,
  reporter:      [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL:    'http://localhost:3000',
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
    video:      'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome']  } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile',   use: { ...devices['Pixel 5']         } },
  ],

  webServer: {
    command:            'npx serve src -p 3000',
    url:                'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
