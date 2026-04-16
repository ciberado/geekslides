import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const webServerPort = Number(process.env['E2E_PORT'] ?? '5173');
const webServerCommand = process.env['E2E_WEB_SERVER_COMMAND'] ?? 'npm run dev';
const reuseExistingServer = process.env['E2E_REUSE_EXISTING_SERVER']
  ? process.env['E2E_REUSE_EXISTING_SERVER'] === 'true'
  : true;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL,
    trace: 'off',
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
