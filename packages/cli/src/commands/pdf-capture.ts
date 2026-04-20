/**
 * GeekSlides v2 — Slide screenshot capture.
 *
 * Opens a Chromium page at the presentation URL and captures a PNG
 * screenshot of each slide (with all partials revealed).
 * Extracted from pdf.ts for maintainability.
 */

import { join } from 'node:path';
import type { Browser } from 'playwright';
import type { SlideData } from '@geekslides/engine/headless';
import { createLogger } from '../logging.ts';

const log = createLogger('pdf');

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export async function captureSlideScreenshots(
  presentationUrl: string,
  slides: readonly SlideData[],
  tmpDir: string,
  browser: Browser,
): Promise<string[]> {
  const page = await browser.newPage();
  await page.setViewportSize({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT });
  await page.goto(presentationUrl, { waitUntil: 'networkidle' });

  // Wait for slides to load
  await page.waitForFunction(() => {
    const ss = document.querySelector('geek-slideshow');
    return ss && Number((ss as unknown as Record<string, unknown>)['slideCount']) > 0;
  }, { timeout: 15_000 });

  // Wait for all stylesheets (including @import Google Fonts) and fonts to finish loading
  await page.evaluate(async () => {
    // Wait for all stylesheets in <head> to load (catches hoisted @import font rules)
    const linkPromises = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => {
        if (el instanceof HTMLLinkElement && !el.sheet) {
          return new Promise<void>((resolve) => {
            el.addEventListener('load', () => { resolve(); }, { once: true });
            el.addEventListener('error', () => { resolve(); }, { once: true });
          });
        }
        return Promise.resolve();
      });
    await Promise.all(linkPromises);
    await document.fonts.ready;
  });

  // Disable slide transitions so screenshots are instant
  await page.evaluate(() => {
    const ss = document.querySelector('geek-slideshow');
    const container = ss?.shadowRoot?.querySelector<HTMLElement>('.gs-container');
    if (container) {
      container.style.setProperty('--gs-transition-duration', '0s');
    }
  });

  const paths: string[] = [];
  const total = slides.length;

  for (const [i, slide] of slides.entries()) {
    const partialCount = slide.partialCount;

    process.stdout.write(`  Capturing slide ${String(i + 1)}/${String(total)}...\r`);

    // Navigate to slide and reveal all partials
    await page.evaluate(
      ({ idx, pc }: { idx: number; pc: number }) => {
        const ss = document.querySelector('geek-slideshow') as HTMLElement & { goTo(idx: number, pc: number): void };
        ss.goTo(idx, pc);
      },
      { idx: i, pc: partialCount },
    );

    // Wait for all images in the active slide to finish loading
    await page.evaluate(async () => {
      const ss = document.querySelector('geek-slideshow');
      const slideEls = Array.from(ss?.shadowRoot?.querySelectorAll('geek-slide') ?? []);
      for (const slide of slideEls) {
        if (!slide.hasAttribute('active')) continue;
        const imgs = Array.from(slide.shadowRoot?.querySelectorAll('img') ?? []);
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => { resolve(); }, { once: true });
                  img.addEventListener('error', () => { resolve(); }, { once: true });
                }),
          ),
        );
      }
      await document.fonts.ready;
    });

    const imgPath = join(tmpDir, `slide-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: imgPath, type: 'png' });
    log.trace({ slide: i + 1, total }, 'slide captured');
    paths.push(imgPath);
  }

  console.log(`  Captured ${String(total)} slides.`);

  await page.close();
  return paths;
}
