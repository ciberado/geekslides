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
  #constrainRaf: number | null = null;
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
    this.#constrainToFreeSpace();
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

  /** Compute available vertical space in the slide and constrain video height. */
  #constrainToFreeSpace(): void {
    // Cancel any pending rAF from a prior connect
    if (this.#constrainRaf !== null) {
      cancelAnimationFrame(this.#constrainRaf);
      this.#constrainRaf = null;
    }
    if (this.hasAttribute('cover')) {
      const video = this.shadowRoot?.querySelector('video');
      if (video) video.style.maxHeight = '';
      return;
    }
    this.#constrainRaf = requestAnimationFrame(() => {
      this.#constrainRaf = null;
      if (this.hasAttribute('cover')) return;
      const section = this.closest('section.content') ??
        (this.getRootNode() as ShadowRoot).host?.querySelector?.('section.content');
      if (!(section instanceof HTMLElement)) return;

      const style = getComputedStyle(section);
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const contentHeight = section.clientHeight - paddingTop - paddingBottom;

      let siblingsHeight = 0;
      const parent = this.parentElement;
      for (const child of section.children) {
        if (child === parent || child.contains(this)) continue;
        siblingsHeight += (child as HTMLElement).offsetHeight ?? 0;
      }
      const available = Math.max(200, contentHeight - siblingsHeight - 60);
      const video = this.shadowRoot?.querySelector('video');
      if (video) {
        video.style.maxHeight = `${String(available)}px`;
      }
    });
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; position: relative; }
      .gs-video-container { position: relative; width: 100%; }
      video { width: 100%; height: auto; display: block; }

      .gs-play-btn {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        transition: opacity 0.3s;
        z-index: 1;
        pointer-events: none;
      }
      .gs-play-btn svg {
        width: 64px;
        height: 64px;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
        opacity: 0.85;
        transition: opacity 0.2s, transform 0.2s;
      }
      .gs-play-btn:hover svg {
        opacity: 1;
        transform: scale(1.1);
      }
      .gs-play-btn.hidden { opacity: 0; pointer-events: none; }
      .gs-play-btn:not(.hidden) { pointer-events: auto; }

      :host([cover]) { position: absolute; inset: 0; width: 100%; height: 100%; }
      :host([cover]) .gs-video-container { height: 100%; }
      :host([cover]) video { height: 100%; max-height: none; object-fit: cover; }
    `;

    const playBtn = document.createElement('div');
    playBtn.className = 'gs-play-btn';
    playBtn.innerHTML = `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="30" fill="rgba(0,0,0,0.45)"/><polygon points="26,20 26,44 46,32" fill="white"/></svg>`;

    // Check if video is already in shadow (re-connection after DOM move)
    const existingVideo = shadow.querySelector('video');
    if (existingVideo) {
      const existingStyle = shadow.querySelector('style');
      if (existingStyle) {
        existingStyle.textContent = style.textContent;
      } else {
        shadow.prepend(style);
      }
      if (!shadow.querySelector('.gs-play-btn')) {
        existingVideo.parentElement?.appendChild(playBtn);
        this.#wirePlayButton(playBtn, existingVideo);
      }
      return;
    }

    // Move the <video> from light DOM into shadow
    const video = this.querySelector('video');
    if (video) {
      video.removeAttribute('controls');
      const container = document.createElement('div');
      container.className = 'gs-video-container';
      container.append(video, playBtn);
      shadow.replaceChildren(style, container);
      this.#wirePlayButton(playBtn, video);
    } else {
      shadow.replaceChildren(style);
    }
  }

  #wirePlayButton(btn: HTMLElement, video: HTMLVideoElement): void {
    const container = video.parentElement;
    btn.addEventListener('click', () => {
      void video.play();
    });
    video.addEventListener('play', () => {
      btn.classList.add('hidden');
      video.controls = true;
    });
    video.addEventListener('pause', () => {
      btn.classList.remove('hidden');
      video.controls = false;
    });
    video.addEventListener('ended', () => {
      btn.classList.remove('hidden');
      video.controls = false;
    });
    // Show controls on hover even while paused
    if (container) {
      container.addEventListener('mouseenter', () => {
        if (!video.paused) video.controls = true;
      });
      container.addEventListener('mouseleave', () => {
        if (!video.paused) video.controls = false;
      });
    }
  }
}
