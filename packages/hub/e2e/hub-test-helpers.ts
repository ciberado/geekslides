/**
 * E2E test helpers for @geekslides/hub
 *
 * Starts a real Fastify server per test suite with an in-memory-like SQLite
 * (temp file for full functionality) and provides auth helpers to bypass OAuth.
 */
import { createHubServer } from './../src/server/index.ts';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface HubTestContext {
  server: FastifyInstance;
  baseUrl: string;
  tmpDir: string;
  /** Generate a JWT access token for the given user payload */
  signToken(payload: { sub: string; role: string; status: string }): string;
  /** Generate an access cookie header string */
  authCookie(payload: { sub: string; role: string; status: string }): string;
}

let nextPort = Number(process.env['HUB_E2E_PORT'] ?? '3099');

export async function startHubServer(): Promise<HubTestContext> {
  const port = nextPort++;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-e2e-'));
  const dbPath = path.join(tmpDir, 'hub.db');
  const repoDir = path.join(tmpDir, 'repos');

  const server = await createHubServer({
    port,
    host: '127.0.0.1',
    dbPath,
    repoDir,
    serverBaseUrl: 'http://localhost:19999', // unreachable — launch tests won't hit it
    viewerBaseUrl: `http://localhost:${String(port)}`,
    githubClientId: 'test-github-id',
    githubClientSecret: 'test-github-secret',
    googleClientId: 'test-google-id',
    googleClientSecret: 'test-google-secret',
    adminEmail: 'admin@test.com',
    jwtSecret: 'e2e-test-secret-key',
    cookieDomain: 'localhost',
  });

  await server.listen({ port, host: '127.0.0.1' });

  const signToken = (payload: { sub: string; role: string; status: string }): string =>
    server.jwt.sign(payload, { expiresIn: '15m' });

  const authCookie = (payload: { sub: string; role: string; status: string }): string => {
    const token = signToken(payload);
    return `hub_access=${token}`;
  };

  return {
    server,
    baseUrl: `http://127.0.0.1:${String(port)}`,
    tmpDir,
    signToken,
    authCookie,
  };
}

export async function stopHubServer(ctx: HubTestContext): Promise<void> {
  await ctx.server.close();
  fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
}
