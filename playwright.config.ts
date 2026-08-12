import { defineConfig, devices } from '@playwright/test';

// retries stay 0 by policy: a flaky test is a bug, not a dice roll (TESTING.md §4.5)
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    // non-offline suites block service workers for determinism (TESTING.md §7)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'], serviceWorkers: 'block' },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      // owner's device is a Galaxy S24+; Pixel 7 is Playwright's closest
      // built-in Android descriptor (chromium engine, mobile UA/viewport/touch)
      name: 'android',
      use: { ...devices['Pixel 7'], serviceWorkers: 'block' },
      testIgnore: /offline\.spec\.ts/,
    },
    // the offline suite is the one place service workers run — Chromium only,
    // per Playwright's SW support matrix (TESTING.md §7)
    {
      name: 'offline-chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /offline\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
