/**
 * GeekSlides v2 — <geek-audio> Web Component.
 *
 * Wraps an `<audio>` element with a real-time symmetric frequency visualiser:
 *  - Short files (≤ `data-vis-threshold` seconds, default 300): Web Audio API
 *    `AnalyserNode` → symmetric bars radiating up AND down from a centre line.
 *  - Long files or CORS-blocked sources: CSS-only animated symmetric bars
 *    (decorative, no real audio data).
 *
 * Visualiser colour is configurable via the `data-color` attribute (CSS colour
 * string, default `oklch(65% 0.25 255)`).  A gradient from centre outward is
 * always applied for a more polished look.
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
const BAR_COUNT = 64;
const DEFAULT_BAR_COLOR = 'oklch(65% 0.25 255)';

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
    return ['src', 'data-vis-threshold', 'data-color'];
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
    // Draw idle waveform so the canvas isn't blank before playback.
    requestAnimationFrame(() => { this.#drawIdle(); });
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
    // Draw idle state (subtle centre line + tiny bars)
    this.#drawIdle();
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
    const cy = h / 2;            // vertical centre for symmetric bars
    ctx.clearRect(0, 0, w, h);   // transparent background

    const barColor = this.getAttribute('data-color') ?? DEFAULT_BAR_COLOR;
    const barWidth = w / BAR_COUNT - 1;

    for (let i = 0; i < BAR_COUNT; i++) {
      const value = data[Math.floor((i / BAR_COUNT) * (data.length * 0.75))] ?? 0;
      const halfH = Math.max(1, (value / 255) * cy * 0.95);

      // Build a vertical gradient: brighter at centre, dimmer at edges.
      const grad = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
      grad.addColorStop(0, barColor + '44');   // top edge (faded)
      grad.addColorStop(0.35, barColor);       // upper body
      grad.addColorStop(0.5, barColor);        // centre (full colour)
      grad.addColorStop(0.65, barColor);       // lower body
      grad.addColorStop(1, barColor + '44');   // bottom edge (faded)

      ctx.fillStyle = grad;
      const x = i * (barWidth + 1);
      ctx.fillRect(x, cy - halfH, barWidth, halfH * 2);
    }

    this.#animationId = requestAnimationFrame(() => { this.#drawFrame(); });
  }

  /** Draw a subtle idle state so the canvas isn't blank before playback. */
  #drawIdle(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    const barColor = this.getAttribute('data-color') ?? DEFAULT_BAR_COLOR;
    const barWidth = w / BAR_COUNT - 1;

    // Draw tiny bars at rest (3px from centre)
    for (let i = 0; i < BAR_COUNT; i++) {
      const halfH = 2 + Math.sin(i * 0.3) * 1.5;
      ctx.fillStyle = barColor + '55'; // very faded
      const x = i * (barWidth + 1);
      ctx.fillRect(x, cy - halfH, barWidth, halfH * 2);
    }
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
    const barColor = this.getAttribute('data-color') ?? DEFAULT_BAR_COLOR;

    // CSS fallback: 9 symmetric bars that bounce both up and down from centre.
    const NUM_CSS_BARS = 9;
    let barsHtml = '<div class="gs-audio-bars" style="display:none">';
    for (let i = 0; i < NUM_CSS_BARS; i++) {
      barsHtml += `<span class="gs-audio-bar" style="animation-delay:${String(i * 0.08)}s"></span>`;
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
        height: 80px;
        display: block;
        border-radius: 6px;
        /* transparent background — bars float on whatever is behind */
        background: transparent;
      }

      /* CSS-only animated symmetric equaliser bars */
      .gs-audio-bars {
        align-items: center;       /* vertically centre bars */
        justify-content: center;
        gap: 3px;
        height: 80px;
        padding: 4px 8px;
        background: transparent;
        border-radius: 6px;
      }

      .gs-audio-bar {
        flex: 0 0 8px;
        height: 4px;
        background: ${barColor};
        border-radius: 2px;
      }

      .gs-audio-bars.playing .gs-audio-bar {
        animation: gs-eq-sym 0.8s ease-in-out infinite alternate;
      }

      /* Bar grows symmetrically (transform scales from centre via scaleY) */
      @keyframes gs-eq-sym {
        0%   { height: 4px; opacity: 0.6; }
        100% { height: 64px; opacity: 1; }
      }

      .gs-audio-bar:nth-child(1) { animation-duration: 0.65s; }
      .gs-audio-bar:nth-child(2) { animation-duration: 0.90s; }
      .gs-audio-bar:nth-child(3) { animation-duration: 0.55s; }
      .gs-audio-bar:nth-child(4) { animation-duration: 1.05s; }
      .gs-audio-bar:nth-child(5) { animation-duration: 0.70s; }
      .gs-audio-bar:nth-child(6) { animation-duration: 0.80s; }
      .gs-audio-bar:nth-child(7) { animation-duration: 0.60s; }
      .gs-audio-bar:nth-child(8) { animation-duration: 0.95s; }
      .gs-audio-bar:nth-child(9) { animation-duration: 0.75s; }
    `;

    const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'gs-audio-wrapper';
    wrapper.innerHTML = `
      <canvas width="640" height="80"></canvas>
      ${barsHtml}
      <audio controls src="${src.replace(/"/g, '&quot;')}"${titleAttr}></audio>
    `;

    shadow.replaceChildren(style, wrapper);
  }
}
