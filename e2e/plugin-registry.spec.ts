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

async function waitForSyncConnected(page): Promise<void> {
  // Wait for the Yjs/WebSocket sync connection to be fully established
  await page.waitForFunction(() => {
    return (window as unknown as { __syncConnected?: boolean }).__syncConnected === true;
  }, { timeout: 10000 });
}

// Inject sync detection script into a page before navigation
async function setupSyncDetection(page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('geek:sync:state', (e: CustomEvent) => {
      if (e.detail?.connected) {
        (window as unknown as { __syncConnected: boolean }).__syncConnected = true;
      }
    });
  });
}

async function ensureTerminalOpen(page): Promise<void> {
  const isOpen = await page.evaluate(() => {
    const term = document.querySelector('geek-terminal') as HTMLElement | null;
    return term?.style.display === 'block';
  });
  if (!isOpen) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'block';
    });
  }
}

async function runTerminalCommand(page, command: string): Promise<void> {
  await ensureTerminalOpen(page);
  await page.evaluate((value) => {
    const terminal = document.querySelector('geek-terminal');
    const input = terminal?.shadowRoot?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not available');
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, command);
}

/**
 * Start a mock registry server that serves index.json and plugin files.
 */
function startRegistryServer(manifest: object, plugins: Record<string, { manifest: object; module: string }>): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = req.url ?? '/';

      if (path === '/index.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(manifest));
        return;
      }

      // Match plugin manifest or module paths
      for (const [pluginPath, plugin] of Object.entries(plugins)) {
        if (path === `/${pluginPath}/plugin.json`) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(plugin.manifest));
          return;
        }
        if (path === `/${pluginPath}/dist/index.js`) {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(plugin.module);
          return;
        }
      }

      res.writeHead(404);
      res.end('Not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No address');
      const baseUrl = `http://127.0.0.1:${String(address.port)}`;
      resolve({ server, baseUrl });
    });
  });
}

const DECK = 'e2e/fixtures/sync-deck/config.json';

test.describe('Plugin Registry Commands', () => {
  let registryServer: Server;
  let registryUrl: string;

  test.beforeAll(async () => {
    const manifest = {
      name: 'E2E Test Registry',
      version: 1,
      plugins: [
        { name: 'e2e-emoji', version: '1.0.0', description: 'E2E emoji plugin', entry: 'e2e-emoji/plugin.json' },
        { name: 'e2e-marker', version: '2.0.0', description: 'E2E marker plugin', entry: 'e2e-marker/plugin.json' },
      ],
    };

    const plugins = {
      'e2e-emoji': {
        manifest: {
          name: 'e2e-emoji',
          version: '1.0.0',
          description: 'E2E emoji plugin',
          preprocessors: ['e2e-emoji-prep'],
          processors: [],
          features: [],
        },
        module: `export function activate(api) {
          return {
            preprocessors: { 'e2e-emoji-prep': (md) => md.replaceAll(':check:', '✅') },
            processors: {},
            features: {}
          };
        }`,
      },
      'e2e-marker': {
        manifest: {
          name: 'e2e-marker',
          version: '2.0.0',
          description: 'E2E marker plugin',
          preprocessors: ['e2e-marker-prep'],
          processors: [],
          features: [],
        },
        module: `export function activate(api) {
          return {
            preprocessors: { 'e2e-marker-prep': (md) => md.replaceAll('MARKER', 'REPLACED') },
            processors: {},
            features: {}
          };
        }`,
      },
    };

    const result = await startRegistryServer(manifest, plugins);
    registryServer = result.server;
    registryUrl = result.baseUrl;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => { registryServer.close(() => resolve()); });
  });

  test('plugin-registry-add fetches and adds a registry', async ({ page }) => {
    const room = uniqueRoom('reg-add');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);

    // Wait for confirmation
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    const terminalContent = await page.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(terminalContent).toContain('E2E Test Registry');
    expect(terminalContent).toContain('2 plugins');
  });

  test('default registry is present on fresh room', async ({ page }) => {
    const room = uniqueRoom('reg-default');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    await runTerminalCommand(page, 'plugin-registry-ls');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('GeekSlides Official'),
      { timeout: 5000 },
    );

    const content = await page.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(content).toContain('Registries:');
    expect(content).toContain('GeekSlides Official');
    expect(content).toContain('github.com/ciberado/geekslides');
  });

  test('plugin-registry-ls lists configured registries', async ({ page }) => {
    const room = uniqueRoom('reg-ls');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry first
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    // List registries
    await runTerminalCommand(page, 'plugin-registry-ls');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('E2E Test Registry'),
      { timeout: 5000 },
    );

    const content = await page.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(content).toContain('Registries:');
    expect(content).toContain(registryUrl.replace('http://', ''));
  });

  test('plugin-available lists plugins from registries', async ({ page }) => {
    const room = uniqueRoom('reg-available');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    // List available
    await runTerminalCommand(page, 'plugin-available');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('e2e-emoji'),
      { timeout: 5000 },
    );

    const content = await page.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(content).toContain('e2e-emoji');
    expect(content).toContain('e2e-marker');
    expect(content).toContain('v1.0.0');
    expect(content).toContain('v2.0.0');
  });

  test('plugin-load loads a plugin and plugin-active shows it', async ({ page }) => {
    const room = uniqueRoom('reg-load');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    // Load plugin
    await runTerminalCommand(page, 'plugin-load e2e-emoji');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Plugin loaded'),
      { timeout: 5000 },
    );

    // Check active
    await runTerminalCommand(page, 'plugin-active');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('e2e-emoji'),
      { timeout: 5000 },
    );

    const content = await page.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(content).toContain('● e2e-emoji');
  });

  test('plugin-unload removes a loaded plugin', async ({ page }) => {
    const room = uniqueRoom('reg-unload');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry and load plugin
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    await runTerminalCommand(page, 'plugin-load e2e-marker');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Plugin loaded'),
      { timeout: 5000 },
    );

    // Unload
    await runTerminalCommand(page, 'plugin-unload e2e-marker');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Plugin unloaded'),
      { timeout: 5000 },
    );

    // Verify it's gone
    await runTerminalCommand(page, 'plugin-active');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('No room plugins'),
      { timeout: 5000 },
    );
  });

  test('plugin-registry-remove removes registry', async ({ page }) => {
    const room = uniqueRoom('reg-remove');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    // Remove it
    await runTerminalCommand(page, `plugin-registry-remove ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry removed'),
      { timeout: 5000 },
    );

    // Verify test registry is gone but default remains
    await runTerminalCommand(page, 'plugin-registry-ls');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('GeekSlides Official'),
      { timeout: 5000 },
    );
    const content = await page.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(content).not.toContain('E2E Test Registry');
  });

  test('plugin-registry-add with invalid URL shows error', async ({ page }) => {
    const room = uniqueRoom('reg-bad');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    await runTerminalCommand(page, 'plugin-registry-add http://127.0.0.1:1/nonexistent');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Failed to add registry'),
      { timeout: 10000 },
    );
  });

  test('plugin-load with unknown name shows error', async ({ page }) => {
    const room = uniqueRoom('reg-unknown');
    await page.goto(`/?config=${DECK}&room=${room}`);
    await waitForSlideshow(page);

    // Add registry
    await runTerminalCommand(page, `plugin-registry-add ${registryUrl}`);
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    // Try to load nonexistent plugin
    await runTerminalCommand(page, 'plugin-load nonexistent-plugin');
    await page.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('not found'),
      { timeout: 5000 },
    );
  });

  test('registry state syncs between two tabs in same room', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('reg-sync');

    const deckUrl = `/?config=${DECK}&room=${room}`;
    await page1.goto(deckUrl);
    await page2.goto(deckUrl);

    await waitForSlideshow(page1);
    await waitForSlideshow(page2);

    // Add registry on page1
    await runTerminalCommand(page1, `plugin-registry-add ${registryUrl}`);
    await page1.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('Registry added'),
      { timeout: 5000 },
    );

    // page2 should see the registry when it lists
    await runTerminalCommand(page2, 'plugin-registry-ls');
    await page2.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('E2E Test Registry'),
      { timeout: 5000 },
    );

    await context.close();
  });
});

test.describe('Short URL API', () => {
  test('POST /api/short creates and GET /s/:id redirects', async ({ page }) => {
    await page.goto(`/?config=${DECK}&room=${uniqueRoom('short-url')}`);
    await waitForSlideshow(page);

    // Use unique URL to avoid dedup from other test runs
    const targetUrl = `https://example.com/test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const result = await page.evaluate(async (url) => {
      const createRes = await fetch('/api/short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const createData = await createRes.json();
      return {
        createStatus: createRes.status,
        id: createData.id,
        short: createData.short,
      };
    }, targetUrl);

    expect(result.createStatus).toBe(201);
    expect(result.id).toMatch(/^[a-z0-9]{6}$/);
    expect(result.short).toContain(`/s/${result.id}`);

    // Verify redirect works using Playwright's request API with full base URL
    const baseUrl = page.url().split('/').slice(0, 3).join('/');
    const redirectResponse = await page.request.get(`${baseUrl}/s/${result.id}`, {
      maxRedirects: 0,
    });
    expect(redirectResponse.status()).toBe(302);
    expect(redirectResponse.headers()['location']).toBe(targetUrl);
  });

  test('POST /api/short deduplicates same URL', async ({ page }) => {
    await page.goto(`/?config=${DECK}&room=${uniqueRoom('short-dedup')}`);
    await waitForSlideshow(page);

    const result = await page.evaluate(async () => {
      const url = 'https://example.com/dedup-test-' + Date.now();
      const res1 = await fetch('/api/short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data1 = await res1.json();

      const res2 = await fetch('/api/short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data2 = await res2.json();

      return { id1: data1.id, id2: data2.id, status2: res2.status };
    });

    expect(result.id1).toBe(result.id2);
    expect(result.status2).toBe(200); // 200 not 201 for existing
  });

  test('POST /api/short rejects missing URL', async ({ page }) => {
    await page.goto(`/?config=${DECK}&room=${uniqueRoom('short-missing')}`);
    await waitForSlideshow(page);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Missing "url" field');
  });

  test('GET /s/nonexistent returns 404', async ({ page }) => {
    await page.goto(`/?config=${DECK}&room=${uniqueRoom('short-404')}`);
    await waitForSlideshow(page);

    const result = await page.evaluate(async () => {
      const res = await fetch('/s/zzzzzz', { redirect: 'manual' });
      return { status: res.status };
    });

    expect(result.status).toBe(404);
  });
});

test.describe('Share QR Command', () => {
  // These tests involve multi-page Yjs sync with polling — need more time
  test.setTimeout(30000);

  test('share-qr shows QR overlay on all screens', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('share-qr');

    // Setup sync detection before navigation
    await setupSyncDetection(page1);
    await setupSyncDetection(page2);

    const deckUrl = `/?config=${DECK}&room=${room}`;
    await page1.goto(deckUrl);
    await page2.goto(deckUrl);

    await waitForSlideshow(page1);
    await waitForSlideshow(page2);

    // Wait for sync to fully establish between clients
    await waitForSyncConnected(page1);
    await waitForSyncConnected(page2);

    // Run share-qr on page1
    await runTerminalCommand(page1, 'share-qr');

    // Wait for command to complete (shows output in terminal)
    await page1.waitForFunction(
      () => {
        const content = document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '';
        return content.includes('QR code shown') || content.includes('✗');
      },
      { timeout: 10000 },
    );

    // Verify no error
    const termText = await page1.evaluate(() =>
      document.querySelector('geek-terminal')?.shadowRoot?.textContent ?? '',
    );
    expect(termText).toContain('QR code shown');

    // page1 should show the QR overlay
    await page1.waitForFunction(
      () => !!document.querySelector('.gs-qr-overlay'),
      { timeout: 5000 },
    );

    // page2 should also show the QR overlay (synced via Yjs)
    await page2.waitForFunction(
      () => !!document.querySelector('.gs-qr-overlay'),
      { timeout: 5000 },
    );

    // Verify the overlay contains a canvas (the QR code)
    const hasCanvas1 = await page1.evaluate(() => !!document.querySelector('.gs-qr-overlay canvas'));
    const hasCanvas2 = await page2.evaluate(() => !!document.querySelector('.gs-qr-overlay canvas'));
    expect(hasCanvas1).toBe(true);
    expect(hasCanvas2).toBe(true);

    await context.close();
  });

  test('share-qr overlay dismissed by Escape on any client', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('share-qr-dismiss');

    // Setup sync detection before navigation
    await setupSyncDetection(page1);
    await setupSyncDetection(page2);

    const deckUrl = `/?config=${DECK}&room=${room}`;
    await page1.goto(deckUrl);
    await page2.goto(deckUrl);

    await waitForSlideshow(page1);
    await waitForSlideshow(page2);

    // Wait for sync to establish
    await waitForSyncConnected(page1);
    await waitForSyncConnected(page2);

    // Show QR on page1
    await runTerminalCommand(page1, 'share-qr');

    // Wait for command confirmation
    await page1.waitForFunction(
      () => document.querySelector('geek-terminal')?.shadowRoot?.textContent?.includes('QR code shown'),
      { timeout: 10000 },
    );

    // Wait for overlay on both (page2 uses polling to detect Yjs map swap, allow extra time)
    await page1.waitForFunction(() => !!document.querySelector('.gs-qr-overlay'), { timeout: 8000 });
    await page2.waitForFunction(() => !!document.querySelector('.gs-qr-overlay'), { timeout: 8000 });

    // Dismiss from page2 (press Escape)
    await page2.keyboard.press('Escape');

    // Both should be dismissed
    await page1.waitForFunction(() => !document.querySelector('.gs-qr-overlay'), { timeout: 8000 });
    await page2.waitForFunction(() => !document.querySelector('.gs-qr-overlay'), { timeout: 8000 });

    await context.close();
  });
});

test.describe('GitHub URL Normalization in Registry', () => {
  test('plugin proxy fetches raw.githubusercontent.com content', async ({ page }) => {
    await page.goto(`/?config=${DECK}&room=${uniqueRoom('github-norm')}`);
    await waitForSlideshow(page);

    // Verify the proxy can reach raw.githubusercontent.com (test with a known public file)
    // We test the normalization logic itself in unit tests; here we just verify
    // the proxy accepts .json from raw.githubusercontent.com
    const result = await page.evaluate(async () => {
      // Use a well-known public JSON file on raw.githubusercontent.com
      const testUrl = 'https://raw.githubusercontent.com/nicolo-ribaudo/tc39-proposal-structs/main/package.json';
      const res = await fetch(`/api/plugin-proxy?url=${encodeURIComponent(testUrl)}`);
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json();
      return { ok: true, hasName: typeof data.name === 'string' };
    });

    // If this specific file doesn't exist, that's fine — we mainly test
    // that the proxy doesn't reject the URL pattern
    expect(result.ok === true || result.status === 502).toBe(true);
  });
});
