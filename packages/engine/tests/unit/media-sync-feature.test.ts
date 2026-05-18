// @vitest-environment jsdom
/**
 * Unit tests for media-sync-feature.ts logic.
 *
 * Covers:
 * - composedPath() slide detection (fix for shadow DOM event retargeting)
 * - Media presence detection (conditional nav arrows)
 * - Pause-on-leave behaviour
 * - Nav arrow show/hide on mouse movement
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Feature, FeatureContext } from '../../src/features/types.ts';

vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// We import the feature dynamically to ensure mocks are in place.
let mediaSyncFeature: Feature;

beforeEach(async () => {
  const mod = await import('../../src/features/builtins/media-sync-feature.ts');
  mediaSyncFeature = mod.mediaSyncFeature;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal slideshow shadow DOM structure for testing. */
function createSlideshowDOM(slideContents: string[]): {
  slideshow: HTMLElement;
  container: HTMLElement;
  slides: HTMLElement[];
} {
  // <geek-slideshow> with shadow root containing .gs-container > geek-slide elements
  const slideshow = document.createElement('geek-slideshow');
  const showShadow = slideshow.attachShadow({ mode: 'open' });

  const gsContainer = document.createElement('div');
  gsContainer.className = 'gs-container';
  showShadow.appendChild(gsContainer);

  const slides: HTMLElement[] = [];
  for (const content of slideContents) {
    const slide = document.createElement('geek-slide');
    const slideShadow = slide.attachShadow({ mode: 'open' });
    const section = document.createElement('section');
    section.className = 'content';
    section.innerHTML = content;
    slideShadow.appendChild(section);
    gsContainer.appendChild(slide);
    slides.push(slide);
  }

  // Features container lives inside the slideshow shadow root
  const featuresDiv = document.createElement('div');
  featuresDiv.className = 'gs-features';
  showShadow.appendChild(featuresDiv);

  document.body.appendChild(slideshow);

  return { slideshow, container: featuresDiv, slides };
}

type EventCallback = (data: { slideIndex: number }) => void;

function createMockContext(
  slideshow: HTMLElement,
  container: HTMLElement,
  opts: { isViewer?: boolean; currentSlide?: number } = {},
): { ctx: FeatureContext; listeners: Record<string, EventCallback[]> } {
  const listeners: Record<string, EventCallback[]> = {};

  const ctx: FeatureContext = {
    container,
    role: opts.isViewer ? 'viewer' : 'presenter',
    slideshow: {
      currentSlide: opts.currentSlide ?? 0,
      goTo: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
    } as unknown as FeatureContext['slideshow'],
    commands: {
      register: vi.fn(),
    } as unknown as FeatureContext['commands'],
    on: vi.fn((event: string, cb: EventCallback) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event]!.push(cb);
      return () => {
        const arr = listeners[event];
        if (arr) {
          const idx = arr.indexOf(cb);
          if (idx >= 0) arr.splice(idx, 1);
        }
      };
    }) as unknown as FeatureContext['on'],
    sync: undefined,
  } as unknown as FeatureContext;

  return { ctx, listeners };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('media-sync-feature', () => {
  describe('composedPath() slide detection', () => {
    it('finds GEEK-SLIDE in the composed event path and pushes state to Yjs', () => {
      const { slideshow, container, slides } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
        '<p>No media</p>',
      ]);

      const mockMap = { set: vi.fn(), observe: vi.fn() };
      const mockSync = { getSharedMap: vi.fn(() => mockMap), isReadonly: false };

      const { ctx } = createMockContext(slideshow, container, { currentSlide: 0 });
      (ctx as unknown as { sync: unknown }).sync = mockSync;

      const cleanup = mediaSyncFeature.activate(ctx);

      // Simulate a geek:media:state event from inside slide 0's shadow DOM.
      // composedPath() must include the GEEK-SLIDE element.
      const audioEl = slides[0]!.shadowRoot!.querySelector('geek-audio')!;
      const event = new CustomEvent('geek:media:state', {
        bubbles: true,
        composed: true,
        detail: { playing: true, currentTime: 5, timestamp: Date.now() },
      });

      // Override composedPath to simulate the real path through shadow DOM
      vi.spyOn(event, 'composedPath').mockReturnValue([
        audioEl,
        slides[0]!.shadowRoot!.querySelector('section.content')!,
        slides[0]!.shadowRoot!,
        slides[0]!,  // GEEK-SLIDE — this is what the handler looks for
        container.getRootNode() as ShadowRoot,
        slideshow,
        document.body,
        document.documentElement,
        document,
        window,
      ]);

      document.dispatchEvent(event);

      // The handler should find slide index 0 and push state
      expect(mockMap.set).toHaveBeenCalledWith('0', expect.objectContaining({
        playing: true,
        currentTime: 5,
      }));

      cleanup();
    });

    it('does nothing when GEEK-SLIDE is NOT in the composed path', () => {
      const { slideshow, container } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      const mockMap = { set: vi.fn(), observe: vi.fn() };
      const mockSync = { getSharedMap: vi.fn(() => mockMap), isReadonly: false };

      const { ctx } = createMockContext(slideshow, container);
      (ctx as unknown as { sync: unknown }).sync = mockSync;

      const cleanup = mediaSyncFeature.activate(ctx);

      const event = new CustomEvent('geek:media:state', {
        bubbles: true,
        composed: true,
        detail: { playing: true, currentTime: 0, timestamp: Date.now() },
      });

      // Path without GEEK-SLIDE (simulates the bug before the fix)
      vi.spyOn(event, 'composedPath').mockReturnValue([
        slideshow, document.body, document.documentElement, document, window,
      ]);

      document.dispatchEvent(event);

      expect(mockMap.set).not.toHaveBeenCalled();

      cleanup();
    });

    it('does not push state when in viewer mode', () => {
      const { slideshow, container, slides } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      const mockMap = { set: vi.fn(), observe: vi.fn() };
      const mockSync = { getSharedMap: vi.fn(() => mockMap), isReadonly: true };

      const { ctx } = createMockContext(slideshow, container, { isViewer: true });
      (ctx as unknown as { sync: unknown }).sync = mockSync;

      const cleanup = mediaSyncFeature.activate(ctx);

      const event = new CustomEvent('geek:media:state', {
        bubbles: true,
        composed: true,
        detail: { playing: true, currentTime: 0, timestamp: Date.now() },
      });
      vi.spyOn(event, 'composedPath').mockReturnValue([
        slides[0]!.shadowRoot!.querySelector('geek-audio')!,
        slides[0]!,
        document,
      ]);

      document.dispatchEvent(event);

      expect(mockMap.set).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('checkMediaPresence (conditional nav arrows)', () => {
    it('shows arrows when slide has a geek-audio element', () => {
      const { slideshow, container } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      const { ctx, listeners } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      // The initial slide has media — trigger a mousemove to reveal arrows
      const gsContainer = (slideshow.shadowRoot!.querySelector('.gs-container'))!;
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));

      const layer = container.querySelector('.gs-media-layer');
      expect(layer?.classList.contains('gs-media-layer--visible')).toBe(true);

      cleanup();
    });

    it('hides arrows when slide has no media elements', () => {
      const { slideshow, container } = createSlideshowDOM([
        '<p>No media here</p>',
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      const { ctx, listeners } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      // Slide 0 has no media, so arrows should not appear even on mousemove
      const gsContainer = (slideshow.shadowRoot!.querySelector('.gs-container'))!;
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));

      const layer = container.querySelector('.gs-media-layer');
      expect(layer?.classList.contains('gs-media-layer--visible')).toBe(false);

      cleanup();
    });

    it('updates arrow visibility on slide:enter', () => {
      const { slideshow, container } = createSlideshowDOM([
        '<p>Text only</p>',
        '<geek-youtube data-id="abc"></geek-youtube>',
      ]);

      const { ctx, listeners } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      // Slide 0: no media → arrows hidden
      const gsContainer = (slideshow.shadowRoot!.querySelector('.gs-container'))!;
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));
      const layer = container.querySelector('.gs-media-layer')!;
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(false);

      // Navigate to slide 1 (has YouTube) — simulate slide:enter event
      const enterCallbacks = listeners['slide:enter'];
      expect(enterCallbacks).toBeDefined();
      for (const cb of enterCallbacks!) cb({ slideIndex: 1 });

      // Now mousemove should show arrows
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(true);

      cleanup();
    });

    it('detects .gs-iframe-wrapper as media content', () => {
      const { slideshow, container } = createSlideshowDOM([
        '<div class="gs-iframe-wrapper"><iframe src="demo.html"></iframe></div>',
      ]);

      const { ctx } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      const gsContainer = (slideshow.shadowRoot!.querySelector('.gs-container'))!;
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));

      const layer = container.querySelector('.gs-media-layer');
      expect(layer?.classList.contains('gs-media-layer--visible')).toBe(true);

      cleanup();
    });
  });

  describe('pause on slide:leave', () => {
    it('calls applyRemoteState(playing:false) on media components when leaving slide', () => {
      const { slideshow, container } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      // Add applyRemoteState mock to the geek-audio element
      const audioEl = slideshow.shadowRoot!
        .querySelector('geek-slide')!.shadowRoot!
        .querySelector('geek-audio')! as HTMLElement & { applyRemoteState: ReturnType<typeof vi.fn> };
      audioEl.applyRemoteState = vi.fn();

      const { ctx, listeners } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      // Simulate leaving slide 0
      const leaveCallbacks = listeners['slide:leave'];
      expect(leaveCallbacks).toBeDefined();
      for (const cb of leaveCallbacks!) cb({ slideIndex: 0 });

      expect(audioEl.applyRemoteState).toHaveBeenCalledWith(
        expect.objectContaining({ playing: false }),
      );

      cleanup();
    });
  });

  describe('nav arrow auto-hide timer', () => {
    it('hides arrows after 2 seconds of no mouse movement', () => {
      vi.useFakeTimers();
      const { slideshow, container } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      const { ctx } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      const gsContainer = (slideshow.shadowRoot!.querySelector('.gs-container'))!;
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));

      const layer = container.querySelector('.gs-media-layer')!;
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(true);

      // Advance 2 seconds
      vi.advanceTimersByTime(2000);
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(false);

      cleanup();
      vi.useRealTimers();
    });

    it('resets timer on subsequent mouse movements', () => {
      vi.useFakeTimers();
      const { slideshow, container } = createSlideshowDOM([
        '<geek-video src="video.mp4"></geek-video>',
      ]);

      const { ctx } = createMockContext(slideshow, container, { currentSlide: 0 });
      const cleanup = mediaSyncFeature.activate(ctx);

      const gsContainer = (slideshow.shadowRoot!.querySelector('.gs-container'))!;
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));

      const layer = container.querySelector('.gs-media-layer')!;
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(true);

      // Move again at 1.5s — timer should reset
      vi.advanceTimersByTime(1500);
      gsContainer.dispatchEvent(new MouseEvent('mousemove'));

      // At 3s from start (1.5s after second move) arrows should still be visible
      vi.advanceTimersByTime(1500);
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(true);

      // At 3.5s (2s after second move) arrows should hide
      vi.advanceTimersByTime(500);
      expect(layer.classList.contains('gs-media-layer--visible')).toBe(false);

      cleanup();
      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('removes geek:media:state document listener on cleanup', () => {
      const { slideshow, container, slides } = createSlideshowDOM([
        '<geek-audio src="track.mp3"></geek-audio>',
      ]);

      const mockMap = { set: vi.fn(), observe: vi.fn() };
      const mockSync = { getSharedMap: vi.fn(() => mockMap), isReadonly: false };

      const { ctx } = createMockContext(slideshow, container);
      (ctx as unknown as { sync: unknown }).sync = mockSync;

      const cleanup = mediaSyncFeature.activate(ctx);
      cleanup();

      // After cleanup, dispatching should NOT push to Yjs
      const event = new CustomEvent('geek:media:state', {
        bubbles: true,
        composed: true,
        detail: { playing: true, currentTime: 0, timestamp: Date.now() },
      });
      vi.spyOn(event, 'composedPath').mockReturnValue([
        slides[0]!, document, window,
      ]);
      document.dispatchEvent(event);

      expect(mockMap.set).not.toHaveBeenCalled();
    });
  });
});
