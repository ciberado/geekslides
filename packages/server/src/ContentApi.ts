/**
 * GeekSlides v2 — Content proxy HTTP API.
 *
 * Handles upload and serving of room-scoped deck assets.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { storeRoomContent, getRoomFile, MAX_UPLOAD_SIZE } from './ContentStore.ts';
import { parseMultipart } from './multipart.ts';

const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

/** Route pattern: /api/rooms/:room/content[/:path] */
function parseRoute(url: string): { room: string; filePath: string | null } | null {
  const match = /^\/api\/rooms\/([^/]+)\/content(?:\/(.+))?$/.exec(url);
  if (!match?.[1]) {
    return null;
  }

  const room = decodeURIComponent(match[1]);
  const filePath = match[2] ? decodeURIComponent(match[2]) : null;
  return { room, filePath };
}

/**
 * Handle an HTTP request for the content proxy API.
 * Returns true if the request was handled, false if it should be passed through.
 */
export async function handleContentApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
  const route = parseRoute(urlPath);

  if (!route) {
    return false;
  }

  // CORS headers for browser uploads
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  try {
    if (req.method === 'POST' && route.filePath === null) {
      return await handleUpload(req, res, route.room);
    }

    if (req.method === 'GET' && route.filePath !== null) {
      return await handleFetch(res, route.room, route.filePath);
    }

    sendError(res, 405, 'Method not allowed');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    sendError(res, 500, message);
    return true;
  }
}

async function handleUpload(req: IncomingMessage, res: ServerResponse, room: string): Promise<boolean> {
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > MAX_UPLOAD_SIZE + 1024 * 1024) {
    sendError(res, 413, `Upload exceeds maximum size of ${String(MAX_UPLOAD_SIZE)} bytes`);
    return true;
  }

  const { files } = await parseMultipart(req, MAX_UPLOAD_SIZE + 1024 * 1024);

  if (files.length === 0) {
    sendError(res, 400, 'No files uploaded');
    return true;
  }

  const content = await storeRoomContent(room, files);

  sendJson(res, 201, {
    room: content.room,
    files: content.files,
    totalSize: content.totalSize,
  });

  return true;
}

async function handleFetch(res: ServerResponse, room: string, filePath: string): Promise<boolean> {
  const data = await getRoomFile(room, filePath);

  if (!data) {
    sendError(res, 404, 'Not found');
    return true;
  }

  const mime = getMimeType(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': data.length,
    'Cache-Control': 'no-cache',
  });
  res.end(data);
  return true;
}
