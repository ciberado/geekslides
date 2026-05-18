// @vitest-environment jsdom
/**
 * Unit tests for YoutubeSlide (<geek-youtube>) autoplay blocking detection.
 *
 * Because YouTube's playVideo() is void (not a Promise), autoplay blocking
 * is detected via a 800ms timeout: if the player has not transitioned to
 * PLAYING or BUFFERING, we assume the browser blocked it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YoutubeSlide } from '../../src/components/YoutubeSlide.ts';

if (!customElements.get('geek-youtube')) {
  customElements.define('geek-youtube', YoutubeSlide);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPlayer() {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    destroy: vi.fn(),
    _onStateChange: null as ((e: { data: number }) => void) | null,
    /** Simulate a YouTube player state change event. */
    triggerStateChange(data: number) {
      this._onStateChange?.({ data });
    },
  };
}

let mockPlayer: ReturnType<typeof createMockPlayer>;

/** Set up window.YT with a mock Player constructor.
 *  The mock captures the onStateChange handler so tests can simulate events. */
function setupYTMock() {
  mockPlayer = createMockPlayer();
  const PlayerCtor = vi.fn((_, opts: { events?: { onStateChange?: (e: { data: number }) => void } }) => {
    mockPlayer._onStateChange = opts.events?.onStateChange ?? null;
    return mockPlayer;
  });
  vi.stubGlobal('YT', {
    Player: PlayerCtor,
    PlayerState: { PLAYING: 1, BUFFERING: 3 },
  });
}

/** Flush microtask queue so async #activate() can complete. */
async function flushPromises(rounds = 6) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/** Create a <geek-youtube> inside an active slide host and wait for activation. */
async function mountActivated(dataId = 'dQw4w9WgXcQ') {
  const hostSlide = document.createElement('div');
  hostSlide.setAttribute('active', '');
  const shadow = hostSlide.attachShadow({ mode: 'open' });
  const el = document.createElement('geek-youtube') as YoutubeSlide;
  el.setAttribute('data-id', dataId);
  shadow.appendChild(el);
  document.body.appendChild(hostSlide);
  // Let #activate() run through the async loadYouTubeAPI() → new YT.Player(...)
  await flushPromises();
  return { el, hostSlide };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('YoutubeSlide autoplay blocking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupYTMock();
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('player.playVideo() is called when applyRemoteState({ playing: true }) is applied', async () => {
    const { el } = await mountActivated();

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it('dispatches geek:autoplay:blocked when player does not start within 800ms', async () => {
    const { el } = await mountActivated();

    const blockedSpy = vi.fn();
    document.addEventListener('geek:autoplay:blocked', blockedSpy);

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

    expect(blockedSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);

    expect(blockedSpy).toHaveBeenCalledTimes(1);
    document.removeEventListener('geek:autoplay:blocked', blockedSpy);
  });

  it('does NOT dispatch blocked when player transitions to PLAYING within 800ms', async () => {
    const { el } = await mountActivated();

    const blockedSpy = vi.fn();
    document.addEventListener('geek:autoplay:blocked', blockedSpy);

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

    // Simulate player successfully starting (PLAYING = 1)
    mockPlayer.triggerStateChange(1);

    vi.advanceTimersByTime(800);

    expect(blockedSpy).not.toHaveBeenCalled();
    document.removeEventListener('geek:autoplay:blocked', blockedSpy);
  });

  it('does NOT dispatch blocked when player transitions to BUFFERING within 800ms', async () => {
    const { el } = await mountActivated();

    const blockedSpy = vi.fn();
    document.addEventListener('geek:autoplay:blocked', blockedSpy);

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

    // Simulate player buffering (BUFFERING = 3)
    mockPlayer.triggerStateChange(3);

    vi.advanceTimersByTime(800);

    expect(blockedSpy).not.toHaveBeenCalled();
    document.removeEventListener('geek:autoplay:blocked', blockedSpy);
  });

  it('retries playVideo when geek:autoplay:unblocked fires', async () => {
    const { el } = await mountActivated();

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });
    vi.advanceTimersByTime(800); // fires blocked event, pendingState remains

    mockPlayer.playVideo.mockClear();

    document.dispatchEvent(new CustomEvent('geek:autoplay:unblocked'));

    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it('does not retry after unblocked if the slide is no longer active', async () => {
    const { el, hostSlide } = await mountActivated();

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });
    vi.advanceTimersByTime(800);

    hostSlide.removeAttribute('active');
    mockPlayer.playVideo.mockClear();

    document.dispatchEvent(new CustomEvent('geek:autoplay:unblocked'));

    expect(mockPlayer.playVideo).not.toHaveBeenCalled();
  });

  it('does not dispatch blocked when playing:false is applied', async () => {
    const { el } = await mountActivated();

    const blockedSpy = vi.fn();
    document.addEventListener('geek:autoplay:blocked', blockedSpy);

    el.applyRemoteState({ playing: false, currentTime: 0, timestamp: Date.now() });

    vi.advanceTimersByTime(800);

    expect(blockedSpy).not.toHaveBeenCalled();
    expect(mockPlayer.pauseVideo).toHaveBeenCalled();
    document.removeEventListener('geek:autoplay:blocked', blockedSpy);
  });

  it('removes geek:autoplay:unblocked listener after element disconnects', async () => {
    const { el } = await mountActivated();

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });
    vi.advanceTimersByTime(800);

    el.remove();
    mockPlayer.playVideo.mockClear();

    document.dispatchEvent(new CustomEvent('geek:autoplay:unblocked'));

    expect(mockPlayer.playVideo).not.toHaveBeenCalled();
  });

  it('cancels the autoplay check timer when playing:false is applied before timeout', async () => {
    const { el } = await mountActivated();

    const blockedSpy = vi.fn();
    document.addEventListener('geek:autoplay:blocked', blockedSpy);

    el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });
    // Pause before timeout fires — should cancel the check
    el.applyRemoteState({ playing: false, currentTime: 0, timestamp: Date.now() });

    vi.advanceTimersByTime(800);

    expect(blockedSpy).not.toHaveBeenCalled();
    document.removeEventListener('geek:autoplay:blocked', blockedSpy);
  });
});
