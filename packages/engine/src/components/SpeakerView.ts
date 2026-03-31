/**
 * GeekSlides v2 — <geek-speaker-view> Web Component.
 *
 * Dedicated speaker interface: current slide thumbnail, next slide preview,
 * scrollable speaker notes, timer, navigation controls. Opened in a second
 * browser tab connected to the same Yjs room.
 */

import type { SlideData } from '../core/SlideParser.ts';
import { SpeakerTimer } from './SpeakerTimer.ts';

const SPEAKER_STYLES = `
  :host {
    display: grid;
    grid-template-columns: 1fr 1fr 1.2fr;
    grid-template-rows: 1fr auto;
    gap: 1rem;
    width: 100vw;
    height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
    background: #1a1a1a;
    color: #fff;
    font-family: system-ui, sans-serif;
  }

  .thumbnail {
    position: relative;
    overflow: hidden;
    border-radius: 6px;
    background: #000;
  }

  .thumbnail-inner {
    position: absolute;
    top: 0;
    left: 0;
    width: 1024px;
    height: 768px;
    transform: scale(var(--thumb-scale, 0.3));
    transform-origin: top left;
    pointer-events: none;
  }

  .current {
    border: 3px solid #4a9eff;
  }

  .next {
    border: 3px solid #555;
    opacity: 0.7;
  }

  .notes {
    grid-row: 1 / 3;
    background: #2a2a2a;
    border-radius: 6px;
    padding: 1.5rem;
    overflow-y: auto;
    font-size: 1.2rem;
    line-height: 1.6;
  }

  .notes::-webkit-scrollbar {
    width: 8px;
  }

  .notes::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 4px;
  }

  .notes p { margin: 0.5em 0; }
  .notes ul, .notes ol { margin: 0.5em 0; padding-left: 1.5em; }
  .notes code { background: #333; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  .notes pre { background: #333; padding: 1em; border-radius: 4px; overflow-x: auto; }
  .notes a { color: #4a9eff; }

  .no-notes {
    color: #666;
    font-style: italic;
  }

  .controls {
    grid-column: 1 / 3;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #2a2a2a;
    border-radius: 6px;
  }

  .timer {
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
    font-family: monospace;
    min-width: 8ch;
  }

  .counter {
    font-size: 1.1rem;
    color: #aaa;
    margin-left: auto;
  }

  button {
    background: #444;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  button:hover { background: #555; }
  button:active { background: #666; }
`;

export class SpeakerView extends HTMLElement {
  #slides: SlideData[] = [];
  #currentIndex = 0;
  #timer: SpeakerTimer;
  #timerDisplay: HTMLElement | null = null;
  #notesPanel: HTMLElement | null = null;
  #currentThumb: HTMLElement | null = null;
  #nextThumb: HTMLElement | null = null;
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
    this.#timer.start();
  }

  disconnectedCallback(): void {
    this.#timer.reset();
  }

  loadSlides(slides: SlideData[]): void {
    this.#slides = slides;
    this.updateSlide(0);
  }

  updateSlide(index: number): void {
    this.#currentIndex = index;

    // Current slide thumbnail
    if (this.#currentThumb) {
      const slide = this.#slides[index];
      this.#currentThumb.innerHTML = slide ? slide.html : '';
    }

    // Next slide thumbnail
    if (this.#nextThumb) {
      const nextSlide = this.#slides[index + 1];
      this.#nextThumb.innerHTML = nextSlide ? nextSlide.html : '<p style="color:#666;padding:2rem;">End of presentation</p>';
    }

    // Notes
    if (this.#notesPanel) {
      const slide = this.#slides[index];
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

    // Counter
    if (this.#counterEl) {
      this.#counterEl.textContent = `${String(index + 1)} / ${String(this.#slides.length)}`;
    }
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = SPEAKER_STYLES;

    // Current slide thumbnail
    const currentContainer = document.createElement('div');
    currentContainer.className = 'thumbnail current';
    this.#currentThumb = document.createElement('div');
    this.#currentThumb.className = 'thumbnail-inner';
    currentContainer.appendChild(this.#currentThumb);

    // Next slide thumbnail
    const nextContainer = document.createElement('div');
    nextContainer.className = 'thumbnail next';
    this.#nextThumb = document.createElement('div');
    this.#nextThumb.className = 'thumbnail-inner';
    nextContainer.appendChild(this.#nextThumb);

    // Notes panel
    this.#notesPanel = document.createElement('div');
    this.#notesPanel.className = 'notes no-notes';
    this.#notesPanel.textContent = 'No notes for this slide';

    // Controls bar
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

    shadow.replaceChildren(style, currentContainer, nextContainer, this.#notesPanel, controls);
  }
}
