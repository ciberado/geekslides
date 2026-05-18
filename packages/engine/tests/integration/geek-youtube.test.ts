// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YoutubeSlide } from '../../src/components/YoutubeSlide.ts';

if (!customElements.get('geek-youtube')) {
  customElements.define('geek-youtube', YoutubeSlide);
}

// --- helpers ----------------------------------------------------------------

const mockPlayer = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  getCurrentTime: vi.fn().mockReturnValue(0),
  destroy: vi.fn(),
};

function makeYTMock() {
  vi.clearAllMocks();
  return {
    Player: vi.fn().mockImplementation(() => mockPlayer),
    PlayerState: { PLAYING: 1 as const, BUFFERING: 3 as const },
  };
}

/** Create a <geek-youtube> inside a shadow root so #observeSlide can fire. */
function createInShadow(dataId = 'test123') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const el = document.createElement('geek-youtube') as YoutubeSlide;
  if (dataId) el.setAttribute('data-id', dataId);
  shadow.appendChild(el);
  return { host, shadow, el };
}

/** Drain the microtask queue to let async/observer callbacks settle. */
async function flushPromises(rounds = 5) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------

describe('geek-youtube', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.querySelectorAll('script[src*="youtube.com"]').forEach(s => s.remove());
    delete (window as unknown as Record<string, unknown>)['YT'];
    delete (window as unknown as Record<string, unknown>)['onYouTubeIframeAPIReady'];
  });

  // -------------------------------------------------------------------------
  describe('custom element registration', () => {
    it('is registered as "geek-youtube"', () => {
      expect(customElements.get('geek-youtube')).toBe(YoutubeSlide);
    });
  });

  // -------------------------------------------------------------------------
  describe('shadow DOM', () => {
    it('renders a #yt-container div in the shadow root', () => {
      const el = document.createElement('geek-youtube');
      document.body.appendChild(el);
      expect(el.shadowRoot?.getElementById('yt-container')).not.toBeNull();
    });

    it('renders a <style> element in the shadow root', () => {
      const el = document.createElement('geek-youtube');
      document.body.appendChild(el);
      expect(el.shadowRoot?.querySelector('style')).not.toBeNull();
    });

    it('shadow root has exactly one child <style> and one #yt-container', () => {
      const el = document.createElement('geek-youtube');
      document.body.appendChild(el);
      const children = el.shadowRoot?.children;
      expect(children?.length).toBe(2);
      expect(children?.[0]?.tagName.toLowerCase()).toBe('style');
      expect(children?.[1]?.id).toBe('yt-container');
    });
  });

  // -------------------------------------------------------------------------
  describe('attributes', () => {
    it('stores the data-id value', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      el.setAttribute('data-id', 'dQw4w9WgXcQ');
      document.body.appendChild(el);
      expect(el.getAttribute('data-id')).toBe('dQw4w9WgXcQ');
    });

    it('always includes :host([cover]) rule in the shadow style', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      el.setAttribute('cover', '');
      document.body.appendChild(el);
      const style = el.shadowRoot?.querySelector('style');
      expect(style?.textContent).toContain(':host([cover])');
    });

    it('sets container height to 100% when cover attribute is present', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      el.setAttribute('cover', '');
      document.body.appendChild(el);
      const container = el.shadowRoot?.getElementById('yt-container') as HTMLDivElement;
      expect(container.style.height).toBe('100%');
    });
  });

  // -------------------------------------------------------------------------
  describe('connectedCallback', () => {
    it('creates the shadow DOM on connect', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      document.body.appendChild(el);
      expect(el.shadowRoot).not.toBeNull();
      expect(el.shadowRoot?.getElementById('yt-container')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('disconnectedCallback', () => {
    it('does not throw when disconnected with no player', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      document.body.appendChild(el);
      expect(() => el.remove()).not.toThrow();
    });

    it('calls player.destroy() when disconnected after activation', async () => {
      (window as unknown as Record<string, unknown>)['YT'] = makeYTMock();
      const { host, el } = createInShadow('abc123');
      host.setAttribute('active', '');
      await flushPromises();
      expect(mockPlayer.destroy).not.toHaveBeenCalled();
      el.remove();
      expect(mockPlayer.destroy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('#observeSlide', () => {
    it('does not throw when NOT inside a shadow root', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      expect(() => document.body.appendChild(el)).not.toThrow();
    });

    it('activates (creates player) when host gains "active" attribute', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      const { host } = createInShadow('abc123');
      host.setAttribute('active', '');
      await flushPromises();
      expect(YTMock.Player).toHaveBeenCalled();
    });

    it('activates immediately if host already has "active" when connected', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      const host = document.createElement('div');
      host.setAttribute('active', '');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      el.setAttribute('data-id', 'abc123');
      shadow.appendChild(el);
      await flushPromises();
      expect(YTMock.Player).toHaveBeenCalled();
    });

    it('does not activate (no player) when element is NOT in a shadow root', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      el.setAttribute('data-id', 'abc123');
      document.body.appendChild(el);
      await flushPromises();
      expect(YTMock.Player).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // loadYouTubeAPI tests use vi.resetModules() + dynamic import so each test
  // gets a fresh module-level ytReady singleton.  A unique custom element name
  // is registered per test to avoid "already defined" errors.
  // -------------------------------------------------------------------------
  describe('loadYouTubeAPI', () => {
    let elCounter = 0;

    afterEach(() => {
      document.querySelectorAll('script[src*="youtube.com/iframe_api"]').forEach(s => s.remove());
    });

    it('adds a <script> pointing to the YouTube IFrame API when window.YT is absent', async () => {
      vi.resetModules();
      delete (window as unknown as Record<string, unknown>)['YT'];
      const { YoutubeSlide: FreshYS } = await import('../../src/components/YoutubeSlide.ts');
      const name = `geek-youtube-lyt-${++elCounter}` as `${string}-${string}`;
      customElements.define(name, FreshYS);

      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const el = document.createElement(name);
      el.setAttribute('data-id', 'testvid');
      shadow.appendChild(el);
      host.setAttribute('active', '');
      await flushPromises();

      const script = document.querySelector('script[src*="youtube.com/iframe_api"]');
      expect(script).not.toBeNull();
      expect(script?.getAttribute('src')).toContain('youtube.com/iframe_api');
    });

    it('does NOT add a duplicate script when one already exists', async () => {
      vi.resetModules();
      delete (window as unknown as Record<string, unknown>)['YT'];
      // Pre-populate the document with the existing script
      const existing = document.createElement('script');
      existing.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(existing);

      const { YoutubeSlide: FreshYS } = await import('../../src/components/YoutubeSlide.ts');
      const name = `geek-youtube-lyt-${++elCounter}` as `${string}-${string}`;
      customElements.define(name, FreshYS);

      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const el = document.createElement(name);
      el.setAttribute('data-id', 'testvid');
      shadow.appendChild(el);
      host.setAttribute('active', '');
      await flushPromises();

      const scripts = document.querySelectorAll('script[src*="youtube.com/iframe_api"]');
      expect(scripts.length).toBe(1);
    });

    it('resolves immediately (creates player) when window.YT is already set', async () => {
      vi.resetModules();
      const freshMockPlayer = { playVideo: vi.fn(), pauseVideo: vi.fn(), seekTo: vi.fn(), getCurrentTime: vi.fn().mockReturnValue(0), destroy: vi.fn() };
      const YTMock = {
        Player: vi.fn().mockImplementation(() => freshMockPlayer),
        PlayerState: { PLAYING: 1 as const, BUFFERING: 3 as const },
      };
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;

      const { YoutubeSlide: FreshYS } = await import('../../src/components/YoutubeSlide.ts');
      const name = `geek-youtube-lyt-${++elCounter}` as `${string}-${string}`;
      customElements.define(name, FreshYS);

      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const el = document.createElement(name);
      el.setAttribute('data-id', 'testvid');
      shadow.appendChild(el);
      host.setAttribute('active', '');
      await flushPromises();

      // Player was created without needing to call window.onYouTubeIframeAPIReady
      expect(YTMock.Player).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('applyRemoteState', () => {
    it('does nothing (no error) when no player exists', () => {
      const el = document.createElement('geek-youtube') as YoutubeSlide;
      document.body.appendChild(el);
      expect(() =>
        el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() }),
      ).not.toThrow();
    });

    it('calls seekTo when currentTime diff exceeds 0.5s', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      mockPlayer.getCurrentTime.mockReturnValue(0);
      const { host } = createInShadow('abc123');
      host.setAttribute('active', '');
      await flushPromises();

      const el = host.shadowRoot?.querySelector('geek-youtube') as YoutubeSlide;
      el.applyRemoteState({ playing: true, currentTime: 5, timestamp: Date.now() });

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.closeTo(5, 0), true);
    });

    it('does NOT seek when diff is within 0.5s', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      mockPlayer.getCurrentTime.mockReturnValue(5);
      const { host } = createInShadow('abc123');
      host.setAttribute('active', '');
      await flushPromises();

      const el = host.shadowRoot?.querySelector('geek-youtube') as YoutubeSlide;
      el.applyRemoteState({ playing: true, currentTime: 5, timestamp: Date.now() });

      expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    });

    it('calls playVideo when state.playing is true', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      const { host } = createInShadow('abc123');
      host.setAttribute('active', '');
      await flushPromises();

      const el = host.shadowRoot?.querySelector('geek-youtube') as YoutubeSlide;
      el.applyRemoteState({ playing: true, currentTime: 0, timestamp: Date.now() });

      expect(mockPlayer.playVideo).toHaveBeenCalled();
      expect(mockPlayer.pauseVideo).not.toHaveBeenCalled();
    });

    it('calls pauseVideo when state.playing is false', async () => {
      const YTMock = makeYTMock();
      (window as unknown as Record<string, unknown>)['YT'] = YTMock;
      const { host } = createInShadow('abc123');
      host.setAttribute('active', '');
      await flushPromises();

      const el = host.shadowRoot?.querySelector('geek-youtube') as YoutubeSlide;
      el.applyRemoteState({ playing: false, currentTime: 0, timestamp: Date.now() });

      expect(mockPlayer.pauseVideo).toHaveBeenCalled();
      expect(mockPlayer.playVideo).not.toHaveBeenCalled();
    });
  });
});
