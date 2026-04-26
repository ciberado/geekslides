import { test, expect } from '@playwright/test';

const DECK = 'e2e/fixtures/layouts-deck/config.json';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForSlideshow(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as {
      slideCount?: number;
    } | null;
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

async function runTerminalCommand(
  page: Parameters<typeof test>[0]['page'],
  command: string,
): Promise<void> {
  await openTerminal(page);
  await page.evaluate((value) => {
    const terminal = document.querySelector('geek-terminal');
    const input = terminal?.shadowRoot?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Terminal input not available');
    }

    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, command);
}

test.describe('Terminal Command System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?config=${DECK}&room=${uniqueRoom('commands')}`);
    await waitForSlideshow(page);
  });

  test('pressing Escape opens the terminal', async ({ page }) => {
    await openTerminal(page);

    // Terminal should be visible in the DOM
    const visible = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display !== 'none';
    });
    expect(visible).toBe(true);
  });

  test('Escape closes the terminal', async ({ page }) => {
    await openTerminal(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'none';
    });

    const visible = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display !== 'none';
    });
    expect(visible).toBe(false);
  });

  test('typing help shows command list', async ({ page }) => {
    await runTerminalCommand(page, 'help');
    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('next');
    });

    const outputText = await page.evaluate(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return output?.textContent ?? '';
    });
    expect(outputText).toContain('next');
    expect(outputText).toContain('prev');
  });

  test('typing next advances slide', async ({ page }) => {
    await openTerminal(page);
    await page.keyboard.type('next');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => ((document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? 0) >= 1,
    );

    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBeGreaterThanOrEqual(1);
  });

  test('navigation still works after closing terminal', async ({ page }) => {
    // Open and close terminal
    await openTerminal(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal') as HTMLElement | null;
      return term?.style.display === 'none';
    });

    // Navigation should work
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      () => ((document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? 0) >= 1,
    );
    const current = await page.evaluate(
      () => (document.getElementById('slideshow') as any)?.currentSlide,
    );
    expect(current).toBeGreaterThanOrEqual(1);
  });

  test('load command switches to a new deck and resolves relative styles and images', async ({ page }) => {
    await runTerminalCommand(page, 'load e2e/fixtures/runtime-load-deck/config.json');

    await page.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Loaded: /e2e/fixtures/runtime-load-deck/config.json');
    });

    const state = await page.evaluate(() => {
      const slideshow = document.getElementById('slideshow') as { slideCount?: number; shadowRoot?: ShadowRoot } | null;
      const activeSlide = slideshow?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const heading = activeSlide?.shadowRoot?.querySelector('h1');
      const image = activeSlide?.shadowRoot?.querySelector('img') as HTMLImageElement | null;

      return {
        slideCount: slideshow?.slideCount ?? 0,
        headingText: heading?.textContent?.trim() ?? '',
        headingColor: heading ? getComputedStyle(heading).color : '',
        imageSrc: image?.src ?? '',
        imageWidth: image?.naturalWidth ?? 0,
      };
    });

    expect(state.slideCount).toBe(2);
    expect(state.headingText).toBe('Runtime Load Fixture');
    expect(state.headingColor).toBe('rgb(12, 34, 56)');
    expect(state.imageSrc).toContain('/e2e/fixtures/runtime-load-deck/badge.svg');
    expect(state.imageWidth).toBeGreaterThan(0);
  });

  test('room command moves the presenter to a new sync room', async ({ browser }) => {
    const context = await browser.newContext();
    const originalRoom = uniqueRoom('terminal-room-original');
    const newRoom = uniqueRoom('terminal-room-new');
    const presenterPage = await context.newPage();
    const oldRoomPage = await context.newPage();
    const newRoomPage = await context.newPage();

    await presenterPage.goto(`/?config=${DECK}&room=${originalRoom}`);
    await oldRoomPage.goto(`/?config=${DECK}&room=${originalRoom}`);

    await waitForSlideshow(presenterPage);
    await waitForSlideshow(oldRoomPage);

    await presenterPage.evaluate(() => {
      (document.getElementById('slideshow') as { goTo: (slide: number) => void } | null)?.goTo(1);
    });
    await oldRoomPage.waitForFunction(
      () => ((document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? -1) === 1,
    );

    await runTerminalCommand(presenterPage, `room ${newRoom}`);
    await presenterPage.waitForFunction(() => {
      const term = document.querySelector('geek-terminal');
      const output = term?.shadowRoot?.querySelector('.output');
      return (output?.textContent ?? '').includes('Room changed');
    });

    await presenterPage.evaluate(() => {
      (document.getElementById('slideshow') as { goTo: (slide: number) => void } | null)?.goTo(2);
    });

    await oldRoomPage.waitForTimeout(500);
    const oldRoomSlide = await oldRoomPage.evaluate(
      () => (document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? -1,
    );
    expect(oldRoomSlide).toBe(1);

    await newRoomPage.goto(`/?config=${DECK}&room=${newRoom}`);
    await waitForSlideshow(newRoomPage);
    await newRoomPage.waitForFunction(
      () => ((document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? -1) === 2,
    );

    const newRoomSlide = await newRoomPage.evaluate(
      () => (document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? -1,
    );
    expect(newRoomSlide).toBe(2);

    await context.close();
  });
});
