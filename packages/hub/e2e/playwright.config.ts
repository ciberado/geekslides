import { defineConfig } from '@playwright/test';

const hubPort = Number(process.env['HUB_E2E_PORT'] ?? '3099');
const baseURL = process.env['HUB_E2E_BASE_URL'] ?? `http://localhost:${String(hubPort)}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Hub API + UI',
      use: { browserName: 'chromium' },
    },
  ],
});
