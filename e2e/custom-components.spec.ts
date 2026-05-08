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
  await page.keyboard.press('Escape');
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

const INITIAL_DECK = 'e2e/fixtures/layouts-deck/config.json';
const COMPONENTS_DECK = 'e2e/fixtures/custom-components-deck/config.json';

test.describe('Custom Components (config.scripts)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?config=${INITIAL_DECK}&room=${uniqueRoom('custom-cmp')}`);
    await waitForSlideshow(page);
  });

  test('loads a custom component from config.scripts and renders it in slide DOM', async ({ page }) => {
    await runTerminalCommand(page, `load ${COMPONENTS_DECK}`);

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded');
    });

    await waitForSlideshow(page);

    const state = await page.evaluate(() => {
      const slideshow = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot } | null;
      const slide = slideshow?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;

      const widget = content?.querySelector('test-widget') as HTMLElement | null;
      const widgetRoot = widget?.querySelector('.test-widget-root') as HTMLElement | null;

      return {
        hasWidget: widget !== null,
        widgetText: widgetRoot?.textContent ?? '',
        widgetDataInit: widgetRoot?.getAttribute('data-init') ?? '',
      };
    });

    expect(state.hasWidget).toBe(true);
    expect(state.widgetText).toBe('Widget loaded');
    expect(state.widgetDataInit).toBe('true');
  });

  test('calls the init() export of loaded scripts', async ({ page }) => {
    await runTerminalCommand(page, `load ${COMPONENTS_DECK}`);

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded');
    });

    await waitForSlideshow(page);

    const hasInitAttr = await page.evaluate(() => {
      return document.body.getAttribute('data-scripts-init') === 'true';
    });

    expect(hasInitAttr).toBe(true);
  });

  test('deck without scripts loads normally', async ({ page }) => {
    // The initial deck (layouts-deck) has no scripts field.
    // Verify it loaded fine and there are slides.
    const slideCount = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return ss?.slideCount ?? 0;
    });

    expect(slideCount).toBeGreaterThan(0);
  });

  test('window.__geekslides is available for custom components', async ({ page }) => {
    await runTerminalCommand(page, `load ${COMPONENTS_DECK}`);

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded');
    });

    await waitForSlideshow(page);

    const geekslidesApi = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gs = (window as any).__geekslides;
      return {
        exists: gs !== undefined && gs !== null,
        hasPatternRegistry: typeof gs?.patternRegistry === 'object',
        hasBuildColorVars: typeof gs?.buildColorVars === 'function',
        hasParseDoodleConfig: typeof gs?.parseDoodleConfig === 'function',
      };
    });

    expect(geekslidesApi.exists).toBe(true);
    expect(geekslidesApi.hasPatternRegistry).toBe(true);
    expect(geekslidesApi.hasBuildColorVars).toBe(true);
    expect(geekslidesApi.hasParseDoodleConfig).toBe(true);
  });
});
