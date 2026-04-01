import { test, expect } from '@playwright/test';

test.describe('Terminal Command System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });
  });

  test('pressing t opens the terminal', async ({ page }) => {
    await page.keyboard.press('t');
    await page.waitForTimeout(200);

    // Terminal should be visible in the DOM
    const visible = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display !== 'none';
    });
    expect(visible).toBe(true);
  });

  test('Escape closes the terminal', async ({ page }) => {
    await page.keyboard.press('t');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const visible = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display !== 'none';
    });
    expect(visible).toBe(false);
  });

  test('typing help shows command list', async ({ page }) => {
    await page.keyboard.press('t');
    await page.waitForTimeout(200);
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const outputText = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return output?.textContent ?? '';
    });
    expect(outputText).toContain('next');
    expect(outputText).toContain('prev');
  });

  test('typing next advances slide', async ({ page }) => {
    await page.keyboard.press('t');
    await page.waitForTimeout(200);
    await page.keyboard.type('next');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBeGreaterThanOrEqual(1);
  });

  test('navigation still works after closing terminal', async ({ page }) => {
    // Open and close terminal
    await page.keyboard.press('t');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Navigation should work
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBeGreaterThanOrEqual(1);
  });
});
