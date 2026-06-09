import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Keep reliable for local E2E database manipulation
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  // Boot the app in `test` mode so it reads .env.test and points at the LOCAL
  // Supabase stack (`supabase start`), never prod. reuseExistingServer is false
  // on purpose: always start our own test-mode server rather than risk reusing a
  // stray prod-pointed `npm run dev` on 8080 (which would sign up users on prod).
  webServer: {
    command: 'npm run dev:test',
    url: 'http://localhost:8080',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
