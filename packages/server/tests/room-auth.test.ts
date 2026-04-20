import { once } from 'node:events';
import { describe, it, expect, afterEach } from 'vitest';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import http from 'node:http';
import { createServer, isYjsWriteMessage, type ServerWithRoomStore } from '../src/index.ts';

async function waitFor(predicate: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('Timed out waiting for condition');
}

function httpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() });
        });
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

let server: http.Server | null = null;

afterEach(async () => {
  if (server) {
    const s = server as ServerWithRoomStore;
    s.__rateLimiter.stopCleanup();
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
    server = null;
  }
});

async function startServer(): Promise<{ baseUrl: string; wsUrl: string; roomStore: import('../src/RoomStore.ts').RoomStore }> {
  server = createServer({ port: 0, host: '127.0.0.1' });
  if (!server.listening) {
    await once(server, 'listening');
  }
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve server address');
  }
  const port = address.port;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    wsUrl: `ws://127.0.0.1:${String(port)}`,
    roomStore: (server as ServerWithRoomStore).__roomStore,
  };
}

describe('Room API', () => {
  it('POST /api/rooms/:room/share creates a protected room', async () => {
    const { baseUrl } = await startServer();

    const res = await httpRequest(`${baseUrl}/api/rooms/my-talk/share`, { method: 'POST' });
    expect(res.status).toBe(201);

    const data = JSON.parse(res.body) as { room: string; presenterToken: string };
    expect(data.room).toBe('my-talk');
    expect(data.presenterToken).toHaveLength(64);
  });

  it('POST /api/rooms/:room/auth validates a presenter token', async () => {
    const { baseUrl, roomStore } = await startServer();
    const { presenterToken } = roomStore.createRoom('my-talk');

    const res = await httpRequest(`${baseUrl}/api/rooms/my-talk/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: presenterToken }),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ room: 'my-talk', role: 'presenter' });
  });

  it('POST /api/rooms/:room/auth rejects an invalid token', async () => {
    const { baseUrl, roomStore } = await startServer();
    roomStore.createRoom('my-talk');

    const res = await httpRequest(`${baseUrl}/api/rooms/my-talk/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'wrong' }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /api/rooms/:room/role reports protected status', async () => {
    const { baseUrl, roomStore } = await startServer();

    const resBefore = await httpRequest(`${baseUrl}/api/rooms/my-talk/role`);
    expect(JSON.parse(resBefore.body)).toEqual({ room: 'my-talk', protected: false });

    roomStore.createRoom('my-talk');

    const resAfter = await httpRequest(`${baseUrl}/api/rooms/my-talk/role`);
    expect(JSON.parse(resAfter.body)).toEqual({ room: 'my-talk', protected: true });
  });
});

describe('WebSocket auth', () => {
  it('allows unprotected room connections (backward compat)', async () => {
    const { wsUrl } = await startServer();

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, 'open-room', doc, { WebSocketPolyfill: WebSocket });

    try {
      await waitFor(() => provider.wsconnected);
      expect(provider.wsconnected).toBe(true);
    } finally {
      provider.destroy();
    }
  });

  it('allows presenter with valid token on protected room', async () => {
    const { wsUrl, roomStore } = await startServer();
    const { presenterToken } = roomStore.createRoom('secured');

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      wsUrl,
      'secured',
      doc,
      { WebSocketPolyfill: WebSocket, params: { token: presenterToken } },
    );

    try {
      await waitFor(() => provider.wsconnected);
      expect(provider.wsconnected).toBe(true);
    } finally {
      provider.destroy();
    }
  });

  it('allows readonly viewer on protected room', async () => {
    const { wsUrl, roomStore } = await startServer();
    roomStore.createRoom('secured');

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      wsUrl,
      'secured',
      doc,
      { WebSocketPolyfill: WebSocket, params: { readonly: '' } },
    );

    try {
      await waitFor(() => provider.wsconnected);
      expect(provider.wsconnected).toBe(true);
    } finally {
      provider.destroy();
    }
  });

  it('rejects connection to protected room without token or readonly', async () => {
    const { wsUrl, roomStore } = await startServer();
    roomStore.createRoom('secured');

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, 'secured', doc, {
      WebSocketPolyfill: WebSocket,
      connect: false,
    });

    // Manually try to connect and expect failure
    const ws = new WebSocket(`${wsUrl}/secured`);
    const closePromise = new Promise<number>((resolve) => {
      ws.on('error', () => { /* expected */ });
      ws.on('close', (code) => resolve(code));
      ws.on('unexpected-response', (_, res) => resolve(res.statusCode ?? 0));
    });

    const result = await closePromise;
    // 403 Forbidden
    expect(result).toBe(403);
    provider.destroy();
  });

  it('rejects connection with invalid token on protected room', async () => {
    const { wsUrl, roomStore } = await startServer();
    roomStore.createRoom('secured');

    const ws = new WebSocket(`${wsUrl}/secured?token=wrong`);
    const closePromise = new Promise<number>((resolve) => {
      ws.on('error', () => { /* expected */ });
      ws.on('close', (code) => resolve(code));
      ws.on('unexpected-response', (_, res) => resolve(res.statusCode ?? 0));
    });

    const result = await closePromise;
    expect(result).toBe(403);
  });
});

describe('write filtering', () => {
  it('isYjsWriteMessage identifies sync update messages', () => {
    // messageSync=0, syncUpdate=2
    expect(isYjsWriteMessage(new Uint8Array([0, 2, 0, 0, 0]))).toBe(true);
  });

  it('isYjsWriteMessage allows sync step 1 and step 2', () => {
    // messageSync=0, syncStep1=0
    expect(isYjsWriteMessage(new Uint8Array([0, 0, 0, 0, 0]))).toBe(false);
    // messageSync=0, syncStep2=1
    expect(isYjsWriteMessage(new Uint8Array([0, 1, 0, 0, 0]))).toBe(false);
  });

  it('isYjsWriteMessage allows awareness messages', () => {
    // messageAwareness=1
    expect(isYjsWriteMessage(new Uint8Array([1, 0, 0, 0, 0]))).toBe(false);
  });

  it('isYjsWriteMessage handles short messages', () => {
    expect(isYjsWriteMessage(new Uint8Array([]))).toBe(false);
    expect(isYjsWriteMessage(new Uint8Array([0]))).toBe(false);
  });

  it('presenter can write to a protected room', async () => {
    const { wsUrl, roomStore } = await startServer();
    const { presenterToken } = roomStore.createRoom('guarded');

    const presenterDoc = new Y.Doc();
    const viewerDoc = new Y.Doc();

    const presenterProvider = new WebsocketProvider(
      wsUrl,
      'guarded',
      presenterDoc,
      { WebSocketPolyfill: WebSocket, params: { token: presenterToken }, disableBc: true },
    );
    const viewerProvider = new WebsocketProvider(
      wsUrl,
      'guarded',
      viewerDoc,
      { WebSocketPolyfill: WebSocket, params: { readonly: '' }, disableBc: true },
    );

    try {
      await waitFor(() => presenterProvider.wsconnected && viewerProvider.wsconnected);

      // Presenter writes
      presenterDoc.getMap('sessionState').set('slide', 7);

      // Viewer receives the update
      await waitFor(() => viewerDoc.getMap('sessionState').get('slide') === 7);
      expect(viewerDoc.getMap('sessionState').get('slide')).toBe(7);
    } finally {
      presenterProvider.destroy();
      viewerProvider.destroy();
    }
  });

  it('viewer writes are silently dropped on protected room', async () => {
    const { wsUrl, roomStore } = await startServer();
    const { presenterToken } = roomStore.createRoom('guarded');

    const presenterDoc = new Y.Doc();
    const viewerDoc = new Y.Doc();

    const presenterProvider = new WebsocketProvider(
      wsUrl,
      'guarded',
      presenterDoc,
      { WebSocketPolyfill: WebSocket, params: { token: presenterToken }, disableBc: true },
    );
    const viewerProvider = new WebsocketProvider(
      wsUrl,
      'guarded',
      viewerDoc,
      { WebSocketPolyfill: WebSocket, params: { readonly: '' }, disableBc: true },
    );

    try {
      await waitFor(() => presenterProvider.wsconnected && viewerProvider.wsconnected);

      // Presenter sets initial state
      presenterDoc.getMap('sessionState').set('slide', 3);
      await waitFor(() => viewerDoc.getMap('sessionState').get('slide') === 3);

      // Viewer tries to write — should be silently dropped
      viewerDoc.getMap('sessionState').set('slide', 99);

      // Wait a bit to confirm the write did NOT propagate
      await new Promise((r) => setTimeout(r, 300));

      // Presenter's doc should still show slide 3
      expect(presenterDoc.getMap('sessionState').get('slide')).toBe(3);
    } finally {
      presenterProvider.destroy();
      viewerProvider.destroy();
    }
  });
});

describe('rate limiting', () => {
  it('blocks connections after too many failed auth attempts', async () => {
    const { wsUrl, roomStore } = await startServer();
    roomStore.createRoom('secured');
    const rateLimiter = (server as ServerWithRoomStore).__rateLimiter;
    rateLimiter.clear();

    // Exhaust the rate limit (default: 10 attempts)
    const attempts = 12;
    for (let i = 0; i < attempts; i++) {
      const ws = new WebSocket(`${wsUrl}/secured?token=wrong`);
      await new Promise<void>((resolve) => {
        ws.on('error', () => resolve());
        ws.on('unexpected-response', () => {
          ws.close();
          resolve();
        });
        ws.on('close', () => resolve());
      });
    }

    // Now even a valid readonly connection should be rate-limited
    const ws = new WebSocket(`${wsUrl}/secured?readonly`);
    const result = await new Promise<number>((resolve) => {
      ws.on('error', () => { /* expected */ });
      ws.on('close', (code) => resolve(code));
      ws.on('unexpected-response', (_, res) => resolve(res.statusCode ?? 0));
    });

    expect(result).toBe(429);
  });
});
