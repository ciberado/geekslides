/**
 * GeekSlides v2 — y-websocket sync server.
 *
 * Wraps y-websocket's setupWSConnection with room-based routing and auth.
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/y-websocket.d.ts" />
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

export const SERVER_VERSION = '2.0.0-alpha.0';

export interface ServerOptions {
  readonly port: number;
  readonly host: string;
}

const DEFAULT_OPTIONS: ServerOptions = {
  port: 1234,
  host: '0.0.0.0',
};

export function createServer(options: Partial<ServerOptions> = {}): WebSocketServer {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const wss = new WebSocketServer({ port: opts.port, host: opts.host });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const room = pathSegments[pathSegments.length - 1] || url.searchParams.get('room');

    if (!room) {
      ws.close(4001, 'Missing room parameter');
      return;
    }

    const token = url.searchParams.get('token');
    // Auth placeholder — extend in production
    if (token === 'invalid') {
      ws.close(4003, 'Invalid token');
      return;
    }

    setupWSConnection(ws, req, { docName: room });
  });

  return wss;
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
  const wss = createServer({ port, host });
  console.log(`[geekslides] y-websocket server listening on ws://${host}:${String(port)}`);

  process.on('SIGINT', () => {
    wss.close();
    process.exit(0);
  });
}
