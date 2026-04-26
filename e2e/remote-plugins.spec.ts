import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForSlideshow(page): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
    return (ss?.slideCount ?? 0) > 0;
  });
}

async function openTerminal(page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const term = document.querySelector('geek-terminal') as HTMLElement | null;
    return term?.style.display === 'block';
  });
}

async function runTerminalCommand(page, command: string): Promise<void> {
  await openTerminal(page);
  await page.evaluate((value) => {
    const terminal = document.querySelector('geek-terminal');
    const input = terminal?.shadowRoot?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not available');
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, command);
}

/**
 * Start a tiny HTTP server that serves a JS plugin file.
 * Returns the server and its local URL.
 */
function startPluginServer(source: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(source);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No address');
      const url = `http://127.0.0.1:${String(address.port)}/remote-plugin.js`;
      resolve({ server, url });
    });
  });
}

test.describe('Remote Plugins', () => {
  let pluginServer: Server;
  let pluginUrl: string;

  test.beforeAll(async () => {
    // Serve a preprocessor that replaces "MARKER" with "REPLACED_BY_REMOTE"
    const result = await startPluginServer(
      'export default function remotePreprocessor(markdown) { return markdown.replaceAll("MARKER", "REPLACED_BY_REMOTE"); }',
    );
    pluginServer = result.server;
    pluginUrl = result.url;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => { pluginServer.close(() => resolve()); });
  });

  test('loads a remote plugin through the proxy and applies it', async ({ page }) => {
    // Navigate to default deck
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('remote-plugins')}`);
    await waitForSlideshow(page);

    // Verify the proxy endpoint is accessible
    const proxyResp = await page.evaluate(async (url) => {
      const res = await fetch(`/api/plugin-proxy?url=${encodeURIComponent(url)}`);
      return { status: res.status, text: await res.text() };
    }, pluginUrl);

    expect(proxyResp.status).toBe(200);
    expect(proxyResp.text).toContain('remotePreprocessor');

    // Create a config that uses the remote plugin, write it as a fixture on disk.
    // Instead, we'll test through the proxy by dynamically importing and running.
    const result = await page.evaluate(async (url) => {
      const proxyUrl = `/api/plugin-proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const source = await response.text();
      const blob = new Blob([source], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      try {
        const mod = await import(blobUrl);
        if (typeof mod.default !== 'function') return { error: 'No default export function' };
        return { output: mod.default('hello MARKER world') };
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }, pluginUrl);

    expect(result).toEqual({ output: 'hello REPLACED_BY_REMOTE world' });
  });

  test('proxy rejects non-.js URLs', async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('remote-plugins-reject')}`);
    await waitForSlideshow(page);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/plugin-proxy?url=' + encodeURIComponent('http://example.com/style.css'));
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Only .js files');
  });

  test('proxy rejects missing url parameter', async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('remote-plugins-missing')}`);
    await waitForSlideshow(page);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/plugin-proxy');
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Missing required');
  });
});
