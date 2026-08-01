import { defineConfig, devices } from '@playwright/test';

// retries stay 0 by policy: a flaky test is a bug, not a dice roll (TESTING.md §4.5)
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    // non-offline suites block service workers for determinism (TESTING.md §7)
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
