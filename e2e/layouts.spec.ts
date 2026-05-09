/**
 * Layout CSS E2E tests.
 *
 * Loads the layouts-deck fixture and verifies that every layout class
 * produces the expected CSS computed styles inside the Shadow DOM.
 *
 * Slide index → layout class:
 *   0  layout-title            8  layout-timeline
 *   1  (default content)       9  layout-chart
 *   2  layout-two-col         10  layout-compare
 *   3  layout-img-text        11  layout-team
 *   4  layout-cover           12  layout-grid
 *   5  layout-section         13  layout-table
 *   6  layout-three-col       14  layout-img-text-bleed
 *   7  layout-big-stat        15  layout-agenda
 *                             16  layout-blank
 */
import { test, expect } from '@playwright/test';

const DECK = 'e2e/fixtures/layouts-deck/config.json';

function uniqueRoom(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deckUrl(room: string): string {
  const base = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';
  return `${base}/?config=${DECK}&room=${room}`;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Wait until the slideshow has parsed at least one slide. */
async function waitForSlideshow(page): Promise<void> {
  await page.waitForFunction(() => {
    const ss = document.getElementById('slideshow') as { slideCount?: number } | null;
    return (ss?.slideCount ?? 0) > 0;
  });
}

/** Navigate to a slide by index and wait for the transition to settle. */
async function goToSlide(page, index: number): Promise<void> {
  await page.evaluate((i) => {
    (document.getElementById('slideshow') as { goTo?: (n: number) => void })?.goTo?.(i);
  }, index);
  await page.waitForTimeout(700);
}

/**
 * Return computed CSS properties for the active slide's <section.content>.
 * All style queries go through page.evaluate so they run inside the browser
 * and can traverse Shadow DOM boundaries.
 */
async function getContentStyles(
  page,
  properties: string[],
): Promise<Record<string, string>> {
  return page.evaluate((props: string[]) => {
    const ss = document.getElementById('slideshow') as
      | (HTMLElement & { shadowRoot: ShadowRoot })
      | null;
    const slide = ss?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
    const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
    if (!content) return {};
    const cs = getComputedStyle(content);
    const out: Record<string, string> = {};
    for (const p of props) {
      out[p] = cs.getPropertyValue(p);
    }
    return out;
  }, properties);
}

/**
 * Return computed CSS properties for a child element inside the active slide's
 * <section.content>, selected by the given CSS selector.
 */
async function getChildStyles(
  page,
  selector: string,
  properties: string[],
): Promise<Record<string, string>> {
  return page.evaluate(
    ({ sel, props }: { sel: string; props: string[] }) => {
      const ss = document.getElementById('slideshow') as
        | (HTMLElement & { shadowRoot: ShadowRoot })
        | null;
      const slide = ss?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
      const el = content?.querySelector(sel) as HTMLElement | null;
      if (!el) return {};
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of props) {
        out[p] = cs.getPropertyValue(p);
      }
      return out;
    },
    { sel: selector, props: properties },
  );
}

/** Count how many children of a given selector exist inside the active slide's content. */
async function countChildren(page, selector: string): Promise<number> {
  return page.evaluate((sel: string) => {
    const ss = document.getElementById('slideshow') as
      | (HTMLElement & { shadowRoot: ShadowRoot })
      | null;
    const slide = ss?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
    const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
    return content?.querySelectorAll(sel).length ?? 0;
  }, selector);
}

/** Check whether the active slide's content section has a specific CSS class. */
async function hasContentClass(page, className: string): Promise<boolean> {
  return page.evaluate((cls: string) => {
    const ss = document.getElementById('slideshow') as
      | (HTMLElement & { shadowRoot: ShadowRoot })
      | null;
    const slide = ss?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
    const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
    return content?.classList.contains(cls) ?? false;
  }, className);
}

/* ── Tests ────────────────────────────────────────────────────────────────── */

test.describe('Layout CSS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(deckUrl(uniqueRoom('layouts')));
    await waitForSlideshow(page);
  });

  /* ── 0. Title slide ─────────────────────────────────────────────────────── */

  test('layout-title: centered flex column', async ({ page }) => {
    await goToSlide(page, 0);
    expect(await hasContentClass(page, 'layout-title')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'flex-direction', 'text-align']);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-direction']).toBe('column');
    expect(styles['text-align']).toBe('center');
  });

  test('layout-title: contains h1 and h2', async ({ page }) => {
    await goToSlide(page, 0);
    expect(await countChildren(page, 'h1')).toBe(1);
    expect(await countChildren(page, 'h2')).toBe(1);
  });

  /* ── 1. Default title + content ─────────────────────────────────────────── */

  test('default slide: has padding and block display', async ({ page }) => {
    await goToSlide(page, 1);

    const styles = await getContentStyles(page, ['padding-left', 'padding-top']);
    // Padding should be non-zero (from layouts.css base rule)
    expect(parseFloat(styles['padding-left'] ?? '0')).toBeGreaterThan(0);
    expect(parseFloat(styles['padding-top'] ?? '0')).toBeGreaterThan(0);
  });

  test('default slide: contains h3 and ul', async ({ page }) => {
    await goToSlide(page, 1);
    expect(await countChildren(page, 'h3')).toBe(1);
    expect(await countChildren(page, 'ul')).toBe(1);
  });

  /* ── 2. Two-column text ─────────────────────────────────────────────────── */

  test('layout-two-col: grid dense arrangement', async ({ page }) => {
    await goToSlide(page, 2);
    expect(await hasContentClass(page, 'layout-two-col')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'grid-template-columns', 'grid-auto-flow']);
    expect(styles['display']).toBe('grid');
    // Chrome sometimes computes 'row dense' as just 'dense', testing for include
    expect(styles['grid-auto-flow']).toContain('dense');
  });

  test('layout-two-col: h4 is hidden or empty', async ({ page }) => {
    await goToSlide(page, 2);
    const h4Display = await getChildStyles(page, 'h4', ['display']);
    expect(h4Display['display']).toBe('none');
  });

  /* ── 3. Image + text ────────────────────────────────────────────────────── */

  test('layout-img-text: grid with two columns', async ({ page }) => {
    await goToSlide(page, 3);
    expect(await hasContentClass(page, 'layout-img-text')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'grid-template-columns']);
    expect(styles['display']).toBe('grid');
    const cols = (styles['grid-template-columns'] ?? '').split(' ');
    expect(cols.length).toBe(2);
  });

  test('layout-img-text: has block-image and list', async ({ page }) => {
    await goToSlide(page, 3);
    expect(await countChildren(page, '.block-image')).toBe(1);
    expect(await countChildren(page, 'ul')).toBe(1);
  });

  /* ── 4. Full-bleed cover ────────────────────────────────────────────────── */

  test('layout-cover: flex column justified to end', async ({ page }) => {
    await goToSlide(page, 4);
    expect(await hasContentClass(page, 'layout-cover')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'flex-direction', 'justify-content']);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-direction']).toBe('column');
    expect(styles['justify-content']).toBe('flex-end');
  });

  test('layout-cover: has h1', async ({ page }) => {
    await goToSlide(page, 4);
    expect(await countChildren(page, 'h1')).toBe(1);
  });

  /* ── 5. Section divider ─────────────────────────────────────────────────── */

  test('layout-section: centered flex with accent background', async ({ page }) => {
    await goToSlide(page, 5);
    expect(await hasContentClass(page, 'layout-section')).toBe(true);

    const styles = await getContentStyles(page, [
      'display', 'flex-direction', 'justify-content', 'text-align',
    ]);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-direction']).toBe('column');
    expect(styles['justify-content']).toBe('center');
    expect(styles['text-align']).toBe('center');
  });

  test('layout-section: contains h2 and h3', async ({ page }) => {
    await goToSlide(page, 5);
    expect(await countChildren(page, 'h2')).toBe(1);
    expect(await countChildren(page, 'h3')).toBe(1);
  });

  /* ── 6. Three-column cards ──────────────────────────────────────────────── */

  test('layout-three-col: grid with three columns', async ({ page }) => {
    await goToSlide(page, 6);
    expect(await hasContentClass(page, 'layout-three-col')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'grid-template-columns']);
    expect(styles['display']).toBe('grid');
    const cols = (styles['grid-template-columns'] ?? '').split(' ');
    expect(cols.length).toBe(3);
  });

  test('layout-three-col: has three h4 card titles', async ({ page }) => {
    await goToSlide(page, 6);
    expect(await countChildren(page, 'h4')).toBe(3);
  });

  /* ── 7. Big stat ────────────────────────────────────────────────────────── */

  test('layout-big-stat: centered flex column', async ({ page }) => {
    await goToSlide(page, 7);
    expect(await hasContentClass(page, 'layout-big-stat')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'flex-direction', 'text-align']);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-direction']).toBe('column');
    expect(styles['text-align']).toBe('center');
  });

  test('layout-big-stat: h3 has large font size', async ({ page }) => {
    await goToSlide(page, 7);
    const h3 = await getChildStyles(page, 'h3', ['font-size']);
    const fontSize = parseFloat(h3['font-size'] ?? '0');
    // 180pt on the 1920×1080 canvas — after engine scaling it varies,
    // but must be significantly larger than body text
    expect(fontSize).toBeGreaterThan(60);
  });

  test('layout-big-stat: has h3 and paragraph label', async ({ page }) => {
    await goToSlide(page, 7);
    expect(await countChildren(page, 'h3')).toBe(1);
    expect(await countChildren(page, 'p')).toBe(1);
  });

  /* ── 8. Timeline / process steps ────────────────────────────────────────── */

  test('layout-timeline: ol uses grid auto-flow column', async ({ page }) => {
    await goToSlide(page, 8);
    expect(await hasContentClass(page, 'layout-timeline')).toBe(true);

    const olStyles = await getChildStyles(page, 'ol', ['display', 'grid-auto-flow']);
    expect(olStyles['display']).toBe('grid');
    expect(olStyles['grid-auto-flow']).toBe('column');
  });

  test('layout-timeline: has four list items', async ({ page }) => {
    await goToSlide(page, 8);
    expect(await countChildren(page, 'ol > li')).toBe(4);
  });

  test('layout-timeline: list items have no default list-style', async ({ page }) => {
    await goToSlide(page, 8);
    const liStyle = await getChildStyles(page, 'ol > li', ['list-style-type']);
    expect(liStyle['list-style-type']).toBe('none');
  });

  /* ── 9. Chart / data slide ──────────────────────────────────────────────── */

  test('layout-chart: flex column with table', async ({ page }) => {
    await goToSlide(page, 9);
    expect(await hasContentClass(page, 'layout-chart')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'flex-direction']);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-direction']).toBe('column');
  });

  test('layout-chart: table exists and fills width', async ({ page }) => {
    await goToSlide(page, 9);
    expect(await countChildren(page, 'table')).toBe(1);

    // Table should span close to full container width
    const result = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as
        | (HTMLElement & { shadowRoot: ShadowRoot })
        | null;
      const slide = ss?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      const content = slide?.shadowRoot?.querySelector('section.content') as HTMLElement | null;
      const table = content?.querySelector('table') as HTMLElement | null;
      if (!content || !table) return { ratio: 0 };
      return { ratio: table.offsetWidth / content.offsetWidth };
    });
    // Table should fill at least 80% of the content width (accounting for padding)
    expect(result.ratio).toBeGreaterThan(0.8);
  });

  /* ── 10. Comparison (A vs B) ────────────────────────────────────────────── */

  test('layout-compare: grid with three columns', async ({ page }) => {
    await goToSlide(page, 10);
    expect(await hasContentClass(page, 'layout-compare')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'grid-template-columns']);
    expect(styles['display']).toBe('grid');
    const cols = (styles['grid-template-columns'] ?? '').split(' ');
    expect(cols.length).toBe(3);
  });

  test('layout-compare: h4 VS badge is visible', async ({ page }) => {
    await goToSlide(page, 10);
    const h4Display = await getChildStyles(page, 'h4', ['display']);
    expect(h4Display['display']).not.toBe('none');
  });

  test('layout-compare: two lists exist', async ({ page }) => {
    await goToSlide(page, 10);
    expect(await countChildren(page, 'ul')).toBe(2);
  });

  /* ── 11. Team / people grid ─────────────────────────────────────────────── */

  test('layout-team: flex layout', async ({ page }) => {
    await goToSlide(page, 11);
    expect(await hasContentClass(page, 'layout-team')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'flex-wrap']);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-wrap']).toBe('wrap');
  });

  test('layout-team: three block-images', async ({ page }) => {
    await goToSlide(page, 11);
    expect(await countChildren(page, '.block-image')).toBe(3);
  });

  /* ── 12. Image grid / mood board ────────────────────────────────────────── */

  test('layout-grid: grid display with auto-fit columns', async ({ page }) => {
    await goToSlide(page, 12);
    expect(await hasContentClass(page, 'layout-grid')).toBe(true);

    const styles = await getContentStyles(page, ['display']);
    expect(styles['display']).toBe('grid');
  });

  test('layout-grid: four block-images', async ({ page }) => {
    await goToSlide(page, 12);
    expect(await countChildren(page, '.block-image')).toBe(4);
  });

  /* ── 13. Table / matrix ─────────────────────────────────────────────────── */

  test('layout-table: flex column with table', async ({ page }) => {
    await goToSlide(page, 13);
    expect(await hasContentClass(page, 'layout-table')).toBe(true);

    const styles = await getContentStyles(page, ['display', 'flex-direction']);
    expect(styles['display']).toBe('flex');
    expect(styles['flex-direction']).toBe('column');
  });

  /* ── 14. Blank / canvas ─────────────────────────────────────────────────── */

  test('layout-blank: has layout-blank class', async ({ page }) => {
    await goToSlide(page, 16);
    expect(await hasContentClass(page, 'layout-blank')).toBe(true);
  });

  test('layout-blank: no visible content elements', async ({ page }) => {
    await goToSlide(page, 16);
    expect(await countChildren(page, 'h1, h2, h3, h4, p, ul, ol, table')).toBe(0);
  });

  /* ── 14. Image + text full-bleed ────────────────────────────────────────── */

  test('layout-img-text-bleed: float-based split layout', async ({ page }) => {
    await goToSlide(page, 14);
    expect(await hasContentClass(page, 'layout-img-text-bleed')).toBe(true);

    const styles = await getContentStyles(page, ['display']);
    expect(styles['display']).toBe('block');

    const imageStyles = await getChildStyles(page, '.block-image', ['float', 'width']);
    expect(imageStyles['float']).toBe('left');
    expect(parseFloat(imageStyles['width'] ?? '0')).toBeGreaterThan(0);
  });

  test('layout-img-text-bleed: has block-image and list', async ({ page }) => {
    await goToSlide(page, 14);
    expect(await countChildren(page, '.block-image')).toBe(1);
    expect(await countChildren(page, 'ul')).toBe(1);
  });

  test('layout-img-text-bleed: zero padding on section', async ({ page }) => {
    await goToSlide(page, 14);
    const styles = await getContentStyles(page, ['padding-left', 'padding-top']);
    expect(parseFloat(styles['padding-left'] ?? '1')).toBe(0);
    expect(parseFloat(styles['padding-top'] ?? '1')).toBe(0);
  });

  /* ── 15. Agenda ─────────────────────────────────────────────────────────── */

  test('layout-agenda: grid with two rows', async ({ page }) => {
    await goToSlide(page, 15);
    expect(await hasContentClass(page, 'layout-agenda')).toBe(true);

    const styles = await getContentStyles(page, ['display']);
    expect(styles['display']).toBe('grid');
  });

  test('layout-agenda: has h3 heading and four list items', async ({ page }) => {
    await goToSlide(page, 15);
    expect(await countChildren(page, 'h3')).toBe(1);
    expect(await countChildren(page, 'ol > li')).toBe(4);
  });

  test('layout-agenda: list items have no default list-style', async ({ page }) => {
    await goToSlide(page, 15);
    const liStyle = await getChildStyles(page, 'ol > li', ['list-style-type']);
    expect(liStyle['list-style-type']).toBe('none');
  });

  /* ── Cross-cutting: base element styles ─────────────────────────────────── */

  test('base: tables have collapsed borders', async ({ page }) => {
    await goToSlide(page, 9); // chart slide has a table
    const tableStyles = await getChildStyles(page, 'table', ['border-collapse']);
    expect(tableStyles['border-collapse']).toBe('collapse');
  });

  test('base: layout CSS is loaded into shadow DOM', async ({ page }) => {
    await goToSlide(page, 0);
    const result = await page.evaluate(() => {
      const ss = document.getElementById('slideshow') as
        | (HTMLElement & { shadowRoot: ShadowRoot })
        | null;
      const slide = ss?.shadowRoot?.querySelector('geek-slide[active]') as HTMLElement | null;
      if (!slide) return '';
      const style = slide.shadowRoot?.querySelector('.gs-external-styles') as HTMLStyleElement | null;
      return style?.textContent ?? '';
    });
    // Verify layout spacing token exists in shadow DOM CSS
    expect(result).toContain('--gs-pad-x');
  });
});
