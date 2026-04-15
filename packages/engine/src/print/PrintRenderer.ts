/**
 * GeekSlides v2 — PrintRenderer.
 *
 * Produces flat HTML documents from parsed slides for PDF generation.
 * Output contains no Shadow DOM, Custom Elements, or JavaScript.
 */

import type { SlideData } from '../core/SlideParser.ts';
import type { GeekSlidesConfig } from '../core/Config.ts';

export type TemplateName = 'slides' | 'slides-notes' | 'slides-details' | 'book';

export type DetailsLayout = 'horizontal' | 'vertical';

export interface PrintOptions {
  readonly extraCss?: string;
  readonly detailsLayout?: DetailsLayout;
}

const PRINT_CSS = `/* GeekSlides v2 — Base print styles (shared across all templates) */

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #222;
}

section.content {
  position: relative;
  isolation: isolate;
}

/* --- Detail blocks hidden (same as browser) --- */
.gs-details {
  display: none;
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

/* --- Common typography --- */
h1, h2, h3, h4, h5, h6 {
  page-break-after: avoid;
}

img {
  max-width: 100%;
  height: auto;
  break-inside: avoid;
}

pre, code {
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.9em;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #f5f5f5;
  padding: 1em;
  border-radius: 4px;
  break-inside: avoid;
}

code {
  background: #f0f0f0;
  padding: 0.15em 0.4em;
  border-radius: 3px;
}

pre code {
  background: none;
  padding: 0;
}

table {
  border-collapse: collapse;
  width: 100%;
  break-inside: avoid;
  margin: 1em 0;
}

th, td {
  border: 1px solid #ddd;
  padding: 0.5em 0.75em;
  text-align: left;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

blockquote {
  border-left: 3px solid #4a9eff;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #555;
}

a {
  color: #4a9eff;
  text-decoration: none;
}

ul, ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
`;

/**
 * Slides template: landscape 16:9 page, full-bleed, one slide per page.
 * Page dimensions: 254mm × 143mm (exactly 16:9).
 */
const SLIDES_CSS = `
@page {
  size: 254mm 143mm;
  margin: 0;
}

.gs-slide {
  page-break-after: always;
  page-break-inside: avoid;
  width: 254mm;
  height: 142.875mm;
  padding: 8mm;
  margin: 0;
  position: relative;
  overflow: hidden;
  background-color: white;
  background-size: cover;
  background-position: center;
}

.gs-slide > * {
  max-height: 126mm;
  overflow: hidden;
}

.gs-slide h1, .gs-slide h2, .gs-slide h3 {
  margin: 0.2em 0;
}

.gs-slide ul, .gs-slide ol {
  margin: 0.2em 0;
}

.gs-slide p {
  margin: 0.2em 0;
}

.gs-slide img {
  max-width: 100%;
  width: auto;
}

.gs-slide .block-image img {
  max-height: 80mm;
  max-width: 100%;
  height: 80mm;
  width: auto;
}

.gs-slide:has(h1, h2) .block-image:first-of-type img,
.gs-slide.coverbg .block-image:first-of-type img,
.gs-slide.illustration .block-image:first-of-type img {
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gs-slide:last-child {
  page-break-after: auto;
}
`;

/**
 * Slides-notes template: portrait A4, slide thumbnail (16:9) + notes below.
 * Usable width = 170mm (A4 minus 2×20mm margins).
 * Slide thumbnail: 170mm × 95.6mm (16:9).
 */
const SLIDES_NOTES_CSS = `
@page {
  size: A4;
  margin: 20mm;

  @bottom-center {
    content: counter(page);
    font-size: 10pt;
    color: #666;
  }
}

@page :first {
  @bottom-center {
    content: none;
  }
}

.gs-slide-with-notes {
  page-break-after: always;
  page-break-inside: avoid;
}

.gs-slide-with-notes .gs-slide {
  page-break-after: auto;
  width: 170mm;
  height: 95.6mm;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6mm;
  margin-bottom: 5mm;
  overflow: hidden;
  background-color: white;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.gs-slide-with-notes .gs-notes {
  font-size: 9pt;
  line-height: 1.5;
  color: #444;
  padding: 3mm 0;
  border-top: 2px solid #4a9eff;
}
`;

/**
 * Book template: portrait A4, flowing content.
 */
const BOOK_CSS = `
@page {
  size: A4;
  margin: 25mm;

  @bottom-center {
    content: counter(page);
    font-size: 10pt;
    color: #666;
  }
}

@page :first {
  @bottom-center {
    content: none;
  }
}

.gs-book-slide {
  page-break-inside: avoid;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  background: #fafafa;
}

.gs-book-notes {
  margin: 1rem 0 2rem;
  line-height: 1.7;
}

.gs-book-chapter {
  page-break-before: always;
}

.gs-book-chapter:first-child {
  page-break-before: auto;
}
`;

/**
 * Placed AFTER author CSS to override presentation-sized fonts for print.
 * Browser slides render at 1920px design width. Author CSS uses large
 * pt-based sizes for viewport display. We override to print-appropriate
 * sizes while preserving the author's fonts and other styling.
 */
const POST_AUTHOR_CSS = `
/* --- Print-scale overrides (after author CSS) --- */
.gs-slide.content {
  font-size: 10pt;
  line-height: 1.3;
}

.gs-slide.content h1 {
  font-size: 22pt;
  line-height: 1.1;
}

.gs-slide.content h2 {
  font-size: 18pt;
  line-height: 1.1;
}

.gs-slide.content h3 {
  font-size: 14pt;
  line-height: 1.2;
}

.gs-slide.content h4 {
  font-size: 12pt;
}

.gs-slide.content a {
  border-bottom-width: 2px;
}
`;

const DETAILS_CSS = `
/* --- Slides-details template: portrait A4 with slide thumbnails + details --- */

/*
 * Usable area on A4 with 15mm margins: 180mm × 267mm.
 * Slide thumbnail widths:
 *   Horizontal: half-width = 85mm, height = 85mm × 9/16 = 47.8mm
 *   Vertical: full-width = 180mm, height = 180mm × 9/16 = 101.25mm
 *     (with details: 60% width = 108mm, height = 60.75mm)
 */

@page {
  size: A4;
  margin: 15mm;

  @bottom-center {
    content: counter(page);
    font-size: 9pt;
    color: #999;
  }
}

@page :first {
  @bottom-center {
    content: none;
  }
}

/* --- Page container --- */
.gs-details-page {
  page-break-after: always;
  page-break-inside: avoid;
  width: 180mm;
  height: 267mm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gs-details-page:last-child {
  page-break-after: auto;
}

/* --- Slide thumbnail: always 16:9 --- */
.gs-details-page .gs-slide {
  page-break-after: auto;
  overflow: hidden;
  border: 1px solid #ccc;
  border-radius: 3px;
  background-color: white;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* --- No-details: slide fills the page --- */
.gs-details-page.gs-no-details .gs-details-slide {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gs-details-page.gs-no-details .gs-slide {
  width: 180mm;
  height: 101.25mm;
}

/* --- With details: split layout --- */
.gs-details-page.gs-has-details {
  gap: 5mm;
}

/* -- Horizontal layout (side by side) -- */
.gs-details-page.gs-layout-horizontal {
  flex-direction: row;
  align-items: flex-start;
}

.gs-details-page.gs-layout-horizontal .gs-details-slide {
  width: 85mm;
  flex-shrink: 0;
}

.gs-details-page.gs-layout-horizontal .gs-slide {
  width: 85mm;
  height: 47.8mm;
  padding: 3mm;
}

.gs-details-page.gs-layout-horizontal .gs-details-content {
  width: 90mm;
  flex-shrink: 0;
}

/* -- Vertical layout (stacked) -- */
.gs-details-page.gs-layout-vertical {
  flex-direction: column;
  align-items: center;
}

.gs-details-page.gs-layout-vertical .gs-details-slide {
  width: 180mm;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.gs-details-page.gs-layout-vertical .gs-slide {
  width: 108mm;
  height: 60.75mm;
  padding: 3mm;
}

.gs-details-page.gs-layout-vertical .gs-details-content {
  width: 180mm;
  flex-shrink: 0;
}

/* --- No-details vertical: slide bigger --- */
.gs-details-page.gs-no-details.gs-layout-vertical .gs-slide {
  width: 180mm;
  height: 101.25mm;
  padding: 5mm;
}

/* --- No-details horizontal: slide fills page width --- */
.gs-details-page.gs-no-details.gs-layout-horizontal .gs-details-slide {
  width: 100%;
}

.gs-details-page.gs-no-details.gs-layout-horizontal .gs-slide {
  width: 180mm;
  height: 101.25mm;
  padding: 5mm;
}

/* --- Details content: readable body text --- */
.gs-details-content-inner {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 8pt;
  font-weight: 400;
  line-height: 1.4;
  color: #333;
  width: 100%;
}

.gs-details-content-inner h1,
.gs-details-content-inner h2,
.gs-details-content-inner h3,
.gs-details-content-inner h4 {
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 600;
  text-shadow: none;
  color: #222;
  margin-top: 0;
  margin-bottom: 0.3em;
  line-height: 1.3;
}

.gs-details-content-inner h1 { font-size: 11pt; }
.gs-details-content-inner h2 { font-size: 10pt; }
.gs-details-content-inner h3 { font-size: 9pt; }
.gs-details-content-inner h4 { font-size: 8pt; }

.gs-details-content-inner p {
  margin: 0 0 0.3em;
}

.gs-details-content-inner p:last-child {
  margin-bottom: 0;
}

.gs-details-content-inner ul,
.gs-details-content-inner ol {
  margin: 0.2em 0;
  padding-left: 1.2em;
}

.gs-details-content-inner li {
  margin-bottom: 0.1em;
}

.gs-details-content-inner strong {
  font-weight: 600;
}

.gs-details-content-inner code {
  font-size: 0.85em;
}

.gs-details-content-inner a {
  color: #4a9eff;
  text-decoration: none;
  font-weight: normal;
  border-bottom: none;
}
`;

function makeTemplate(bodyContent: string, titleSuffix = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}${titleSuffix}</title>
  <style>{{styles}}</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

const TEMPLATES: Record<TemplateName, string> = {
  slides: makeTemplate('{{slides}}'),
  'slides-notes': makeTemplate('{{slides}}', ' \u2014 Speaker Notes'),
  'slides-details': makeTemplate('{{slides}}', ' \u2014 Details'),
  book: makeTemplate('<h1 class="gs-book-title">{{title}}</h1>\n{{slides}}', ' \u2014 Handbook'),
};

/**
 * Render slides into a complete HTML document suitable for print/PDF.
 */
export function renderPrint(slides: SlideData[], template: TemplateName, config: GeekSlidesConfig, options?: PrintOptions): string {
  const html = TEMPLATES[template];
  const title = config.title;
  const layout = options?.detailsLayout ?? 'horizontal';
  const slidesHtml = renderSlides(slides, template, layout);
  const templateCss = templateSpecificCss(template);
  const styles = buildStyles(slides, templateCss, options?.extraCss);

  return html
    .replace('{{title}}', escapeHtml(title))
    .replaceAll('{{title}}', escapeHtml(title))
    .replace('{{slides}}', slidesHtml)
    .replace('{{styles}}', styles);
}

function templateSpecificCss(template: TemplateName): string {
  switch (template) {
    case 'slides': return SLIDES_CSS;
    case 'slides-notes': return SLIDES_NOTES_CSS;
    case 'slides-details': return DETAILS_CSS;
    case 'book': return BOOK_CSS;
  }
}

function renderSlides(slides: SlideData[], template: TemplateName, layout: DetailsLayout): string {
  return slides.map((slide, i) => {
    switch (template) {
      case 'slides':
        return renderSlide(slide, i);
      case 'slides-notes':
        return renderSlideWithNotes(slide, i);
      case 'slides-details':
        return renderSlideWithDetails(slide, i, layout);
      case 'book':
        return renderBookSlide(slide, i);
    }
  }).join('\n');
}

function renderSlide(slide: SlideData, index: number): string {
  const attrs = slideAttrs(slide, index);
  const css = slide.rawCss ? `<style>${slide.rawCss}</style>` : '';
  return `<section ${attrs}>${css}${slide.html}</section>`;
}

function renderSlideWithNotes(slide: SlideData, index: number): string {
  const attrs = slideAttrs(slide, index);
  const css = slide.rawCss ? `<style>${slide.rawCss}</style>` : '';
  const notes = slide.notesHtml
    ? `<aside class="gs-notes">${slide.notesHtml}</aside>`
    : '';
  return `<div class="gs-slide-with-notes"><section ${attrs}>${css}${slide.html}</section>${notes}</div>`;
}

function renderSlideWithDetails(slide: SlideData, index: number, layout: DetailsLayout): string {
  const attrs = slideAttrs(slide, index);
  const css = slide.rawCss ? `<style>${slide.rawCss}</style>` : '';
  const hasDetails = Boolean(slide.detailsHtml);
  const detailsClass = hasDetails ? 'gs-has-details' : 'gs-no-details';
  const layoutClass = `gs-layout-${layout}`;
  const slideSection = `<div class="gs-details-slide"><section ${attrs}>${css}${slide.html}</section></div>`;
  const detailsSection = hasDetails
    ? `<div class="gs-details-content"><div class="gs-details-content-inner">${slide.detailsHtml}</div></div>`
    : '';
  return `<div class="gs-details-page ${detailsClass} ${layoutClass}">${slideSection}${detailsSection}</div>`;
}

function renderBookSlide(slide: SlideData, index: number): string {
  const isChapter = slide.html.trimStart().startsWith('<h1');
  const chapterClass = isChapter ? ' gs-book-chapter' : '';
  const attrs = slideAttrs(slide, index, `gs-book-slide${chapterClass}`);
  const css = slide.rawCss ? `<style>${slide.rawCss}</style>` : '';
  const notes = slide.notesHtml
    ? `<div class="gs-book-notes">${slide.notesHtml}</div>`
    : '';
  return `<section ${attrs}>${css}${slide.html}</section>${notes}`;
}

function slideAttrs(slide: SlideData, index: number, className?: string): string {
  const cls = [className ?? 'gs-slide', 'content', ...slide.classes]
    .filter((value, position, values) => value.length > 0 && values.indexOf(value) === position)
    .join(' ');
  const id = slide.id ? ` id="${escapeAttr(slide.id)}"` : '';
  const dataId = slide.id ? ` data-id="${escapeAttr(slide.id)}"` : '';
  const dataBackgroundImage = slide.backgroundImage
    ? ` data-background-image="${escapeAttr(slide.backgroundImage)}"`
    : '';
  const dataBackgroundColor = slide.backgroundColor
    ? ` data-background-color="${escapeAttr(slide.backgroundColor)}"`
    : '';
  const style = buildSlideStyle(slide);

  return `class="${escapeAttr(cls)}" data-index="${String(index)}"${dataId}${id}${dataBackgroundImage}${dataBackgroundColor}${style}`;
}

function buildStyles(slides: SlideData[], templateCss: string, authorCss?: string): string {
  const imports = authorCss ? collectImportRules(authorCss) : [];
  const authorBody = authorCss ? adaptAuthorCss(stripImportRules(authorCss).trim()) : '';
  const parts = [...imports, PRINT_CSS, templateCss];

  if (authorBody.length > 0) {
    parts.push(authorBody);
    parts.push(POST_AUTHOR_CSS);
  }

  return parts.join('\n');
}

/**
 * Adapt author CSS from Shadow-DOM conventions to flat-HTML print context.
 * - Rewrites `:host` selectors to `section.content` (the print slide element).
 * - Strips unsupported pseudo-selectors like `:has()` rules.
 */
function adaptAuthorCss(css: string): string {
  // Replace :host(...) with section.content...
  let result = css.replace(/:host\(([^)]+)\)/g, 'section.content$1');
  // Replace standalone :host with section.content
  result = result.replace(/:host\b/g, 'section.content');
  return result;
}

function collectImportRules(css: string): string[] {
  return Array.from(css.matchAll(/^\s*@import\s+.*;\s*$/gm), (match) => match[0].trim());
}

function stripImportRules(css: string): string {
  return css.replace(/^\s*@import\s+.*;\s*$/gm, '');
}

function buildSlideStyle(slide: SlideData): string {
  const declarations: string[] = [];

  if (slide.backgroundColor) {
    declarations.push(`background-color: ${slide.backgroundColor}`);
  }

  if (slide.backgroundImage) {
    declarations.push(`background-image: url(&quot;${escapeAttr(slide.backgroundImage)}&quot;)`);
    declarations.push('background-position: center');
    declarations.push('background-repeat: no-repeat');
    declarations.push('background-size: cover');
  }

  if (declarations.length === 0) {
    return '';
  }

  return ` style="${declarations.join('; ')}"`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
