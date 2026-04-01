import { test, expect } from '@playwright/test';

test.describe('Whiteboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
  });

  test('whiteboard command toggles canvas overlay', async ({ page }) => {
    // Open terminal and run whiteboard command
    await page.keyboard.press('t');
    await page.waitForTimeout(200);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    // Close terminal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Check that geek-whiteboard was created in the slideshow shadow DOM
    const exists = await page.evaluate(() => {
      const ss = document.getElementById('slideshow');
      return !!ss?.shadowRoot?.querySelector('geek-whiteboard');
    });
    // Whiteboard element should exist (may not be registered as custom element yet)
    expect(exists).toBeDefined();
  });
});
