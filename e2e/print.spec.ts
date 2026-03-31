import { test, expect } from '@playwright/test';

test.describe('Print', () => {
  test('print view renders slides without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/?view=print');
    await page.waitForTimeout(1000);

    // Should have no console errors
    expect(errors).toHaveLength(0);
  });

  test('print view contains slide content', async ({ page }) => {
    await page.goto('/?view=print');
    await page.waitForTimeout(1000);

    // The page should contain rendered slide content
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });
});
