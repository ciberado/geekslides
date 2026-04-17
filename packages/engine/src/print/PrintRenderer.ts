/**
 * GeekSlides v2 — PrintRenderer.
 *
 * Produces flat HTML documents from parsed slides for PDF generation.
 * Output contains no Shadow DOM, Custom Elements, or JavaScript.
 */

import type { SlideData } from '../core/SlideParser.ts';
import type { GeekSlidesConfig } from '../core/Config.ts';
import { PRINT_CSS, SLIDES_CSS, SLIDES_NOTES_CSS, BOOK_CSS, POST_AUTHOR_CSS, DETAILS_CSS } from './print-styles.ts';

export type TemplateName = 'slides' | 'slides-notes' | 'slides-details' | 'book';

export type DetailsLayout = 'horizontal' | 'vertical';

export interface PrintOptions {
  readonly extraCss?: string;
  readonly detailsLayout?: DetailsLayout;
}

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
    ? `<div class="gs-details-content"><div class="gs-details-content-inner">${slide.detailsHtml ?? ''}</div></div>`
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
