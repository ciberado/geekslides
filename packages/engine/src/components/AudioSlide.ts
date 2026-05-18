/**
 * GeekSlides v2 — <geek-audio> Web Component.
 *
 * Wraps an `<audio>` element with a real-time frequency visualiser:
 *  - Short files (≤ `data-vis-threshold` seconds, default 300): Web Audio API
 *    `AnalyserNode` → animated frequency bars on a Canvas.
 *  - Long files or CORS-blocked sources: CSS-only animated equaliser bars
 *    (decorative, no real audio data).
 *
 * Pauses audio when the parent `<geek-slide>` becomes inactive.
 *
 * Dispatches `geek:media:state` for the `media-sync` feature.
 * Listens for `geek:media:remote-state` to apply remote presenter commands.
 *
 * Markdown syntax (via audio-plugin preprocessor):
 *   ![Background track](https://example.com/music.mp3)
 */

import type { MediaState } from '../sync/types.ts';

const DEFAULT_VIS_THRESHOLD = 300; // seconds
const BAR_COUNT = 48;
const BAR_COLOR = 'oklch(70% 0.2 260)';

export class AudioSlide extends HTMLElement {
  #observer: MutationObserver | null = null;
  #animationId: number | null = null;
  #analyser: AnalyserNode | null = null;
  #audioCtx: AudioContext | null = null;
  #useCssVisualiser = false;
  #connected = false;
  #pendingState: MediaState | null = null;
  #onAutoplayUnblocked: () => void;

  static get observedAttributes(): string[] {
    return ['src', 'data-vis-threshold'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#onAutoplayUnblocked = () => {
      if (!this.#pendingState) return;
      const root = this.getRootNode();
      const hostSlide = root instanceof ShadowRoot ? root.host : null;
      if (!hostSlide?.hasAttribute('active')) {
        this.#pendingState = null;
        return;
      }
      const state = this.#pendingState;
      this.#pendingState = null;
      this.applyRemoteState(state);
    };
  }

  connectedCallback(): void {
    this.#connected = true;
    this.#render();
    this.#observeSlide();
    this.#wireEvents();
    document.addEventListener('geek:autoplay:unblocked', this.#onAutoplayUnblocked);
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#pendingState = null;
    this.#stopVisualiser();
    this.#audioCtx?.close().catch(() => { /* best-effort */ });
    this.#audioCtx = null;
    this.#analyser = null;
    document.removeEventListener('geek:autoplay:unblocked', this.#onAutoplayUnblocked);
  }

  /** Returns the current playback position in seconds. */
  getCurrentTime(): number {
    return this.#audio?.currentTime ?? 0;
  }

  /** Apply a remote play/pause/seek state from the media-sync feature. */
  applyRemoteState(state: MediaState): void {
    const audio = this.#audio;
    if (!audio) return;

    const elapsed = (Date.now() - state.timestamp) / 1000;
    const targetTime = state.currentTime + (state.playing ? elapsed : 0);

    if (Math.abs(audio.currentTime - targetTime) > 0.5) {
      audio.currentTime = targetTime;
    }
    if (state.playing) {
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          this.#pendingState = state;
          this.dispatchEvent(new CustomEvent('geek:autoplay:blocked', { bubbles: true, composed: true }));
        }
      });
    } else {
      audio.pause();
      this.#pendingState = null;
    }
  }

  get #audio(): HTMLAudioElement | null {
    return this.shadowRoot?.querySelector('audio') ?? null;
  }

  get #canvas(): HTMLCanvasElement | null {
    return this.shadowRoot?.querySelector('canvas') ?? null;
  }

  #observeSlide(): void {
    const root = this.getRootNode();
    const hostSlide = root instanceof ShadowRoot ? root.host : null;
    if (!hostSlide) return;

    this.#observer = new MutationObserver(() => {
      if (!hostSlide.hasAttribute('active')) {
        this.#audio?.pause();
        this.#pendingState = null;
      }
    });
    this.#observer.observe(hostSlide, { attributes: true, attributeFilter: ['active'] });
  }

  #wireEvents(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    shadow.addEventListener('play', (e) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      this.#setupWebAudio(e.target);
      this.#startVisualiser();
      this.#emitState(true, e.target.currentTime);
    }, true);

    shadow.addEventListener('pause', (e) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      this.#stopVisualiser();
      this.#emitState(false, e.target.currentTime);
    }, true);

    shadow.addEventListener('seeked', (e) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      this.#emitState(!e.target.paused, e.target.currentTime);
    }, true);

    shadow.addEventListener('ended', () => {
      this.#stopVisualiser();
    }, true);

    shadow.addEventListener('loadedmetadata', (e) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      const threshold = Number(this.getAttribute('data-vis-threshold') || DEFAULT_VIS_THRESHOLD);
      this.#useCssVisualiser = !isFinite(e.target.duration) || e.target.duration > threshold;
      this.#updateVisualiserMode();
    }, true);
  }

  #setupWebAudio(audio: HTMLAudioElement): void {
    if (this.#analyser || this.#useCssVisualiser) return;
    try {
      const ctx = this.#audioCtx ?? new AudioContext();
      this.#audioCtx = ctx;
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      this.#analyser = analyser;
    } catch {
      // CORS or API unavailable — fall back to CSS visualiser.
      this.#useCssVisualiser = true;
      this.#updateVisualiserMode();
    }
  }

  #startVisualiser(): void {
    if (this.#useCssVisualiser) {
      this.shadowRoot?.querySelector('.gs-audio-bars')?.classList.add('playing');
      return;
    }
    this.#drawFrame();
  }

  #stopVisualiser(): void {
    if (this.#animationId !== null) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
    // Clear canvas
    const canvas = this.#canvas;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.shadowRoot?.querySelector('.gs-audio-bars')?.classList.remove('playing');
  }

  #drawFrame(): void {
    const analyser = this.#analyser;
    const canvas = this.#canvas;
    if (!analyser || !canvas || !this.#connected) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barWidth = (w / BAR_COUNT) - 1;
    for (let i = 0; i < BAR_COUNT; i++) {
      const value = data[Math.floor((i / BAR_COUNT) * data.length)] ?? 0;
      const barH = (value / 255) * h;
      ctx.fillStyle = BAR_COLOR;
      ctx.fillRect(i * (barWidth + 1), h - barH, barWidth, barH);
    }

    this.#animationId = requestAnimationFrame(() => { this.#drawFrame(); });
  }

  #updateVisualiserMode(): void {
    const canvas = this.#canvas;
    const bars = this.shadowRoot?.querySelector('.gs-audio-bars');
    if (canvas) canvas.style.display = this.#useCssVisualiser ? 'none' : 'block';
    if (bars instanceof HTMLElement) bars.style.display = this.#useCssVisualiser ? 'flex' : 'none';
  }

  #emitState(playing: boolean, currentTime: number): void {
    this.dispatchEvent(
      new CustomEvent<MediaState>('geek:media:state', {
        bubbles: true,
        composed: true,
        detail: { playing, currentTime, timestamp: Date.now() },
      }),
    );
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const src = this.getAttribute('src') ?? '';
    const title = this.getAttribute('title') ?? '';

    // CSS equaliser bars (decorative, for large files or CORS-blocked sources)
    let barsHtml = '<div class="gs-audio-bars" style="display:none">';
    for (let i = 0; i < 5; i++) {
      barsHtml += `<span class="gs-audio-bar" style="animation-delay:${String(i * 0.12)}s"></span>`;
    }
    barsHtml += '</div>';

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; }

      .gs-audio-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
        width: 100%;
      }

      audio { width: 100%; display: block; }

      canvas {
        width: 100%;
        height: 60px;
        display: block;
        border-radius: 4px;
        background: oklch(15% 0 0 / 0.5);
      }

      /* CSS-only animated equaliser bars */
      .gs-audio-bars {
        align-items: flex-end;
        justify-content: center;
        gap: 4px;
        height: 48px;
        padding: 4px 8px;
        background: oklch(15% 0 0 / 0.5);
        border-radius: 4px;
      }

      .gs-audio-bar {
        flex: 0 0 10px;
        height: 8px;
        background: oklch(70% 0.2 260);
        border-radius: 2px;
        transition: height 0.1s ease;
      }

      .gs-audio-bars.playing .gs-audio-bar {
        animation: gs-eq-bounce 0.8s ease-in-out infinite alternate;
      }

      @keyframes gs-eq-bounce {
        0%   { height: 8px; }
        100% { height: 44px; }
      }

      .gs-audio-bar:nth-child(1) { animation-duration: 0.7s; }
      .gs-audio-bar:nth-child(2) { animation-duration: 0.9s; }
      .gs-audio-bar:nth-child(3) { animation-duration: 0.6s; }
      .gs-audio-bar:nth-child(4) { animation-duration: 1.0s; }
      .gs-audio-bar:nth-child(5) { animation-duration: 0.75s; }
    `;

    const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'gs-audio-wrapper';
    wrapper.innerHTML = `
      <canvas width="480" height="60"></canvas>
      ${barsHtml}
      <audio controls src="${src.replace(/"/g, '&quot;')}"${titleAttr}></audio>
    `;

    shadow.replaceChildren(style, wrapper);
  }
}
