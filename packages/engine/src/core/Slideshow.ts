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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
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
    this.#mode = value;
    this.setAttribute('mode', value);
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
   * Load slides from parsed SlideData array.
   */
  loadSlides(slides: SlideData[]): void {
    this.#slides = slides;
    this.#currentSlide = 0;
    this.#currentPartial = 0;
    this.#slideElements = [];

    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Clear existing slides (keep style)
    const container = shadow.querySelector('.gs-container');
    if (container) {
      container.innerHTML = '';
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

    // Deactivate all
    for (const el of this.#slideElements) {
      el.removeAttribute('active');
    }

    slideEl.setAttribute('active', '');
    slideEl.revealPartial(this.#currentPartial);
  }

  #dispatchNavigate(): void {
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
        background: var(--gs-bg, #fff);
      }

      .gs-container {
        transform-origin: top left;
        position: relative;
        overflow: hidden;
      }
    `;

    const container = document.createElement('div');
    container.classList.add('gs-container');

    shadow.replaceChildren(style, container);
  }
}
