#!/usr/bin/env node
/**
 * Bundle smoke test for @geekslides/hub
 *
 * Spawns the compiled server bundle (dist/server/index.cjs), starts it with a
 * temporary SQLite database and dev-mode authentication, then verifies that the
 * PPTX import endpoint works end-to-end.  This catches runtime failures that
 * only manifest in the bundle (e.g. esbuild incorrectly resolving __dirname for
 * dependencies that load assets from disk, like jsdom).
 *
 * Exit codes: 0 = pass, 1 = fail.
 *
 * Usage:
 *   node scripts/bundle-smoke.mjs
 *   npm run build:smoke --workspace=@geekslides/hub
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, EOL } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE   = join(__dirname, '../dist/server/index.cjs');
const FIXTURE  = join(__dirname, '../e2e/fixtures/sample.pptx');
const PORT     = 13099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const POLL_MS  = 300;
const TIMEOUT_S = 30;

// ─── helpers ─────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`✗ SMOKE FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

async function pollHealth(deadlineMs) {
  while (Date.now() < deadlineMs) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {
      // server not yet ready
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  fail(`Server did not become ready within ${TIMEOUT_S}s`);
}

// ─── main ────────────────────────────────────────────────────────────────────

const tmpDir = mkdtempSync(join(tmpdir(), 'hub-smoke-'));
const dbPath  = join(tmpDir, 'hub.db');
const repoDir = join(tmpDir, 'repos');

console.log(`Starting bundle smoke test (port ${PORT}) …`);

const server = spawn('node', [BUNDLE], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    DB_PATH: dbPath,
    REPO_DIR: repoDir,
    HUB_DEV_MODE: 'true',
    JWT_SECRET: 'smoke-test-secret',
    NODE_ENV: 'production',
    // suppress verbose Fastify logging in smoke test output
    LOG_LEVEL: 'error',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

// Surface only error output so failures are easy to spot
server.stderr.on('data', d => process.stderr.write(d));

let exited = false;
server.on('exit', (code) => {
  exited = true;
  if (code !== null && code !== 0) fail(`Server process exited with code ${code}`);
});

const deadline = Date.now() + TIMEOUT_S * 1000;

try {
  // 1. Wait for server to be ready
  await pollHealth(deadline);
  pass('Server started and /healthz responded');

  // 2. Log in as a dev user to obtain a session cookie
  const loginRes = await fetch(`${BASE_URL}/hub/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@localhost' }),
  });
  if (!loginRes.ok) fail(`Dev login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie') ?? '';
  if (!cookie) fail('No cookie returned from dev login');
  pass('Dev login succeeded');

  // 3. Upload a PPTX file — this exercises jsdom (chart/bullet post-processing)
  const pptxBytes = readFileSync(FIXTURE);
  const form = new FormData();
  form.append('title', 'Smoke Test Deck');
  form.append('deck.pptx', new Blob([pptxBytes], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }), 'deck.pptx');

  const uploadRes = await fetch(`${BASE_URL}/hub/api/presentations`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });

  if (uploadRes.status !== 201) {
    const body = await uploadRes.text();
    fail(`PPTX upload returned ${uploadRes.status}: ${body}`);
  }
  const body = await uploadRes.json();
  if (!body.id) fail('PPTX upload response has no id');
  pass(`PPTX import succeeded (id=${body.id})`);

  console.log(EOL + '✓ Bundle smoke test PASSED');
} finally {
  // Clean up
  if (!exited) server.kill('SIGTERM');
  rmSync(tmpDir, { recursive: true, force: true });
}
