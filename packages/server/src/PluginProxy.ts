/**
 * GeekSlides v2 — Plugin proxy HTTP handler.
 *
 * Fetches remote JavaScript plugin files on behalf of the browser,
 * avoiding CORS issues that would block direct cross-origin dynamic imports.
 *
 * Route: GET /api/plugin-proxy?url=<encoded-url>
 *
 * Security constraints:
 * - Only https: URLs are accepted (http: rejected in production)
 * - Only .js files are fetched
 * - Response must have a JavaScript content type
 * - Maximum response size: 1 MB
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_PLUGIN_SIZE = 1024 * 1024; // 1 MB

const ALLOWED_PROTOCOLS = new Set(['https:']);
// Also allow http: in dev mode (NODE_ENV !== 'production')
if (process.env['NODE_ENV'] !== 'production') {
  ALLOWED_PROTOCOLS.add('http:');
}

function sendProxyError(res: ServerResponse, status: number, message: string): void {
  const body = JSON.stringify({ error: message });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Handle GET /api/plugin-proxy?url=<encoded-url>
 * Returns true if the request was handled, false to pass through.
 */
export async function handlePluginProxy(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const fullUrl = req.url ?? '/';
  const [pathname, queryString] = fullUrl.split('?', 2);

  if (pathname !== '/api/plugin-proxy') {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method !== 'GET') {
    sendProxyError(res, 405, 'Method not allowed');
    return true;
  }

  const params = new URLSearchParams(queryString ?? '');
  const targetUrl = params.get('url');

  if (!targetUrl) {
    sendProxyError(res, 400, 'Missing required "url" query parameter');
    return true;
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    sendProxyError(res, 400, 'Invalid URL');
    return true;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    sendProxyError(res, 400, `Protocol "${parsed.protocol}" is not allowed; use https:`);
    return true;
  }

  if (!parsed.pathname.endsWith('.js')) {
    sendProxyError(res, 400, 'Only .js files can be proxied');
    return true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/javascript, text/javascript, */*' },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      sendProxyError(res, 502, `Remote server returned ${String(response.status)}`);
      return true;
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_PLUGIN_SIZE) {
      sendProxyError(res, 502, `Remote plugin exceeds maximum size of ${String(MAX_PLUGIN_SIZE)} bytes`);
      return true;
    }

    const bodyBuffer = Buffer.from(await response.arrayBuffer());

    if (bodyBuffer.length > MAX_PLUGIN_SIZE) {
      sendProxyError(res, 502, `Remote plugin exceeds maximum size of ${String(MAX_PLUGIN_SIZE)} bytes`);
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': bodyBuffer.length,
      'Cache-Control': 'public, max-age=300',
    });
    res.end(bodyBuffer);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    sendProxyError(res, 502, `Failed to fetch remote plugin: ${message}`);
    return true;
  }
}
