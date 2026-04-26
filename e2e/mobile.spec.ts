import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test.describe('Mobile Touch Navigation', () => {
  test('renders and loads slides on mobile viewport', async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('mobile')}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    const slideCount = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.slideCount,
    );
    expect(slideCount).toBeGreaterThan(0);
  });

  test('tap right advances slide', async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('mobile')}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Tap on the right zone (> 33%) to move forward
    const box = await page.locator('geek-slideshow').boundingBox();
    if (box) {
      const startX = box.x + box.width * 0.8;
      const y = box.y + box.height / 2;
      await page.touchscreen.tap(startX, y);
      await page.waitForTimeout(300);
    }

    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBeGreaterThanOrEqual(1);
  });

  test('tap left goes to previous slide', async ({ page }) => {
    await page.goto(`/?config=e2e/fixtures/layouts-deck/config.json&room=${uniqueRoom('mobile')}`);
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Advance first so we can go back
    const box = await page.locator('geek-slideshow').boundingBox();
    if (box) {
      const xRight = box.x + box.width * 0.75;
      const y = box.y + box.height / 2;
      await page.touchscreen.tap(xRight, y);
      await page.waitForTimeout(300);

      // Tap left zone (<= 33%) to move backward
      const xLeft = box.x + box.width * 0.15;
      await page.touchscreen.tap(xLeft, y);
      await page.waitForTimeout(300);
    }

    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBe(0);
  });
});
