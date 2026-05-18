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
): { showAutoplayBanner: () => void; removeUI: () => void } {
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
      background: oklch(0% 0 0 / 0.25);
      color: white;
      border: none;
      border-radius: 4px;
      width: 28px;
      height: 56px;
      cursor: pointer;
      font-size: 1.4rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.45;
      transition: opacity 0.2s, background 0.2s;
      user-select: none;
    }
    .gs-media-nav-btn:hover { opacity: 0.85; background: oklch(0% 0 0 / 0.55); }
    .gs-media-nav-prev { left: 6px; }
    .gs-media-nav-next { right: 6px; }
    .gs-autoplay-banner {
      position: absolute;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: auto;
      background: oklch(18% 0 0 / 0.92);
      color: white;
      padding: 10px 22px;
      border-radius: 8px;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      font-size: 0.85rem;
      white-space: nowrap;
      border: 1px solid oklch(55% 0 0 / 0.5);
      z-index: 200;
    }
    .gs-autoplay-banner strong { font-weight: 600; }
  `;

  const layer = document.createElement('div');
  layer.className = 'gs-media-layer';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'gs-media-nav-btn gs-media-nav-prev';
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', onPrev);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'gs-media-nav-btn gs-media-nav-next';
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', onNext);

  layer.appendChild(prevBtn);
  layer.appendChild(nextBtn);
  container.appendChild(style);
  container.appendChild(layer);

  let banner: HTMLElement | null = null;

  const showAutoplayBanner = (): void => {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'gs-autoplay-banner';
    banner.setAttribute('role', 'button');
    banner.setAttribute('tabindex', '0');
    banner.innerHTML = '▶ Media is playing — <strong>click here to enable audio/video</strong>';
    banner.addEventListener('click', () => {
      banner?.remove();
      banner = null;
      document.dispatchEvent(new CustomEvent('geek:autoplay:unblocked'));
    });
    layer.appendChild(banner);
  };

  // Style the container as the positioning root.
  Object.assign(container.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });

  return {
    showAutoplayBanner,
    removeUI: () => { style.remove(); layer.remove(); },
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
    const { showAutoplayBanner, removeUI } = injectFeatureUI(
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

    // ── 2. Presenter: collect geek:media:state events, push to Yjs ──────────
    const onMediaState = (e: Event): void => {
      if (isViewer || !ctx.sync) return;
      const ce = e as CustomEvent<MediaState>;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const slideEl = target.closest('geek-slide') ??
        (target.getRootNode() instanceof ShadowRoot
          ? (target.getRootNode() as ShadowRoot).host
          : null);
      const slides = slideshow?.shadowRoot?.querySelectorAll('geek-slide');
      const idx = slides ? [...slides].indexOf(slideEl as Element) : -1;
      if (idx < 0) return;

      ctx.sync.getSharedMap().set(String(idx), ce.detail);
    };

    document.addEventListener('geek:media:state', onMediaState);

    // ── 3. Autoplay-blocked banner ───────────────────────────────────────────
    const onAutoplayBlocked = (): void => { showAutoplayBanner(); };
    document.addEventListener('geek:autoplay:blocked', onAutoplayBlocked);

    // ── 4. Viewer: observe shared map, apply to current slide ────────────────
    let mapUnsubscribe: (() => void) | null = null;

    if (isViewer && ctx.sync) {
      const sharedMap = ctx.sync.getSharedMap();
      sharedMap.observe((event) => {
        event.keysChanged.forEach((key: unknown) => {
          if (!slideshow) return;
          const keyStr = String(key);
          const slideIndex = parseInt(keyStr, 10);
          if (isNaN(slideIndex)) return;
          const state = sharedMap.get(keyStr) as MediaState | undefined;
          if (!state) return;

          const components = getMediaInSlide(slideshow, slideIndex);
          for (const c of components) {
            if (c instanceof HTMLElement && 'applyRemoteState' in c) {
              c.applyRemoteState(state);
            }
          }
        });
      });
      mapUnsubscribe = () => { /* Yjs observers clean up with the doc */ };
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
      mapUnsubscribe?.();
      document.removeEventListener('geek:media:state', onMediaState);
      document.removeEventListener('geek:autoplay:blocked', onAutoplayBlocked);
      removeUI();
    };
  },
};
