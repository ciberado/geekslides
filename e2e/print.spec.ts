import { test, expect } from '@playwright/test';

test.describe('Print Rendering', () => {
  test('print command generates correct HTML', async ({ page }) => {
    // This tests the PrintRenderer via the engine API, not via WeasyPrint
    await page.goto('/');
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    // Verify we can access the parse + renderPrint functions
    const result = await page.evaluate(async () => {
      const { parse, renderPrint, DEFAULT_CONFIG } = await import('/packages/engine/src/index.ts');
      const slides = parse('## Slide 1\n\n[]()\n\n## Slide 2\n\n::: Notes\nSome notes\n:::\n');
      const html = renderPrint(slides, 'slides', DEFAULT_CONFIG);
      return {
        slideCount: slides.length,
        hasDoctype: html.includes('<!DOCTYPE html>'),
        hasSlideContent: html.includes('Slide 1') && html.includes('Slide 2'),
      };
    });

    expect(result.slideCount).toBe(2);
    expect(result.hasDoctype).toBe(true);
    expect(result.hasSlideContent).toBe(true);
  });

  test('slides-notes format includes notes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const ss = document.getElementById('slideshow') as any;
      return ss?.slideCount > 0;
    });

    const result = await page.evaluate(async () => {
      const { parse, renderPrint, DEFAULT_CONFIG } = await import('/packages/engine/src/index.ts');
      const slides = parse('## Slide 1\n\n::: Notes\nMy speaker notes here\n:::\n\n[]()\n\n## Slide 2\n');
      const html = renderPrint(slides, 'slides-notes', DEFAULT_CONFIG);
      return {
        hasNotes: html.includes('My speaker notes here'),
        hasNotesClass: html.includes('gs-notes'),
      };
    });

    expect(result.hasNotes).toBe(true);
    expect(result.hasNotesClass).toBe(true);
  });
});
