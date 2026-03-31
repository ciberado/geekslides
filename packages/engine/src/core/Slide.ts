/**
 * GeekSlides v2 — <geek-slide> Web Component.
 *
 * Individual slide container with Shadow DOM, partial reveals,
 * per-slide scoped CSS, and background support.
 */

import { scope } from './StyleScoper.ts';

export class Slide extends HTMLElement {
  #partialCount = 0;
  #visiblePartials = 0;
  #notesHtml: string | undefined;

  static get observedAttributes(): string[] {
    return ['active'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void {
    if (name === 'active') {
      if (newVal !== null) {
        this.#revealPartials(this.#visiblePartials || 1);
      }
    }
  }

  get partialCount(): number {
    return this.#partialCount;
  }

  get visiblePartials(): number {
    return this.#visiblePartials;
  }

  get notes(): string | undefined {
    return this.#notesHtml;
  }

  get isActive(): boolean {
    return this.hasAttribute('active');
  }

  /**
   * Load slide content from SlideData.
   */
  loadContent(html: string, options: {
    id: string;
    classes: readonly string[];
    backgroundImage?: string;
    backgroundColor?: string;
    rawCss?: string;
    notesHtml?: string;
    partialCount: number;
  }): void {
    this.setAttribute('data-id', options.id);

    for (const cls of options.classes) {
      this.classList.add(cls);
    }

    if (options.backgroundImage) {
      this.style.backgroundImage = `url(${options.backgroundImage})`;
      this.style.backgroundSize = 'cover';
      this.style.backgroundPosition = 'center';
    }

    if (options.backgroundColor) {
      this.style.backgroundColor = options.backgroundColor;
    }

    this.#notesHtml = options.notesHtml;
    this.#partialCount = options.partialCount;
    this.#visiblePartials = 0;

    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Build shadow DOM
    const style = document.createElement('style');
    style.textContent = this.#baseStyles();

    if (options.rawCss) {
      const scopedCss = scope(options.rawCss, options.id);
      style.textContent += '\n' + scopedCss;
    }

    const content = document.createElement('div');
    content.classList.add('content');
    content.innerHTML = html;

    // Mark partial elements
    const partials = content.querySelectorAll('[partial]');
    partials.forEach((el) => {
      el.classList.add('gs-partial');
    });

    shadow.replaceChildren(style, content);
  }

  /**
   * Reveal the first n partials. Elements after n are hidden.
   */
  revealPartial(n: number): void {
    this.#revealPartials(n);
  }

  #revealPartials(n: number): void {
    this.#visiblePartials = Math.max(0, Math.min(n, this.#partialCount));
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const partials = shadow.querySelectorAll('.gs-partial');
    partials.forEach((el, i) => {
      if (i < this.#visiblePartials) {
        el.classList.add('gs-visible');
      } else {
        el.classList.remove('gs-visible');
      }
    });
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    if (shadow.children.length === 0) {
      const style = document.createElement('style');
      style.textContent = this.#baseStyles();
      shadow.appendChild(style);
    }
  }

  #baseStyles(): string {
    return `
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        width: 100%;
        height: 100%;
        padding: var(--gs-slide-padding, 2rem 4rem);
        box-sizing: border-box;
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0;
        transition: opacity var(--gs-transition-duration, 0.3s) var(--gs-transition-timing, ease);
        pointer-events: none;
        font-family: var(--gs-font-family, system-ui, sans-serif);
        font-size: var(--gs-base-font-size, 1.5rem);
        color: var(--gs-color, #222);
        overflow: hidden;
        background-size: cover;
        background-position: center;
      }

      :host([active]) {
        opacity: 1;
        pointer-events: auto;
        z-index: 1;
      }

      .content {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .gs-partial {
        visibility: hidden;
        opacity: 0;
        transition: opacity var(--gs-transition-duration, 0.3s) var(--gs-transition-timing, ease);
      }

      .gs-partial.gs-visible {
        visibility: visible;
        opacity: 1;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      pre {
        background: var(--gs-code-bg, #f5f5f5);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        font-family: var(--gs-code-font, 'Fira Code', monospace);
        font-size: var(--gs-code-font-size, 0.9em);
      }

      code {
        font-family: var(--gs-code-font, 'Fira Code', monospace);
      }
    `;
  }
}
