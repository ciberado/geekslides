/**
 * GeekSlides v2 — <geek-speaker-view> Web Component.
 *
 * Dedicated speaker interface: current slide thumbnail, next slide preview,
 * scrollable speaker notes, timer, navigation controls. Opened in a second
 * browser tab connected to the same Yjs room.
 */

import type { GeekSlidesConfig } from '../core/Config.ts';
import { Slide } from '../core/Slide.ts';
import type { SlideData } from '../core/SlideParser.ts';
import type { Processor, ProcessorContext } from '../plugins/types.ts';
import { SpeakerTimer } from './SpeakerTimer.ts';

if (typeof customElements !== 'undefined' && !customElements.get('geek-slide')) {
  customElements.define('geek-slide', Slide);
}

const SUPPORTS_ZOOM = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
  ? CSS.supports('zoom', '1')
  : false;

const SPEAKER_PREVIEW_PARTIAL_STYLES = `
  .gs-partial {
    visibility: visible !important;
    opacity: 0.42 !important;
  }

  .gs-partial.gs-visible {
    opacity: 1 !important;
  }
`;

const SPEAKER_STYLES = `
  :host {
    --gs-speaker-gap: 1rem;
    display: grid;
    grid-template-columns: minmax(22rem, 32rem) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas:
      "notes previews"
      "controls controls";
    gap: var(--gs-speaker-gap);
    width: 100vw;
    height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
    background:
      radial-gradient(circle at top right, rgba(74, 158, 255, 0.18), transparent 28%),
      linear-gradient(180deg, #111827 0%, #0f172a 100%);
    color: #e5eefb;
    font-family: system-ui, sans-serif;
  }

  .preview-stack {
    grid-area: previews;
    display: grid;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--gs-speaker-gap);
    min-height: 0;
  }

  .preview-card {
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.85rem;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.25);
  }

  .preview-label {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .current-card .preview-label {
    color: #7dd3fc;
  }

  .next-card .preview-label {
    color: #cbd5e1;
  }

  .viewport {
    position: relative;
    min-height: 0;
    overflow: hidden;
    border-radius: 10px;
    background:
      radial-gradient(circle at top center, rgba(125, 211, 252, 0.12), transparent 35%),
      #020617;
  }

  .stage {
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
    transform-origin: top left;
    pointer-events: none;
  }

  .viewport geek-slide {
    --gs-transition-duration: 0s;
    color: #000;
  }

  .viewport.empty {
    display: grid;
    place-items: center;
  }

  .empty-state {
    padding: 1.5rem;
    color: #64748b;
    font-size: 1rem;
    text-align: center;
  }

  .notes {
    grid-area: notes;
    min-width: 0;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 1.5rem;
    overflow-y: auto;
    font-size: 1.15rem;
    line-height: 1.6;
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.25);
  }

  .notes::-webkit-scrollbar {
    width: 8px;
  }

  .notes::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.45);
    border-radius: 4px;
  }

  .notes p { margin: 0.5em 0; }
  .notes ul, .notes ol { margin: 0.5em 0; padding-left: 1.5em; }
  .notes code { background: rgba(30, 41, 59, 0.9); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  .notes pre { background: rgba(30, 41, 59, 0.9); padding: 1em; border-radius: 4px; overflow-x: auto; }
  .notes a { color: #4a9eff; }

  .no-notes {
    color: #64748b;
    font-style: italic;
  }

  .controls {
    grid-area: controls;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
  }

  .timer {
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
    font-family: monospace;
    min-width: 8ch;
  }

  .counter {
    font-size: 1.1rem;
    color: #cbd5e1;
    margin-left: auto;
  }

  button {
    background: rgba(51, 65, 85, 0.9);
    color: #f8fafc;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  button:hover {
    background: rgba(71, 85, 105, 0.95);
    border-color: rgba(125, 211, 252, 0.45);
  }

  button:active { background: rgba(100, 116, 139, 0.95); }

  @media (max-width: 1100px) {
    :host {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) auto;
      grid-template-areas:
        "previews"
        "notes"
        "controls";
    }

    .notes {
      min-height: 18rem;
    }
  }

  @media (max-width: 720px) {
    :host {
      padding: 0.75rem;
    }

    .preview-stack {
      grid-template-rows: repeat(2, minmax(12rem, 1fr));
    }

    .controls {
      gap: 0.75rem;
    }

    .counter {
      margin-left: 0;
    }
  }
`;

export class SpeakerView extends HTMLElement {
  #slides: SlideData[] = [];
  #currentIndex = 0;
  #currentPartial = 0;
  #designWidth = 1920;
  #designHeight = 1080;
  #externalStyles = '';
  #fontImportsEl: HTMLStyleElement | null = null;
  #processors: readonly Processor[] = [];
  #processorConfig: GeekSlidesConfig | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #timer: SpeakerTimer;
  #timerDisplay: HTMLElement | null = null;
  #notesPanel: HTMLElement | null = null;
  #currentViewport: HTMLElement | null = null;
  #nextViewport: HTMLElement | null = null;
  #currentStage: HTMLElement | null = null;
  #nextStage: HTMLElement | null = null;
  #counterEl: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#timer = new SpeakerTimer((formatted) => {
      if (this.#timerDisplay) {
        this.#timerDisplay.textContent = formatted;
      }
    });
  }

  connectedCallback(): void {
    this.#render();
    this.#setupResizeObserver();
    this.updateSlide(this.#currentIndex);
    this.#timer.start();
  }

  disconnectedCallback(): void {
    this.#timer.reset();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#fontImportsEl?.remove();
    this.#fontImportsEl = null;
  }

  get currentIndex(): number {
    return this.#currentIndex;
  }

  get currentPartial(): number {
    return this.#currentPartial;
  }

  loadSlides(slides: SlideData[]): void {
    this.#slides = slides;
    this.updateSlide(0, 0);
  }

  setAspectRatio(ratio: string): void {
    const parts = ratio.split('/');
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (width > 0 && height > 0) {
      this.#designWidth = width * 120;
      this.#designHeight = height * 120;
      this.updateSlide(this.#currentIndex);
      this.#rescalePreviews();
    }
  }

  loadStyles(css: string): void {
    const importRegex = /@import\s+url\([^)]+\)[^;]*;/g;
    const imports = css.match(importRegex);

    if (imports && imports.length > 0) {
      if (!this.#fontImportsEl) {
        this.#fontImportsEl = document.createElement('style');
        this.#fontImportsEl.classList.add('gs-speaker-font-imports');
        document.head.appendChild(this.#fontImportsEl);
      }
      this.#fontImportsEl.textContent = imports.join('\n');
    } else if (this.#fontImportsEl) {
      this.#fontImportsEl.remove();
      this.#fontImportsEl = null;
    }

    this.#externalStyles = css.replace(importRegex, '').trim();
    this.updateSlide(this.#currentIndex, this.#currentPartial);
  }

  loadProcessors(processors: readonly Processor[], config: GeekSlidesConfig): void {
    this.#processors = [...processors];
    this.#processorConfig = config;
    this.updateSlide(this.#currentIndex, this.#currentPartial);
  }

  updateSlide(index: number, partial = 0): void {
    const maxIndex = Math.max(this.#slides.length - 1, 0);
    this.#currentIndex = Math.max(0, Math.min(index, maxIndex));
    const slide = this.#slides[this.#currentIndex];
    this.#currentPartial = slide
      ? Math.max(0, Math.min(partial, slide.partialCount))
      : 0;

    this.#renderPreview(this.#currentViewport, slide, this.#currentIndex, this.#currentPartial, 'No slide loaded');

    const nextSlide = this.#slides[this.#currentIndex + 1];
    this.#renderPreview(this.#nextViewport, nextSlide, this.#currentIndex + 1, 0, 'End of presentation');

    if (this.#notesPanel) {
      const notes = slide?.notesHtml;
      if (notes) {
        this.#notesPanel.innerHTML = notes;
        this.#notesPanel.classList.remove('no-notes');
      } else {
        this.#notesPanel.textContent = 'No notes for this slide';
        this.#notesPanel.classList.add('no-notes');
      }
      this.#notesPanel.scrollTop = 0;
    }

    if (this.#counterEl) {
      this.#counterEl.textContent = this.#slides.length > 0
        ? `${String(this.#currentIndex + 1)} / ${String(this.#slides.length)}`
        : '0 / 0';
    }

    this.#rescalePreviews();
  }

  #buildSlideOptions(slide: SlideData): Parameters<Slide['loadContent']>[1] {
    const options: Parameters<Slide['loadContent']>[1] = {
      id: slide.id,
      classes: slide.classes,
      partialCount: slide.partialCount,
    };

    if (slide.backgroundImage !== undefined) {
      options.backgroundImage = slide.backgroundImage;
    }
    if (slide.backgroundColor !== undefined) {
      options.backgroundColor = slide.backgroundColor;
    }
    if (slide.rawCss !== undefined) {
      options.rawCss = slide.rawCss;
    }
    if (slide.notesHtml !== undefined) {
      options.notesHtml = slide.notesHtml;
    }

    return options;
  }

  #renderPreview(
    viewport: HTMLElement | null,
    slide: SlideData | undefined,
    slideIndex: number,
    partial: number,
    emptyMessage: string,
  ): void {
    if (!viewport) return;

    if (!slide) {
      this.#setStageRef(viewport, null);
      viewport.classList.add('empty');
      viewport.replaceChildren(this.#createEmptyState(emptyMessage));
      return;
    }

    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.style.width = `${String(this.#designWidth)}px`;
    stage.style.height = `${String(this.#designHeight)}px`;

    const slideEl = document.createElement('geek-slide') as Slide;
    slideEl.classList.add('transition-none');
    slideEl.setAttribute('active', '');
    slideEl.loadContent(slide.html, this.#buildSlideOptions(slide));
    slideEl.revealPartial(partial);

    if (this.#externalStyles) {
      slideEl.injectStyles(this.#externalStyles);
    }

    const content = slideEl.shadowRoot?.querySelector('section.content');
    if (content instanceof HTMLElement) {
      this.#applyProcessors(content, slideIndex);
    }

    this.#injectPreviewPartialStyles(slideEl);

    stage.appendChild(slideEl);
    viewport.classList.remove('empty');
    viewport.replaceChildren(stage);
    this.#setStageRef(viewport, stage);
    this.#rescalePreview(viewport, stage);
  }

  #applyProcessors(slideElement: HTMLElement, slideIndex: number): void {
    if (this.#processors.length === 0 || !this.#processorConfig) {
      return;
    }

    const context: ProcessorContext = {
      slideIndex,
      slideCount: this.#slides.length,
      config: this.#processorConfig,
      slideshow: this,
    };

    for (const processor of this.#processors) {
      processor(slideElement, context);
    }
  }

  #injectPreviewPartialStyles(slideEl: Slide): void {
    const shadow = slideEl.shadowRoot;
    if (!shadow) {
      return;
    }

    const existing = shadow.querySelector('.gs-speaker-preview-styles');
    if (existing) {
      return;
    }

    const style = document.createElement('style');
    style.className = 'gs-speaker-preview-styles';
    style.textContent = SPEAKER_PREVIEW_PARTIAL_STYLES;
    shadow.appendChild(style);
  }

  #createEmptyState(message: string): HTMLElement {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = message;
    return empty;
  }

  #setStageRef(viewport: HTMLElement, stage: HTMLElement | null): void {
    if (viewport === this.#currentViewport) {
      this.#currentStage = stage;
      return;
    }

    if (viewport === this.#nextViewport) {
      this.#nextStage = stage;
    }
  }

  #setupResizeObserver(): void {
    if (this.#resizeObserver || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.#resizeObserver = new ResizeObserver(() => {
      this.#rescalePreviews();
    });

    this.#resizeObserver.observe(this);
    if (this.#currentViewport) {
      this.#resizeObserver.observe(this.#currentViewport);
    }
    if (this.#nextViewport) {
      this.#resizeObserver.observe(this.#nextViewport);
    }
  }

  #rescalePreviews(): void {
    this.#rescalePreview(this.#currentViewport, this.#currentStage);
    this.#rescalePreview(this.#nextViewport, this.#nextStage);
  }

  #rescalePreview(viewport: HTMLElement | null, stage: HTMLElement | null): void {
    if (!viewport || !stage) {
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (viewportWidth === 0 || viewportHeight === 0) {
      return;
    }

    const scale = Math.min(
      viewportWidth / this.#designWidth,
      viewportHeight / this.#designHeight,
    );

    stage.style.width = `${String(this.#designWidth)}px`;
    stage.style.height = `${String(this.#designHeight)}px`;
    stage.style.left = `${String((viewportWidth - (this.#designWidth * scale)) / 2)}px`;
    stage.style.top = `${String((viewportHeight - (this.#designHeight * scale)) / 2)}px`;

    if (SUPPORTS_ZOOM) {
      stage.style.setProperty('zoom', String(scale));
      stage.style.transform = 'none';
    } else {
      stage.style.removeProperty('zoom');
      stage.style.transform = `scale(${String(scale)})`;
    }
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = SPEAKER_STYLES;

    this.#notesPanel = document.createElement('div');
    this.#notesPanel.className = 'notes no-notes';
    this.#notesPanel.textContent = 'No notes for this slide';

    const previewStack = document.createElement('section');
    previewStack.className = 'preview-stack';

    const currentCard = document.createElement('section');
    currentCard.className = 'preview-card current-card';
    const currentLabel = document.createElement('span');
    currentLabel.className = 'preview-label';
    currentLabel.textContent = 'Current Slide';
    this.#currentViewport = document.createElement('div');
    this.#currentViewport.className = 'viewport';
    currentCard.append(currentLabel, this.#currentViewport);

    const nextCard = document.createElement('section');
    nextCard.className = 'preview-card next-card';
    const nextLabel = document.createElement('span');
    nextLabel.className = 'preview-label';
    nextLabel.textContent = 'Next Slide';
    this.#nextViewport = document.createElement('div');
    this.#nextViewport.className = 'viewport';
    nextCard.append(nextLabel, this.#nextViewport);

    previewStack.append(currentCard, nextCard);

    const controls = document.createElement('div');
    controls.className = 'controls';

    this.#timerDisplay = document.createElement('span');
    this.#timerDisplay.className = 'timer';
    this.#timerDisplay.textContent = '00:00:00';

    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => {
      if (this.#timer.running) {
        this.#timer.pause();
        pauseBtn.textContent = 'Resume';
      } else {
        this.#timer.start();
        pauseBtn.textContent = 'Pause';
      }
    });

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      this.#timer.reset();
      pauseBtn.textContent = 'Start';
    });

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '\u25C0';
    prevBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('geek:speaker:navigate', {
        bubbles: true,
        detail: { direction: 'prev' },
      }));
    });

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '\u25B6';
    nextBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('geek:speaker:navigate', {
        bubbles: true,
        detail: { direction: 'next' },
      }));
    });

    this.#counterEl = document.createElement('span');
    this.#counterEl.className = 'counter';
    this.#counterEl.textContent = '0 / 0';

    controls.append(this.#timerDisplay, pauseBtn, resetBtn, prevBtn, nextBtn, this.#counterEl);

    shadow.replaceChildren(style, this.#notesPanel, previewStack, controls);
  }
}
