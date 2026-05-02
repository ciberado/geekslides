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
import { createLogger } from '../logging.ts';

const log = createLogger('parser');

type MarkdownToken = ReturnType<MarkdownIt['parse']>[number];

export interface SlideData {
  readonly id: string;
  readonly html: string;
  readonly classes: readonly string[];
  readonly backgroundImage: string | undefined;
  readonly backgroundColor: string | undefined;
  readonly rawCss: string | undefined;
  readonly notesHtml: string | undefined;
  readonly detailsHtml: string | undefined;
  readonly partialCount: number;
  readonly sourceLineStart?: number;
  readonly sourceLineEnd?: number;
}

export interface SlideMapEntry {
  readonly slideIndex: number;
  readonly sourceLineStart: number;
  readonly sourceLineEnd: number;
  readonly id: string;
}

interface ParseOptions {
  readonly lineMapping?: readonly number[];
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

function setTokenAttr(token: MarkdownToken, name: string, value: string): void {
  if (!token.attrs) {
    token.attrs = [];
  }

  const existingAttr = token.attrs.find((attr) => attr[0] === name);
  if (existingAttr) {
    existingAttr[1] = value;
    return;
  }

  token.attrs.push([name, value]);
}

function findPartialOwner(openTokens: MarkdownToken[]): MarkdownToken | undefined {
  const reversed = [...openTokens].reverse();
  return reversed.find((token) => token.tag === 'li')
    ?? reversed.find((token) => token.tag === 'tr')
    ?? reversed.find((token) => token.tag === 'p')
    ?? reversed[0];
}

function normalizePartialMarkers(
  tokens: MarkdownToken[],
  slideClasses: readonly string[],
): { tokens: MarkdownToken[]; partialCount: number } {
  const openTokens: MarkdownToken[] = [];
  let partialCount = 0;

  for (const token of tokens) {
    if (token.nesting === 1) {
      openTokens.push(token);
    }

    if (token.type === 'inline' && token.content.includes('[partial]')) {
      const owner = findPartialOwner(openTokens);
      if (owner && getTokenAttr(owner, 'partial') === undefined) {
        setTokenAttr(owner, 'partial', '');
        partialCount++;
      }

      token.content = token.content.replace(/\s*\[partial\]\s*/gi, ' ').replace(/\s{2,}/g, ' ').trimEnd();
      token.children?.forEach((childToken) => {
        if (childToken.type === 'text') {
          childToken.content = childToken.content.replace(/\s*\[partial\]\s*/gi, ' ').replace(/\s{2,}/g, ' ').trimEnd();
        }
      });
    }

    if (token.nesting === -1) {
      openTokens.pop();
    }
  }

  if (slideClasses.includes('partial')) {
    let detailDepth = 0;
    for (const token of tokens) {
      if (token.type === 'container_Details_open') {
        detailDepth++;
        continue;
      }
      if (token.type === 'container_Details_close') {
        detailDepth--;
        continue;
      }

      if (detailDepth > 0) {
        continue;
      }

      if (token.nesting !== 1) {
        continue;
      }

      if (token.tag !== 'li' && token.tag !== 'tr') {
        continue;
      }

      if (getTokenAttr(token, 'partial') !== undefined) {
        continue;
      }

      setTokenAttr(token, 'partial', '');
      partialCount++;
    }
  }

  return { tokens, partialCount };
}

/**
 * Wrap standalone paragraph-images in a .block-image container used by deck layouts.
 * Matches <p><img ...></p> and wraps in <div class="block-image">.
 */
function wrapBlockImages(html: string): string {
  return html.replace(
    /<p>(\s*<img\s[^>]*>)\s*<\/p>/g,
    '<div class="block-image">$1</div>',
  );
}

const md = MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
});

function getTokenAttr(token: MarkdownToken, name: string): string | undefined {
  const attr = token.attrs?.find(([key]) => key === name);
  return attr?.[1];
}

function getSeparatorHref(
  paragraphOpen: MarkdownToken | undefined,
  inline: MarkdownToken | undefined,
  paragraphClose: MarkdownToken | undefined,
): string | undefined {
  if (!paragraphOpen || !inline || !paragraphClose) {
    return undefined;
  }
  if (paragraphOpen.type !== 'paragraph_open' || paragraphClose.type !== 'paragraph_close') {
    return undefined;
  }
  if (inline.type !== 'inline') {
    return undefined;
  }

  const children = inline.children ?? [];
  if (children.length !== 2) {
    return undefined;
  }

  const [linkOpen, linkClose] = children;
  if (!linkOpen || !linkClose || linkOpen.type !== 'link_open' || linkClose.type !== 'link_close') {
    return undefined;
  }

  return getTokenAttr(linkOpen, 'href');
}

/**
 * Split markdown-it tokens on empty-link separators.
 * Empty links look like: [](.class#id,bgurl(...))
 */
function splitOnSeparators(tokens: MarkdownToken[]): Array<{
  href: string;
  tokens: MarkdownToken[];
  startLine?: number;
  endLine?: number;
}> {
  const sections: Array<{
    href: string;
    tokens: MarkdownToken[];
    startLine?: number;
    endLine?: number;
  }> = [];
  let currentHref = '';
  let currentTokens: MarkdownToken[] = [];
  let currentStartLine: number | undefined;
  let currentEndLine: number | undefined;

  const pushCurrentSection = (endLineOverride?: number) => {
    if (currentTokens.length > 0 || currentHref.length > 0) {
      const section: {
        href: string;
        tokens: MarkdownToken[];
        startLine?: number;
        endLine?: number;
      } = {
        href: currentHref,
        tokens: [...currentTokens],
      };

      if (currentStartLine !== undefined) {
        section.startLine = currentStartLine;
      }
      const resolvedEndLine = endLineOverride ?? currentEndLine;
      if (resolvedEndLine !== undefined) {
        section.endLine = resolvedEndLine;
      }

      sections.push(section);
    }
    currentTokens = [];
    currentStartLine = undefined;
    currentEndLine = undefined;
  };

  for (let index = 0; index < tokens.length; index++) {
    const href = getSeparatorHref(tokens[index], tokens[index + 1], tokens[index + 2]);
    if (href !== undefined) {
      pushCurrentSection(tokens[index]?.map?.[0]);
      currentHref = href;
      currentStartLine = tokens[index]?.map?.[0];
      currentEndLine = tokens[index + 2]?.map?.[1] ?? tokens[index]?.map?.[1];
      index += 2;
      continue;
    }

    const token = tokens[index];
    if (token) {
      currentTokens.push(token);
      if (token.map) {
        currentStartLine ??= token.map[0];
        currentEndLine = Math.max(currentEndLine ?? token.map[1], token.map[1]);
      }
    }
  }

  pushCurrentSection();
  return sections;
}

function getMappedOriginalLine(
  processedLine: number,
  lineMapping: readonly number[] | undefined,
): number {
  return lineMapping?.[processedLine] ?? processedLine + 1;
}

function getSectionSourceRange(
  section: {
    readonly startLine?: number;
    readonly endLine?: number;
  },
  lineMapping: readonly number[] | undefined,
): { sourceLineStart: number; sourceLineEnd: number } | undefined {
  let start = Number.POSITIVE_INFINITY;
  let endInclusive = Number.NEGATIVE_INFINITY;

  const includeProcessedRange = (rangeStart: number, rangeEnd: number): void => {
    for (let line = rangeStart; line < rangeEnd; line++) {
      const originalLine = getMappedOriginalLine(line, lineMapping);
      start = Math.min(start, originalLine);
      endInclusive = Math.max(endInclusive, originalLine);
    }
  };

  if (section.startLine !== undefined && section.endLine !== undefined) {
    includeProcessedRange(section.startLine, section.endLine);
  }

  if (!Number.isFinite(start) || !Number.isFinite(endInclusive)) {
    return undefined;
  }

  return {
    sourceLineStart: start,
    sourceLineEnd: endInclusive + 1,
  };
}

function extractContainerTokens(
  tokens: MarkdownToken[],
  containerName: 'Notes' | 'Details',
  removeFromMain: boolean,
): { mainTokens: MarkdownToken[]; extractedTokens: MarkdownToken[] } {
  const openType = `container_${containerName}_open`;
  const closeType = `container_${containerName}_close`;
  const mainTokens: MarkdownToken[] = [];
  const extractedTokens: MarkdownToken[] = [];
  let depth = 0;

  for (const token of tokens) {
    if (token.type === openType) {
      if (!removeFromMain) {
        mainTokens.push(token);
      }
      depth++;
      continue;
    }

    if (token.type === closeType) {
      depth--;
      if (!removeFromMain) {
        mainTokens.push(token);
      }
      continue;
    }

    if (depth > 0) {
      extractedTokens.push(token);
      if (!removeFromMain) {
        mainTokens.push(token);
      }
      continue;
    }

    mainTokens.push(token);
  }

  return { mainTokens, extractedTokens };
}

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

// Register the ::: Details container for book-mode content (hidden in presentation)
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- markdown-it-container typing mismatch
md.use(container, 'Details', {
  validate: (params: string) => params.trim() === 'Details',
  render: (tokens: { nesting: number }[], idx: number) => {
    const token = tokens[idx];
    if (token && token.nesting === 1) {
      return '<div class="gs-details">';
    }
    return '</div>\n';
  },
});

let autoId = 0;

/**
 * Parse markdown into an array of SlideData objects.
 */
export function parse(markdown: string, options?: ParseOptions): SlideData[] {
  autoId = 0;
  const tokens = md.parse(markdown, {});
  const sections = splitOnSeparators(tokens);

  const slides = sections
    .filter((s) => s.tokens.length > 0 || s.href.length > 0)
    .map((section) => {
      const attrs = parseSectionAttrs(section.href);
      const { mainTokens: withoutNotesTokens, extractedTokens: noteTokens } = extractContainerTokens(section.tokens, 'Notes', true);
      const { mainTokens: contentTokens, extractedTokens: detailTokens } = extractContainerTokens(withoutNotesTokens, 'Details', false);
      const { tokens: normalizedContentTokens, partialCount } = normalizePartialMarkers(contentTokens, attrs.classes);
      const renderedContent = md.renderer.render(normalizedContentTokens, md.options, {}).trim();
      const { html: htmlWithoutStyles, css } = extractStyleBlocks(renderedContent);
      const finalHtml = wrapBlockImages(htmlWithoutStyles);
      const notesHtml = noteTokens.length > 0
        ? md.renderer.render(noteTokens, md.options, {}).trim()
        : undefined;
      const detailsHtml = detailTokens.length > 0
        ? md.renderer.render(detailTokens, md.options, {}).trim()
        : undefined;
      const id = attrs.id || `slide-${String(++autoId)}`;
      const sourceRange = getSectionSourceRange(section, options?.lineMapping);

      return {
        id,
        html: finalHtml,
        classes: attrs.classes,
        backgroundImage: attrs.backgroundImage,
        backgroundColor: attrs.backgroundColor,
        rawCss: css.length > 0 ? css : undefined,
        notesHtml,
        detailsHtml,
        partialCount,
        ...(sourceRange
          ? {
              sourceLineStart: sourceRange.sourceLineStart,
              sourceLineEnd: sourceRange.sourceLineEnd,
            }
          : {}),
      } satisfies SlideData;
    });

  // Warn about duplicate slide IDs
  const seenIds = new Set<string>();
  for (const slide of slides) {
    if (seenIds.has(slide.id)) {
      log.warn({ id: slide.id }, 'duplicate slide ID — may cause CSS scoping or navigation issues');
    }
    seenIds.add(slide.id);
  }

  log.debug({ slideCount: slides.length }, 'parsed slides');

  return slides;
}

export function computeSlideMap(slides: readonly SlideData[]): SlideMapEntry[] {
  return slides.flatMap((slide, slideIndex) => (
    slide.sourceLineStart !== undefined && slide.sourceLineEnd !== undefined
      ? [{
          slideIndex,
          sourceLineStart: slide.sourceLineStart,
          sourceLineEnd: slide.sourceLineEnd,
          id: slide.id,
        }]
      : []
  ));
}

export type { MarkdownIt };
