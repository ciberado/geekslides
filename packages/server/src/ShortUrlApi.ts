/**
 * GeekSlides v2 — Short URL API.
 *
 * Provides URL shortening for share links (especially QR codes where shorter
 * URLs produce less dense, more scannable codes).
 *
 * Routes:
 *   POST /api/short        — Create a short URL mapping { url } → { id, short }
 *   GET  /s/:id            — Redirect (302) to the original URL
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createLogger } from './logging.ts';

const log = createLogger('short-url');

/** In-memory short URL store. Maps id → original URL. */
const store = new Map<string, string>();

/** Maximum number of stored short URLs (to prevent memory exhaustion). */
const MAX_ENTRIES = 10000;

/**
 * Generate a short random ID (6 chars, base36).
 */
function generateId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
  });
  res.end(body);
}

function readBody(req: IncomingMessage, maxBytes = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { resolve(Buffer.concat(chunks).toString('utf-8')); });
    req.on('error', (err) => { reject(err); });
  });
}

/**
 * Handle short URL creation: POST /api/short
 */
async function handleCreate(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return true;
  }

  const raw = await readBody(req);
  let url: string;
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body['url'] !== 'string' || body['url'].length === 0) {
      sendJson(res, 400, { error: 'Missing "url" field' });
      return true;
    }
    url = body['url'];
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return true;
  }

  // Check if URL already shortened
  for (const [existingId, existingUrl] of store) {
    if (existingUrl === url) {
      const host = req.headers['host'] ?? 'localhost';
      const protocol = req.headers['x-forwarded-proto'] ?? 'http';
      const short = `${String(protocol)}://${host}/s/${existingId}`;
      sendJson(res, 200, { id: existingId, short });
      return true;
    }
  }

  // Evict oldest entries if at capacity
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value as string;
    store.delete(firstKey);
  }

  const id = generateId();
  store.set(id, url);
  log.info({ id, url: url.slice(0, 100) }, 'short URL created');

  const host = req.headers['host'] ?? 'localhost';
  const protocol = req.headers['x-forwarded-proto'] ?? 'http';
  const short = `${String(protocol)}://${host}/s/${id}`;
  sendJson(res, 201, { id, short });
  return true;
}

/**
 * Handle short URL redirect: GET /s/:id
 */
function handleRedirect(res: ServerResponse, id: string): boolean {
  const url = store.get(id);
  if (!url) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Short URL not found');
    return true;
  }

  log.debug({ id }, 'short URL redirect');
  res.writeHead(302, { Location: url });
  res.end();
  return true;
}

/**
 * Main handler for short URL routes.
 * Returns true if the request was handled, false otherwise.
 */
export async function handleShortUrl(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlPath = (req.url ?? '/').split('?')[0] ?? '/';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS' && (urlPath === '/api/short' || urlPath.startsWith('/s/'))) {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (urlPath === '/api/short') {
    return await handleCreate(req, res);
  }

  const redirectMatch = /^\/s\/([a-z0-9]+)$/.exec(urlPath);
  if (redirectMatch?.[1]) {
    return handleRedirect(res, redirectMatch[1]);
  }

  return false;
}

/**
 * Get the current store size (for testing/diagnostics).
 */
export function getStoreSize(): number {
  return store.size;
}

/**
 * Clear all short URLs (for testing).
 */
export function clearStore(): void {
  store.clear();
}
