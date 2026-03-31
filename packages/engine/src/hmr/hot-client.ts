/**
 * Client-side HMR handler for GeekSlides.
 *
 * Registers with Vite's HMR API to handle content-update events
 * without full page reloads, preserving the current slide position.
 */

import type { ContentUpdatePayload } from './vite-plugin-geekslides-hmr.ts';

const HMR_EVENT = 'geekslides:content-update';

export interface HotClientOptions {
  /** Function to re-fetch and return the raw markdown content. */
  fetchMarkdown: () => Promise<string>;
  /** Function to re-fetch and return the parsed config object. */
  fetchConfig: () => Promise<Record<string, unknown>>;
  /** Function called with new markdown to re-parse and reload slides. */
  reloadSlides: (markdown: string) => void;
  /** Function called with new config to apply changes. */
  applyConfig: (config: Record<string, unknown>) => void;
  /** Returns the current slide index (0-based). */
  getCurrentSlide: () => number;
  /** Returns the current partial index (0-based). */
  getCurrentPartial: () => number;
  /** Navigate to a specific slide and partial. */
  goTo: (slide: number, partial: number) => void;
  /** Returns the total number of slides after reload. */
  getSlideCount: () => number;
  /** List of author stylesheets from config (relative paths). */
  styleSheets: string[];
}

/**
 * Handles a content-update HMR event.
 *
 * Dispatches to the appropriate handler based on file type:
 * markdown, config, or style. Preserves slide position.
 */
export async function handleContentUpdate(
  payload: ContentUpdatePayload,
  options: HotClientOptions,
): Promise<void> {
  switch (payload.type) {
    case 'markdown':
      await handleMarkdownUpdate(options);
      break;
    case 'config':
      await handleConfigUpdate(payload, options);
      break;
    case 'style':
      handleStyleUpdate(payload, options);
      break;
  }
}

async function handleMarkdownUpdate(options: HotClientOptions): Promise<void> {
  const savedSlide = options.getCurrentSlide();
  const savedPartial = options.getCurrentPartial();

  const markdown = await options.fetchMarkdown();
  options.reloadSlides(markdown);

  // Clamp position if slides were removed
  const slideCount = options.getSlideCount();
  const targetSlide = Math.min(savedSlide, slideCount - 1);
  const targetPartial = targetSlide === savedSlide ? savedPartial : 0;

  options.goTo(Math.max(0, targetSlide), Math.max(0, targetPartial));
}

async function handleConfigUpdate(
  payload: ContentUpdatePayload,
  options: HotClientOptions,
): Promise<void> {
  const config = await options.fetchConfig();

  // Structural changes that require full reload
  const structuralKeys = ['plugins', 'content', 'sync'];
  const isStructural = structuralKeys.some((key) => key in config);

  if (isStructural && typeof location !== 'undefined') {
    location.reload();
    return;
  }

  options.applyConfig(config);
}

function handleStyleUpdate(
  payload: ContentUpdatePayload,
  options: HotClientOptions,
): void {
  if (typeof document === 'undefined') return;

  // Find matching <link> element and cache-bust it
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    const normalizedHref = href.split('?')[0] ?? '';

    if (
      options.styleSheets.some((s) => normalizedHref.endsWith(s)) ||
      normalizedHref.endsWith(payload.file)
    ) {
      link.href = `${normalizedHref}?t=${String(payload.timestamp)}`;
      break;
    }
  }
}

/**
 * Registers the HMR client with Vite's hot module API.
 *
 * Call this from the browser entry point when `import.meta.hot` is available.
 */
export function registerHotClient(
  hot: { on: (event: string, cb: (data: ContentUpdatePayload) => void) => void },
  options: HotClientOptions,
): void {
  hot.on(HMR_EVENT, (data: ContentUpdatePayload) => {
    void handleContentUpdate(data, options);
  });
}
