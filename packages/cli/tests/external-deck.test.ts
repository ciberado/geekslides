/**
 * Integration tests for external deck serving via /@fs paths.
 *
 * Verifies the full flow: CLI resolves an external config.json path,
 * converts it to a valid Vite /@fs URL, starts a dev server, and the
 * server responds with the actual JSON (not the SPA fallback HTML).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { geekSlidesHmr } from '@geekslides/engine/hmr';
import {
  resolveDeckConfigPath,
  toBrowserServedPath,
  resolveCliAppRoot,
} from '../src/commands/dev.ts';
import { dirname } from 'node:path';
import { createServer as createNetServer } from 'node:net';

const APP_ROOT = resolveCliAppRoot();

/** Find a free port by briefly binding to port 0 and releasing it. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => { reject(new Error('Could not determine port')); });
        return;
      }
      const { port } = addr;
      srv.close(() => { resolve(port); });
    });
    srv.on('error', reject);
  });
}

describe('external deck /@fs serving', () => {
  let tmpDir: string;
  let server: ViteDevServer;

  afterAll(async () => {
    await server?.close();
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('serves an external config.json via /@fs without double slashes', async () => {
    // Create a temporary deck outside the workspace
    tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-ext-deck-'));
    const configContent = JSON.stringify({
      title: 'External Deck Test',
      content: 'README.md',
      styles: [],
      aspectRatio: '16/9',
    });
    const markdownContent = '# Test Slide\n\nHello from external deck.';
    await writeFile(join(tmpDir, 'config.json'), configContent, 'utf-8');
    await writeFile(join(tmpDir, 'README.md'), markdownContent, 'utf-8');

    // Resolve paths exactly as the CLI does
    const deckConfigPath = resolveDeckConfigPath(join(tmpDir, 'config.json'));
    const deckDir = dirname(deckConfigPath);
    const browserConfigPath = toBrowserServedPath(deckConfigPath);

    // Verify no double slashes in the /@fs path
    expect(browserConfigPath).toMatch(/^\/@fs\/[^/]/);
    expect(browserConfigPath).not.toContain('//');

    // Start a real Vite dev server (same config as the CLI)
    const port = await findFreePort();
    server = await createServer({
      plugins: [geekSlidesHmr()],
      server: {
        host: '127.0.0.1',
        port,
        strictPort: true,
        fs: { allow: [APP_ROOT, deckDir] },
      },
      configFile: false,
      root: APP_ROOT,
      logLevel: 'silent',
    });
    await server.listen();

    const baseUrl = `http://localhost:${String(port)}`;

    // Fetch config.json via the /@fs path
    const configResponse = await fetch(`${baseUrl}${browserConfigPath}`);
    expect(configResponse.status).toBe(200);
    const contentType = configResponse.headers.get('content-type') ?? '';
    expect(contentType).toContain('json');

    const json = await configResponse.json() as Record<string, unknown>;
    expect(json['title']).toBe('External Deck Test');

    // Fetch the markdown content via /@fs
    const readmePath = toBrowserServedPath(join(tmpDir, 'README.md'));
    const mdResponse = await fetch(`${baseUrl}${readmePath}`);
    expect(mdResponse.status).toBe(200);
    const mdText = await mdResponse.text();
    expect(mdText).toContain('Hello from external deck.');
  });
});
