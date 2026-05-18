/**
 * GeekSlides v2 — <geek-youtube> Web Component.
 *
 * Embeds a YouTube video using the YouTube IFrame API. Lazy-loads when the
 * parent `<geek-slide>` becomes active; pauses when it becomes inactive.
 *
 * Supports a `cover` attribute to fill the slide as a background.
 *
 * Dispatches `geek:media:state` events so the `media-sync` feature can
 * synchronise play/pause/seek across presenter and viewers.
 * Listens for `geek:media:remote-state` to apply remote presenter commands.
 *
 * Markdown syntax (via youtube-plugin preprocessor):
 *   ![My Video](https://youtu.be/dQw4w9WgXcQ)
 *   ![cover](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
 */

import type { MediaState } from '../sync/types.ts';

/** Minimal interface for a YouTube IFrame Player instance. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}

/** Minimal interface for the YouTube IFrame API exposed on window.YT. */
interface YouTubeAPI {
  Player: new (container: string | HTMLElement, opts: {
    videoId?: string;
    playerVars?: Record<string, number>;
    events?: {
      onStateChange?: (e: { data: number }) => void;
    };
  }) => YTPlayer;
  PlayerState: {
    readonly PLAYING: 1;
    readonly BUFFERING: 3;
  };
}

/** Returns the YouTube IFrame API if it has been loaded, or undefined. */
function getYouTubeAPI(): YouTubeAPI | undefined {
  return (window as unknown as Record<string, unknown>)['YT'] as YouTubeAPI | undefined;
}

// Shared promise that resolves once the YouTube IFrame API is ready.
let ytReady: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (ytReady) return ytReady;

  ytReady = new Promise<void>((resolve) => {
    if (getYouTubeAPI()) {
      resolve();
      return;
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return ytReady;
}

export class YoutubeSlide extends HTMLElement {
  #player: YTPlayer | null = null;
  #videoId = '';
  #observer: MutationObserver | null = null;
  #loaded = false;
  /** State stored while awaiting autoplay confirmation or banner dismissal. */
  #pendingState: MediaState | null = null;
  #autoplayCheckTimer: ReturnType<typeof setTimeout> | null = null;
  #onAutoplayUnblocked: () => void;

  static get observedAttributes(): string[] {
    return ['data-id', 'cover'];
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
    this.#videoId = this.getAttribute('data-id') ?? '';
    this.#render();
    this.#observeSlide();
    document.addEventListener('geek:autoplay:unblocked', this.#onAutoplayUnblocked);
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#player?.destroy();
    this.#player = null;
    this.#loaded = false;
    this.#pendingState = null;
    if (this.#autoplayCheckTimer !== null) {
      clearTimeout(this.#autoplayCheckTimer);
      this.#autoplayCheckTimer = null;
    }
    document.removeEventListener('geek:autoplay:unblocked', this.#onAutoplayUnblocked);
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
    if (name === 'data-id') {
      this.#videoId = newVal ?? '';
    }
  }

  /** Returns the current playback position in seconds. */
  getCurrentTime(): number {
    return this.#player?.getCurrentTime() ?? 0;
  }

  /** Called by media-sync feature when the presenter plays/seeks. */
  applyRemoteState(state: MediaState): void {
    const player = this.#player;
    if (!player) return;

    // Correct for network latency: adjust seek target by elapsed wall time.
    const elapsed = (Date.now() - state.timestamp) / 1000;
    const targetTime = state.currentTime + (state.playing ? elapsed : 0);

    if (Math.abs(player.getCurrentTime() - targetTime) > 0.5) {
      player.seekTo(targetTime, true);
    }

    if (state.playing) {
      player.playVideo();
      // YouTube's playVideo() is void — it can't throw NotAllowedError.
      // Detect blocked autoplay by checking if the player transitioned to
      // PLAYING or BUFFERING within a short window.
      this.#pendingState = state;
      if (this.#autoplayCheckTimer !== null) clearTimeout(this.#autoplayCheckTimer);
      this.#autoplayCheckTimer = setTimeout(() => {
        this.#autoplayCheckTimer = null;
        if (!this.#pendingState) return; // Already cleared by onStateChange → success
        // Player hasn't started — autoplay is blocked by the browser.
        this.dispatchEvent(new CustomEvent('geek:autoplay:blocked', { bubbles: true, composed: true }));
      }, 800);
    } else {
      this.#clearPending();
      player.pauseVideo();
    }
  }

  #clearPending(): void {
    this.#pendingState = null;
    if (this.#autoplayCheckTimer !== null) {
      clearTimeout(this.#autoplayCheckTimer);
      this.#autoplayCheckTimer = null;
    }
  }

  #observeSlide(): void {
    const root = this.getRootNode();
    const hostSlide = root instanceof ShadowRoot ? root.host : null;
    if (!hostSlide) return;

    this.#observer = new MutationObserver(() => {
      if (hostSlide.hasAttribute('active')) {
        void this.#activate();
      } else {
        this.#deactivate();
      }
    });
    this.#observer.observe(hostSlide, { attributes: true, attributeFilter: ['active'] });

    // Activate immediately if already active (e.g. first slide on load).
    if (hostSlide.hasAttribute('active')) {
      void this.#activate();
    }
  }

  async #activate(): Promise<void> {
    if (this.#loaded || !this.#videoId) return;
    this.#loaded = true;

    await loadYouTubeAPI();

    const shadow = this.shadowRoot;
    if (!shadow) return;

    const container = shadow.getElementById('yt-container');
    if (!container) return;

    const yt = getYouTubeAPI();
    if (!yt) return;

    this.#player = new yt.Player(container, {
      videoId: this.#videoId,
      playerVars: {
        enablejsapi: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onStateChange: (e: { data: number }) => {
          this.#onPlayerStateChange(e);
        },
      },
    });
  }

  #deactivate(): void {
    this.#clearPending();
    this.#player?.pauseVideo();
  }

  #onPlayerStateChange(e: { data: number }): void {
    const state = e.data;
    const yt = getYouTubeAPI();
    const playing = yt
      ? state === yt.PlayerState.PLAYING || state === yt.PlayerState.BUFFERING
      : false;

    // Autoplay succeeded — clear pending check.
    if (playing && this.#pendingState) {
      this.#clearPending();
    }

    this.dispatchEvent(
      new CustomEvent<MediaState>('geek:media:state', {
        bubbles: true,
        composed: true,
        detail: {
          playing,
          currentTime: this.#player?.getCurrentTime() ?? 0,
          timestamp: Date.now(),
        },
      }),
    );
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const isCover = this.hasAttribute('cover');

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
      }
      :host([cover]) {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        aspect-ratio: unset;
      }
      #yt-container,
      #yt-container iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }
    `;

    const container = document.createElement('div');
    container.id = 'yt-container';
    if (isCover) container.style.height = '100%';

    shadow.replaceChildren(style, container);
  }
}
