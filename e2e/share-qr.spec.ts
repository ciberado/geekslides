import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DECK_URL = 'e2e/fixtures/sync-deck/config.json';

/** Wait for the slideshow to be loaded and synced. */
async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
    return ss !== null && ss.slideCount > 0;
  });
  // Wait for sync connection
  await page.waitForFunction(() => {
    const sync = (window as any).__geekslides_sync;
    return sync && sync.isConnected;
  }, undefined, { timeout: 10000 });
}

/** Check if the QR overlay is visible. */
async function hasQrOverlay(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.querySelector('.gs-qr-overlay') !== null;
  });
}

/** Set qrUrl in the Yjs features map (simulates what share-qr command does). */
async function setQrUrl(page: Page, url: string): Promise<void> {
  await page.evaluate((qrUrl) => {
    const sync = (window as any).__geekslides_sync;
    const doc = sync.doc;
    const featuresMap = doc.getMap('features');
    let qrMap = featuresMap.get('qr-overlay') as any;
    if (!qrMap) {
      // Use the Y.Map constructor from the existing doc's runtime
      // The doc.getMap always returns a Y.Map — we can use its constructor
      const YMap = Object.getPrototypeOf(featuresMap).constructor;
      qrMap = new YMap();
      featuresMap.set('qr-overlay', qrMap);
    }
    qrMap.set('qrUrl', qrUrl);
  }, url);
}

/** Clear qrUrl in the Yjs features map (simulates dismiss). */
async function clearQrUrl(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sync = (window as any).__geekslides_sync;
    const doc = sync.doc;
    const featuresMap = doc.getMap('features');
    const qrMap = featuresMap.get('qr-overlay') as any;
    if (qrMap) {
      qrMap.set('qrUrl', '');
    }
  });
}

test.describe('Share QR overlay', () => {
  test('QR overlay appears on both presenter tabs in the same room', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('qr-sync');

    const url = `/?config=${DECK_URL}&room=${room}`;
    await page1.goto(url);
    await page2.goto(url);
    await waitForReady(page1);
    await waitForReady(page2);

    // Verify the qr-overlay feature is registered on both pages
    for (const page of [page1, page2]) {
      const hasFeature = await page.evaluate(() => {
        const ss = document.querySelector('geek-slideshow');
        const sr = ss?.shadowRoot;
        return sr?.querySelector('[data-feature="qr-overlay"]') !== null;
      });
      expect(hasFeature).toBe(true);
    }

    // Set QR URL on page1
    await setQrUrl(page1, 'https://example.com/test-qr');

    // Wait for overlay on page1
    await page1.waitForSelector('.gs-qr-overlay', { timeout: 5000 });
    expect(await hasQrOverlay(page1)).toBe(true);

    // Wait for overlay on page2 (synced via Yjs)
    await page2.waitForSelector('.gs-qr-overlay', { timeout: 5000 });
    expect(await hasQrOverlay(page2)).toBe(true);

    await context.close();
  });

  test('QR overlay appears on readonly viewer tab', async ({ browser }) => {
    const context = await browser.newContext();
    const presenter = await context.newPage();
    const viewer = await context.newPage();
    const room = uniqueRoom('qr-viewer');

    await presenter.goto(`/?config=${DECK_URL}&room=${room}`);
    await viewer.goto(`/?config=${DECK_URL}&room=${room}&readonly`);
    await waitForReady(presenter);
    await waitForReady(viewer);

    // Set QR URL from the presenter
    await setQrUrl(presenter, 'https://example.com/viewer-qr');

    // Overlay should appear on presenter
    await presenter.waitForSelector('.gs-qr-overlay', { timeout: 5000 });
    expect(await hasQrOverlay(presenter)).toBe(true);

    // Overlay should appear on viewer (readonly)
    await viewer.waitForSelector('.gs-qr-overlay', { timeout: 5000 });
    expect(await hasQrOverlay(viewer)).toBe(true);

    await context.close();
  });

  test('dismissing QR from presenter closes it on all sessions', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const room = uniqueRoom('qr-dismiss');

    const url = `/?config=${DECK_URL}&room=${room}`;
    await page1.goto(url);
    await page2.goto(url);
    await waitForReady(page1);
    await waitForReady(page2);

    // Show QR
    await setQrUrl(page1, 'https://example.com/dismiss-test');
    await page1.waitForSelector('.gs-qr-overlay', { timeout: 5000 });
    await page2.waitForSelector('.gs-qr-overlay', { timeout: 5000 });

    // Dismiss from page1
    await clearQrUrl(page1);

    // Both should lose the overlay
    await page1.waitForSelector('.gs-qr-overlay', { state: 'detached', timeout: 5000 });
    await page2.waitForSelector('.gs-qr-overlay', { state: 'detached', timeout: 5000 });

    expect(await hasQrOverlay(page1)).toBe(false);
    expect(await hasQrOverlay(page2)).toBe(false);

    await context.close();
  });

  test('readonly viewer cannot dismiss QR overlay', async ({ browser }) => {
    const context = await browser.newContext();
    const presenter = await context.newPage();
    const viewer = await context.newPage();
    const room = uniqueRoom('qr-no-dismiss');

    await presenter.goto(`/?config=${DECK_URL}&room=${room}`);
    await viewer.goto(`/?config=${DECK_URL}&room=${room}&readonly`);
    await waitForReady(presenter);
    await waitForReady(viewer);

    // Show QR
    await setQrUrl(presenter, 'https://example.com/no-dismiss-test');
    await presenter.waitForSelector('.gs-qr-overlay', { timeout: 5000 });
    await viewer.waitForSelector('.gs-qr-overlay', { timeout: 5000 });

    // Try to dismiss from viewer by pressing Escape
    await viewer.keyboard.press('Escape');
    await viewer.waitForTimeout(500);

    // QR should still be showing on both — viewer can't dismiss
    expect(await hasQrOverlay(presenter)).toBe(true);
    expect(await hasQrOverlay(viewer)).toBe(true);

    // Check viewer hint text says "Scan to join" not "Click or press Esc to dismiss"
    const viewerHint = await viewer.evaluate(() => {
      return document.querySelector('.gs-qr-overlay .gs-qr-hint')?.textContent;
    });
    expect(viewerHint).toBe('Scan to join');

    await context.close();
  });
});
