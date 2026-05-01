/**
 * Tests for structured error responses in the deck proxy (phase 18).
 *
 * Validates that:
 * - Every error path returns a structured JSON body with `code`, `message`, `timestamp`.
 * - Hints and details are present where appropriate.
 * - Root-cause information is not masked (e.g. URL parse failure includes the reason).
 */

import { once } from 'node:events';
import http from 'node:http';
import { describe, it, expect } from 'vitest';
import { createServer } from '../src/index.ts';

interface ErrorBody {
  code: string;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

function httpRequest(url: string, options: { method?: string } = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: options.method ?? 'GET' },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer({ port: 0, host: '127.0.0.1' });
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') { server.close(); throw new Error('no address'); }
  return {
    baseUrl: `http://127.0.0.1:${String((address as { port: number }).port)}`,
    close: () => new Promise<void>((r) => { server.close(() => r()); }),
  };
}

describe('deck proxy — structured error responses', () => {
  it('MISSING_URL: returns structured error with code and hint', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(`${baseUrl}/api/deck-proxy`);
      expect(status).toBe(400);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('MISSING_URL');
      expect(err.message).toContain('url');
      expect(err.hint).toBeTruthy();
      expect(typeof err.timestamp).toBe('number');
    } finally { await close(); }
  });

  it('INVALID_URL: preserves the parse-error root cause in the message', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(`${baseUrl}/api/deck-proxy?url=${encodeURIComponent('not-a-url')}`);
      expect(status).toBe(400);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('INVALID_URL');
      // Root cause from the URL parser must be surfaced (not just "Invalid URL")
      expect(err.message.length).toBeGreaterThan('INVALID_URL'.length + 5);
      expect(err.details?.['url']).toBe('not-a-url');
      expect(err.hint).toBeTruthy();
    } finally { await close(); }
  });

  it('BLOCKED_PROTOCOL: includes the blocked protocol in details', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent('ftp://example.com/file.txt')}`,
      );
      expect(status).toBe(400);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('BLOCKED_PROTOCOL');
      expect(err.details?.['protocol']).toBe('ftp:');
      expect(err.hint).toContain('https');
    } finally { await close(); }
  });

  it('BLOCKED_HOST: includes the blocked hostname in details and hints about DEV_PROXY for localhost', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent('http://localhost/config.json')}`,
      );
      expect(status).toBe(400);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('BLOCKED_HOST');
      expect(err.details?.['hostname']).toBe('localhost');
      expect(err.hint).toContain('DEV_PROXY');
    } finally { await close(); }
  });

  it('BLOCKED_HOST: blocks metadata IP and does not mention DEV_PROXY', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent('http://169.254.169.254/meta')}`,
      );
      expect(status).toBe(400);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('BLOCKED_HOST');
      expect(err.hint).not.toContain('DEV_PROXY');
    } finally { await close(); }
  });

  it('UPSTREAM_ERROR: includes upstream status and URL in details', async () => {
    process.env['DEV_PROXY'] = 'true';
    const upstream = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
    upstream.listen(0, '127.0.0.1');
    if (!upstream.listening) await once(upstream, 'listening');
    const addr = upstream.address() as { port: number };
    const upstreamUrl = `http://127.0.0.1:${String(addr.port)}`;

    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent(`${upstreamUrl}/missing.json`)}`,
      );
      expect(status).toBe(502);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('UPSTREAM_ERROR');
      expect(err.details?.['upstreamStatus']).toBe(404);
      expect(typeof err.details?.['url']).toBe('string');
      expect(err.hint).toBeTruthy();
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
      await new Promise<void>((r) => { upstream.close(() => r()); });
    }
  });

  it('FETCH_FAILED: includes cause in details when upstream is unreachable', async () => {
    process.env['DEV_PROXY'] = 'true';
    const { baseUrl, close } = await startServer();
    try {
      const { status, body } = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent('http://127.0.0.1:19997/config.json')}`,
      );
      expect(status).toBe(502);
      const err = JSON.parse(body) as ErrorBody;
      expect(err.code).toBe('FETCH_FAILED');
      expect(typeof err.details?.['cause']).toBe('string');
      // Root cause must not be hidden — it should contain meaningful network error text
      expect((err.details?.['cause'] as string).length).toBeGreaterThan(0);
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
    }
  });

  it('all error responses include a numeric timestamp', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const { body } = await httpRequest(`${baseUrl}/api/deck-proxy`);
      const err = JSON.parse(body) as ErrorBody;
      expect(typeof err.timestamp).toBe('number');
      expect(err.timestamp).toBeGreaterThan(0);
    } finally { await close(); }
  });
});
