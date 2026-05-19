/**
 * GeekSlides v2 — <geek-video> Web Component.
 *
 * Video player with timestamp-based partial control and media-sync support.
 *
 * Dispatches `geek:media:state` events so the `media-sync` feature can
 * synchronise play/pause/seek across presenter and viewers.
 * Listens for `geek:media:remote-state` to apply remote presenter commands.
 */

import type { MediaState } from '../sync/types.ts';

export class VideoSlide extends HTMLElement {
  #timestamps: number[] = [];
  #observer: MutationObserver | null = null;
  #pendingState: MediaState | null = null;
  #onAutoplayUnblocked: () => void;

  static get observedAttributes(): string[] {
    return ['data-timestamps', 'partial', 'cover'];
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
    this.#render();
    this.#parseTimestamps();
    this.#observeSlide();
    this.#wireEvents();
    document.addEventListener('geek:autoplay:unblocked', this.#onAutoplayUnblocked);
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#pendingState = null;
    document.removeEventListener('geek:autoplay:unblocked', this.#onAutoplayUnblocked);
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
    if (name === 'data-timestamps') {
      this.#parseTimestamps();
    }
    if (name === 'partial' && newVal !== null) {
      this.#seekToPartial(Number(newVal));
    }
  }

  /** Returns the current playback position in seconds. */
  getCurrentTime(): number {
    return this.shadowRoot?.querySelector('video')?.currentTime ?? 0;
  }

  /**
   * Seek to a specific partial index.
   */
  seekToPartial(index: number): void {
    this.#seekToPartial(index);
  }

  /** Apply a remote play/pause/seek state from the media-sync feature. */
  applyRemoteState(state: MediaState): void {
    const video = this.shadowRoot?.querySelector('video');
    if (!video) return;

    const elapsed = (Date.now() - state.timestamp) / 1000;
    const targetTime = state.currentTime + (state.playing ? elapsed : 0);

    if (Math.abs(video.currentTime - targetTime) > 0.5) {
      video.currentTime = targetTime;
    }
    if (state.playing) {
      video.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          this.#pendingState = state;
          this.dispatchEvent(new CustomEvent('geek:autoplay:blocked', { bubbles: true, composed: true }));
        }
      });
    } else {
      video.pause();
      this.#pendingState = null;
    }
  }

  #observeSlide(): void {
    const root = this.getRootNode();
    const hostSlide = root instanceof ShadowRoot ? root.host : null;
    if (!hostSlide) return;

    this.#observer = new MutationObserver(() => {
      if (!hostSlide.hasAttribute('active')) {
        const video = this.shadowRoot?.querySelector('video');
        video?.pause();
        this.#pendingState = null;
      }
    });
    this.#observer.observe(hostSlide, { attributes: true, attributeFilter: ['active'] });
  }

  #wireEvents(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const emit = (playing: boolean, currentTime: number): void => {
      this.dispatchEvent(
        new CustomEvent<MediaState>('geek:media:state', {
          bubbles: true,
          composed: true,
          detail: { playing, currentTime, timestamp: Date.now() },
        }),
      );
    };

    shadow.addEventListener('play', (e) => {
      if (e.target instanceof HTMLVideoElement) emit(true, e.target.currentTime);
    }, true);

    shadow.addEventListener('pause', (e) => {
      if (e.target instanceof HTMLVideoElement) emit(false, e.target.currentTime);
    }, true);

    shadow.addEventListener('seeked', (e) => {
      if (e.target instanceof HTMLVideoElement) emit(!e.target.paused, e.target.currentTime);
    }, true);
  }

  #parseTimestamps(): void {
    const attr = this.getAttribute('data-timestamps');
    if (!attr) {
      this.#timestamps = [];
      return;
    }
    this.#timestamps = attr.split(',').map((s) => Number(s.trim()));
  }

  #seekToPartial(index: number): void {
    const video = this.shadowRoot?.querySelector('video');
    if (!video) return;

    if (index >= 0 && index < this.#timestamps.length) {
      const time = this.#timestamps[index];
      if (time !== undefined) {
        video.currentTime = time;
        void video.play();
      }
    }
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; }
      video { width: 100%; height: auto; max-height: 60vh; display: block; }
      :host([cover]) {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      :host([cover]) video {
        height: 100%;
        max-height: none;
        object-fit: cover;
      }
    `;

    // Check if video is already in shadow (re-connection after DOM move)
    const existingVideo = shadow.querySelector('video');
    if (existingVideo) {
      // Just update the style element
      const existingStyle = shadow.querySelector('style');
      if (existingStyle) {
        existingStyle.textContent = style.textContent;
      } else {
        shadow.prepend(style);
      }
      return;
    }

    // Move the <video> from light DOM into shadow
    const video = this.querySelector('video');
    if (video) {
      shadow.replaceChildren(style, video);
    } else {
      shadow.replaceChildren(style);
    }
  }
}
