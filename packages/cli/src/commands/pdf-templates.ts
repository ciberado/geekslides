/**
 * GeekSlides v2 — PDF template builders.
 *
 * Functions that assemble HTML documents for PDF rendering via Playwright.
 * Extracted from pdf.ts for maintainability.
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import type { DetailsLayout, SlideData } from '@geekslides/engine/headless';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- PDF assembly: slides --------------------------------------- */

export function buildSlidesPdfHtml(screenshotPaths: string[]): string {
  const imgs = screenshotPaths
    .map((p) => `<div class="page"><img src="${pathToFileURL(p).href}"></div>`)
    .join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: 508mm 285.75mm; margin: 0; }
* { margin: 0; padding: 0; }
.page { page-break-after: always; width: 508mm; height: 285.75mm; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.page img { display: block; width: 100%; height: 100%; object-fit: contain; }
</style></head><body>${imgs}</body></html>`;
}

/* ---------- PDF assembly: slides-details ------------------------------- */

export function buildDetailsPdfHtml(
  screenshotPaths: string[],
  slides: readonly SlideData[],
  layout: DetailsLayout,
): string {
  const isHorizontal = layout === 'horizontal';
  const lastIdx = slides.length - 1;
  const pages = slides.map((slide, i) => {
    const screenshotPath = screenshotPaths[i] ?? '';
    const imgSrc = pathToFileURL(screenshotPath).href;
    const hasDetails = Boolean(slide.detailsHtml);
    const isHero = !hasDetails && (i === 0 || i === lastIdx);
    const detailsClass = isHero ? 'hero' : (hasDetails ? 'has-details' : 'no-details');
    const layoutClass = isHorizontal ? 'horizontal' : 'vertical';
    const details = hasDetails
      ? `<div class="details"><div class="details-inner">${slide.detailsHtml ?? ''}</div></div>`
      : '';
    return `<div class="page ${detailsClass} ${layoutClass}"><div class="thumb"><img src="${imgSrc}"></div>${details}</div>`;
  }).join('\n');

  const pageSize = isHorizontal ? 'A4 landscape' : 'A4';
  const pageMargin = isHorizontal ? '10mm' : '15mm';
  const usableW = isHorizontal ? '277mm' : '180mm';
  const usableH = isHorizontal ? '190mm' : '267mm';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: ${pageSize}; margin: ${pageMargin}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 12pt; line-height: 1.5; color: #333; }
.page { page-break-after: always; page-break-inside: avoid;
  height: ${usableH}; display: flex; overflow: hidden; }
.page:last-child { page-break-after: auto; }

/* Hero slides (first/last without details): full-page centred, 16:9 preserved */
.page.hero { align-items: center; justify-content: center; }
.page.hero .thumb { width: 100%; }
.page.hero .thumb img { width: 100%; height: auto; border: none; border-radius: 0; }

/* No details: slide at top (vertical) or left-aligned + vertically centred (horizontal) */
.page.no-details:not(.hero) { flex-direction: column; align-items: stretch; }
.page.horizontal.no-details:not(.hero) { flex-direction: row; align-items: center; }
.page.no-details:not(.hero) .thumb { width: 100%; }
.page.no-details:not(.hero) .thumb img { object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }
.page.horizontal.no-details:not(.hero) .thumb { flex-shrink: 0; width: 140mm; }
.page.horizontal.no-details:not(.hero) .thumb img { width: 140mm; height: 78.75mm; }

/* Horizontal layout (landscape page: slide left, details right, both vertically centred) */
.page.horizontal.has-details { flex-direction: row; align-items: center; gap: 6mm; }
.page.horizontal.has-details .thumb { flex-shrink: 0; width: 140mm; }
.page.horizontal.has-details .thumb img { width: 140mm; height: 78.75mm; object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }
.page.horizontal.has-details .details { flex: 1; min-width: 0; overflow: hidden; }

/* Vertical layout (portrait page: slide at top, details below) */
.page.vertical:not(.hero) { flex-direction: column; align-items: stretch; gap: 5mm; }
.page.vertical:not(.hero) .thumb { flex-shrink: 0; width: ${usableW}; }
.page.vertical:not(.hero) .thumb img { width: ${usableW}; object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }
.page.vertical .details { flex: 1; min-width: 0; overflow: hidden; }

.details-inner { font-size: 12pt; line-height: 1.5; }
.details-inner h1 { font-size: 16pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner h2 { font-size: 14pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner h3 { font-size: 13pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner h4 { font-size: 12pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner p { margin: 0 0 0.3em; }
.details-inner p:last-child { margin-bottom: 0; }
.details-inner ul, .details-inner ol { margin: 0.2em 0; padding-left: 1.2em; }
.details-inner li { margin-bottom: 0.1em; }
.details-inner code { font-family: ui-monospace, monospace; font-size: 0.85em; background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 3px; }
.details-inner a { color: #4a9eff; text-decoration: none; }
</style></head><body>${pages}</body></html>`;
}

/* ---------- PDF assembly: slides-notes --------------------------------- */

export function buildNotesPdfHtml(
  screenshotPaths: string[],
  slides: readonly SlideData[],
): string {
  const pages = slides.map((slide, i) => {
    const screenshotPath = screenshotPaths[i] ?? '';
    const imgSrc = pathToFileURL(screenshotPath).href;
    const notes = slide.notesHtml
      ? `<aside class="notes">${slide.notesHtml}</aside>`
      : '';
    return `<div class="page"><div class="thumb"><img src="${imgSrc}"></div>${notes}</div>`;
  }).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 20mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 9pt; line-height: 1.5; color: #444; }
.page { page-break-after: always; page-break-inside: avoid; }
.page:last-child { page-break-after: auto; }
.thumb img { width: 170mm; height: 95.6mm; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 5mm; }
.notes { font-size: 9pt; line-height: 1.5; padding: 3mm 0; border-top: 2px solid #4a9eff; }
</style></head><body>${pages}</body></html>`;
}

/* ---------- PDF assembly: book ----------------------------------------- */

/** Extract the first heading element from rendered slide HTML. */
export function extractHeadingFromHtml(html: string): { level: number; innerHtml: string } | null {
  const m = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/i.exec(html);
  if (!m) return null;
  return { level: parseInt(m[1] ?? '1', 10), innerHtml: m[2] ?? '' };
}

/** Resolve a potentially relative image src to a file:// URL using the deck directory. */
export function resolveImageToFileUrl(src: string, deckDir: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('file://')) return src;
  if (src.startsWith('/')) return pathToFileURL(src).href;
  return pathToFileURL(join(deckDir, src)).href;
}

/**
 * Find the first image for a slide's book page.
 * Priority: inline <img> in slide.html → backgroundImage field → null.
 * Only used when the slide has details (separator/title-only pages stay clean).
 */
export function extractFirstBookImage(slide: SlideData, deckDir: string): string | null {
  const inlineMatch = /<img[^>]+src="([^"]+)"/i.exec(slide.html);
  if (inlineMatch?.[1]) return resolveImageToFileUrl(inlineMatch[1], deckDir);
  if (slide.backgroundImage) return resolveImageToFileUrl(slide.backgroundImage, deckDir);
  return null;
}

export function buildBookPdfHtml(
  slides: readonly SlideData[],
  title: string,
  deckDir: string,
  imageWidthPct: number,
): string {
  const imgWidthCss = `${String(imageWidthPct)}%`;
  const sections: string[] = [];
  let firstH1Seen = false;

  for (const slide of slides) {
    const hasDetails = Boolean(slide.detailsHtml);
    const heading = extractHeadingFromHtml(slide.html);
    const level = heading?.level ?? 4;

    if (level === 1) {
      const pageBreakClass = firstH1Seen ? ' page-break' : '';
      firstH1Seen = true;
      const imageUrl = hasDetails ? extractFirstBookImage(slide, deckDir) : null;
      const imgHtml = imageUrl ? `<figure class="book-img"><img src="${imageUrl}" alt=""></figure>` : '';
      const detailsContent = hasDetails ? `<div class="book-details">${imgHtml}${slide.detailsHtml ?? ''}</div>` : '';
      sections.push(
        `<section class="book-section level-1${pageBreakClass}">` +
        `<h1 class="book-h1">${heading?.innerHtml ?? ''}</h1>` +
        detailsContent +
        `</section>`,
      );
    } else if (level === 2) {
      if (!hasDetails) {
        sections.push(
          `<section class="book-section level-2 separator">` +
          `<h2 class="book-h2">${heading?.innerHtml ?? ''}</h2>` +
          `</section>`,
        );
      } else {
        const imageUrl = extractFirstBookImage(slide, deckDir);
        const imgHtml = imageUrl ? `<figure class="book-img"><img src="${imageUrl}" alt=""></figure>` : '';
        sections.push(
          `<section class="book-section level-2">` +
          `<h2 class="book-h2">${heading?.innerHtml ?? ''}</h2>` +
          `<div class="book-details">${imgHtml}${slide.detailsHtml ?? ''}</div>` +
          `</section>`,
        );
      }
    } else {
      // h3 or deeper (or no heading at all)
      if (!hasDetails) continue;
      const imageUrl = extractFirstBookImage(slide, deckDir);
      const imgHtml = imageUrl ? `<figure class="book-img"><img src="${imageUrl}" alt=""></figure>` : '';
      const headingHtml = heading ? `<h3 class="book-h3">${heading.innerHtml}</h3>` : '';
      sections.push(
        `<section class="book-section level-3">` +
        headingHtml +
        `<div class="book-details">${imgHtml}${slide.detailsHtml ?? ''}</div>` +
        `</section>`,
      );
    }
  }

  const css = `
@page { size: A4; margin: 20mm 20mm 25mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.65; color: #1a1a1a; }

/* Deck title masthead */
.book-masthead { font-size: 9pt; font-family: system-ui, -apple-system, sans-serif;
  font-variant: small-caps; letter-spacing: 0.08em; color: #888; margin-bottom: 2em;
  padding-bottom: 0.5em; border-bottom: 1px solid #ddd; }

/* Chapter openers (h1 slides) */
.book-section.level-1 { margin-bottom: 1.5em; }
.book-section.level-1.page-break { page-break-before: always; }
.book-h1 { font-size: 22pt; font-weight: 700; color: #1a3e6e;
  border-bottom: 2px solid #1a3e6e; padding-bottom: 0.3em; margin-bottom: 0.8em; }

/* Section separators (h2 without details) */
.book-section.level-2.separator { margin: 1.8em 0 1em; }
.book-section.level-2.separator .book-h2 { font-size: 15pt; font-weight: 600; color: #555;
  border-bottom: 1px solid #ccc; padding-bottom: 0.25em; }

/* Section entries (h2 with details) */
.book-section.level-2:not(.separator) { margin-bottom: 1.2em; }
.book-section.level-2:not(.separator) .book-h2 { font-size: 15pt; font-weight: 700;
  color: #1a3e6e; margin-bottom: 0.5em; }

/* Content subsections (h3) */
.book-section.level-3 { margin-bottom: 1.2em; }
.book-h3 { font-size: 13pt; font-weight: 600; color: #2b2b2b; margin-bottom: 0.4em; }

/* Details body */
.book-details { overflow: hidden; }
.book-details p { margin-bottom: 0.5em; }
.book-details p:last-child { margin-bottom: 0; }
.book-details ul, .book-details ol { margin: 0.3em 0 0.5em 1.4em; }
.book-details li { margin-bottom: 0.2em; }
.book-details ul ul, .book-details ol ol,
.book-details ul ol, .book-details ol ul { margin: 0.1em 0 0.1em 1.4em; }
.book-details code { font-family: 'Courier New', monospace; font-size: 0.88em;
  background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 2px; }
.book-details pre { background: #f5f5f5; padding: 0.8em 1em; border-radius: 4px;
  margin: 0.5em 0; font-size: 0.85em; overflow: hidden; }
.book-details pre code { background: none; padding: 0; }
.book-details strong { font-weight: 700; }
.book-details a { color: #1a5faa; }
.book-details h1, .book-details h2, .book-details h3,
.book-details h4, .book-details h5, .book-details h6 {
  font-size: 11pt; font-weight: 600; margin: 0.6em 0 0.3em; }

/* Floated slide image */
.book-img { float: right; margin: 0 0 1em 1.5em; width: ${imgWidthCss}; clear: right; }
.book-img img { width: 100%; height: auto; border-radius: 3px; border: 1px solid #ddd; }`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>${css}
</style></head><body>
<p class="book-masthead">${escapeHtml(title)}</p>
${sections.join('\n')}
</body></html>`;
}
