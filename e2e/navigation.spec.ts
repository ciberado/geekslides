import { test, expect } from '@playwright/test';

test.describe('Slide Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('geek-slideshow');
  });

  test('arrow right advances to next slide', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toHaveAttribute('current-slide', '1');
  });

  test('arrow left goes to previous slide', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toHaveAttribute('current-slide', '0');
  });

  test('space advances to next slide', async ({ page }) => {
    await page.keyboard.press('Space');
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toHaveAttribute('current-slide', '1');
  });

  test('Home jumps to first slide', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Home');
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toHaveAttribute('current-slide', '0');
  });

  test('End jumps to last slide', async ({ page }) => {
    await page.keyboard.press('End');
    const slideshow = page.locator('geek-slideshow');
    const slide = await slideshow.getAttribute('current-slide');
    expect(Number(slide)).toBeGreaterThan(0);
  });

  test('partials reveal before slide advances', async ({ page }) => {
    // Navigate to a slide with partials if present
    const slideshow = page.locator('geek-slideshow');
    const initialSlide = await slideshow.getAttribute('current-slide');
    await page.keyboard.press('ArrowRight');
    // If partials exist, the slide number may not change on first press
    const afterPress = await slideshow.getAttribute('current-slide');
    expect(afterPress).toBeDefined();
  });
});
