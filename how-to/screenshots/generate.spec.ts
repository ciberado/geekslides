import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Screenshot generator for the how-to tutorials.
 *
 * Run with:
 *   npx playwright test --config=how-to/screenshots/playwright.config.ts
 *
 * The dev server must be running (or let Playwright start it via the webServer config).
 * Screenshots are saved to how-to/screenshots/.
 */

const screenshotDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureConfig = 'how-to/screenshots/fixture/config.json';

function screenshotPath(name: string): string {
  return path.join(screenshotDir, `${name}.png`);
}

async function waitForSlideshow(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.waitForFunction(
    () => {
      const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
      return (ss?.slideCount ?? 0) > 0;
    },
    { timeout: 10000 },
  );
  // Give rendering a moment to settle
  await page.waitForTimeout(500);
}

async function openTerminal(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.keyboard.press('t');
  await page.waitForFunction(() => {
    const term = document.querySelector('geek-terminal') as HTMLElement | null;
    return term?.style.display === 'block';
  });
  await page.waitForTimeout(200);
}

async function goToSlide(
  page: Parameters<typeof test>[0]['page'],
  index: number,
): Promise<void> {
  await page.evaluate((i) => {
    const ss = document.getElementById('slideshow') as any;
    ss?.goTo(i);
  }, index);
  await page.waitForTimeout(400);
}

// ─── Screenshots ───────────────────────────────────────────────────

test.describe('How-To Screenshots', () => {
  test('dev-server-running — first slide of the fixture deck', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}`);
    await waitForSlideshow(page);

    await page.screenshot({ path: screenshotPath('dev-server-running') });
  });

  test('new-deck — a freshly scaffolded deck', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}`);
    await waitForSlideshow(page);

    // Show the first slide (title slide)
    await goToSlide(page, 0);
    await page.screenshot({ path: screenshotPath('new-deck') });
  });

  test('hmr-update — editing triggers a live update', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}`);
    await waitForSlideshow(page);

    // Navigate to the architecture slide (index 2)
    await goToSlide(page, 2);
    await page.screenshot({ path: screenshotPath('hmr-update') });
  });

  test('partial-reveals — items appearing one at a time', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}`);
    await waitForSlideshow(page);

    // Go to the partial slide (index 1)
    await goToSlide(page, 1);

    // Reveal a few partials
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    await page.screenshot({ path: screenshotPath('partial-reveals') });
  });

  test('terminal-open — the command terminal visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}`);
    await waitForSlideshow(page);

    await openTerminal(page);

    // Type a command to show something in the prompt
    const terminal = await page.evaluateHandle(() => document.querySelector('geek-terminal'));
    await page.evaluate((term) => {
      const input = (term as HTMLElement)?.shadowRoot?.querySelector('input');
      if (input instanceof HTMLInputElement) {
        input.value = 'help';
      }
    }, terminal);

    await page.screenshot({ path: screenshotPath('terminal-open') });
  });

  test('speaker-view — notes with current slide', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}&view=speaker`);

    await page.waitForFunction(
      () => {
        const sv = document.querySelector('geek-speaker-view') as any;
        return sv?.currentIndex !== undefined;
      },
      { timeout: 10000 },
    );
    await page.waitForTimeout(800);

    await page.screenshot({ path: screenshotPath('speaker-view') });
  });

  test('speaker-view-layout — speaker view from a later slide', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}&view=speaker`);

    await page.waitForFunction(
      () => {
        const sv = document.querySelector('geek-speaker-view') as any;
        return sv?.currentIndex !== undefined;
      },
      { timeout: 10000 },
    );
    await page.waitForTimeout(500);

    // Navigate to a slide with notes
    const sv = await page.evaluateHandle(() => document.querySelector('geek-speaker-view'));
    await page.evaluate((el) => {
      (el as any)?.goTo?.(1);
    }, sv);
    await page.waitForTimeout(600);

    await page.screenshot({ path: screenshotPath('speaker-view-layout') });
  });

  test('whiteboard — drawing annotations on a slide', async ({ page }) => {
    const room = `howto-wb-${Date.now().toString(36)}`;
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?config=${fixtureConfig}&room=${room}`);
    await waitForSlideshow(page);

    // Go to architecture slide
    await goToSlide(page, 2);

    // Enable whiteboard via terminal command
    await page.keyboard.press('t');
    await page.waitForTimeout(300);
    await page.keyboard.type('whiteboard');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Draw a circle-ish annotation
    const vw = 1280;
    const vh = 720;
    const cx = vw * 0.5;
    const cy = vh * 0.4;
    const r = 80;
    const steps = 24;

    await page.mouse.move(cx + r, cy);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      await page.mouse.move(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Draw an arrow
    await page.mouse.move(vw * 0.3, vh * 0.6);
    await page.mouse.down();
    await page.mouse.move(vw * 0.6, vh * 0.6);
    await page.mouse.up();
    await page.waitForTimeout(200);

    await page.screenshot({ path: screenshotPath('whiteboard') });
  });
});
