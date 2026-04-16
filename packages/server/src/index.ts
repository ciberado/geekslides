/**
 * GeekSlides v2 — y-websocket sync server + content proxy.
 *
 * Wraps y-websocket's setupWSConnection with room-based routing and auth.
 * Also serves the content proxy HTTP API for room-scoped deck uploads.
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/y-websocket.d.ts" />
import { createServer as createHttpServer, type IncomingMessage, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { handleContentApi } from './ContentApi.ts';

export { storeRoomContent, getRoomFile, getRoomContent, deleteRoomContent, MAX_UPLOAD_SIZE } from './ContentStore.ts';
export { handleContentApi } from './ContentApi.ts';

export const SERVER_VERSION = '2.0.0-alpha.0';

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

function checkAuth(req: IncomingMessage): boolean {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const token = url.searchParams.get('token');
  // Auth placeholder — extend in production
  return token !== 'invalid';
}

export function createServer(options: Partial<ServerOptions> = {}): Server {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const httpServer = createHttpServer((req, res) => {
    void (async () => {
      const handled = await handleContentApi(req, res);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    })();
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const room = extractRoom(req);

    if (!room) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing room parameter');
      socket.destroy();
      return;
    }

    if (!checkAuth(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\nInvalid token');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      setupWSConnection(ws, req, { docName: room });
    });
  });

  httpServer.listen(opts.port, opts.host);
  return httpServer;
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
  console.log(`[geekslides] server listening on http://${host}:${String(port)}`);

  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });
}
