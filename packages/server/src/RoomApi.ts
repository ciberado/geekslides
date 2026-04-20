/**
 * GeekSlides v2 — Room management HTTP API.
 *
 * Handles protected-room creation and token validation.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RoomStore } from './RoomStore.ts';

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
  });
  res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

/**
 * Parse routes:
 *   POST /api/rooms/:room/share → create protected room
 *   POST /api/rooms/:room/auth  → validate presenter token
 *   GET  /api/rooms/:room/role  → check if room is protected (for client init)
 */
function parseRoute(url: string): { room: string; action: 'share' | 'auth' | 'role' } | null {
  const match = /^\/api\/rooms\/([^/]+)\/(share|auth|role)$/.exec(url);
  if (!match?.[1] || !match[2]) return null;
  return {
    room: decodeURIComponent(match[1]),
    action: match[2] as 'share' | 'auth' | 'role',
  };
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

export function createRoomApiHandler(roomStore: RoomStore): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async function handleRoomApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
    const route = parseRoute(urlPath);
    if (!route) return false;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    try {
      if (route.action === 'share' && req.method === 'POST') {
        return handleShare(res, route.room, roomStore);
      }

      if (route.action === 'auth' && req.method === 'POST') {
        return await handleAuth(req, res, route.room, roomStore);
      }

      if (route.action === 'role' && req.method === 'GET') {
        return handleRole(res, route.room, roomStore);
      }

      sendError(res, 405, 'Method not allowed');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      sendError(res, 500, message);
      return true;
    }
  };
}

/**
 * POST /api/rooms/:room/share
 * Creates a protected room and returns the presenter token.
 */
function handleShare(res: ServerResponse, room: string, store: RoomStore): boolean {
  const { presenterToken } = store.createRoom(room);
  sendJson(res, 201, { room, presenterToken });
  return true;
}

/**
 * POST /api/rooms/:room/auth
 * Validates a presenter token. Body: { "token": "<hex>" }
 */
async function handleAuth(
  req: IncomingMessage,
  res: ServerResponse,
  room: string,
  store: RoomStore,
): Promise<boolean> {
  const raw = await readBody(req);
  let token: string;

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body['token'] !== 'string') {
      sendError(res, 400, 'Missing token field');
      return true;
    }
    token = body['token'];
  } catch {
    sendError(res, 400, 'Invalid JSON body');
    return true;
  }

  if (!store.isProtected(room)) {
    sendError(res, 404, 'Room is not protected');
    return true;
  }

  const valid = store.validateToken(room, token);
  if (valid) {
    sendJson(res, 200, { room, role: 'presenter' });
  } else {
    sendError(res, 403, 'Invalid token');
  }
  return true;
}

/**
 * GET /api/rooms/:room/role
 * Returns whether a room is protected (for client init flow).
 */
function handleRole(res: ServerResponse, room: string, store: RoomStore): boolean {
  const isProtected = store.isProtected(room);
  sendJson(res, 200, { room, protected: isProtected });
  return true;
}
