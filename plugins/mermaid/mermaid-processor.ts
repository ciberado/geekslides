/**
 * GeekSlides v2 — Mermaid diagram processor.
 *
 * Finds `<pre><code class="language-mermaid">` elements in rendered slides
 * and replaces them with SVG diagrams via the Mermaid library.
 *
 * The mermaid library is loaded lazily (dynamic import) so it doesn't
 * add weight when the processor isn't active.
 */

import type { Processor } from '@engine/plugins/types.ts';
import { createLogger } from '@engine/logging.ts';

const log = createLogger('mermaid');

let mermaidReady: Promise<typeof import('mermaid')['default']> | null = null;

function getMermaid(): Promise<typeof import('mermaid')['default']> {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      mod.default.initialize({ startOnLoad: false, theme: 'dark' });
      return mod.default;
    });
  }
  return mermaidReady;
}

let renderCounter = 0;

export const mermaidProcessor: Processor = (slideElement: HTMLElement): void => {
  const codeBlocks = slideElement.querySelectorAll<HTMLElement>('pre > code.language-mermaid');
  if (codeBlocks.length === 0) return;

  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (!pre) continue;

    const definition = code.textContent;
    if (definition.trim() === '') continue;

    renderCounter++;
    const id = `gs-mermaid-${String(renderCounter)}`;

    // Async render — replaces element when SVG is ready
    void getMermaid()
      .then(async (mermaid) => mermaid.render(id, definition))
      .then(({ svg }) => {
        const container = document.createElement('div');
        container.classList.add('gs-mermaid');
        container.innerHTML = svg;
        pre.replaceWith(container);
      })
      .catch((err: unknown) => {
        log.warn({ err }, 'failed to render diagram');
        pre.classList.add('gs-mermaid-error');
      });
  }
};
