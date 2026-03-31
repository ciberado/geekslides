/**
 * GeekSlides v2 — PrintRenderer.
 *
 * Produces flat HTML documents from parsed slides for PDF generation.
 * Output contains no Shadow DOM, Custom Elements, or JavaScript.
 */

import type { SlideData } from '../core/SlideParser.ts';
import type { GeekSlidesConfig } from '../core/Config.ts';

export type TemplateName = 'slides' | 'slides-notes' | 'book';

export interface PrintOptions {
  readonly extraCss?: string;
}

const PRINT_CSS = `/* GeekSlides v2 — Print stylesheet */
@page { size: A4; margin: 2cm; }
@page :first { }
* { box-sizing: border-box; }
body { margin:0; padding:0; font-family:system-ui,-apple-system,sans-serif; font-size:12pt; line-height:1.5; color:#222; }
.gs-slide { page-break-after:always; page-break-inside:avoid; width:100%; padding:2rem; }
.gs-slide:last-child { page-break-after:auto; }
.gs-slide-with-notes { page-break-after:always; page-break-inside:avoid; }
.gs-slide-with-notes .gs-slide { page-break-after:auto; border:1px solid #ddd; border-radius:4px; padding:1.5rem; margin-bottom:1rem; min-height:55vh; }
.gs-slide-with-notes .gs-notes { font-size:10pt; line-height:1.6; color:#444; padding:1rem; border-top:2px solid #4a9eff; }
.gs-book-slide { page-break-inside:avoid; border:1px solid #ddd; border-radius:4px; padding:1.5rem; margin:1.5rem 0; background:#fafafa; }
.gs-book-notes { margin:1rem 0 2rem; line-height:1.7; }
.gs-book-chapter { page-break-before:always; }
.gs-book-chapter:first-child { page-break-before:auto; }
h1,h2,h3,h4,h5,h6 { page-break-after:avoid; }
img { max-width:100%; height:auto; break-inside:avoid; }
pre { white-space:pre-wrap; word-wrap:break-word; background:#f5f5f5; padding:1em; border-radius:4px; break-inside:avoid; }
code { background:#f0f0f0; padding:0.15em 0.4em; border-radius:3px; font-size:0.9em; }
pre code { background:none; padding:0; }
table { border-collapse:collapse; width:100%; break-inside:avoid; margin:1em 0; }
th,td { border:1px solid #ddd; padding:0.5em 0.75em; text-align:left; }
th { background:#f5f5f5; font-weight:600; }
blockquote { border-left:3px solid #4a9eff; margin:1em 0; padding:0.5em 1em; color:#555; }
a { color:#4a9eff; text-decoration:none; }
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
  book: makeTemplate('<h1 class="gs-book-title">{{title}}</h1>\n{{slides}}', ' \u2014 Handbook'),
};

/**
 * Render slides into a complete HTML document suitable for print/PDF.
 */
export function renderPrint(slides: SlideData[], template: TemplateName, config: GeekSlidesConfig, options?: PrintOptions): string {
  const html = TEMPLATES[template];
  const title = config.title;
  const slidesHtml = renderSlides(slides, template);
  const styles = buildStyles(slides, options?.extraCss);

  return html
    .replace('{{title}}', escapeHtml(title))
    .replaceAll('{{title}}', escapeHtml(title))
    .replace('{{slides}}', slidesHtml)
    .replace('{{styles}}', styles);
}

function renderSlides(slides: SlideData[], template: TemplateName): string {
  return slides.map((slide, i) => {
    switch (template) {
      case 'slides':
        return renderSlide(slide, i);
      case 'slides-notes':
        return renderSlideWithNotes(slide, i);
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
  const cls = className ?? 'gs-slide';
  const id = slide.id ? ` id="${escapeAttr(slide.id)}"` : '';
  const bg = slide.backgroundColor
    ? ` style="background: ${escapeAttr(slide.backgroundColor)}"`
    : '';
  return `class="${cls}" data-index="${String(index)}"${id}${bg}`;
}

function buildStyles(slides: SlideData[], extraCss?: string): string {
  const parts = [PRINT_CSS];

  if (extraCss) {
    parts.push(extraCss);
  }

  for (const slide of slides) {
    if (slide.rawCss) {
      parts.push(slide.rawCss);
    }
  }

  return parts.join('\n');
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
