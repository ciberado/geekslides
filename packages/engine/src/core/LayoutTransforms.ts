/**
 * GeekSlides v2 — Layout Transform Registry.
 *
 * Provides a mechanism for layouts to define DOM transformations that run
 * after the basic markdown-to-HTML conversion. This is used for layouts that
 * need structural elements beyond what CSS can provide (wrapper divs, semantic
 * replacements, injected badges, etc.).
 *
 * Built-in transforms are registered at module load time. Deck-local scripts
 * can register custom transforms via `window.__geekslides.registerLayoutTransform`.
 *
 * Transforms are applied in `Slide.loadContent()` after `innerHTML` is set,
 * and run exactly once per slide load.
 *
 * CSS in layouts.css should include both:
 *   - New selectors targeting the injected DOM (e.g. `.gs-card`, `.gs-vs-badge`)
 *   - Old fallback selectors for environments where transforms don't run (e.g. renderPrint)
 */

export type LayoutTransform = (section: HTMLElement) => void;

const registry = new Map<string, LayoutTransform>();

/**
 * Register a layout transform for a given layout class name.
 * When a slide has this class, the transform is called with the section element
 * immediately after its HTML content is set.
 *
 * @param cls - The layout class name (e.g. 'layout-three-col')
 * @param fn  - The transform function; receives the section.content element
 */
export function registerLayoutTransform(cls: string, fn: LayoutTransform): void {
  registry.set(cls, fn);
}

/**
 * Apply any registered transforms matching the section's CSS classes.
 * Called by Slide.loadContent() after innerHTML is set.
 */
export function applyLayoutTransforms(section: HTMLElement): void {
  for (const cls of section.classList) {
    registry.get(cls)?.(section);
  }
}

// ── Built-in transforms ────────────────────────────────────────────────────

/**
 * layout-three-col: Wrap each (h4 + following content sibling) pair into
 * a `.gs-card` div so the card header and body can be styled as a unit.
 *
 * Before:
 *   <h4>Title</h4>
 *   <ul>...</ul>
 *
 * After:
 *   <div class="gs-card">
 *     <h4>Title</h4>
 *     <ul>...</ul>
 *   </div>
 *
 * The CSS `@transform` comment explains the expected structure.
 */
function threeColTransform(section: HTMLElement): void {
  const h4s = Array.from(section.querySelectorAll(':scope > h4'));

  for (const h4 of h4s) {
    const card = document.createElement('div');
    card.className = 'gs-card';
    h4.replaceWith(card);
    card.appendChild(h4);

    // Move the immediately following content sibling into the card
    const next = card.nextElementSibling;
    if (
      next !== null &&
      (next.tagName === 'P' ||
        next.tagName === 'UL' ||
        next.tagName === 'OL' ||
        next.classList.contains('block-image'))
    ) {
      card.appendChild(next);
    }
  }
}

/**
 * layout-compare: Replace the `h4` VS-badge element with a semantic
 * `<span class="gs-vs-badge">` so the middle column marker is not
 * polluting heading semantics.
 *
 * Before:  <h4>vs</h4>
 * After:   <span class="gs-vs-badge">vs</span>
 */
function compareTransform(section: HTMLElement): void {
  const h4 = section.querySelector(':scope > h4');
  if (h4 === null) return;

  const badge = document.createElement('span');
  badge.className = 'gs-vs-badge';
  badge.textContent = h4.textContent;
  h4.replaceWith(badge);
}

registerLayoutTransform('layout-three-col', threeColTransform);
registerLayoutTransform('layout-compare', compareTransform);
registerLayoutTransform('layout-features', threeColTransform);
