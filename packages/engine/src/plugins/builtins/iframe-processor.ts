/**
 * GeekSlides v2 — Iframe processor.
 *
 * Lazy-loads iframes by converting data-src to src only when the slide becomes active.
 * Uses MutationObserver to watch for the active attribute on the parent slide.
 */

import type { Processor } from '../types.ts';

export const iframeProcessor: Processor = (slideElement: HTMLElement): void => {
  const iframes = slideElement.querySelectorAll('iframe[data-src]');
  if (iframes.length === 0) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'active') {
        const isActive = slideElement.hasAttribute('active');

        iframes.forEach((iframe) => {
          if (!(iframe instanceof HTMLIFrameElement)) return;
          const dataSrc = iframe.getAttribute('data-src');

          if (isActive && dataSrc && !iframe.src) {
            iframe.src = dataSrc;
          }
        });
      }
    }
  });

  observer.observe(slideElement, { attributes: true, attributeFilter: ['active'] });
};
