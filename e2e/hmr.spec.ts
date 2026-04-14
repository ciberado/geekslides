import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appBaseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
const fixtureDir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/hmr-deck');
const fixtureMarkdownPath = resolve(fixtureDir, 'README.md');
const fixtureStylesPath = resolve(fixtureDir, 'local.css');
const fixtureConfigPath = resolve(fixtureDir, 'config.json');

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildFixtureUrl(room: string): string {
  const url = new URL('/', appBaseURL);
  url.searchParams.set('config', 'e2e/fixtures/hmr-deck/config.json');
  url.searchParams.set('room', room);
  return url.toString();
}

async function waitForSlideshow(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot; goTo?: unknown } | null;
    return Boolean(
      ss
      && typeof ss.goTo === 'function'
      && (ss.shadowRoot?.querySelectorAll('geek-slide').length ?? 0) > 0,
    );
  });
}

test.describe.serial('HMR Smoke', () => {
  test('markdown edits hot-reload and preserve slide position', async ({ page }) => {
    test.setTimeout(30000);
    const originalMarkdown = await readFile(fixtureMarkdownPath, 'utf8');

    try {
      await page.goto(buildFixtureUrl(uniqueRoom('hmr-md')));
      await waitForSlideshow(page);

      await page.evaluate(() => {
        (document.getElementById('slideshow') as { goTo: (slide: number) => void } | null)?.goTo(1);
        (window as typeof window & { __hmrProbe?: string }).__hmrProbe = 'alive';
      });

      await page.waitForFunction(
        () => ((document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? -1) === 1,
      );

      const updatedMarkdown = originalMarkdown.replace('Marker v1', 'Marker v2');
      await writeFile(fixtureMarkdownPath, updatedMarkdown, 'utf8');

      await page.waitForFunction(() => {
        const slideshow = document.getElementById('slideshow') as { currentSlide?: number; shadowRoot?: ShadowRoot } | null;
        const activeSlide = slideshow?.shadowRoot?.querySelector('geek-slide[active]');
        const text = activeSlide?.shadowRoot?.querySelector('section.content')?.textContent ?? '';
        return (slideshow?.currentSlide ?? -1) === 1 && text.includes('Marker v2');
      });

      const result = await page.evaluate(() => {
        const slideshow = document.getElementById('slideshow') as { currentSlide?: number } | null;
        return {
          currentSlide: slideshow?.currentSlide ?? -1,
          probe: (window as typeof window & { __hmrProbe?: string }).__hmrProbe,
        };
      });

      expect(result.currentSlide).toBe(1);
      expect(result.probe).toBe('alive');
    } finally {
      await writeFile(fixtureMarkdownPath, originalMarkdown, 'utf8');
    }
  });

  test('config title and stylesheet edits hot-apply without full reload', async ({ page }) => {
    test.setTimeout(30000);
    const originalConfig = await readFile(fixtureConfigPath, 'utf8');
    const originalStyles = await readFile(fixtureStylesPath, 'utf8');

    try {
      await page.goto(buildFixtureUrl(uniqueRoom('hmr-config')));
      await waitForSlideshow(page);

      await page.evaluate(() => {
        (window as typeof window & { __hmrProbe?: string }).__hmrProbe = 'alive';
      });

      const updatedConfig = originalConfig.replace('HMR Fixture', 'HMR Fixture Updated');
      await writeFile(fixtureConfigPath, updatedConfig, 'utf8');

      await page.waitForFunction(() => document.title === 'HMR Fixture Updated');

      await page.evaluate(() => {
        (document.getElementById('slideshow') as { goTo: (slide: number) => void } | null)?.goTo(1);
      });
      await page.waitForFunction(
        () => ((document.getElementById('slideshow') as { currentSlide?: number } | null)?.currentSlide ?? -1) === 1,
      );

      const updatedStyles = originalStyles.replace('rgb(12, 120, 40)', 'rgb(20, 40, 180)');
      await writeFile(fixtureStylesPath, updatedStyles, 'utf8');

      await page.waitForFunction(() => {
        const slideshow = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot } | null;
        const activeSlide = slideshow?.shadowRoot?.querySelector('geek-slide[active]');
        const heading = activeSlide?.shadowRoot?.querySelector('h2');
        return heading ? getComputedStyle(heading).color === 'rgb(20, 40, 180)' : false;
      });

      const result = await page.evaluate(() => {
        const slideshow = document.getElementById('slideshow') as { shadowRoot?: ShadowRoot } | null;
        const activeSlide = slideshow?.shadowRoot?.querySelector('geek-slide[active]');
        const heading = activeSlide?.shadowRoot?.querySelector('h2');
        return {
          title: document.title,
          headingColor: heading ? getComputedStyle(heading).color : '',
          probe: (window as typeof window & { __hmrProbe?: string }).__hmrProbe,
        };
      });

      expect(result.title).toBe('HMR Fixture Updated');
      expect(result.headingColor).toBe('rgb(20, 40, 180)');
      expect(result.probe).toBe('alive');
    } finally {
      await writeFile(fixtureConfigPath, originalConfig, 'utf8');
      await writeFile(fixtureStylesPath, originalStyles, 'utf8');
    }
  });
});