/**
 * Wait for a processor-generated element to appear inside a slide's content section.
 *
 * Processors (css-doodle, chart, iframe, …) run asynchronously in a staggered
 * render queue. Custom components that depend on processor output should use
 * this helper instead of polling or fixed retries.
 *
 * @example
 * // In a custom component's connectedCallback:
 * import { waitForProcessedElement } from '@geekslides/engine/utils';
 * // or from window.__geekslides in a plain-JS deck script:
 * const { waitForProcessedElement } = window.__geekslides;
 *
 * connectedCallback() {
 *   waitForProcessedElement('css-doodle', this, (el) => this.#init(el));
 * }
 */

/**
 * Finds the nearest slide content root (`section.content` or any element whose
 * class contains "content") by walking up from `anchor`, then watches for
 * `selector` to appear via MutationObserver.
 *
 * If the element already exists the callback is invoked synchronously.
 * Returns a cleanup function that stops the observer — call it from
 * `disconnectedCallback` if needed (though the observer auto-stops on match).
 */
export function waitForProcessedElement(
  selector: string,
  anchor: Element,
  callback: (el: Element) => void,
): () => void {
  const content =
    anchor.closest('section.content') ??
    anchor.closest('[class*="content"]');

  if (!content) return () => { /* no-op */ };

  // Already present — invoke synchronously and return a no-op cleanup.
  const existing = content.querySelector(selector);
  if (existing) {
    callback(existing);
    return () => { /* no-op */ };
  }

  const observer = new MutationObserver(() => {
    const el = content.querySelector(selector);
    if (el) {
      observer.disconnect();
      callback(el);
    }
  });

  observer.observe(content, { childList: true, subtree: true });

  return () => { observer.disconnect(); };
}
