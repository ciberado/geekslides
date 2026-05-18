/**
 * GeekSlides v2 — media-sync Feature.
 *
 * Bridges the media web components (<geek-youtube>, <geek-audio>, <geek-video>)
 * with the sync layer and slide lifecycle.
 *
 * Responsibilities:
 *  1. Pause all media on a slide when the user navigates away (slide:leave).
 *  2. In presenter mode: listen for `geek:media:state` events and publish
 *     them to the feature-scoped Yjs shared map so viewers receive them.
 *  3. In viewer mode: observe the shared map and apply remote state to the
 *     current slide's media components via `applyRemoteState()`.
 *  4. Show an autoplay-blocked banner when the browser prevents autoplay
 *     (common in viewer mode without prior user interaction). Clicking the
 *     banner fires `geek:autoplay:unblocked` so components can retry.
 *  5. Inject subtle prev/next navigation buttons that work even when an
 *     iframe or YouTube embed has captured keyboard focus.
 *  6. Register terminal commands: `media-play`, `media-pause`, `media-seek <s>`.
 *
 * Configuration in config.json:
 *   { "features": ["whiteboard", "media-sync"] }
 */

import type { Feature, FeatureContext } from '../types.ts';
import type { YoutubeSlide } from '../../components/YoutubeSlide.ts';
import type { AudioSlide } from '../../components/AudioSlide.ts';
import type { VideoSlide } from '../../components/VideoSlide.ts';
import type { MediaState } from '../../sync/types.ts';

type MediaComponent = YoutubeSlide | AudioSlide | VideoSlide;

const MEDIA_SELECTORS = 'geek-youtube, geek-audio, geek-video';
const MEDIA_OR_IFRAME_SELECTORS = 'geek-youtube, geek-audio, geek-video, .gs-iframe-wrapper';

/** Find all media components inside the shadow DOM of a given slide element. */
function getMediaInSlide(
  slideshow: HTMLElement,
  slideIndex: number,
): MediaComponent[] {
  const slides = slideshow.shadowRoot?.querySelectorAll('geek-slide');
  const slideEl = slides?.[slideIndex];
  if (!slideEl) return [];
  const content = slideEl.shadowRoot?.querySelector('section.content');
  if (!content) return [];
  return [...content.querySelectorAll<MediaComponent>(MEDIA_SELECTORS)];
}

/** Get current time from a media component (supports all 3 types). */
function getComponentTime(c: MediaComponent): number {
  if ('getCurrentTime' in c && typeof c.getCurrentTime === 'function') {
    return c.getCurrentTime();
  }
  return 0;
}

/** Pause all media components on a slide. */
function pauseAll(components: MediaComponent[]): void {
  for (const c of components) {
    if (c instanceof HTMLElement && 'applyRemoteState' in c) {
      c.applyRemoteState({ playing: false, currentTime: getComponentTime(c), timestamp: Date.now() });
    }
  }
}

/** Inject the feature UI layer (nav arrows + autoplay banner container). */
function injectFeatureUI(
  container: HTMLElement,
  onPrev: () => void,
  onNext: () => void,
): { showAutoplayBanner: () => void; setHasMedia: (value: boolean) => void; removeUI: () => void } {
  const style = document.createElement('style');
  style.textContent = `
    .gs-media-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 100;
    }
    .gs-media-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: auto;
      background: rgba(20, 20, 20, 0.62);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      width: 36px;
      height: 80px;
      cursor: pointer;
      font-size: 1.6rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.25s;
      user-select: none;
      box-shadow: 0 2px 10px rgba(0,0,0,0.45);
    }
    .gs-media-layer--visible .gs-media-nav-btn { opacity: 0.72; }
    .gs-media-layer--visible .gs-media-nav-btn:hover { opacity: 1; background: rgba(30, 30, 30, 0.82); }
    .gs-media-nav-prev { left: 8px; }
    .gs-media-nav-next { right: 8px; }
    .gs-keyboard-captured {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: auto;
      background: rgba(25, 35, 60, 0.92);
      color: #c8deff;
      padding: 7px 18px;
      border-radius: 20px;
      font-family: system-ui, sans-serif;
      font-size: 0.78rem;
      white-space: nowrap;
      border: 1px solid rgba(80, 120, 200, 0.4);
      z-index: 200;
      cursor: pointer;
    }
    .gs-keyboard-captured:hover { background: rgba(40, 50, 80, 0.95); }
    .gs-autoplay-banner {
      position: absolute;
      inset: 0;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(4px);
      cursor: pointer;
      z-index: 200;
      animation: gs-autoplay-fadein 0.3s ease;
    }
    @keyframes gs-autoplay-fadein {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .gs-autoplay-banner__icon {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 3px solid rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.8rem;
      line-height: 1;
      animation: gs-autoplay-pulse 1.8s ease-in-out infinite;
    }
    @keyframes gs-autoplay-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
      50%       { box-shadow: 0 0 0 22px rgba(255,255,255,0); }
    }
    .gs-autoplay-banner__title {
      font-family: system-ui, sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: white;
      letter-spacing: 0.01em;
      text-align: center;
    }
    .gs-autoplay-banner__sub {
      font-family: system-ui, sans-serif;
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.72);
      text-align: center;
    }
    .gs-autoplay-banner__btn {
      margin-top: 8px;
      padding: 12px 36px;
      border-radius: 40px;
      background: white;
      color: #111;
      font-family: system-ui, sans-serif;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 18px rgba(0,0,0,0.4);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .gs-autoplay-banner__btn:hover {
      transform: scale(1.04);
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    }
  `;

  const layer = document.createElement('div');
  layer.className = 'gs-media-layer';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'gs-media-nav-btn gs-media-nav-prev';
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.innerHTML = '&#8249;';
  prevBtn.addEventListener('click', onPrev);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'gs-media-nav-btn gs-media-nav-next';
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.innerHTML = '&#8250;';
  nextBtn.addEventListener('click', onNext);

  layer.appendChild(prevBtn);
  layer.appendChild(nextBtn);
  container.appendChild(style);
  container.appendChild(layer);

  // ── Arrow visibility: only on media slides, only while mouse moves ────
  let hasMedia = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const HIDE_DELAY = 2000; // ms after last mouse movement

  const showArrows = (): void => { layer.classList.add('gs-media-layer--visible'); };
  const hideArrows = (): void => { layer.classList.remove('gs-media-layer--visible'); };

  const onMouseMove = (): void => {
    if (!hasMedia) return;
    showArrows();
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideArrows, HIDE_DELAY);
  };

  // Listen on the parent element (which covers the slide area) for mouse activity.

  /** Call when slide changes to signal whether the new slide has media/iframes. */
  const setHasMedia = (value: boolean): void => {
    hasMedia = value;
    if (!value) hideArrows();
  };

  // Show a banner when an iframe captures keyboard focus (window loses focus).
  // Clicking the banner returns keyboard navigation.
  let keyboardBanner: HTMLElement | null = null;
  const showKeyboardCapturedBanner = (): void => {
    if (keyboardBanner) return;
    keyboardBanner = document.createElement('div');
    keyboardBanner.className = 'gs-keyboard-captured';
    keyboardBanner.setAttribute('title', 'Click to return keyboard navigation to the presentation');
    keyboardBanner.innerHTML = '⌨ Keyboard captured · <strong>click ‹ › or here</strong> to navigate';
    keyboardBanner.addEventListener('click', () => {
      keyboardBanner?.remove();
      keyboardBanner = null;
    });
    layer.appendChild(keyboardBanner);
  };
  const hideKeyboardCapturedBanner = (): void => {
    keyboardBanner?.remove();
    keyboardBanner = null;
  };

  const onWindowBlur = (): void => {
    if (hasMedia) showKeyboardCapturedBanner();
  };
  const onWindowFocus = (): void => { hideKeyboardCapturedBanner(); };
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('focus', onWindowFocus);

  let banner: HTMLElement | null = null;

  const showAutoplayBanner = (): void => {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'gs-autoplay-banner';
    banner.setAttribute('role', 'button');
    banner.setAttribute('tabindex', '0');
    banner.setAttribute('aria-label', 'Click to enable media playback');
    banner.innerHTML = `
      <div class="gs-autoplay-banner__icon">▶</div>
      <div class="gs-autoplay-banner__title">Media playback is paused</div>
      <div class="gs-autoplay-banner__sub">Your browser requires a click before playing audio or video.</div>
      <button class="gs-autoplay-banner__btn">Click to enable playback</button>
    `;
    const dismiss = (): void => {
      banner?.remove();
      banner = null;
      document.dispatchEvent(new CustomEvent('geek:autoplay:unblocked'));
    };
    banner.addEventListener('click', dismiss);
    banner.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') dismiss();
    });
    layer.appendChild(banner);
  };

  // Style the container as the positioning root — pointer-events: none so slides remain interactive.
  Object.assign(container.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });

  // Detect mouse movement on .gs-container (the full-size slide area in the shadow root).
  const rootNode = container.getRootNode();
  const mouseTarget = rootNode instanceof ShadowRoot
    ? rootNode.querySelector('.gs-container') ?? container
    : container;
  mouseTarget.addEventListener('mousemove', onMouseMove);
  mouseTarget.addEventListener('mouseenter', onMouseMove);
  mouseTarget.addEventListener('mouseleave', () => {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideArrows();
  });

  return {
    showAutoplayBanner,
    setHasMedia,
    removeUI: () => {
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      if (hideTimer !== null) clearTimeout(hideTimer);
      style.remove();
      layer.remove();
    },
  };
}

export const mediaSyncFeature: Feature = {
  id: 'media-sync',
  label: 'Media playback sync (YouTube, audio, video)',

  activate(ctx: FeatureContext): () => void {
    const isViewer = ctx.role === 'viewer';

    // Resolve the <geek-slideshow> element. ctx.container lives inside
    // the slideshow's shadow root, so getRootNode().host is the slideshow.
    const ctxRoot = ctx.container.getRootNode();
    const slideshow = ctxRoot instanceof ShadowRoot
      ? ctxRoot.host as HTMLElement
      : ctx.container.closest<HTMLElement>('geek-slideshow');

    // ── UI: nav arrows + autoplay banner ────────────────────────────────────
    const { showAutoplayBanner, setHasMedia, removeUI } = injectFeatureUI(
      ctx.container,
      () => { ctx.slideshow.prev(); },
      () => { ctx.slideshow.next(); },
    );

    // ── 1. Pause on slide:leave ──────────────────────────────────────────────
    const unsubLeave = ctx.on('slide:leave', ({ slideIndex }) => {
      if (!slideshow) return;
      const components = getMediaInSlide(slideshow, slideIndex);
      pauseAll(components);
    });

    // ── 1b. Show/hide nav arrows based on media presence in new slide ────────
    const checkMediaPresence = (slideIndex: number): void => {
      if (!slideshow) { setHasMedia(false); return; }
      const slides = slideshow.shadowRoot?.querySelectorAll('geek-slide');
      const slideEl = slides?.[slideIndex];
      if (!slideEl) { setHasMedia(false); return; }
      const content = slideEl.shadowRoot?.querySelector('section.content');
      if (!content) { setHasMedia(false); return; }
      const found = content.querySelector(MEDIA_OR_IFRAME_SELECTORS);
      setHasMedia(found !== null);
    };

    const unsubEnter = ctx.on('slide:enter', ({ slideIndex }) => {
      checkMediaPresence(slideIndex);
    });
    // Check the initial slide too.
    checkMediaPresence(ctx.slideshow.currentSlide);

    // ── 2. Presenter: collect geek:media:state events, push to Yjs ──────────
    const onMediaState = (e: Event): void => {
      if (isViewer || !ctx.sync) return;
      const ce = e as CustomEvent<MediaState>;
      // Use composedPath() to find the originating element through shadow DOM.
      const path = e.composedPath();
      let slideEl: Element | null = null;
      for (const node of path) {
        if (node instanceof Element && node.tagName === 'GEEK-SLIDE') {
          slideEl = node;
          break;
        }
      }
      if (!slideEl) return;
      const slides = slideshow?.shadowRoot?.querySelectorAll('geek-slide');
      const idx = slides ? [...slides].indexOf(slideEl) : -1;
      if (idx < 0) return;

      ctx.sync.getSharedMap().set(String(idx), ce.detail);
    };

    document.addEventListener('geek:media:state', onMediaState);

    // ── 3. Autoplay-blocked banner ───────────────────────────────────────────
    const onAutoplayBlocked = (): void => { showAutoplayBanner(); };
    document.addEventListener('geek:autoplay:blocked', onAutoplayBlocked);

    // ── 4. Viewer: observe shared map, apply to current slide ────────────────
    // IMPORTANT: The viewer must NOT call getSharedMap() eagerly because that
    // creates a local Y.Map via root.set(). If the server rejects readonly writes,
    // the presenter's map arrives later and Yjs conflict resolution may pick a
    // different Y.Map instance — making the viewer's .observe() on the old orphan
    // map never fire. Instead, observe the root 'features' map for the feature key
    // to appear, then observe the actual shared map.
    let mapUnsubscribe: (() => void) | null = null;

    if (isViewer && ctx.syncManager) {
      const root = ctx.syncManager.doc.getMap('features');

      const applyState = (state: MediaState, slideIndex: number): void => {
        if (!slideshow) return;
        const components = getMediaInSlide(slideshow, slideIndex);
        for (const c of components) {
          if (c instanceof HTMLElement && 'applyRemoteState' in c) {
            c.applyRemoteState(state);
          }
        }
      };

      // Handler that observes the feature's nested map for media state changes.
      type YMapEvent = { keysChanged: Set<string> };
      const onFeatureMapChange = (event: YMapEvent): void => {
        const featureMap = root.get('media-sync') as { get(k: string): unknown } | undefined;
        if (!featureMap) return;
        event.keysChanged.forEach((key: string) => {
          const slideIndex = parseInt(key, 10);
          if (isNaN(slideIndex)) return;
          const state = featureMap.get(key) as MediaState | undefined;
          if (state) applyState(state, slideIndex);
        });
      };

      // Try to attach observer to the existing feature map, or wait for it.
      let currentFeatureMap: { observe(fn: (e: YMapEvent) => void): void; unobserve(fn: (e: YMapEvent) => void): void; get(k: string): unknown } | null = null;

      const attachFeatureMap = (): void => {
        const map = root.get('media-sync') as typeof currentFeatureMap | undefined;
        if (map && map !== currentFeatureMap) {
          if (currentFeatureMap) currentFeatureMap.unobserve(onFeatureMapChange);
          currentFeatureMap = map;
          map.observe(onFeatureMapChange);
        }
      };

      // Observe root for the 'media-sync' key appearing (presenter creates it).
      const onRootChange = (event: YMapEvent): void => {
        if (event.keysChanged.has('media-sync')) {
          attachFeatureMap();
        }
      };
      root.observe(onRootChange);

      // If the map already exists (presenter connected first), attach immediately.
      attachFeatureMap();

      mapUnsubscribe = () => {
        root.unobserve(onRootChange);
        if (currentFeatureMap) currentFeatureMap.unobserve(onFeatureMapChange);
      };
    }

    // ── 5. Terminal commands (all roles) ─────────────────────────────────────
    ctx.commands.register({
      name: 'media-play',
      label: 'Play media on current slide',
      category: 'media',
      execute: () => {
        if (!slideshow) return;
        const components = getMediaInSlide(slideshow, ctx.slideshow.currentSlide);
        for (const c of components) {
          if (c instanceof HTMLElement && 'applyRemoteState' in c) {
            c.applyRemoteState({ playing: true, currentTime: getComponentTime(c), timestamp: Date.now() });
          }
        }
      },
    });

    ctx.commands.register({
      name: 'media-pause',
      label: 'Pause media on current slide',
      category: 'media',
      execute: () => {
        if (!slideshow) return;
        const components = getMediaInSlide(slideshow, ctx.slideshow.currentSlide);
        pauseAll(components);
      },
    });

    ctx.commands.register({
      name: 'media-seek',
      label: 'Seek media to time in seconds (usage: media-seek 30)',
      category: 'media',
      execute: (args) => {
        const secs = parseFloat(args?.[0] ?? '');
        if (isNaN(secs)) {
          ctx.output.show('✗ Usage: media-seek <seconds>');
          return;
        }
        if (!slideshow) return;
        const components = getMediaInSlide(slideshow, ctx.slideshow.currentSlide);
        for (const c of components) {
          if (c instanceof HTMLElement && 'applyRemoteState' in c) {
            c.applyRemoteState({ playing: false, currentTime: secs, timestamp: Date.now() });
          }
        }
      },
    });

    return () => {
      unsubLeave();
      unsubEnter();
      mapUnsubscribe?.();
      document.removeEventListener('geek:media:state', onMediaState);
      document.removeEventListener('geek:autoplay:blocked', onAutoplayBlocked);
      removeUI();
    };
  },
};
