import { test, expect } from '@playwright/test';

test.describe('Speaker View', () => {
  test('speaker view renders with timer and notes', async ({ page }) => {
    await page.goto('/?view=speaker');
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    }, { timeout: 5000 });

    // Speaker view should exist and be visible
    const speakerEl = page.locator('geek-speaker-view');
    await expect(speakerEl).toBeVisible();

    // Timer should be running (check shadow DOM text)
    const timerText = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      return sv?.shadowRoot?.querySelector('.timer')?.textContent ?? '';
    });
    // Timer is formatted as HH:MM:SS
    expect(timerText).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test('arrow keys navigate in speaker view', async ({ page }) => {
    await page.goto('/?view=speaker');
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    });

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const current = await page.evaluate(
      () => (document.querySelector('geek-speaker-view') as any)?.currentIndex,
    );
    expect(current).toBe(1);
  });

  test('slide counter updates on navigation', async ({ page }) => {
    await page.goto('/?view=speaker');
    await page.waitForFunction(() => {
      const sv = document.querySelector('geek-speaker-view') as any;
      return sv?.currentIndex !== undefined;
    });

    const before = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      return sv?.shadowRoot?.querySelector('.counter')?.textContent ?? '';
    });
    expect(before).toContain('1 /');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const sv = document.querySelector('geek-speaker-view');
      return sv?.shadowRoot?.querySelector('.counter')?.textContent ?? '';
    });
    expect(after).toContain('2 /');
  });
});
