import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const webServerPort = Number(process.env['E2E_PORT'] ?? '5173');
const webServerCommand = process.env['E2E_WEB_SERVER_COMMAND'] ?? 'npm run dev';
const reuseExistingServer = process.env['E2E_REUSE_EXISTING_SERVER']
  ? process.env['E2E_REUSE_EXISTING_SERVER'] === 'true'
  : true;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 15000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: webServerCommand,
    port: webServerPort,
    reuseExistingServer,
  },
});
