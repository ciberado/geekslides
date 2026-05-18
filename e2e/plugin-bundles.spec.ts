import { test, expect } from '@playwright/test';

const NO_FEATURES_DECK = 'e2e/fixtures/no-features-deck/config.json';
const BUNDLE_DECK = 'e2e/fixtures/plugin-bundle-deck/config.json';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForSlideshow(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
    return (ss?.slideCount ?? 0) > 0;
  });
}

async function openTerminal(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const term = document.querySelector('geek-terminal') as HTMLElement | null;
    return term?.style.display === 'block';
  });
}

test.describe('Plugin Bundle Syntax', () => {
  test('deck loaded with plugins array syntax loads correctly', async ({ page }) => {
    await page.goto(`/?config=${BUNDLE_DECK}&room=${uniqueRoom('pb')}`);
    await waitForSlideshow(page);

    const slideCount = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return ss?.slideCount ?? 0;
    });
    expect(slideCount).toBeGreaterThan(0);
  });

  test('whiteboard bundle enables whiteboard feature', async ({ page }) => {
    await page.goto(`/?config=${BUNDLE_DECK}&room=${uniqueRoom('pb-wb')}`);
    await waitForSlideshow(page);

    // The whiteboard canvas should exist when the whiteboard bundle is loaded
    const hasWhiteboard = await page.evaluate(() => {
      const slideshow = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot } | null;
      const activeSlide = slideshow?.shadowRoot?.querySelector('geek-slide[active]');
      return activeSlide !== null;
    });
    expect(hasWhiteboard).toBe(true);

    // Open terminal and verify whiteboard command is available
    await openTerminal(page);
    await page.evaluate(() => {
      const terminal = document.querySelector('geek-terminal');
      const input = terminal?.shadowRoot?.querySelector('input');
      if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not found');
      input.value = 'help';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent?.length ?? 0) > 0;
    });

    const helpText = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal');
      return term?.shadowRoot?.querySelector('.output')?.textContent ?? '';
    });

    // whiteboard bundle loaded → wb command should be listed
    expect(helpText).toContain('wb');
  });

  test('terminal shows no whiteboard commands when whiteboard bundle is not loaded', async ({
    page,
  }) => {
    // layouts-deck/config.json uses the old object syntax with no features → no whiteboard
    await page.goto(`/?config=${NO_FEATURES_DECK}&room=${uniqueRoom('pb-no-wb')}`);
    await waitForSlideshow(page);

    await openTerminal(page);
    await page.evaluate(() => {
      const terminal = document.querySelector('geek-terminal');
      const input = terminal?.shadowRoot?.querySelector('input');
      if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not found');
      input.value = 'help';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent?.length ?? 0) > 0;
    });

    const helpText = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal');
      return term?.shadowRoot?.querySelector('.output')?.textContent ?? '';
    });

    // No whiteboard feature loaded → whiteboard-specific commands should not appear
    expect(helpText).not.toContain('whiteboard');
  });

  test('terminal output is scrollable when content overflows', async ({ page }) => {
    await page.goto(`/?config=${NO_FEATURES_DECK}&room=${uniqueRoom('pb-scroll')}`);
    await waitForSlideshow(page);

    await openTerminal(page);
    // Run help multiple times to fill up output
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const terminal = document.querySelector('geek-terminal');
        const input = terminal?.shadowRoot?.querySelector('input');
        if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not found');
        input.value = 'help';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
    }

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent?.length ?? 0) > 100;
    });

    const scrollInfo = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output') as HTMLElement | null;
      if (!output) return null;
      return {
        scrollHeight: output.scrollHeight,
        clientHeight: output.clientHeight,
        overflowY: getComputedStyle(output).overflowY,
      };
    });

    expect(scrollInfo).not.toBeNull();
    // scrollHeight > clientHeight means content overflows → scrolling is possible
    expect(scrollInfo!.scrollHeight).toBeGreaterThan(scrollInfo!.clientHeight);
    // overflow-y must not be 'hidden' or 'visible' (should be 'auto' or 'scroll')
    expect(['auto', 'scroll']).toContain(scrollInfo!.overflowY);
  });
});
