/**
 * GeekSlides v2 — <geek-slideshow> Web Component.
 *
 * Root orchestrator: receives SlideData[], creates <geek-slide> children,
 * manages navigation, aspect-ratio scaling, and mode transitions.
 */

import type { SlideData } from './SlideParser.ts';
import { Slide } from './Slide.ts';

export type SlideshowMode = 'present' | 'speaker' | 'overview';

export class Slideshow extends HTMLElement {
  #slides: SlideData[] = [];
  #slideElements: Slide[] = [];
  #currentSlide = 0;
  #currentPartial = 0;
  #mode: SlideshowMode = 'present';
  #resizeObserver: ResizeObserver | null = null;
  #aspectRatio = 16 / 9;
  #designWidth = 1920;
  #designHeight = 1080;
  #externalStyles = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.setAttribute('role', 'region');
    this.setAttribute('aria-roledescription', 'slide deck');
    this.#render();
    this.#setupResizeObserver();
  }

  disconnectedCallback(): void {
    this.#resizeObserver?.disconnect();
  }

  get currentSlide(): number {
    return this.#currentSlide;
  }

  get currentPartial(): number {
    return this.#currentPartial;
  }

  get slideCount(): number {
    return this.#slides.length;
  }

  get mode(): SlideshowMode {
    return this.#mode;
  }

  set mode(value: SlideshowMode) {
    const prevMode = this.#mode;
    this.#mode = value;
    this.setAttribute('mode', value);

    if (value === 'overview') {
      // In overview mode, make all slides visible and clickable
      for (let i = 0; i < this.#slideElements.length; i++) {
        const el = this.#slideElements[i];
        if (!el) continue;
        el.classList.remove('gs-prev');
        el.dataset.slideIndex = String(i);
      }
      this.#setupOverviewClickHandlers();
    } else if (prevMode === 'overview') {
      // Returning from overview — re-activate current slide
      this.#removeOverviewClickHandlers();
      this.#activateSlide(this.#currentSlide);
      this.#rescale();
    }

    this.#updateProgress();
  }

  #overviewClickHandler = (e: Event): void => {
    const target = (e.currentTarget as HTMLElement);
    const idx = Number(target.dataset.slideIndex);
    if (!isNaN(idx)) {
      this.mode = 'present';
      this.goTo(idx);
    }
  };

  #setupOverviewClickHandlers(): void {
    for (const el of this.#slideElements) {
      el.addEventListener('click', this.#overviewClickHandler);
    }
  }

  #removeOverviewClickHandlers(): void {
    for (const el of this.#slideElements) {
      el.removeEventListener('click', this.#overviewClickHandler);
    }
  }

  /**
   * Set the aspect ratio (e.g. "16/9" or "4/3").
   */
  setAspectRatio(ratio: string): void {
    const parts = ratio.split('/');
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (w > 0 && h > 0) {
      this.#aspectRatio = w / h;
      this.#designWidth = w * 120;   // 1920 for 16:9
      this.#designHeight = h * 120;  // 1080 for 16:9
      this.#rescale();
    }
  }

  /**
   * Load external CSS to inject into every slide's shadow DOM.
   * Extracts @import rules (e.g. Google Fonts) and hoists them to
   * the main document <head> so fonts load globally.
   * Call before loadSlides() or it will re-inject into existing slides.
   */
  loadStyles(css: string): void {
    // Hoist @import rules to the main document so web fonts work across shadow DOM
    const importRegex = /@import\s+url\([^)]+\)[^;]*;/g;
    const imports = css.match(importRegex);
    if (imports) {
      const linkStyle = document.createElement('style');
      linkStyle.classList.add('gs-font-imports');
      linkStyle.textContent = imports.join('\n');
      document.head.appendChild(linkStyle);
    }

    // Keep the remaining CSS (without @import) for shadow DOM injection
    this.#externalStyles = css.replace(importRegex, '').trim();

    // Re-inject into existing slides
    for (const el of this.#slideElements) {
      el.injectStyles(this.#externalStyles);
    }
  }

  /**
   * Load slides from parsed SlideData array.
   */
  loadSlides(slides: SlideData[]): void {
    this.#slides = slides;
    this.#currentSlide = 0;
    this.#currentPartial = 0;
    this.#slideElements = [];

    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Clear existing slides but preserve non-slide children (e.g. <geek-whiteboard>)
    const container = shadow.querySelector('.gs-container');
    if (container) {
      const preserve: Element[] = [];
      for (const child of Array.from(container.children)) {
        if (child.tagName !== 'GEEK-SLIDE') {
          preserve.push(child);
        }
      }
      container.innerHTML = '';
      for (const el of preserve) {
        container.appendChild(el);
      }
    }

    for (const slideData of slides) {
      const slideEl = new Slide();
      container?.appendChild(slideEl);

      const options: Parameters<Slide['loadContent']>[1] = {
        id: slideData.id,
        classes: slideData.classes,
        partialCount: slideData.partialCount,
      };

      if (slideData.backgroundImage !== undefined) {
        options.backgroundImage = slideData.backgroundImage;
      }
      if (slideData.backgroundColor !== undefined) {
        options.backgroundColor = slideData.backgroundColor;
      }
      if (slideData.rawCss !== undefined) {
        options.rawCss = slideData.rawCss;
      }
      if (slideData.notesHtml !== undefined) {
        options.notesHtml = slideData.notesHtml;
      }

      slideEl.loadContent(slideData.html, options);

      // Inject external presentation-wide styles into slide shadow DOM
      if (this.#externalStyles) {
        slideEl.injectStyles(this.#externalStyles);
      }

      this.#slideElements.push(slideEl);
    }

    // Activate first slide
    if (this.#slideElements.length > 0) {
      this.#activateSlide(0);
    }

    this.#rescale();

    this.dispatchEvent(new CustomEvent('geek:slides:loaded', {
      bubbles: true,
      detail: { slideCount: slides.length },
    }));
  }

  /**
   * Navigate to the next partial or slide.
   */
  next(): void {
    const current = this.#slideElements[this.#currentSlide];
    if (!current) return;

    if (this.#currentPartial < current.partialCount) {
      this.#currentPartial++;
      current.revealPartial(this.#currentPartial);
      this.#dispatchNavigate();
      return;
    }

    if (this.#currentSlide < this.#slides.length - 1) {
      this.goTo(this.#currentSlide + 1);
    }
  }

  /**
   * Navigate to the previous partial or slide.
   */
  prev(): void {
    const current = this.#slideElements[this.#currentSlide];
    if (!current) return;

    if (this.#currentPartial > 0) {
      this.#currentPartial--;
      current.revealPartial(this.#currentPartial);
      this.#dispatchNavigate();
      return;
    }

    if (this.#currentSlide > 0) {
      this.goTo(this.#currentSlide - 1);
    }
  }

  /**
   * Jump to a specific slide and optionally a partial.
   */
  goTo(slide: number, partial?: number): void {
    const targetSlide = Math.max(0, Math.min(slide, this.#slides.length - 1));

    // Deactivate current slide
    const currentEl = this.#slideElements[this.#currentSlide];
    if (currentEl) {
      currentEl.removeAttribute('active');
    }

    this.#currentSlide = targetSlide;
    this.#currentPartial = partial ?? 0;
    this.#activateSlide(targetSlide);
    this.#dispatchNavigate();
  }

  #activateSlide(index: number): void {
    const slideEl = this.#slideElements[index];
    if (!slideEl) return;

    const total = this.#slides.length;

    // Update all slides: set prev/active classes for scroll transition
    for (let i = 0; i < this.#slideElements.length; i++) {
      const el = this.#slideElements[i];
      if (!el) continue;

      el.removeAttribute('active');
      el.classList.remove('gs-prev');
      el.setAttribute('aria-hidden', 'true');

      if (i < index) {
        el.classList.add('gs-prev');
      }
    }

    slideEl.setAttribute('active', '');
    slideEl.removeAttribute('aria-hidden');
    slideEl.setAttribute('aria-label', `Slide ${String(index + 1)} of ${String(total)}`);
    slideEl.revealPartial(this.#currentPartial);
  }

  #dispatchNavigate(): void {
    this.#updateProgress();
    this.dispatchEvent(new CustomEvent('geek:navigate', {
      bubbles: true,
      detail: {
        slide: this.#currentSlide,
        partial: this.#currentPartial,
        slideCount: this.#slides.length,
        mode: this.#mode,
      },
    }));
  }

  #updateProgress(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const bar = shadow.querySelector<HTMLElement>('.gs-progress-bar');
    const counter = shadow.querySelector<HTMLElement>('.gs-progress-counter');
    const wrapper = shadow.querySelector<HTMLElement>('.gs-progress');
    const ariaLive = shadow.querySelector<HTMLElement>('.gs-aria-live');
    if (!bar || !counter || !wrapper) return;

    const total = this.#slides.length;
    const pct = total > 0 ? ((this.#currentSlide + 1) / total) * 100 : 0;
    bar.style.width = `${String(pct)}%`;
    counter.textContent = `${String(this.#currentSlide + 1)} / ${String(total)}`;
    wrapper.style.display = this.#mode === 'overview' ? 'none' : '';

    if (ariaLive) {
      ariaLive.textContent = `Slide ${String(this.#currentSlide + 1)} of ${String(total)}`;
    }
  }

  #setupResizeObserver(): void {
    this.#resizeObserver = new ResizeObserver(() => {
      this.#rescale();
    });
    this.#resizeObserver.observe(this);
  }

  #rescale(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const container = shadow.querySelector<HTMLElement>('.gs-container');
    if (!container) return;

    const hostWidth = this.clientWidth;
    const hostHeight = this.clientHeight;

    if (hostWidth === 0 || hostHeight === 0) return;

    const scaleX = hostWidth / this.#designWidth;
    const scaleY = hostHeight / this.#designHeight;
    const scale = Math.min(scaleX, scaleY);

    container.style.setProperty('--gs-scale-factor', String(scale));
    container.style.transform = `scale(${String(scale)})`;
    container.style.width = `${String(this.#designWidth)}px`;
    container.style.height = `${String(this.#designHeight)}px`;
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        position: relative;
        background: var(--gs-bg, #404040);
      }

      .gs-container {
        transform-origin: top left;
        position: relative;
        overflow: hidden;
      }

      :host([mode="overview"]) {
        overflow: auto;
      }

      :host([mode="overview"]) .gs-container {
        transform: none !important;
        width: 100% !important;
        height: auto !important;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
        padding: 16px;
        box-sizing: border-box;
      }

      :host([mode="overview"]) .gs-container geek-slide {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        transform: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        border: 2px solid transparent;
        transition: border-color 0.2s ease;
      }

      :host([mode="overview"]) .gs-container geek-slide[active] {
        border-color: rgba(74, 158, 255, 0.8);
      }

      :host([mode="overview"]) .gs-container geek-slide:hover {
        border-color: rgba(74, 158, 255, 0.5);
      }

      .gs-progress {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        pointer-events: none;
      }

      .gs-progress-bar {
        height: 3px;
        background: var(--gs-progress-color, rgba(74, 158, 255, 0.7));
        transition: width 0.3s ease;
        width: 0%;
      }

      .gs-progress-counter {
        position: absolute;
        bottom: 8px;
        right: 12px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        user-select: none;
      }

      .gs-aria-live {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }

      .gs-shortcuts-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(6px);
        justify-content: center;
        align-items: center;
        font-family: system-ui, sans-serif;
        color: #e5eefb;
      }

      .gs-shortcuts-overlay[open] {
        display: flex;
      }

      .gs-shortcuts-panel {
        max-width: 540px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        padding: 2rem;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.2);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
      }

      .gs-shortcuts-panel h2 {
        margin: 0 0 1.2rem;
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7dd3fc;
      }

      .gs-shortcuts-panel dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.4rem 1.2rem;
        margin: 0 0 1.4rem;
        font-size: 0.95rem;
      }

      .gs-shortcuts-panel dt {
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        color: #8be9fd;
        text-align: right;
      }

      .gs-shortcuts-panel dd {
        margin: 0;
        color: #cbd5e1;
      }

      .gs-shortcuts-hint {
        margin-top: 1rem;
        text-align: center;
        font-size: 0.8rem;
        color: #64748b;
      }

      .gs-toolbar {
        display: none;
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 150;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 6px 10px;
        gap: 4px;
        align-items: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        font-family: system-ui, sans-serif;
      }

      .gs-toolbar[open] {
        display: flex;
      }

      :host([mode="overview"]) .gs-toolbar {
        display: none !important;
      }

      .gs-toolbar button {
        background: transparent;
        border: none;
        color: #cbd5e1;
        font-size: 1.2rem;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease, color 0.15s ease;
        padding: 0;
      }

      .gs-toolbar button:hover {
        background: rgba(148, 163, 184, 0.2);
        color: #e5eefb;
      }

      .gs-toolbar button:active {
        background: rgba(148, 163, 184, 0.35);
      }

      .gs-toolbar .gs-toolbar-sep {
        width: 1px;
        height: 24px;
        background: rgba(148, 163, 184, 0.2);
        margin: 0 2px;
      }
    `;

    const container = document.createElement('div');
    container.classList.add('gs-container');

    const progress = document.createElement('div');
    progress.classList.add('gs-progress');

    const progressBar = document.createElement('div');
    progressBar.classList.add('gs-progress-bar');

    const progressCounter = document.createElement('div');
    progressCounter.classList.add('gs-progress-counter');

    progress.appendChild(progressBar);
    progress.appendChild(progressCounter);

    const ariaLive = document.createElement('div');
    ariaLive.classList.add('gs-aria-live');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.setAttribute('aria-atomic', 'true');

    const shortcutsOverlay = document.createElement('div');
    shortcutsOverlay.classList.add('gs-shortcuts-overlay');
    shortcutsOverlay.innerHTML = `
      <div class="gs-shortcuts-panel">
        <h2>Keyboard Shortcuts</h2>
        <dl>
          <dt>→ ↓ Space</dt><dd>Next slide / partial</dd>
          <dt>← ↑</dt><dd>Previous slide / partial</dd>
          <dt>Home</dt><dd>First slide</dd>
          <dt>End</dt><dd>Last slide</dd>
          <dt>t</dt><dd>Open command terminal</dd>
          <dt>?</dt><dd>Toggle this help</dd>
        </dl>
        <h2>Terminal Commands</h2>
        <dl>
          <dt>help</dt><dd>List all commands</dd>
          <dt>go &lt;n&gt;</dt><dd>Jump to slide n</dd>
          <dt>load &lt;url&gt;</dt><dd>Load a different deck</dd>
          <dt>room &lt;name&gt;</dt><dd>Switch sync room</dd>
          <dt>speaker</dt><dd>Open speaker view</dd>
          <dt>overview</dt><dd>Toggle overview mode</dd>
          <dt>fullscreen</dt><dd>Toggle fullscreen</dd>
          <dt>whiteboard</dt><dd>Toggle whiteboard</dd>
        </dl>
        <div class="gs-shortcuts-hint">Press <strong>?</strong> or <strong>Esc</strong> to close</div>
      </div>
    `;
    shortcutsOverlay.addEventListener('click', (e) => {
      if (e.target === shortcutsOverlay) this.toggleShortcutsOverlay();
    });
    shortcutsOverlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.toggleShortcutsOverlay();
    });

    const toolbar = document.createElement('div');
    toolbar.classList.add('gs-toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Presentation controls');

    const toolbarButtons: Array<{ label: string; icon: string; command: string }> = [
      { label: 'Previous slide', icon: '\u25C0', command: 'prev' },
      { label: 'Next slide', icon: '\u25B6', command: 'next' },
      { label: 'Overview', icon: '\u229E', command: 'overview' },
      { label: 'Fullscreen', icon: '\u26F6', command: 'fullscreen' },
      { label: 'Whiteboard', icon: '\u270E', command: 'whiteboard' },
      { label: 'Speaker view', icon: '\uD83C\uDFA4', command: 'speaker' },
    ];

    for (const btn of toolbarButtons) {
      if (btn.command === 'overview') {
        const sep = document.createElement('div');
        sep.classList.add('gs-toolbar-sep');
        toolbar.appendChild(sep);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', btn.label);
      button.dataset.command = btn.command;
      button.textContent = btn.icon;
      button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('geek:toolbar:command', {
          bubbles: true,
          detail: { command: btn.command },
        }));
      });
      toolbar.appendChild(button);
    }

    shadow.replaceChildren(style, container, progress, ariaLive, shortcutsOverlay, toolbar);
  }

  /**
   * Toggle the keyboard shortcuts overlay.
   */
  toggleShortcutsOverlay(): void {
    const overlay = this.shadowRoot?.querySelector('.gs-shortcuts-overlay');
    if (!overlay) return;
    if (overlay.hasAttribute('open')) {
      overlay.removeAttribute('open');
    } else {
      overlay.setAttribute('open', '');
    }
  }

  /**
   * Toggle the presentation toolbar.
   */
  toggleToolbar(): void {
    const toolbar = this.shadowRoot?.querySelector('.gs-toolbar');
    if (!toolbar) return;
    if (toolbar.hasAttribute('open')) {
      toolbar.removeAttribute('open');
    } else {
      toolbar.setAttribute('open', '');
    }
  }
}
