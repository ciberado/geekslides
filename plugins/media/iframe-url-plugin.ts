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

import type { Preprocessor, Processor } from '../sdk/types.ts';

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
      'Click to interact with embedded content. Use ‹ › buttons or click here again to restore keyboard navigation.',
    );

    const hint = document.createElement('span');
    hint.className = 'gs-iframe-overlay-hint';
    hint.textContent = 'Click to interact · use ‹ › to navigate';
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

    // A small "restore" badge shown when the overlay is dismissed.
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'gs-iframe-restore';
    restoreBtn.setAttribute('aria-label', 'Restore keyboard navigation');
    restoreBtn.setAttribute('title', 'Restore keyboard navigation');
    restoreBtn.textContent = '⌨';
    restoreBtn.style.cssText = [
      'position:absolute', 'top:6px', 'right:6px', 'z-index:20',
      'display:none', 'pointer-events:auto',
      'background:oklch(15% 0 0 / 0.72)', 'color:#fff',
      'border:1px solid oklch(60% 0 0 / 0.35)', 'border-radius:4px',
      'padding:3px 7px', 'font-size:0.8rem', 'cursor:pointer', 'line-height:1.4',
    ].join(';');
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.style.display = '';
      restoreBtn.style.display = 'none';
    });
    wrapper.appendChild(restoreBtn);

    // Clicking the overlay yields control to the iframe; restore badge appears.
    overlay.addEventListener('click', () => {
      overlay.style.display = 'none';
      restoreBtn.style.display = 'block';
    });

    // Restore the overlay when the slide is no longer active.
    new MutationObserver(() => {
      if (!hostSlide.hasAttribute('active')) {
        overlay.style.display = '';
        restoreBtn.style.display = 'none';
      }
    }).observe(hostSlide, { attributes: true, attributeFilter: ['active'] });

    wrapper.appendChild(overlay);
  }
};

export const iframeUrlPlugin = {
  name: 'iframe-url',
  preprocessors: [iframeUrlPreprocessor],
  processors: [iframeOverlayProcessor],
};
