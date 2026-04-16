import { test, expect } from '@playwright/test';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForSlideshow(page): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
    return (ss?.slideCount ?? 0) > 0;
  });
}

async function openTerminal(page): Promise<void> {
  await page.keyboard.press('t');
  await page.waitForFunction(() => {
    const term = document.querySelector('geek-terminal') as HTMLElement | null;
    return term?.style.display === 'block';
  });
}

async function runTerminalCommand(page, command: string): Promise<void> {
  await openTerminal(page);
  await page.evaluate((value) => {
    const terminal = document.querySelector('geek-terminal');
    const input = terminal?.shadowRoot?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Terminal input not available');
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, command);
}

test.describe('Local Plugins', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?room=${uniqueRoom('local-plugins')}`);
    await waitForSlideshow(page);
  });

  test('loads a deck with local preprocessor and processor plugins', async ({ page }) => {
    await runTerminalCommand(page, 'load e2e/fixtures/local-plugins-deck/config.json');

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded');
    });

    // Wait for the new deck to finish loading
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return (ss?.slideCount ?? 0) > 0;
    });

    const state = await page.evaluate(() => {
      const slideshow = document.getElementById('slideshow') as { slideCount?: number; shadowRoot?: ShadowRoot } | null;
      const activeSlide = slideshow?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const content = activeSlide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;

      return {
        slideCount: slideshow?.slideCount ?? 0,
        // The preprocessor should have replaced "hello" with "HELLO"
        contentText: content?.textContent?.trim() ?? '',
        // The processor should have added data-highlighted="true"
        hasHighlightAttr: content?.getAttribute('data-highlighted') === 'true',
      };
    });

    expect(state.slideCount).toBeGreaterThan(0);
    expect(state.contentText).toContain('HELLO');
    expect(state.contentText).not.toContain('hello');
    expect(state.hasHighlightAttr).toBe(true);
  });

  test('local preprocessor transforms markdown content', async ({ page }) => {
    await runTerminalCommand(page, 'load e2e/fixtures/local-plugins-deck/config.json');

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded');
    });

    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return (ss?.slideCount ?? 0) > 0;
    });

    const text = await page.evaluate(() => {
      const slideshow = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot } | null;
      const slide = slideshow?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
      return content?.textContent ?? '';
    });

    // "hello world" should have been transformed to "HELLO world"
    expect(text).toContain('HELLO world');
  });

  test('local processor mutates slide DOM', async ({ page }) => {
    await runTerminalCommand(page, 'load e2e/fixtures/local-plugins-deck/config.json');

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded');
    });

    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return (ss?.slideCount ?? 0) > 0;
    });

    const highlighted = await page.evaluate(() => {
      const slideshow = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot } | null;
      const slide = slideshow?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
      return content?.getAttribute('data-highlighted');
    });

    expect(highlighted).toBe('true');
  });
});
