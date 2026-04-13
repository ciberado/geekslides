import { once } from 'node:events';
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { SERVER_VERSION, createServer } from '../src/index.ts';

async function waitFor(predicate: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error('Timed out waiting for condition');
}

describe('server', () => {
  it('exports version', () => {
    expect(SERVER_VERSION).toBe('2.0.0-alpha.0');
  });

  it('createServer is a function', () => {
    expect(typeof createServer).toBe('function');
  });

  it('syncs documents for clients connected with path-based room names', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();

    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const serverUrl = `ws://127.0.0.1:${String(address.port)}`;
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const provider1 = new WebsocketProvider(serverUrl, 'path-room', doc1, { WebSocketPolyfill: WebSocket });
    const provider2 = new WebsocketProvider(serverUrl, 'path-room', doc2, { WebSocketPolyfill: WebSocket });

    try {
      await waitFor(() => provider1.wsconnected && provider2.wsconnected);

      doc1.getMap('sessionState').set('slide', 4);

      await waitFor(() => doc2.getMap('sessionState').get('slide') === 4);
      expect(doc2.getMap('sessionState').get('slide')).toBe(4);
    } finally {
      provider1.destroy();
      provider2.destroy();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});
