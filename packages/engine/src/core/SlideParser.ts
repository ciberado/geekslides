/**
 * GeekSlides v2 — Markdown to structured slides parser.
 *
 * Converts raw markdown into an array of SlideData objects.
 * Replaces v1's MarkdownToHTML class.
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/markdown-it-container.d.ts" />
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

export interface SlideData {
  readonly id: string;
  readonly html: string;
  readonly classes: readonly string[];
  readonly backgroundImage: string | undefined;
  readonly backgroundColor: string | undefined;
  readonly rawCss: string | undefined;
  readonly notesHtml: string | undefined;
  readonly partialCount: number;
}

/**
 * Parse the empty-link separator syntax: [](.class1.class2#id,bgurl(url),bgcolor(color))
 */
function parseSectionAttrs(href: string): {
  id: string;
  classes: string[];
  backgroundImage: string | undefined;
  backgroundColor: string | undefined;
} {
  let id = '';
  const classes: string[] = [];
  let backgroundImage: string | undefined;
  let backgroundColor: string | undefined;

  // Split on comma to extract bgurl(...) and bgcolor(...)
  const parts = href.split(',');

  for (const part of parts) {
    const trimmed = part.trim();

    const bgurlMatch = /^bgurl\((.+)\)$/i.exec(trimmed);
    if (bgurlMatch) {
      backgroundImage = bgurlMatch[1];
      continue;
    }

    const bgcolorMatch = /^bgcolor\((.+)\)$/i.exec(trimmed);
    if (bgcolorMatch) {
      backgroundColor = bgcolorMatch[1];
      continue;
    }

    // Parse .class and #id tokens
    const tokens = trimmed.split(/(?=[.#])/);
    for (const token of tokens) {
      if (token.startsWith('#')) {
        id = token.slice(1);
      } else if (token.startsWith('.')) {
        const cls = token.slice(1);
        if (cls.length > 0) {
          classes.push(cls);
        }
      }
    }
  }

  return { id, classes, backgroundImage, backgroundColor };
}

/**
 * Extract <style>...</style> blocks from HTML and return the CSS and remaining HTML.
 */
function extractStyleBlocks(html: string): { css: string; html: string } {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const cssBlocks: string[] = [];
  const cleaned = html.replace(styleRegex, (_match, content: string) => {
    cssBlocks.push(content.trim());
    return '';
  });

  return {
    css: cssBlocks.join('\n'),
    html: cleaned,
  };
}

/**
 * Count elements with the [partial] attribute in HTML.
 */
function countPartials(html: string): number {
  const partialRegex = /\[partial\]/gi;
  const matches = html.match(partialRegex);
  return matches ? matches.length : 0;
}

const md = MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
});

// Register the ::: Notes container for speaker notes
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- markdown-it-container typing mismatch
md.use(container, 'Notes', {
  validate: (params: string) => params.trim() === 'Notes',
  render: (tokens: { nesting: number }[], idx: number) => {
    const token = tokens[idx];
    if (token && token.nesting === 1) {
      return '<div class="gs-notes">';
    }
    return '</div>\n';
  },
});

/**
 * Split rendered HTML on empty <a> separators.
 * Empty links look like: <a href=".class#id,bgurl(...)"></a>
 */
function splitOnSeparators(html: string): { href: string; content: string }[] {
  // Match empty anchor tags that serve as slide separators
  const separatorRegex = /<p><a href="([^"]*)"[^>]*>\s*<\/a><\/p>/g;

  const sections: { href: string; content: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = separatorRegex.exec(html)) !== null) {
    // Content before this separator belongs to the previous section
    const before = html.slice(lastIndex, match.index).trim();
    if (sections.length > 0 || before.length > 0) {
      if (sections.length === 0) {
        sections.push({ href: '', content: before });
      } else {
        const last = sections[sections.length - 1];
        if (last) {
          last.content = before;
        }
      }
    }
    // Start a new section with this separator's attributes
    const href = match[1];
    sections.push({ href: href ?? '', content: '' });
    lastIndex = match.index + match[0].length;
  }

  // Remaining content after the last separator
  const remaining = html.slice(lastIndex).trim();
  if (sections.length === 0) {
    sections.push({ href: '', content: remaining });
  } else {
    const last = sections[sections.length - 1];
    if (last) {
      last.content = last.content.length > 0
        ? last.content + remaining
        : remaining;
    }
  }

  return sections;
}

/**
 * Extract notes HTML from a section and return the section without notes.
 */
function extractNotes(sectionHtml: string): { html: string; notesHtml: string | undefined } {
  const notesRegex = /<div class="gs-notes">([\s\S]*?)<\/div>/;
  const match = notesRegex.exec(sectionHtml);

  if (!match) {
    return { html: sectionHtml, notesHtml: undefined };
  }

  const notesHtml = match[1]?.trim();
  const html = sectionHtml.replace(notesRegex, '').trim();

  return {
    html,
    notesHtml: notesHtml && notesHtml.length > 0 ? notesHtml : undefined,
  };
}

let autoId = 0;

/**
 * Parse markdown into an array of SlideData objects.
 */
export function parse(markdown: string): SlideData[] {
  autoId = 0;
  const rendered = md.render(markdown);
  const sections = splitOnSeparators(rendered);

  return sections
    .filter((s) => s.content.length > 0 || s.href.length > 0)
    .map((section) => {
      const attrs = parseSectionAttrs(section.href);
      const { html: htmlWithoutStyles, css } = extractStyleBlocks(section.content);
      const { html: finalHtml, notesHtml } = extractNotes(htmlWithoutStyles);
      const partialCount = countPartials(finalHtml);
      const id = attrs.id || `slide-${String(++autoId)}`;

      return {
        id,
        html: finalHtml,
        classes: attrs.classes,
        backgroundImage: attrs.backgroundImage,
        backgroundColor: attrs.backgroundColor,
        rawCss: css.length > 0 ? css : undefined,
        notesHtml,
        partialCount,
      };
    });
}

export type { MarkdownIt };
