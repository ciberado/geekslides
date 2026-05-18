/**
 * GeekSlides v2 — Iframe processor.
 *
 * Lazy-loads iframes by activating `data-src` → `src` when the parent
 * `<geek-slide>` becomes active, and resetting it on deactivation so embedded
 * audio/video stops playing when the user navigates away.
 *
 * Processors receive `section.content` (inside the <geek-slide> shadow root),
 * so we use `getRootNode().host` to reach the actual <geek-slide> element
 * that carries the `active` attribute.
 */

import type { Processor } from '../sdk/types.ts';

export const iframeProcessor: Processor = (slideElement: HTMLElement): void => {
  const iframes = slideElement.querySelectorAll('iframe[data-src]');
  if (iframes.length === 0) return;

  // Processors receive section.content which lives inside the <geek-slide> shadow root.
  // The `active` attribute is on <geek-slide> (the shadow host), not on section.content.
  const root = slideElement.getRootNode();
  const hostSlide = root instanceof ShadowRoot ? root.host : slideElement;

  const observer = new MutationObserver(() => {
    const isActive = hostSlide.hasAttribute('active');

    iframes.forEach((iframe) => {
      if (!(iframe instanceof HTMLIFrameElement)) return;
      const dataSrc = iframe.getAttribute('data-src');

      if (isActive && dataSrc && !iframe.hasAttribute('src')) {
        iframe.src = dataSrc;
      } else if (!isActive && iframe.hasAttribute('src')) {
        // Remove src to stop any embedded audio/video from playing in the background.
        iframe.removeAttribute('src');
      }
    });
  });

  observer.observe(hostSlide, { attributes: true, attributeFilter: ['active'] });
};
