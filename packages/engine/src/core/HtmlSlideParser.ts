/**
 * HtmlSlideParser — parses a pptx-imported `slides.html` file into SlideData[].
 *
 * The Hub converts uploaded .pptx files to a flat HTML document composed of
 * <section> elements (one per slide) using the internal pptx2html fork. This
 * parser splits that document back into individual SlideData objects for the engine.
 *
 * All styles are inline in the converted output, so rawCss is never needed.
 * Backgrounds may be solid colours, gradients, or images — all are preserved
 * via `backgroundCss` (full CSS value) and `backgroundColor` (solid only, for
 * legacy consumers).
 */

import type { SlideData } from './SlideParser.ts';

export interface HtmlSlideParserOptions {
  /** Prefix for auto-generated slide IDs. Defaults to "pptx-slide". */
  readonly idPrefix?: string;
}

/**
 * Dimensions of the PPTX coordinate space extracted from the first slide.
 * The engine uses these to set its design dimensions so slides fill the viewport.
 */
export interface HtmlSlideDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Parse a pptx-to-html slides.html string into an array of SlideData.
 *
 * The input format is:
 *   <section style="width:960px; height:540px; background:#1B2A4A;">
 *     <!-- absolutely-positioned HTML with inline styles -->
 *   </section>
 *   <section ...> ... </section>
 *
 * This is a regex-based parser (no DOMParser) so it works in both browser
 * and Node.js headless contexts.
 */
export function parseHtmlSlides(
  html: string,
  options?: HtmlSlideParserOptions,
): SlideData[] {
  const idPrefix = options?.idPrefix ?? 'pptx-slide';
  const slides: SlideData[] = [];

  // Match each <section ...>...</section> block. The flag `s` (dotAll) lets
  // `.` match newlines. We use a non-greedy `[\s\S]*?` to avoid merging slides.
  const sectionRe = /<section([^>]*)>([\s\S]*?)<\/section>/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = sectionRe.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    let innerHtml = match[2] ?? '';

    const { backgroundColor, backgroundCss } = extractBackground(attrs);

    // Extract speaker notes injected by the Hub PPTX converter.
    // Format: <aside class="gs-notes">…html…</aside> at the end of the section.
    let notesHtml: string | undefined;
    const asideRe = /<aside class="gs-notes">([\s\S]*?)<\/aside>/;
    const asideMatch = asideRe.exec(innerHtml);
    if (asideMatch) {
      notesHtml = asideMatch[1];
      innerHtml = innerHtml.replace(asideRe, '').trim();
    }

    slides.push({
      id: `${idPrefix}-${String(index + 1)}`,
      html: innerHtml,
      classes: [],
      backgroundImage: undefined,
      backgroundColor,
      backgroundCss,
      rawCss: undefined,
      notesHtml,
      detailsHtml: undefined,
      partialCount: 0,
    } satisfies SlideData);

    index++;
  }

  return slides;
}

/**
 * Extract the slide coordinate-space dimensions from the first <section>'s
 * inline style. Returns undefined if no width/height is found.
 */
export function extractHtmlSlideDimensions(html: string): HtmlSlideDimensions | undefined {
  const firstSection = /<section([^>]*)>/.exec(html);
  if (!firstSection) return undefined;
  const attrs = firstSection[1] ?? '';
  const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/);
  if (!styleMatch) return undefined;
  const style = styleMatch[1] ?? '';
  const wMatch = style.match(/width\s*:\s*([\d.]+)px/);
  const hMatch = style.match(/height\s*:\s*([\d.]+)px/);
  if (!wMatch || !hMatch) return undefined;
  const width = parseFloat(wMatch[1] ?? '0');
  const height = parseFloat(hMatch[1] ?? '0');
  return width > 0 && height > 0 ? { width, height } : undefined;
}

/**
 * Extract background from a <section> opening tag's style attribute.
 * Returns `backgroundColor` for solid colour values (for Slide.ts compat)
 * and `backgroundCss` for the full CSS value (gradients, images, etc.).
 */
function extractBackground(attrs: string): {
  backgroundColor: string | undefined;
  backgroundCss: string | undefined;
} {
  const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/);
  if (!styleMatch) return { backgroundColor: undefined, backgroundCss: undefined };

  const style = styleMatch[1] ?? '';

  // background-color takes priority over shorthand background
  const bgColorMatch = style.match(/background-color\s*:\s*([^;]+)/);
  if (bgColorMatch) {
    const value = bgColorMatch[1]?.trim() ?? '';
    return { backgroundColor: value, backgroundCss: undefined };
  }

  const bgMatch = style.match(/(?<![a-z-])background\s*:\s*([^;]+)/);
  if (bgMatch) {
    const value = bgMatch[1]?.trim() ?? '';
    if (value.startsWith('url(')) {
      // Background image — use backgroundCss
      return { backgroundColor: undefined, backgroundCss: `background: ${value}` };
    }
    // Could be a solid colour or a gradient
    const isSolid = /^(#|rgb|rgba|hsl|hsla|[a-z]+$)/.test(value);
    if (isSolid) {
      return { backgroundColor: value, backgroundCss: undefined };
    }
    // Gradient or complex value
    return { backgroundColor: undefined, backgroundCss: `background: ${value}` };
  }

  return { backgroundColor: undefined, backgroundCss: undefined };
}
