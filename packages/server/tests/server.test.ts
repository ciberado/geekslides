import { once } from 'node:events';
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { SERVER_VERSION, createServer, storeRoomContent, getRoomFile, deleteRoomContent } from '../src/index.ts';
import http from 'node:http';

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

describe('content proxy', () => {
  it('stores and retrieves room content via ContentStore', async () => {
    const files = [
      { path: 'config.json', data: Buffer.from('{"title":"Test"}') },
      { path: 'README.md', data: Buffer.from('# Hello') },
    ];

    const content = await storeRoomContent('test-room', files);
    expect(content.room).toBe('test-room');
    expect(content.files).toContain('config.json');
    expect(content.files).toContain('README.md');
    expect(content.totalSize).toBe(files[0].data.length + files[1].data.length);

    const config = await getRoomFile('test-room', 'config.json');
    expect(config?.toString()).toBe('{"title":"Test"}');

    const readme = await getRoomFile('test-room', 'README.md');
    expect(readme?.toString()).toBe('# Hello');

    // Path traversal should return null
    const traversal = await getRoomFile('test-room', '../../../etc/passwd');
    expect(traversal).toBeNull();

    await deleteRoomContent('test-room');
    const afterDelete = await getRoomFile('test-room', 'config.json');
    expect(afterDelete).toBeNull();
  });

  it('stores files in subdirectories', async () => {
    const files = [
      { path: 'images/logo.png', data: Buffer.from('fake-png') },
    ];

    const content = await storeRoomContent('subdir-room', files);
    expect(content.files).toContain('images/logo.png');

    const data = await getRoomFile('subdir-room', 'images/logo.png');
    expect(data?.toString()).toBe('fake-png');

    await deleteRoomContent('subdir-room');
  });

  it('uploads and serves content via HTTP API', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();

    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      // Build multipart body
      const boundary = '----TestBoundary123';
      const configData = Buffer.from('{"title":"Remote Test","content":"README.md","styles":["local.css"]}');
      const mdData = Buffer.from('# Slide 1\n---\n# Slide 2');
      const cssData = Buffer.from('.slide { color: red; }');

      const parts = [
        buildMultipartPart(boundary, 'files', 'config.json', configData),
        buildMultipartPart(boundary, 'files', 'README.md', mdData),
        buildMultipartPart(boundary, 'files', 'local.css', cssData),
      ];
      const body = Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)]);

      // Upload
      const uploadRes = await httpRequest(`${baseUrl}/api/rooms/http-test/content`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      });

      expect(uploadRes.status).toBe(201);
      const uploadBody = JSON.parse(uploadRes.body);
      expect(uploadBody.room).toBe('http-test');
      expect(uploadBody.files).toContain('config.json');

      // Fetch config
      const configRes = await httpRequest(`${baseUrl}/api/rooms/http-test/content/config.json`);
      expect(configRes.status).toBe(200);
      expect(configRes.body).toContain('"Remote Test"');

      // Fetch markdown
      const mdRes = await httpRequest(`${baseUrl}/api/rooms/http-test/content/README.md`);
      expect(mdRes.status).toBe(200);
      expect(mdRes.body).toContain('# Slide 1');

      // 404 for missing file
      const missingRes = await httpRequest(`${baseUrl}/api/rooms/http-test/content/nope.txt`);
      expect(missingRes.status).toBe(404);

      // 404 for missing room
      const missingRoomRes = await httpRequest(`${baseUrl}/api/rooms/no-room/content/config.json`);
      expect(missingRoomRes.status).toBe(404);

      await deleteRoomContent('http-test');
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});

function buildMultipartPart(boundary: string, fieldName: string, filename: string, data: Buffer): Buffer {
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  return Buffer.concat([Buffer.from(header), data, Buffer.from('\r\n')]);
}

function httpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: Buffer } = {},
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
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      },
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

describe('plugin proxy', () => {
  it('rejects requests without url parameter', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      const res = await httpRequest(`${baseUrl}/api/plugin-proxy`);
      expect(res.status).toBe(400);
      expect(res.body).toContain('Missing required');
    } finally {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
    }
  });

  it('rejects non-.js URLs', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      const res = await httpRequest(
        `${baseUrl}/api/plugin-proxy?url=${encodeURIComponent('http://example.com/style.css')}`,
      );
      expect(res.status).toBe(400);
      expect(res.body).toContain('Only .js files');
    } finally {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
    }
  });

  it('rejects invalid URLs', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      const res = await httpRequest(
        `${baseUrl}/api/plugin-proxy?url=${encodeURIComponent('not-a-url')}`,
      );
      expect(res.status).toBe(400);
      expect(res.body).toContain('Invalid URL');
    } finally {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
    }
  });

  it('proxies a valid .js URL and returns JavaScript', async () => {
    // Start a tiny HTTP server to serve a fake plugin
    const pluginSource = 'export default function(md) { return md.toUpperCase(); }';
    const pluginServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(pluginSource);
    });
    pluginServer.listen(0, '127.0.0.1');
    if (!pluginServer.listening) {
      await once(pluginServer, 'listening');
    }
    const pluginAddress = pluginServer.address();
    if (!pluginAddress || typeof pluginAddress === 'string') {
      pluginServer.close();
      throw new Error('Unable to resolve plugin server address');
    }
    const pluginUrl = `http://127.0.0.1:${String(pluginAddress.port)}/emoji.js`;

    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      pluginServer.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      const res = await httpRequest(
        `${baseUrl}/api/plugin-proxy?url=${encodeURIComponent(pluginUrl)}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe(pluginSource);
    } finally {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
      await new Promise<void>((resolve) => { pluginServer.close(() => resolve()); });
    }
  });

  it('returns 502 when remote server is unreachable', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      // Use a port that should be closed
      const res = await httpRequest(
        `${baseUrl}/api/plugin-proxy?url=${encodeURIComponent('http://127.0.0.1:19999/plugin.js')}`,
      );
      expect(res.status).toBe(502);
      expect(res.body).toContain('Failed to fetch remote plugin');
    } finally {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
    }
  });

  it('rejects POST requests', async () => {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) {
      await once(server, 'listening');
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Unable to resolve server address');
    }

    const baseUrl = `http://127.0.0.1:${String(address.port)}`;

    try {
      const res = await httpRequest(
        `${baseUrl}/api/plugin-proxy?url=${encodeURIComponent('http://example.com/plugin.js')}`,
        { method: 'POST' },
      );
      expect(res.status).toBe(405);
    } finally {
      await new Promise<void>((resolve) => { server.close(() => resolve()); });
    }
  });
});

// ---------------------------------------------------------------------------
// Deck proxy
// ---------------------------------------------------------------------------

describe('deck proxy', () => {
  async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
    const server = createServer({ port: 0, host: '127.0.0.1' });
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') { server.close(); throw new Error('no address'); }
    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    return { baseUrl, close: () => new Promise<void>((r) => { server.close(() => r()); }) };
  }

  async function startUpstream(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<{ url: string; close: () => Promise<void> }> {
    const upstream = http.createServer(handler);
    upstream.listen(0, '127.0.0.1');
    if (!upstream.listening) await once(upstream, 'listening');
    const addr = upstream.address();
    if (!addr || typeof addr === 'string') { upstream.close(); throw new Error('no address'); }
    return {
      url: `http://127.0.0.1:${String(addr.port)}`,
      close: () => new Promise<void>((r) => { upstream.close(() => r()); }),
    };
  }

  it('returns 400 when url parameter is missing', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(`${baseUrl}/api/deck-proxy`);
      expect(res.status).toBe(400);
      expect(res.body).toContain('Missing required');
    } finally { await close(); }
  });

  it('returns 400 for an invalid URL', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(`${baseUrl}/api/deck-proxy?url=${encodeURIComponent('not-a-url')}`);
      expect(res.status).toBe(400);
      expect(res.body).toContain('Invalid URL');
    } finally { await close(); }
  });

  it('returns 400 for non-http(s) protocols', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(`${baseUrl}/api/deck-proxy?url=${encodeURIComponent('ftp://example.com/file.txt')}`);
      expect(res.status).toBe(400);
      expect(res.body).toContain('not allowed');
    } finally { await close(); }
  });

  it('returns 400 for blocked link-local metadata address', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(`${baseUrl}/api/deck-proxy?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data/')}`);
      expect(res.status).toBe(400);
      expect(res.body).toContain('not allowed');
    } finally { await close(); }
  });

  it('returns 405 for POST requests', async () => {
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent('http://example.com/config.json')}`,
        { method: 'POST' },
      );
      expect(res.status).toBe(405);
    } finally { await close(); }
  });

  it('proxies a config.json file and preserves content-type', async () => {
    process.env['DEV_PROXY'] = 'true';
    const configJson = JSON.stringify({ title: 'Test', content: 'README.md' });
    const upstream = await startUpstream((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(configJson);
    });
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent(`${upstream.url}/deck/config.json`)}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe(configJson);
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
      await upstream.close();
    }
  });

  it('proxies a markdown file', async () => {
    process.env['DEV_PROXY'] = 'true';
    const markdown = '# Hello\n\n![Slide 1](slide_1.png)\n';
    const upstream = await startUpstream((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(markdown);
    });
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent(`${upstream.url}/deck/README.md`)}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe(markdown);
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
      await upstream.close();
    }
  });

  it('proxies a binary image file', async () => {
    process.env['DEV_PROXY'] = 'true';
    const fakeImage = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const upstream = await startUpstream((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(fakeImage.length) });
      res.end(fakeImage);
    });
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent(`${upstream.url}/slide_1.png`)}`,
      );
      expect(res.status).toBe(200);
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
      await upstream.close();
    }
  });

  it('returns 502 when upstream returns an error status', async () => {
    process.env['DEV_PROXY'] = 'true';
    const upstream = await startUpstream((_req, res) => { res.writeHead(404); res.end(); });
    const { baseUrl, close } = await startServer();
    try {
      const res = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent(`${upstream.url}/missing.json`)}`,
      );
      expect(res.status).toBe(502);
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
      await upstream.close();
    }
  });

  it('returns 502 when upstream is unreachable', async () => {
    process.env['DEV_PROXY'] = 'true';
    const { baseUrl, close } = await startServer();
    try {
      // Port 19998 should be closed
      const res = await httpRequest(
        `${baseUrl}/api/deck-proxy?url=${encodeURIComponent('http://127.0.0.1:19998/config.json')}`,
      );
      expect(res.status).toBe(502);
    } finally {
      delete process.env['DEV_PROXY'];
      await close();
    }
  });
});
