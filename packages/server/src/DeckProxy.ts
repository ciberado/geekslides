/**
 * GeekSlides v2 — Deck proxy HTTP handler.
 *
 * Fetches arbitrary deck files (config.json, markdown, images, CSS) from a
 * remote URL on behalf of the browser. This lets the client load decks served
 * over plain HTTP even when the GeekSlides SPA is served over HTTPS (mixed
 * content would otherwise be blocked by the browser).
 *
 * Route: GET /api/deck-proxy?url=<encoded-url>
 *
 * Security constraints:
 * - Both http: and https: are allowed (the point is to bridge the gap)
 * - Only private / RFC-1918 ranges are blocked when accessed by hostname
 *   (loopback is blocked unless DEV_PROXY=true)
 * - Maximum response size: 50 MB (large image decks)
 * - Only GET; no credentials forwarded to the upstream
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createLogger } from './logging.ts';
import { sendErrorResponse } from './types/ErrorResponse.ts';

const log = createLogger('deck-proxy');

const MAX_PROXY_SIZE = 50 * 1024 * 1024; // 50 MB

// Hostnames/CIDRs that must never be forwarded to (SSRF protection).
// We resolve the URL hostname and reject obvious loopback / metadata addresses.
const BLOCKED_HOSTNAMES = new Set([
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS / GCP metadata service
]);
// Block localhost/loopback by hostname string unless DEV_PROXY is set
function isBlockedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && process.env['DEV_PROXY'] !== 'true') return true;
  return false;
}

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums as [number, number, number, number];
  // 127.x.x.x — loopback (allowed in DEV_PROXY mode)
  if (a === 127) return process.env['DEV_PROXY'] !== 'true';
  // 10.x.x.x — private class A (allowed — typical LAN)
  if (a === 10) return false;
  // 172.16–31.x.x — private class B (allowed — typical LAN)
  if (a === 172 && b >= 16 && b <= 31) return false;
  // 192.168.x.x — private class C (allowed — typical LAN)
  if (a === 192 && b === 168) return false;
  // 169.254.x.x — link-local / cloud metadata
  if (a === 169 && b === 254) return true;
  return false;
}

function sendProxyError(res: ServerResponse, status: number, code: string, message: string, hint?: string, details?: Record<string, unknown>): void {
  sendErrorResponse(res, status, {
    code,
    message,
    ...(hint !== undefined ? { hint } : {}),
    ...(details !== undefined ? { details } : {}),
  });
}

/**
 * Handle GET /api/deck-proxy?url=<encoded-url>
 * Returns true if the request was handled, false to pass through.
 */
export async function handleDeckProxy(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const fullUrl = req.url ?? '/';
  const [pathname, queryString] = fullUrl.split('?', 2);

  if (pathname !== '/api/deck-proxy') {
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
    sendProxyError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported by the deck proxy');
    return true;
  }

  const params = new URLSearchParams(queryString ?? '');
  const targetUrl = params.get('url');

  if (!targetUrl) {
    sendProxyError(
      res, 400,
      'MISSING_URL',
      'Missing required "url" query parameter',
      'Append ?url=<encoded-url> to the request, e.g. /api/deck-proxy?url=https%3A%2F%2Fexample.com%2Fconfig.json',
    );
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    sendProxyError(
      res, 400,
      'INVALID_URL',
      `URL could not be parsed: ${reason}`,
      'The url parameter must be a fully-qualified URL starting with http:// or https://',
      { url: targetUrl },
    );
    return true;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    sendProxyError(
      res, 400,
      'BLOCKED_PROTOCOL',
      `Protocol "${parsed.protocol}" is not allowed`,
      'Only http: and https: URLs may be proxied',
      { url: targetUrl, protocol: parsed.protocol },
    );
    return true;
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname) || isBlockedIpv4(hostname)) {
    log.warn({ url: targetUrl, hostname }, 'deck proxy blocked — hostname not allowed');
    sendProxyError(
      res, 400,
      'BLOCKED_HOST',
      `Host "${hostname}" is not allowed by the proxy security policy`,
      hostname === 'localhost' || hostname === '127.0.0.1'
        ? 'To load from localhost during development, set DEV_PROXY=true and restart the server'
        : 'Private/link-local IP ranges and cloud metadata endpoints are blocked to prevent SSRF attacks',
      { url: targetUrl, hostname },
    );
    return true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 15_000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      // Do NOT forward cookies or auth headers to the upstream
      headers: { 'Accept': '*/*', 'User-Agent': 'GeekSlides/2 deck-proxy' },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      log.warn({ url: targetUrl, status: response.status }, 'upstream server returned error status');
      sendProxyError(
        res, 502,
        'UPSTREAM_ERROR',
        `Upstream server returned ${String(response.status)} for the requested URL`,
        'Check that the URL is correct and the remote server is accessible',
        { url: targetUrl, upstreamStatus: response.status },
      );
      return true;
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_PROXY_SIZE) {
      log.warn({ url: targetUrl, contentLength }, 'upstream response too large (content-length header)');
      sendProxyError(
        res, 502,
        'OVERSIZED_RESPONSE',
        `Remote resource is too large (Content-Length: ${String(contentLength)} bytes, limit: ${String(MAX_PROXY_SIZE)} bytes)`,
        'Split the resource into smaller files or host it on a CDN with range-request support',
        { url: targetUrl, contentLength, limit: MAX_PROXY_SIZE },
      );
      return true;
    }

    const bodyBuffer = Buffer.from(await response.arrayBuffer());

    if (bodyBuffer.length > MAX_PROXY_SIZE) {
      log.warn({ url: targetUrl, bodyLength: bodyBuffer.length }, 'upstream response too large (body)');
      sendProxyError(
        res, 502,
        'OVERSIZED_RESPONSE',
        `Remote resource body exceeds the ${String(MAX_PROXY_SIZE)}-byte limit`,
        'Split the resource into smaller files or host it on a CDN with range-request support',
        { url: targetUrl, bodyLength: bodyBuffer.length, limit: MAX_PROXY_SIZE },
      );
      return true;
    }

    const upstreamContentType = response.headers.get('content-type') ?? 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': upstreamContentType,
      'Content-Length': bodyBuffer.length,
      'Cache-Control': 'no-store',
    });
    res.end(bodyBuffer);
    log.info({ url: targetUrl, size: bodyBuffer.length }, 'deck file proxied');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    log.error({ url: targetUrl, err: message }, 'deck proxy fetch failed');
    sendProxyError(
      res, 502,
      isAbort ? 'FETCH_TIMEOUT' : 'FETCH_FAILED',
      isAbort
        ? `Request to upstream timed out after 15 seconds: ${targetUrl}`
        : `Proxy fetch failed: ${message}`,
      isAbort
        ? 'The remote server did not respond in time. Check the server is up and reachable from the GeekSlides host.'
        : 'Verify the URL is correct and the remote host is reachable from the GeekSlides server.',
      { url: targetUrl, cause: message },
    );
    return true;
  }
}
