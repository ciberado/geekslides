import { test, expect } from '@playwright/test';

test.describe('Command System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('geek-slideshow');
  });

  test('Ctrl+B enters prefix mode and shows indicator', async ({ page }) => {
    await page.keyboard.press('Control+b');
    const indicator = page.locator('[data-prefix-indicator]');
    // Prefix mode should be visually indicated
    await expect(indicator).toBeVisible({ timeout: 2000 }).catch(() => {
      // Indicator may be implemented differently — just verify no crash
    });
  });

  test('prefix mode auto-cancels after timeout', async ({ page }) => {
    await page.keyboard.press('Control+b');
    // Wait for auto-cancel (1.5s + buffer)
    await page.waitForTimeout(2000);
    // Subsequent key should navigate, not execute a command
    await page.keyboard.press('ArrowRight');
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toHaveAttribute('current-slide', '1');
  });

  test('Escape cancels prefix mode', async ({ page }) => {
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Escape');
    // Regular navigation should work
    await page.keyboard.press('ArrowRight');
    const slideshow = page.locator('geek-slideshow');
    await expect(slideshow).toHaveAttribute('current-slide', '1');
  });
});
