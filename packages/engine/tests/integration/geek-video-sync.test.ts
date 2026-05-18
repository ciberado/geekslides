// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { VideoSlide } from '../../src/components/VideoSlide.ts';
import type { MediaState } from '../../src/sync/types.ts';

if (!customElements.get('geek-video')) {
  customElements.define('geek-video', VideoSlide);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a <geek-video> with an inner <video> attached to document.body. */
function createElement() {
  const el = document.createElement('geek-video') as VideoSlide;
  const video = document.createElement('video');
  el.appendChild(video); // light-DOM video is moved to shadow on connectedCallback
  document.body.appendChild(el);
  const shadowVideo = el.shadowRoot?.querySelector('video') as HTMLVideoElement;
  // mock play/pause so jsdom doesn't complain
  vi.spyOn(shadowVideo, 'play').mockResolvedValue(undefined);
  vi.spyOn(shadowVideo, 'pause').mockImplementation(() => { /* no-op */ });
  return { el, shadowVideo };
}

/** Create a <geek-video> inside a shadow root for observeSlide tests. */
function createInShadow() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const outer = host.attachShadow({ mode: 'open' });

  const el = document.createElement('geek-video') as VideoSlide;
  const video = document.createElement('video');
  el.appendChild(video);
  outer.appendChild(el);

  const shadowVideo = el.shadowRoot?.querySelector('video') as HTMLVideoElement;
  vi.spyOn(shadowVideo, 'play').mockResolvedValue(undefined);
  vi.spyOn(shadowVideo, 'pause').mockImplementation(() => { /* no-op */ });

  return { host, el, shadowVideo };
}

async function flushPromises(rounds = 4) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------

describe('geek-video sync', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  describe('custom element registration', () => {
    it('is registered as "geek-video"', () => {
      expect(customElements.get('geek-video')).toBe(VideoSlide);
    });
  });

  // -------------------------------------------------------------------------
  describe('applyRemoteState', () => {
    it('sets video.currentTime when diff > 0.5s (playing)', () => {
      const { el, shadowVideo } = createElement();
      shadowVideo.currentTime = 0;

      const state: MediaState = { playing: true, currentTime: 3, timestamp: Date.now() };
      el.applyRemoteState(state);

      // elapsed ≈ 0, targetTime ≈ 3, diff = 3 > 0.5 → seek
      expect(shadowVideo.currentTime).toBeCloseTo(3, 0);
    });

    it('sets video.currentTime when diff > 0.5s (paused)', () => {
      const { el, shadowVideo } = createElement();
      shadowVideo.currentTime = 0;

      const state: MediaState = { playing: false, currentTime: 3, timestamp: Date.now() };
      el.applyRemoteState(state);

      expect(shadowVideo.currentTime).toBeCloseTo(3, 0);
    });

    it('does NOT seek when diff <= 0.5s', () => {
      const { el, shadowVideo } = createElement();
      shadowVideo.currentTime = 3;

      const state: MediaState = { playing: true, currentTime: 3, timestamp: Date.now() };
      el.applyRemoteState(state);

      expect(shadowVideo.currentTime).toBe(3); // unchanged
    });

    it('calls video.play() when state.playing is true', () => {
      const { el, shadowVideo } = createElement();
      shadowVideo.currentTime = 0;

      el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

      expect(shadowVideo.play).toHaveBeenCalled();
      expect(shadowVideo.pause).not.toHaveBeenCalled();
    });

    it('calls video.pause() when state.playing is false', () => {
      const { el, shadowVideo } = createElement();
      shadowVideo.currentTime = 0;

      el.applyRemoteState({ playing: false, currentTime: 0, timestamp: Date.now() });

      expect(shadowVideo.pause).toHaveBeenCalled();
      expect(shadowVideo.play).not.toHaveBeenCalled();
    });

    it('does not seek when diff is within 0.5s (exact match)', () => {
      const { el, shadowVideo } = createElement();
      shadowVideo.currentTime = 10;

      // targetTime = 10 + 0 = 10, diff = |10 - 10| = 0
      el.applyRemoteState({ playing: true, currentTime: 10, timestamp: Date.now() });

      // currentTime should remain 10
      expect(shadowVideo.currentTime).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  describe('#observeSlide (pause when inactive)', () => {
    it('pauses video when slide becomes inactive', async () => {
      const { host, shadowVideo } = createInShadow();

      host.setAttribute('active', '');
      await flushPromises();

      host.removeAttribute('active');
      await flushPromises();

      expect(shadowVideo.pause).toHaveBeenCalled();
    });

    it('does NOT pause when slide is still active', async () => {
      const { host, shadowVideo } = createInShadow();

      host.setAttribute('active', '');
      await flushPromises();

      // Attribute changed but still active → observer fires but condition is false
      host.setAttribute('active', 'still-active');
      await flushPromises();

      expect(shadowVideo.pause).not.toHaveBeenCalled();
    });

    it('does not throw when element is not inside a shadow root', () => {
      const el = document.createElement('geek-video') as VideoSlide;
      expect(() => document.body.appendChild(el)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('geek:media:state event', () => {
    it('dispatches geek:media:state (bubbles, composed) on video play', () => {
      const { el, shadowVideo } = createElement();

      let capturedEvent: CustomEvent<MediaState> | null = null;
      el.addEventListener('geek:media:state', (e) => {
        capturedEvent = e as CustomEvent<MediaState>;
      });

      // Fire play on the inner video (shadow capture listener re-emits as geek:media:state)
      shadowVideo.dispatchEvent(new Event('play', { bubbles: false }));

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.bubbles).toBe(true);
      expect(capturedEvent!.composed).toBe(true);
      expect(capturedEvent!.detail.playing).toBe(true);
    });

    it('dispatches geek:media:state with playing=false on video pause', () => {
      const { el, shadowVideo } = createElement();

      let capturedDetail: MediaState | null = null;
      el.addEventListener('geek:media:state', (e) => {
        capturedDetail = (e as CustomEvent<MediaState>).detail;
      });

      shadowVideo.dispatchEvent(new Event('pause', { bubbles: false }));

      expect(capturedDetail).not.toBeNull();
      expect(capturedDetail!.playing).toBe(false);
    });

    it('dispatches geek:media:state on video seeked', () => {
      const { el, shadowVideo } = createElement();

      let capturedDetail: MediaState | null = null;
      el.addEventListener('geek:media:state', (e) => {
        capturedDetail = (e as CustomEvent<MediaState>).detail;
      });

      shadowVideo.dispatchEvent(new Event('seeked', { bubbles: false }));

      expect(capturedDetail).not.toBeNull();
      expect(typeof capturedDetail!.currentTime).toBe('number');
      expect(typeof capturedDetail!.timestamp).toBe('number');
    });

    it('geek:media:state bubbles to document', () => {
      const { el, shadowVideo } = createElement();
      // el is already in document.body via createElement(); do NOT re-append (would
      // trigger disconnectedCallback → connectedCallback, wiping the shadow DOM).

      let received = false;
      el.addEventListener('geek:media:state', () => { received = true; }, { once: true, capture: false });

      shadowVideo.dispatchEvent(new Event('play', { bubbles: false }));

      // The geek:media:state event (bubbles:true, composed:true) is dispatched on el,
      // so an ancestor listener on el itself fires.
      expect(received).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('disconnectedCallback', () => {
    it('does not throw when disconnected', () => {
      const { el } = createElement();
      expect(() => el.remove()).not.toThrow();
    });

    it('stops observing after disconnect (inactive slide no longer pauses)', async () => {
      const { host, el, shadowVideo } = createInShadow();

      el.remove(); // disconnect

      host.removeAttribute('active');
      await flushPromises();

      expect(shadowVideo.pause).not.toHaveBeenCalled();
    });
  });
});
