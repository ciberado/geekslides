/**
 * Playwright global setup — builds the Lit SPA client so Fastify can serve it
 * as static files during the E2E tests.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalSetup(): void {
  const hubDir = resolve(import.meta.dirname, '..');
  console.log('[global-setup] Building hub client…');
  execSync('npm run build:client', { cwd: hubDir, stdio: 'inherit' });
  console.log('[global-setup] Client build complete.');
}
