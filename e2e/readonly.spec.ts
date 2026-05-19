import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DECK_URL = 'e2e/fixtures/sync-deck/config.json';

test.describe('Read-only viewer mode', () => {
  test('readonly viewer sees slides but has no terminal or keyboard nav', async ({ page }) => {
    const room = uniqueRoom('readonly');
    await page.goto(`/?config=${DECK_URL}&room=${room}&readonly`);

    // Wait for slideshow to load
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });

    // Slideshow is visible
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toBeAttached();

    // Terminal element should NOT exist
    const terminal = page.locator('geek-terminal');
    await expect(terminal).toHaveCount(0);

    // VIEW ONLY badge should be visible
    const badge = page.locator('text=VIEW ONLY');
    await expect(badge).toBeVisible();

    // Pressing Escape should NOT open a terminal (no terminal element in readonly mode)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('geek-terminal')).toHaveCount(0);

    // Arrow keys should NOT change slide (readonly = no navigation)
    const slideBefore = await page.evaluate(
      () => (document.getElementById('slideshow') as unknown as { currentSlide: number })?.currentSlide,
    );
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const slideAfter = await page.evaluate(
      () => (document.getElementById('slideshow') as unknown as { currentSlide: number })?.currentSlide,
    );
    expect(slideAfter).toBe(slideBefore);
  });

  test('readonly viewer follows presenter navigation', async ({ browser }) => {
    const context = await browser.newContext();
    const room = uniqueRoom('readonly-follow');

    // Presenter tab (normal mode)
    const presenter = await context.newPage();
    await presenter.goto(`/?config=${DECK_URL}&room=${room}`);
    await presenter.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });

    // Wait for content proxy upload to complete before opening viewer
    await presenter.waitForTimeout(2000);

    // Viewer tab (readonly)
    const viewer = await context.newPage();
    await viewer.goto(`/?config=${DECK_URL}&room=${room}&readonly`);
    await viewer.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });

    // Wait for viewer to finish loading from content proxy and for sync to connect
    await viewer.waitForTimeout(3000);

    // Presenter navigates to slide 2
    await presenter.evaluate(() => {
      (document.getElementById('slideshow') as unknown as { goTo: (n: number) => void })?.goTo(2);
    });

    // Viewer should follow
    await viewer.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { currentSlide: number } | null;
      return ss?.currentSlide === 2;
    }, undefined, { timeout: 10000 });

    const viewerSlide = await viewer.evaluate(
      () => (document.getElementById('slideshow') as unknown as { currentSlide: number })?.currentSlide,
    );
    expect(viewerSlide).toBe(2);

    await context.close();
  });

  test('share command creates a protected room', async ({ page }) => {
    const room = uniqueRoom('share-test');
    await page.goto(`/?config=${DECK_URL}&room=${room}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });

    // Wait for sync to connect
    await page.waitForTimeout(500);

    // Open terminal and run share command
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'block';
    });
    await page.evaluate(() => {
      const terminal = document.querySelector('geek-terminal');
      const input = terminal?.shadowRoot?.querySelector('input');
      if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not available');
      input.value = 'share';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // Wait for the share command to complete (output shows ✓ Share link)
    await page.waitForFunction(() => {
      const terminal = document.querySelector('geek-terminal');
      if (!terminal?.shadowRoot) return false;
      const output = terminal.shadowRoot.querySelector('.output');
      return output?.textContent?.includes('Share link') ?? false;
    }, undefined, { timeout: 5000 });

    // Check the room is now protected via the API
    const apiUrl = `${page.url().split('?')[0]}api/rooms/${encodeURIComponent(room)}/role`;
    const response = await page.evaluate(
      async (url: string) => {
        const res = await fetch(url);
        return res.json() as Promise<{ room: string; protected: boolean }>;
      },
      apiUrl.replace(/\/$/, ''),
    );
    expect(response.protected).toBe(true);
  });

  test('sync status dot shows green for readonly viewer', async ({ page }) => {
    const room = uniqueRoom('readonly-dot');
    await page.goto(`/?config=${DECK_URL}&room=${room}&readonly`);

    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as unknown as { slideCount: number } | null;
      return ss !== null && ss.slideCount > 0;
    });

    // Wait for sync connection
    await page.waitForTimeout(1000);

    // Check the sync dot is green (connected)
    const dotColor = await page.evaluate(() => {
      const dots = document.querySelectorAll('div');
      for (const dot of dots) {
        if (dot.title?.includes('Sync:')) {
          return getComputedStyle(dot).backgroundColor;
        }
      }
      return null;
    });

    // Green (#4ade80) = rgb(74, 222, 128)
    expect(dotColor).toBe('rgb(74, 222, 128)');
  });
});
