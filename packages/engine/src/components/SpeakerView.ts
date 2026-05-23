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
import {
  SUPPORTS_ZOOM,
  DEFAULT_NOTES_FONT_SIZE_REM,
  MIN_NOTES_FONT_SIZE_REM,
  MAX_NOTES_FONT_SIZE_REM,
  MIN_NOTES_WIDTH_PX,
  MIN_PREVIEW_HEIGHT_PX,
  SPLITTER_SIZE_PX,
  MOBILE_LAYOUT_BREAKPOINT_PX,
  SPEAKER_PREVIEW_PARTIAL_STYLES,
  SPEAKER_STYLES,
} from './speaker-view-styles.ts';

if (typeof customElements !== 'undefined' && !customElements.get('geek-slide')) {
  customElements.define('geek-slide', Slide);
}

export class SpeakerView extends HTMLElement {
  #slides: SlideData[] = [];
  #currentIndex = 0;
  #currentPartial = 0;
  #designWidth = 1920;
  #designHeight = 1080;
  #notesFontSizeRem = DEFAULT_NOTES_FONT_SIZE_REM;
  #notesWidthPx: number | null = null;
  #currentPreviewHeightPx: number | null = null;
  #externalStyles = '';
  #fontImportsEl: HTMLStyleElement | null = null;
  #processors: readonly Processor[] = [];
  #processorConfig: GeekSlidesConfig | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #timer: SpeakerTimer;
  #mainLayout: HTMLElement | null = null;
  #previewStack: HTMLElement | null = null;
  #timerDisplay: HTMLElement | null = null;
  #notesPanel: HTMLElement | null = null;
  #notesBody: HTMLElement | null = null;
  #currentViewport: HTMLElement | null = null;
  #nextViewport: HTMLElement | null = null;
  #currentStage: HTMLElement | null = null;
  #nextStage: HTMLElement | null = null;
  #counterEl: HTMLElement | null = null;
  #wallClockEl: HTMLElement | null = null;
  #wallClockInterval: ReturnType<typeof setInterval> | null = null;

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
    if (this.#wallClockInterval !== null) {
      clearInterval(this.#wallClockInterval);
      this.#wallClockInterval = null;
    }
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
      this.updateSlide(this.#currentIndex, this.#currentPartial);
      this.#rescalePreviews();
    }
  }

  /**
   * Set the design-space dimensions directly (in pixels).
   * Use this when loading a PPTX-imported deck whose slide size is known.
   * Must be called after setAspectRatio() if both are used.
   */
  setDesignDimensions(width: number, height: number): void {
    if (width > 0 && height > 0) {
      this.#designWidth = width;
      this.#designHeight = height;
      this.updateSlide(this.#currentIndex, this.#currentPartial);
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

    if (this.#notesPanel && this.#notesBody) {
      const notes = slide?.notesHtml;
      if (notes) {
        this.#notesBody.innerHTML = notes;
        this.#notesPanel.classList.remove('no-notes');
        this.#notesBody.classList.remove('no-notes');
      } else {
        this.#notesBody.textContent = 'No notes for this slide';
        this.#notesPanel.classList.add('no-notes');
        this.#notesBody.classList.add('no-notes');
      }
      this.#notesBody.scrollTop = 0;
    }

    if (this.#counterEl) {
      this.#counterEl.textContent = this.#slides.length > 0
        ? `${String(this.#currentIndex + 1)} / ${String(this.#slides.length)}`
        : '0 / 0';
    }

    this.#applyLayout();
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

  #adjustNotesFontSize(delta: number): void {
    this.#notesFontSizeRem = this.#clamp(
      this.#notesFontSizeRem + delta,
      MIN_NOTES_FONT_SIZE_REM,
      MAX_NOTES_FONT_SIZE_REM,
    );
    this.#applyNotesFontSize();
  }

  #applyNotesFontSize(): void {
    this.style.setProperty('--gs-speaker-notes-font-size', `${String(this.#notesFontSizeRem)}rem`);
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
      this.#applyLayout();
      this.#rescalePreviews();
    });

    this.#resizeObserver.observe(this);
    if (this.#mainLayout) {
      this.#resizeObserver.observe(this.#mainLayout);
    }
    if (this.#previewStack) {
      this.#resizeObserver.observe(this.#previewStack);
    }
    if (this.#currentViewport) {
      this.#resizeObserver.observe(this.#currentViewport);
    }
    if (this.#nextViewport) {
      this.#resizeObserver.observe(this.#nextViewport);
    }
  }

  #applyLayout(): void {
    if (!this.#mainLayout || !this.#previewStack) {
      return;
    }

    if (this.clientWidth <= MOBILE_LAYOUT_BREAKPOINT_PX) {
      this.#mainLayout.style.removeProperty('grid-template-columns');
      this.#previewStack.style.removeProperty('grid-template-rows');
      return;
    }

    const mainWidth = this.#mainLayout.clientWidth;
    if (mainWidth > 0) {
      const maxNotesWidth = Math.max(
        MIN_NOTES_WIDTH_PX,
        mainWidth - MIN_NOTES_WIDTH_PX - SPLITTER_SIZE_PX,
      );
      if (this.#notesWidthPx === null) {
        this.#notesWidthPx = this.#clamp(mainWidth * 0.38, MIN_NOTES_WIDTH_PX, maxNotesWidth);
      } else {
        this.#notesWidthPx = this.#clamp(this.#notesWidthPx, MIN_NOTES_WIDTH_PX, maxNotesWidth);
      }

      this.#mainLayout.style.gridTemplateColumns = `${String(this.#notesWidthPx)}px ${String(SPLITTER_SIZE_PX)}px minmax(0, 1fr)`;
    }

    const previewHeight = this.#previewStack.clientHeight;
    if (previewHeight > 0) {
      const maxCurrentHeight = Math.max(
        MIN_PREVIEW_HEIGHT_PX,
        previewHeight - MIN_PREVIEW_HEIGHT_PX - SPLITTER_SIZE_PX,
      );
      if (this.#currentPreviewHeightPx === null) {
        this.#currentPreviewHeightPx = this.#clamp(previewHeight * 0.56, MIN_PREVIEW_HEIGHT_PX, maxCurrentHeight);
      } else {
        this.#currentPreviewHeightPx = this.#clamp(this.#currentPreviewHeightPx, MIN_PREVIEW_HEIGHT_PX, maxCurrentHeight);
      }

      this.#previewStack.style.gridTemplateRows = `${String(this.#currentPreviewHeightPx)}px ${String(SPLITTER_SIZE_PX)}px minmax(0, 1fr)`;
    }
  }

  #startResize(kind: 'main' | 'preview', event: PointerEvent): void {
    if (this.clientWidth <= MOBILE_LAYOUT_BREAKPOINT_PX) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.setPointerCapture(event.pointerId);
    this.setAttribute('data-resizing', kind);

    const startX = event.clientX;
    const startY = event.clientY;
    const startNotesWidth = this.#notesWidthPx ?? 0;
    const startPreviewHeight = this.#currentPreviewHeightPx ?? 0;

    const onMove = (moveEvent: PointerEvent): void => {
      if (kind === 'main' && this.#mainLayout) {
        const maxNotesWidth = Math.max(
          MIN_NOTES_WIDTH_PX,
          this.#mainLayout.clientWidth - MIN_NOTES_WIDTH_PX - SPLITTER_SIZE_PX,
        );
        this.#notesWidthPx = this.#clamp(
          startNotesWidth + (moveEvent.clientX - startX),
          MIN_NOTES_WIDTH_PX,
          maxNotesWidth,
        );
      }

      if (kind === 'preview' && this.#previewStack) {
        const maxCurrentHeight = Math.max(
          MIN_PREVIEW_HEIGHT_PX,
          this.#previewStack.clientHeight - MIN_PREVIEW_HEIGHT_PX - SPLITTER_SIZE_PX,
        );
        this.#currentPreviewHeightPx = this.#clamp(
          startPreviewHeight + (moveEvent.clientY - startY),
          MIN_PREVIEW_HEIGHT_PX,
          maxCurrentHeight,
        );
      }

      this.#applyLayout();
      this.#rescalePreviews();
    };

    const onEnd = (): void => {
      target.releasePointerCapture(event.pointerId);
      this.removeAttribute('data-resizing');
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onEnd);
      target.removeEventListener('pointercancel', onEnd);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onEnd);
    target.addEventListener('pointercancel', onEnd);
  }

  #clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
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

    if (SUPPORTS_ZOOM) {
      stage.style.left = `${String(((viewportWidth / scale) - this.#designWidth) / 2)}px`;
      stage.style.top = `${String(((viewportHeight / scale) - this.#designHeight) / 2)}px`;
      stage.style.setProperty('zoom', String(scale));
      stage.style.transform = 'none';
    } else {
      stage.style.left = `${String((viewportWidth - (this.#designWidth * scale)) / 2)}px`;
      stage.style.top = `${String((viewportHeight - (this.#designHeight * scale)) / 2)}px`;
      stage.style.removeProperty('zoom');
      stage.style.transform = `scale(${String(scale)})`;
    }
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = SPEAKER_STYLES;

    this.#applyNotesFontSize();

    this.#mainLayout = document.createElement('section');
    this.#mainLayout.className = 'main-layout';

    this.#notesPanel = document.createElement('div');
    this.#notesPanel.className = 'notes no-notes';
    const notesHeader = document.createElement('div');
    notesHeader.className = 'notes-header';
    const notesTitle = document.createElement('span');
    notesTitle.className = 'notes-title';
    notesTitle.textContent = 'Notes';
    const notesActions = document.createElement('div');
    notesActions.className = 'notes-actions';
    const notesFontDecrease = document.createElement('button');
    notesFontDecrease.className = 'notes-font-button notes-font-decrease';
    notesFontDecrease.textContent = 'A-';
    notesFontDecrease.title = 'Decrease notes font size';
    notesFontDecrease.addEventListener('click', () => {
      this.#adjustNotesFontSize(-0.1);
    });
    const notesFontIncrease = document.createElement('button');
    notesFontIncrease.className = 'notes-font-button notes-font-increase';
    notesFontIncrease.textContent = 'A+';
    notesFontIncrease.title = 'Increase notes font size';
    notesFontIncrease.addEventListener('click', () => {
      this.#adjustNotesFontSize(0.1);
    });
    notesActions.append(notesFontDecrease, notesFontIncrease);
    notesHeader.append(notesTitle, notesActions);

    this.#notesBody = document.createElement('div');
    this.#notesBody.className = 'notes-body no-notes';
    this.#notesBody.textContent = 'No notes for this slide';
    this.#notesPanel.append(notesHeader, this.#notesBody);

    const mainSplitter = document.createElement('div');
    mainSplitter.className = 'splitter main-splitter';
    mainSplitter.addEventListener('pointerdown', (event) => {
      this.#startResize('main', event);
    });

    this.#previewStack = document.createElement('section');
    this.#previewStack.className = 'preview-stack';

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

    const previewSplitter = document.createElement('div');
    previewSplitter.className = 'splitter preview-splitter';
    previewSplitter.addEventListener('pointerdown', (event) => {
      this.#startResize('preview', event);
    });

    this.#previewStack.append(currentCard, previewSplitter, nextCard);
    this.#mainLayout.append(this.#notesPanel, mainSplitter, this.#previewStack);

    const controls = document.createElement('div');
    controls.className = 'controls';

    this.#timerDisplay = document.createElement('span');
    this.#timerDisplay.className = 'timer';
    this.#timerDisplay.textContent = '00:00:00';

    this.#wallClockEl = document.createElement('span');
    this.#wallClockEl.className = 'wall-clock';
    const updateClock = (): void => {
      if (this.#wallClockEl) {
        this.#wallClockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    };
    updateClock();
    this.#wallClockInterval = setInterval(updateClock, 10_000);

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

    pauseBtn.className = 'speaker-pause';
    resetBtn.className = 'speaker-reset';
    prevBtn.className = 'speaker-prev';
    nextBtn.className = 'speaker-next';

    controls.append(this.#timerDisplay, this.#wallClockEl, pauseBtn, resetBtn, prevBtn, nextBtn, this.#counterEl);

    shadow.replaceChildren(style, this.#mainLayout, controls);
  }
}
