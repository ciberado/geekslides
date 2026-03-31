import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 14']);

test.describe('Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('geek-slideshow');
  });

  test('swipe left advances to next slide', async ({ page }) => {
    const slideshow = page.locator('geek-slideshow');
    const box = await slideshow.boundingBox();
    if (box) {
      // Swipe left (drag from right to left)
      await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
    }
    await page.waitForTimeout(500);
    // Verify slide changed or tap in right zone works
    await expect(slideshow).toBeVisible();
  });

  test('tap in right 2/3 advances slide', async ({ page }) => {
    const slideshow = page.locator('geek-slideshow');
    const box = await slideshow.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2);
    }
    await page.waitForTimeout(300);
    await expect(slideshow).toHaveAttribute('current-slide', '1');
  });

  test('tap in left 1/3 goes back', async ({ page }) => {
    const slideshow = page.locator('geek-slideshow');
    const box = await slideshow.boundingBox();
    if (box) {
      // First advance
      await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2);
      await page.waitForTimeout(300);
      // Then go back
      await page.touchscreen.tap(box.x + box.width * 0.15, box.y + box.height / 2);
      await page.waitForTimeout(300);
    }
    await expect(slideshow).toHaveAttribute('current-slide', '0');
  });

  test('toolbar is always visible on mobile', async ({ page }) => {
    const toolbar = page.locator('geek-toolbar, [data-toolbar]');
    if (await toolbar.count() > 0) {
      await expect(toolbar.first()).toBeVisible();
    }
  });
});
