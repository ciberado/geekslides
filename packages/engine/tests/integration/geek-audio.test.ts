// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioSlide } from '../../src/components/AudioSlide.ts';
import type { MediaState } from '../../src/sync/types.ts';

if (!customElements.get('geek-audio')) {
  customElements.define('geek-audio', AudioSlide);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a <geek-audio> inside a shadow root so #observeSlide fires. */
function createInShadow(src = 'test.mp3') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const el = document.createElement('geek-audio') as AudioSlide;
  el.setAttribute('src', src);
  shadow.appendChild(el);
  return { host, shadow, el };
}

/** Create a standalone <geek-audio> appended to document.body. */
function createElement(src = 'test.mp3', title?: string) {
  const el = document.createElement('geek-audio') as AudioSlide;
  el.setAttribute('src', src);
  if (title) el.setAttribute('title', title);
  document.body.appendChild(el);
  return el;
}

/** Get the <audio> element from the shadow root. */
function getAudio(el: AudioSlide): HTMLAudioElement {
  return el.shadowRoot!.querySelector('audio')!;
}

/** Get the <canvas> element from the shadow root. */
function getCanvas(el: AudioSlide): HTMLCanvasElement {
  return el.shadowRoot!.querySelector('canvas')!;
}

/** Get the .gs-audio-bars element from the shadow root. */
function getBars(el: AudioSlide): HTMLElement {
  return el.shadowRoot!.querySelector('.gs-audio-bars')!;
}

async function flushPromises(rounds = 4) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------

describe('geek-audio', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
      createMediaElementSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 0,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn(),
        connect: vi.fn(),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  describe('custom element registration', () => {
    it('is registered as "geek-audio"', () => {
      expect(customElements.get('geek-audio')).toBe(AudioSlide);
    });
  });

  // -------------------------------------------------------------------------
  describe('shadow DOM structure', () => {
    it('renders a <canvas> element', () => {
      const el = createElement();
      expect(getCanvas(el)).not.toBeNull();
    });

    it('renders a <audio> element with controls', () => {
      const el = createElement();
      const audio = getAudio(el);
      expect(audio).not.toBeNull();
      expect(audio.hasAttribute('controls')).toBe(true);
    });

    it('renders a .gs-audio-bars wrapper', () => {
      const el = createElement();
      expect(getBars(el)).not.toBeNull();
    });

    it('renders exactly 9 .gs-audio-bar children inside .gs-audio-bars', () => {
      const el = createElement();
      const bars = el.shadowRoot!.querySelectorAll('.gs-audio-bar');
      expect(bars.length).toBe(9);
    });

    it('canvas is visible (no display:none) by default', () => {
      const el = createElement();
      expect(getCanvas(el).style.display).not.toBe('none');
    });

    it('bars are hidden (display:none) by default', () => {
      const el = createElement();
      expect(getBars(el).style.display).toBe('none');
    });
  });

  // -------------------------------------------------------------------------
  describe('attribute reflection', () => {
    it('reflects src attribute to the inner <audio> src', () => {
      const el = createElement('https://example.com/track.mp3');
      const audio = getAudio(el);
      expect(audio.getAttribute('src')).toBe('https://example.com/track.mp3');
    });

    it('reflects title attribute to the inner <audio> title', () => {
      const el = createElement('track.mp3', 'Background Music');
      const audio = getAudio(el);
      expect(audio.getAttribute('title')).toBe('Background Music');
    });

    it('does not add a title attribute when none is provided', () => {
      const el = createElement('track.mp3');
      const audio = getAudio(el);
      expect(audio.getAttribute('title')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('#observeSlide', () => {
    it('pauses audio when parent slide becomes inactive', async () => {
      const { host, el } = createInShadow();
      const audio = getAudio(el);
      vi.spyOn(audio, 'pause').mockImplementation(() => { /* no-op */ });

      // Make the host active, then inactive.
      host.setAttribute('active', '');
      await flushPromises();
      host.removeAttribute('active');
      await flushPromises();

      expect(audio.pause).toHaveBeenCalled();
    });

    it('does not throw when element is not inside a shadow root', () => {
      const el = createElement();
      expect(() => el.connectedCallback()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('applyRemoteState', () => {
    it('seeks (sets currentTime) when diff > 0.5s', () => {
      const el = createElement();
      const audio = getAudio(el);
      vi.spyOn(audio, 'play').mockResolvedValue(undefined);
      audio.currentTime = 0;

      el.applyRemoteState({ playing: true, currentTime: 5, timestamp: Date.now() });

      // elapsed ≈ 0, targetTime ≈ 5, diff = 5 > 0.5 → seek
      expect(audio.currentTime).toBeCloseTo(5, 0);
    });

    it('does NOT seek when diff <= 0.5s', () => {
      const el = createElement();
      const audio = getAudio(el);
      vi.spyOn(audio, 'play').mockResolvedValue(undefined);
      audio.currentTime = 5;

      el.applyRemoteState({ playing: true, currentTime: 5, timestamp: Date.now() });

      expect(audio.currentTime).toBe(5);
    });

    it('calls audio.play() when state.playing is true', () => {
      const el = createElement();
      const audio = getAudio(el);
      const playSpy = vi.spyOn(audio, 'play').mockResolvedValue(undefined);

      el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

      expect(playSpy).toHaveBeenCalled();
    });

    it('calls audio.pause() when state.playing is false', () => {
      const el = createElement();
      const audio = getAudio(el);
      vi.spyOn(audio, 'play').mockResolvedValue(undefined);
      const pauseSpy = vi.spyOn(audio, 'pause').mockImplementation(() => { /* no-op */ });

      el.applyRemoteState({ playing: false, currentTime: 0, timestamp: Date.now() });

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('does nothing when not yet connected (no audio element)', () => {
      const el = document.createElement('geek-audio') as AudioSlide;
      // NOT appended to document → no shadow DOM → no #audio
      expect(() =>
        el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() }),
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('loadedmetadata event → visualiser mode', () => {
    it('switches to CSS visualiser when duration exceeds threshold', () => {
      const el = createElement();
      const audio = getAudio(el);
      const canvas = getCanvas(el);
      const bars = getBars(el);

      // Set a duration larger than the 300s default threshold
      Object.defineProperty(audio, 'duration', { value: 400, configurable: true });
      audio.dispatchEvent(new Event('loadedmetadata'));

      expect(canvas.style.display).toBe('none');
      expect(bars.style.display).toBe('flex');
    });

    it('stays with canvas visualiser when duration is below threshold', () => {
      const el = createElement();
      const audio = getAudio(el);
      const canvas = getCanvas(el);
      const bars = getBars(el);

      Object.defineProperty(audio, 'duration', { value: 30, configurable: true });
      audio.dispatchEvent(new Event('loadedmetadata'));

      expect(canvas.style.display).toBe('block');
      expect(bars.style.display).toBe('none');
    });

    it('switches to CSS visualiser when duration is not finite (NaN)', () => {
      const el = createElement();
      const audio = getAudio(el);
      const canvas = getCanvas(el);
      const bars = getBars(el);

      // jsdom default: duration is NaN
      Object.defineProperty(audio, 'duration', { value: NaN, configurable: true });
      audio.dispatchEvent(new Event('loadedmetadata'));

      expect(canvas.style.display).toBe('none');
      expect(bars.style.display).toBe('flex');
    });
  });

  // -------------------------------------------------------------------------
  describe('geek:media:state event', () => {
    it('dispatches geek:media:state (bubbles, composed) on audio play', () => {
      const el = createElement();
      const audio = getAudio(el);
      vi.spyOn(audio, 'play').mockResolvedValue(undefined);

      let capturedEvent: CustomEvent<MediaState> | null = null;
      el.addEventListener('geek:media:state', (e) => {
        capturedEvent = e as CustomEvent<MediaState>;
      });

      // Fire a play event on the audio element in shadow root (capture phase listener)
      audio.dispatchEvent(new Event('play', { bubbles: false }));

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.bubbles).toBe(true);
      expect(capturedEvent!.composed).toBe(true);
      expect(capturedEvent!.detail.playing).toBe(true);
    });

    it('includes currentTime in the dispatched state', () => {
      const el = createElement();
      const audio = getAudio(el);
      vi.spyOn(audio, 'play').mockResolvedValue(undefined);
      audio.currentTime = 0; // jsdom default

      let capturedDetail: MediaState | null = null;
      el.addEventListener('geek:media:state', (e) => {
        capturedDetail = (e as CustomEvent<MediaState>).detail;
      });

      audio.dispatchEvent(new Event('play', { bubbles: false }));

      expect(capturedDetail).not.toBeNull();
      expect(typeof capturedDetail!.currentTime).toBe('number');
      expect(typeof capturedDetail!.timestamp).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  describe('disconnectedCallback', () => {
    it('does not throw on disconnect', () => {
      const el = createElement();
      expect(() => el.remove()).not.toThrow();
    });

    it('disconnects the observer so inactive-slide no longer pauses audio', async () => {
      const { host, el } = createInShadow();
      const audio = getAudio(el);
      const pauseSpy = vi.spyOn(audio, 'pause').mockImplementation(() => { /* no-op */ });

      el.remove(); // disconnect → observer torn down

      host.removeAttribute('active');
      await flushPromises();

      expect(pauseSpy).not.toHaveBeenCalled();
    });
  });
});
