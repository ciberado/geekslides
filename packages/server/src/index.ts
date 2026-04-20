/**
 * GeekSlides v2 — y-websocket sync server + content proxy.
 *
 * Wraps y-websocket's setupWSConnection with room-based routing and auth.
 * Also serves the content proxy HTTP API for room-scoped deck uploads.
 * Supports protected rooms with read-only viewer access.
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/y-websocket.d.ts" />
import { createServer as createHttpServer, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { handleContentApi } from './ContentApi.ts';
import { handlePluginProxy } from './PluginProxy.ts';
import { RoomStore } from './RoomStore.ts';
import { RateLimiter } from './RateLimiter.ts';
import { createRoomApiHandler } from './RoomApi.ts';
import { createLogger } from './logging.ts';

const log = createLogger('ws');
const httpLog = createLogger('http');

export { storeRoomContent, getRoomFile, getRoomContent, deleteRoomContent, MAX_UPLOAD_SIZE } from './ContentStore.ts';
export { handleContentApi } from './ContentApi.ts';
export { handlePluginProxy } from './PluginProxy.ts';
export { RoomStore } from './RoomStore.ts';
export { RateLimiter } from './RateLimiter.ts';
export { createRoomApiHandler } from './RoomApi.ts';

export const SERVER_VERSION = '2.0.0-alpha.0';

/**
 * Yjs protocol constants for server-side write filtering.
 *
 * y-websocket message types:
 *   0 = messageSync, 1 = messageAwareness
 *
 * y-protocols/sync sub-types (second byte inside a messageSync frame):
 *   0 = SyncStep1 (state vector request — read-only, safe),
 *   1 = SyncStep2 (state diff response — read-only, safe),
 *   2 = YjsUpdate (document mutation — MUST be blocked for viewers)
 */
const MESSAGE_SYNC = 0;
const SYNC_UPDATE = 2;

export interface ServerOptions {
  readonly port: number;
  readonly host: string;
}

const DEFAULT_OPTIONS: ServerOptions = {
  port: 1234,
  host: '0.0.0.0',
};

function extractRoom(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  return pathSegments[pathSegments.length - 1] || url.searchParams.get('room');
}

function parseConnectionParams(req: IncomingMessage): { token: string | null; readonly: boolean } {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return {
    token: url.searchParams.get('token'),
    readonly: url.searchParams.has('readonly'),
  };
}

function getClientIp(req: IncomingMessage): string {
  // Trust X-Forwarded-For behind a reverse proxy (Caddy), take first entry
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Determine the role for a WebSocket connection to a room.
 * Returns 'presenter' | 'viewer' | 'peer' (unprotected) | null (rejected).
 */
function resolveRole(
  room: string,
  params: { token: string | null; readonly: boolean },
  roomStore: RoomStore,
): 'presenter' | 'viewer' | 'peer' | null {
  if (!roomStore.isProtected(room)) {
    // Unprotected room — backward compat. ?readonly forces viewer even on unprotected rooms.
    return params.readonly ? 'viewer' : 'peer';
  }

  // Protected room
  if (params.readonly) {
    return 'viewer';
  }
  if (params.token && roomStore.validateToken(room, params.token)) {
    return 'presenter';
  }
  // Protected room, no readonly flag, no valid token → reject
  return null;
}

/**
 * Check if a Yjs message from a client is a document-mutating update.
 * Blocks messageSync + YjsUpdate (sub-type 2) from viewers.
 */
export function isYjsWriteMessage(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  // Byte 0: message type (VarUint, 0 = sync for values < 128)
  // Byte 1: sync sub-type (VarUint, 2 = update for values < 128)
  return data[0] === MESSAGE_SYNC && data[1] === SYNC_UPDATE;
}

/**
 * Wrap a WebSocket so that Yjs update messages from the client are silently dropped.
 * The viewer can still receive state from the server (read), but can't mutate the Y.Doc (write).
 *
 * Must be called AFTER setupWSConnection has registered its message listener.
 */
function applyReadOnlyFilter(ws: WebSocket): void {
  // Capture the existing message listeners registered by setupWSConnection
  const originalListeners = ws.listeners('message') as ((...args: unknown[]) => void)[];
  ws.removeAllListeners('message');

  // Re-register with a filter that drops Yjs update messages
  for (const listener of originalListeners) {
    ws.on('message', (message: ArrayBuffer) => {
      const data = new Uint8Array(message);
      if (isYjsWriteMessage(data)) {
        return; // silently drop write attempts
      }
      listener(message);
    });
  }
}

export function createServer(options: Partial<ServerOptions> = {}): Server {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const roomStore = new RoomStore();
  const rateLimiter = new RateLimiter();
  rateLimiter.startCleanup();

  const handleRoomApi = createRoomApiHandler(roomStore);

  const httpServer = createHttpServer((req, res) => {
    void (async () => {
      const handled =
        await handlePluginProxy(req, res) ||
        await handleRoomApi(req, res) ||
        await handleContentApi(req, res);
      if (!handled) {
        httpLog.debug({ url: req.url, method: req.method }, 'unhandled request — 404');
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    })();
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const room = extractRoom(req);

    if (!room) {
      log.debug({ url: req.url }, 'ws upgrade rejected — missing room');
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing room parameter');
      socket.destroy();
      return;
    }

    const clientIp = getClientIp(req);

    // Rate-limit check (before any auth work)
    if (rateLimiter.isLimited(clientIp)) {
      log.warn({ clientIp, room }, 'ws upgrade rejected — rate limited');
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\nRate limited');
      socket.destroy();
      return;
    }

    const params = parseConnectionParams(req);
    const role = resolveRole(room, params, roomStore);

    if (role === null) {
      // Protected room, bad/missing token, not readonly → reject
      rateLimiter.recordFailure(clientIp);
      log.warn({ clientIp, room }, 'ws upgrade rejected — invalid token');
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\nInvalid or missing presenter token');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      log.info({ room, role, clientIp }, 'ws connection accepted');
      setupWSConnection(ws, req, { docName: room });
      if (role === 'viewer') {
        applyReadOnlyFilter(ws);
      }
    });
  });

  httpServer.listen(opts.port, opts.host);

  // Expose roomStore for the `share` command and testing
  (httpServer as ServerWithRoomStore).__roomStore = roomStore;
  (httpServer as ServerWithRoomStore).__rateLimiter = rateLimiter;

  return httpServer;
}

/** Extended Server type exposing internal stores for testing. */
export interface ServerWithRoomStore extends Server {
  __roomStore: RoomStore;
  __rateLimiter: RateLimiter;
}

// Start server when run directly
if (
  process.argv[1]?.endsWith('/packages/server/src/index.ts') ||
  process.argv[1]?.endsWith('/packages/server/dist/index.js') ||
  process.argv[1]?.endsWith('/packages/server/dist/index.cjs') ||
  process.argv[1]?.endsWith('/index.cjs')
) {
  const port = Number(process.env['PORT']) || DEFAULT_OPTIONS.port;
  const host = process.env['HOST'] ?? DEFAULT_OPTIONS.host;
  const server = createServer({ port, host });
  log.info({ host, port }, 'server listening');

  process.on('SIGINT', () => {
    const s = server as ServerWithRoomStore;
    s.__rateLimiter.stopCleanup();
    s.close();
    process.exit(0);
  });
}
