import { test, expect } from '@playwright/test';

test.describe('Slide Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
  });

  test('renders slides from the default v2 sample deck', async ({ page }) => {
    const slideCount = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.slideCount,
    );
    expect(slideCount).toBeGreaterThan(0);
  });

  test('starts at slide 0', async ({ page }) => {
    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBe(0);
  });

  test('ArrowRight advances slide', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBeGreaterThanOrEqual(1);
  });

  test('ArrowLeft goes back', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBe(0);
  });

  test('Space advances slide/partial', async ({ page }) => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as any;
      return { slide: ss?.currentSlide, partial: ss?.currentPartial };
    });
    expect(result.slide + result.partial).toBeGreaterThan(0);
  });

  test('Home jumps to first slide', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('Home');
    await page.waitForTimeout(200);
    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBe(0);
  });

  test('End jumps to last slide', async ({ page }) => {
    await page.keyboard.press('End');
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as any;
      return { current: ss?.currentSlide, total: ss?.slideCount };
    });
    expect(result.current).toBe(result.total - 1);
  });
});
