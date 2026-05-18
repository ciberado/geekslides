/**
 * GeekSlides v2 — Iframe URL plugin.
 *
 * Preprocessor that detects `.html`/`.htm` URLs in image syntax and emits
 * a lazy-loadable `<iframe data-src>` element (activated by the built-in
 * `iframe` processor).
 *
 * An overlay processor adds a transparent click-to-activate overlay over
 * every `<iframe>` on a slide to prevent keyboard-focus stealing. Clicking
 * the overlay removes it; pressing Escape while an iframe is focused returns
 * keyboard control to the browser (standard browser behaviour).
 *
 * Markdown syntax:
 *   ![alt text](https://example.com/page.html)
 *   ![My Demo](./demos/interactive.html)
 */

import type { Plugin, Preprocessor, Processor } from '../types.ts';

const HTML_EXT_RE = /\.html?(\?[^)]*)?$/i;
const IMAGE_SYNTAX_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export const iframeUrlPreprocessor: Preprocessor = (markdown: string): string =>
  markdown.replace(IMAGE_SYNTAX_RE, (match, alt: string, url: string) => {
    if (!HTML_EXT_RE.test(url)) return match;
    const title = alt.trim();
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<div class="gs-iframe-wrapper"><iframe data-src="${escapeAttr(url)}"${titleAttr}></iframe></div>`;
  });

/**
 * Adds a transparent click-to-activate overlay over every `<iframe>` on the
 * slide. The overlay captures keyboard events and re-dispatches navigation
 * keys (arrows, space, page up/down) to the document so slide navigation
 * keeps working while an iframe is present.
 *
 * The overlay is restored when the slide becomes inactive so the next visit
 * starts protected again.
 */
export const iframeOverlayProcessor: Processor = (slideElement: HTMLElement): void => {
  const wrappers = slideElement.querySelectorAll<HTMLElement>('.gs-iframe-wrapper');
  if (wrappers.length === 0) return;

  const root = slideElement.getRootNode();
  const hostSlide = root instanceof ShadowRoot ? root.host : slideElement;

  for (const wrapper of wrappers) {
    if (wrapper.querySelector('.gs-iframe-overlay')) continue;

    const overlay = document.createElement('div');
    overlay.className = 'gs-iframe-overlay';
    overlay.setAttribute('role', 'button');
    overlay.setAttribute('tabindex', '0');
    overlay.setAttribute(
      'aria-label',
      'Click to interact with embedded content. Press Escape to return to presentation navigation.',
    );

    const hint = document.createElement('span');
    hint.className = 'gs-iframe-overlay-hint';
    hint.textContent = 'Click to interact · Esc to navigate';
    overlay.appendChild(hint);

    // Forward navigation keys to the document while the overlay has focus.
    const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown']);
    overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!NAV_KEYS.has(e.key)) return;
      e.stopPropagation();
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: e.key, bubbles: true, cancelable: true }),
      );
    });

    // Clicking the overlay removes it so the user can interact with the iframe.
    overlay.addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    // Restore the overlay when the slide is no longer active.
    new MutationObserver(() => {
      if (!hostSlide.hasAttribute('active')) {
        overlay.style.display = '';
      }
    }).observe(hostSlide, { attributes: true, attributeFilter: ['active'] });

    wrapper.appendChild(overlay);
  }
};

export const iframeUrlPlugin: Plugin = {
  name: 'iframe-url',
  preprocessors: [iframeUrlPreprocessor],
  processors: [iframeOverlayProcessor],
};
