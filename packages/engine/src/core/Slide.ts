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
    this.setAttribute('role', 'group');
    this.setAttribute('aria-roledescription', 'slide');
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
   * Inject external CSS into this slide's shadow DOM.
   * Used for presentation-wide styles that need to penetrate Shadow DOM.
   */
  injectStyles(css: string): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Remove previous external styles if any
    const existing = shadow.querySelector('.gs-external-styles');
    if (existing) {
      existing.remove();
    }

    const style = document.createElement('style');
    style.classList.add('gs-external-styles');
    style.textContent = css;
    shadow.appendChild(style);
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

    const content = document.createElement('section');
    content.classList.add('content');
    if (options.id) {
      content.id = options.id;
    }
    for (const cls of options.classes) {
      content.classList.add(cls);
    }

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
        display: block;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 50%;
        left: 150%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: left var(--gs-transition-duration, 0.5s) ease-in-out,
                    opacity var(--gs-transition-duration, 0.5s) ease-out;
        pointer-events: none;
        overflow: hidden;
        background-color: white;
        background-size: cover;
        background-position: center;
      }

      :host([active]) {
        left: 50%;
        opacity: 1;
        pointer-events: auto;
        z-index: 1;
      }

      :host(.gs-prev) {
        left: -150%;
        opacity: 0;
      }

      /* Transition variants — add class on <geek-slide> */
      :host(.transition-fade) {
        left: 50% !important;
        transition: opacity var(--gs-transition-duration, 0.5s) ease-out;
      }
      :host(.transition-fade[active]) { opacity: 1; }
      :host(.transition-fade:not([active])) { opacity: 0; }

      :host(.transition-none) {
        transition: none;
      }

      /* .succession: instant replacement, no transition */
      :host(.succession), :host(.gs-prev:has(+ .succession)) {
        transition: none;
      }

      section.content {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        background: transparent;
        isolation: isolate;
      }

      /* ::: Details blocks hidden in presentation mode */
      .gs-details {
        display: none;
      }

      .gs-partial {
        visibility: hidden;
        opacity: 0;
        transition: opacity var(--gs-transition-duration, 0.5s) ease-out;
      }

      .gs-partial.gs-visible {
        visibility: visible;
        opacity: 1;
      }

      img {
        max-width: 100%;
      }

      pre {
        background: var(--gs-code-bg, #f5f5f5);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
      }

      /* Speaker notes hidden in presentation mode */
      .gs-notes {
        display: none;
      }
    `;
  }
}
