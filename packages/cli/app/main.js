import {
  loadConfig,
  parse,
  computeSlideMap,
  headerPreprocessor,
  slideSourceNotesPreprocessor,
  CommandSystem,
  KeyBindings,
  TouchInput,
  SyncManager,
  FeatureManager,
  loadFeature,
  iframeProcessor,
  chartProcessor,
  videoProcessor,
  uploadDeck,
  buildManifest,
  getProxyBaseUrl,
  isLocalPluginPath,
  isRemotePluginUrl,
  importRemotePlugin,
  extractPreprocessor,
  extractProcessor,
  createIdentityLineMapping,
  normalizePreprocessorResult,
  composeLineMappings,
} from '@geekslides/engine';
import { registerHotClient } from '@geekslides/engine/hot-client';

// Built-in theme CSS strings (imported as raw text for runtime switching)
import themeDefaultRaw from '../src/templates/theme-default.css?raw';
import themeAuroraRaw from '../src/templates/theme-aurora.css?raw';
import themeSolarizedRaw from '../src/templates/theme-solarized.css?raw';
import themeOceanRaw from '../src/templates/theme-ocean.css?raw';
import themeForestRaw from '../src/templates/theme-forest.css?raw';
import themeSunsetRaw from '../src/templates/theme-sunset.css?raw';
import themeNordicRaw from '../src/templates/theme-nordic.css?raw';
import themeCrimsonRaw from '../src/templates/theme-crimson.css?raw';
import themeMonochromeRaw from '../src/templates/theme-monochrome.css?raw';
import themeCandyRaw from '../src/templates/theme-candy.css?raw';
import themeVolcanoRaw from '../src/templates/theme-volcano.css?raw';

/** Registry of all built-in themes available at runtime. */
const BUILTIN_THEMES = [
  { name: 'default',     label: 'Default',     description: 'Clean neutral palette, blue accent (system-ui)',          dark: false, css: themeDefaultRaw },
  { name: 'aurora',      label: 'Aurora',      description: 'Deep-space dark, electric-cyan accents (Exo 2)',          dark: true,  css: themeAuroraRaw },
  { name: 'solarized',   label: 'Solarized',   description: 'Warm Solarized Light, amber accents (Source Serif 4)',    dark: false, css: themeSolarizedRaw },
  { name: 'ocean',       label: 'Ocean',       description: 'Deep-blue ocean, teal accents (Nunito)',                  dark: false, css: themeOceanRaw },
  { name: 'forest',      label: 'Forest',      description: 'Earthy warm-cream, forest-green accents (Playfair)',      dark: false, css: themeForestRaw },
  { name: 'sunset',      label: 'Sunset',      description: 'Warm ivory, coral/orange accents (Raleway)',              dark: false, css: themeSunsetRaw },
  { name: 'nordic',      label: 'Nordic',      description: 'Cool Scandinavian grey, nordic-blue accents (DM Sans)',   dark: false, css: themeNordicRaw },
  { name: 'crimson',     label: 'Crimson',     description: 'Parchment cream, deep burgundy accents (Cormorant)',      dark: false, css: themeCrimsonRaw },
  { name: 'monochrome',  label: 'Monochrome',  description: 'Pure black-and-white, typography-driven (Space Grotesk)', dark: false, css: themeMonochromeRaw },
  { name: 'candy',       label: 'Candy',       description: 'Soft lavender, vivid violet accents (Poppins)',           dark: false, css: themeCandyRaw },
  { name: 'volcano',     label: 'Volcano',     description: 'Near-black, fiery orange-red accents (Oswald)',           dark: true,  css: themeVolcanoRaw },
];

const PREPROCESSORS = {
  header: headerPreprocessor,
  'source-notes': slideSourceNotesPreprocessor,
};

const PROCESSORS = {
  chart: chartProcessor,
  iframe: iframeProcessor,
  video: videoProcessor,
};

const params = new URLSearchParams(window.location.search);
const viewMode = params.get('view');

function appendConfigJson(url) {
  // Split off any query string before checking the path extension
  const qIdx = url.indexOf('?');
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const query = qIdx >= 0 ? url.slice(qIdx) : '';
  if (path.endsWith('.json')) return url;
  const sep = path.endsWith('/') ? '' : '/';
  return `${path}${sep}config.json${query}`;
}

function normalizeConfigUrl(url) {
  // Transform GitHub repo URLs to raw.githubusercontent.com
  const ghMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/);
  if (ghMatch) {
    const [, owner, repo, branch = 'main'] = ghMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/config.json`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return appendConfigJson(url);
  }
  const normalised = url.startsWith('/') ? url : `/${url.replace(/^\.\//, '')}`;
  return appendConfigJson(normalised);
}

function getConfigBase(url) {
  const lastSlash = url.lastIndexOf('/');
  return lastSlash >= 0 ? url.substring(0, lastSlash + 1) : '/';
}

function updateDocumentBase(baseHref) {
  // Don't set an http:// base tag on an https:// page — that would cause the
  // browser to resolve all relative resource URLs (img, link, …) as mixed
  // content and block them.  Resource URLs are rewritten to the proxy instead.
  if (baseHref.startsWith('http://') && window.location.protocol === 'https:') return;
  let base = document.querySelector('base[data-geekslides-base]');
  if (!base) {
    base = document.createElement('base');
    base.setAttribute('data-geekslides-base', '');
    document.head.appendChild(base);
  }
  base.href = new URL(baseHref, window.location.origin).href;
}

let configUrl = normalizeConfigUrl(params.get('config') || '/deck/config.json');
let configBase = getConfigBase(configUrl);

/**
 * Wrap a URL through the server-side deck proxy when the browser would block
 * it as mixed content (http:// URL loaded from an https:// page).
 */
function proxyUrlIfNeeded(url) {
  if (url.startsWith('http://') && window.location.protocol === 'https:') {
    return `/api/deck-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * When configBase is http:// and the page is https://, rewrite relative image
 * and link URLs in markdown to absolute proxied URLs so the browser never
 * has to fetch http:// resources directly (mixed-content block).
 */
function rewriteMarkdownUrlsForProxy(markdown) {
  if (!configBase.startsWith('http://') || window.location.protocol !== 'https:') return markdown;
  // Match markdown image/link syntax: ![alt](url) or [text](url)
  // Only rewrite relative paths (not http://, https://, /, #, data:)
  return markdown.replace(
    /(!?\[[^\]]*\])\((?!https?:\/\/|\/|#|data:)([^)]+)\)/g,
    (_, prefix, path) => `${prefix}(${proxyUrlIfNeeded(configBase + path.trim())})`,
  );
}

function resolveUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path;
  }
  return configBase + path;
}

async function fetchConfig() {
  const proxiedUrl = proxyUrlIfNeeded(configUrl);
  return await loadConfig(`${proxiedUrl}${proxiedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
}

async function fetchMarkdown(config) {
  const contentPaths = Array.isArray(config.content) ? config.content : [config.content];
  const parts = await Promise.all(
    contentPaths.map(async (path) => {
      const url = proxyUrlIfNeeded(resolveUrl(path));
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
        cache: 'no-store',
      });
      const text = await res.text();
      return rewriteMarkdownUrlsForProxy(text);
    }),
  );
  return parts.join('\n');
}

async function fetchStyles(config) {
  const styleUrls = Array.isArray(config.styles) ? config.styles : [];
  const cssTexts = await Promise.all(
    styleUrls.map(async (url) => {
      try {
        const resolvedUrl = proxyUrlIfNeeded(resolveUrl(url));
        const separator = resolvedUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${resolvedUrl}${separator}raw&t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          console.warn(`Failed to load style: ${url} (HTTP ${res.status})`);
          return '';
        }
        let text = await res.text();
        // Vite wraps ?raw CSS as a JS module: export default "..."
        // with a sourcemap comment. Strip both to get actual CSS.
        text = text.replace(/\/\/# sourceMappingURL=.*$/gm, '').trim();
        if (text.startsWith('export default "')) {
          try {
            text = JSON.parse(text.slice('export default '.length).replace(/;\s*$/, ''));
          } catch { /* not a JS module, use as-is */ }
        }
        return text;
      } catch (err) {
        console.warn(`Failed to load style: ${url}`, err);
        return '';
      }
    }),
  );
  return cssTexts.join('\n');
}

function updateDocumentTitle(activeConfig) {
  document.title = activeConfig?.title || 'GeekSlides v2';
}

function getTrackedStylePaths(activeConfig) {
  const styleUrls = Array.isArray(activeConfig?.styles) ? activeConfig.styles : [];
  return styleUrls.map((url) => resolveUrl(url));
}

function getHmrWatchFiles(activeConfig) {
  const contentPaths = Array.isArray(activeConfig.content) ? activeConfig.content : [activeConfig.content];
  const files = [configUrl, ...contentPaths.map(resolveUrl), ...getTrackedStylePaths(activeConfig)];
  return [...new Set(files.map((file) => file.split('?')[0]))];
}

async function registerHmrFiles(activeConfig) {
  if (!import.meta.hot) {
    return;
  }

  try {
    await fetch('/__geekslides_watch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: getHmrWatchFiles(activeConfig) }),
    });
  } catch (error) {
    console.warn('[hmr] Failed to register watch files:', error);
  }
}

async function applyPreprocessors(markdown, config) {
  const ppNames = config.plugins.preprocessors;
  let result = markdown;
  let lineMapping = createIdentityLineMapping(markdown);
  for (const name of ppNames) {
    let pp;
    if (isRemotePluginUrl(name)) {
      const mod = await importRemotePlugin(name);
      pp = extractPreprocessor(mod, name);
    } else if (isLocalPluginPath(name)) {
      const url = resolveUrl(name);
      const mod = await import(/* @vite-ignore */ url);
      pp = extractPreprocessor(mod, name);
    } else {
      pp = PREPROCESSORS[name];
    }
    if (pp) {
      const next = normalizePreprocessorResult(pp(result, config));
      result = next.content;
      lineMapping = composeLineMappings(lineMapping, next.lineMapping);
    }
  }
  return { content: result, lineMapping };
}

async function publishSlideMap(slideMap) {
  try {
    await fetch('/api/slide-map', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slideMap),
    });
  } catch (error) {
    console.warn('[hmr] Failed to publish slide map:', error);
  }
}

async function getActiveProcessors(config) {
  const processorNames = config.plugins.processors;
  const processors = [];
  for (const name of processorNames) {
    if (isRemotePluginUrl(name)) {
      const mod = await importRemotePlugin(name);
      processors.push(extractProcessor(mod, name));
    } else if (isLocalPluginPath(name)) {
      const url = resolveUrl(name);
      const mod = await import(/* @vite-ignore */ url);
      processors.push(extractProcessor(mod, name));
    } else {
      const proc = PROCESSORS[name];
      if (proc) processors.push(proc);
    }
  }
  return processors;
}

async function applyProcessors(slideshow, config) {
  const activeProcessors = await getActiveProcessors(config);
  if (activeProcessors.length === 0) {
    return;
  }

  const slideElements = slideshow.shadowRoot?.querySelectorAll('geek-slide') || [];
  for (const slideEl of slideElements) {
    const content = slideEl.shadowRoot?.querySelector('section.content');
    if (!content) {
      continue;
    }
    for (const proc of activeProcessors) {
      proc(content);
    }
  }
}

try {
  let config = await fetchConfig();
  let markdown = await fetchMarkdown(config);
  let combinedCss = await fetchStyles(config);
  updateDocumentTitle(config);
  await registerHmrFiles(config);
  let currentSlideMap = [];
  let currentLineMapping = createIdentityLineMapping(markdown);

  if (configBase) {
    updateDocumentBase(configBase);
  }

  const processedMarkdown = await applyPreprocessors(markdown, config);
  currentLineMapping = processedMarkdown.lineMapping;
  let slides = parse(processedMarkdown.content, { lineMapping: currentLineMapping });
  currentSlideMap = computeSlideMap(slides);
  await publishSlideMap(currentSlideMap);

  if (viewMode === 'speaker') {
    document.body.innerHTML = '<geek-speaker-view id="speaker"></geek-speaker-view>';
    const speaker = document.getElementById('speaker');
    const activeProcessors = await getActiveProcessors(config);
    speaker.setAspectRatio(config.aspectRatio);
    if (combinedCss) {
      speaker.loadStyles(combinedCss);
    }
    speaker.loadSlides(slides);
    if (activeProcessors.length > 0) {
      speaker.loadProcessors(activeProcessors, config);
    }

    const syncConfig = config.sync || {};
    const wsUrl = syncConfig.server || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const room = params.get('room') || syncConfig.room || 'default';
    const token = params.get('token') || undefined;

    const sync = new SyncManager();
    sync.connect(wsUrl, room, { token });

    document.addEventListener('geek:sync:state', (e) => {
      if (e.detail?.connected) {
        console.log('[speaker] Connected to sync server');
      }
    });

    const applySpeakerSyncState = () => {
      const state = sync.doc.getMap('sessionState');
      const slide = state.get('slide');
      const partial = state.get('partial');
      if (typeof slide === 'number') {
        speaker.updateSlide(slide, typeof partial === 'number' ? partial : 0);
      }
    };

    // --- Per-connection state ------------------------------------------------
    // Both are reset each time the speaker follows a roomTransfer to a new room.
    let speakerConnectionStarted = Date.now();
    let speakerInitialCheckDone = false;
    let lastSpeakerProxyRaw = '';

    // True when the speaker was opened via a room-proxy config URL, meaning the
    // browser already fetched the latest deck from the server.  On the FIRST
    // contentProxy check we skip a reload if the proxy URL matches, avoiding a
    // redundant re-download that can race against stale Yjs room state.
    const speakerConfigIsRoomProxy = configBase.includes('/api/rooms/');

    // Reload the speaker view when the presenter switches decks via contentProxy.
    const reloadSpeakerFromProxy = async (proxyBaseUrl) => {
      const spkId = Math.random().toString(36).slice(2, 8);
      console.log(`[speakerReload:${spkId}] START proxyBaseUrl=${proxyBaseUrl}`);
      try {
        const proxyConfigUrl = `${proxyBaseUrl}config.json`;
        const newConfig = await loadConfig(proxyConfigUrl);
        console.log(`[speakerReload:${spkId}] config loaded: title=${newConfig.title}`);
        // Update configBase so resolveUrl() resolves relative paths against the
        // proxy URL, not the original config URL.
        configBase = proxyBaseUrl;
        updateDocumentBase(proxyBaseUrl);
        const newMarkdown = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);
        const processedMd = await applyPreprocessors(newMarkdown, newConfig);
        slides = parse(processedMd.content, { lineMapping: processedMd.lineMapping });
        speaker.setAspectRatio(newConfig.aspectRatio);
        if (newCss) speaker.loadStyles(newCss);
        speaker.loadSlides(slides);
        const activeProcessors = await getActiveProcessors(newConfig);
        if (activeProcessors.length > 0) speaker.loadProcessors(activeProcessors, newConfig);
        updateDocumentTitle(newConfig);
        applySpeakerSyncState();
        console.log(`[speakerReload:${spkId}] DONE title=${newConfig.title} slideCount=${slides.length}`);
      } catch (err) {
        console.warn(`[speakerReload:${spkId}] FAILED:`, err.message);
      }
    };

    const checkSpeakerContentProxy = () => {
      const proxyRaw = sync.doc.getMap('sessionState').get('contentProxy');
      const isSame = proxyRaw === lastSpeakerProxyRaw;
      if (typeof proxyRaw !== 'string' || isSame) {
        return;
      }

      const isFirstCheck = !speakerInitialCheckDone;
      lastSpeakerProxyRaw = proxyRaw;
      speakerInitialCheckDone = true;

      try {
        const proxy = JSON.parse(proxyRaw);
        if (!proxy.baseUrl) return;

        console.log(`[speaker:checkProxy] baseUrl=${proxy.baseUrl} room=${proxy.room} loadedAt=${proxy.loadedAt} isFirst=${isFirstCheck} currentRoom=${sync.currentRoom}`);

        // Block proxies from a different room — these are CRDT contamination
        // from the Y.Doc being reused across room changes.
        if (proxy.room && sync.currentRoom && proxy.room !== sync.currentRoom) {
          console.log(`[speaker:checkProxy] IGNORED stale proxy from room=${proxy.room} (current=${sync.currentRoom})`);
          return;
        }

        // On the very first check after (re)connecting: skip if the speaker was
        // opened from a proxy URL that matches this contentProxy.  The browser
        // already fetched the latest deck from that URL — no reload needed.
        // This prevents stale Yjs room state from overwriting a freshly opened
        // speaker view with an older version of the same proxy content.
        if (isFirstCheck && speakerConfigIsRoomProxy && configBase === proxy.baseUrl) {
          console.log('[speaker:checkProxy] SKIPPED initial (matches config URL)');
          return;
        }

        console.log(`[speaker:checkProxy] → reloadSpeakerFromProxy(${proxy.baseUrl})`);
        void reloadSpeakerFromProxy(proxy.baseUrl);
      } catch {
        // ignore invalid proxy data
      }
    };

    // Follow the presenter when they switch rooms via the `room` command.
    const checkRoomTransfer = () => {
      const transferRaw = sync.doc.getMap('sessionState').get('roomTransfer');
      if (typeof transferRaw !== 'string') return;
      try {
        const transfer = JSON.parse(transferRaw);
        if (!transfer.toRoom || typeof transfer.at !== 'number') return;
        // Only follow transfers that happened AFTER this connection was established.
        // Older values are stale from a previous session in the same Yjs room.
        if (transfer.at <= speakerConnectionStarted) return;

        const newRoom = transfer.toRoom;
        console.log(`[speaker] Following presenter to room: ${newRoom}`);

        // Update the URL so that reloading the speaker view reconnects to the
        // new room instead of the original room the page was opened with.
        const newParams = new URLSearchParams(location.search);
        newParams.set('room', newRoom);
        history.replaceState(null, '', `${location.pathname}?${newParams.toString()}`);

        // Reconnect to new room.  The same Y.Doc may retain stale state from the
        // old room (CRDT contamination), so we bypass it with a direct HTTP check.
        sync.disconnect();
        speakerConnectionStarted = Date.now();
        speakerInitialCheckDone = false;
        // Mark current Yjs contentProxy as seen so Yjs observe won't double-load
        lastSpeakerProxyRaw = String(sync.doc.getMap('sessionState').get('contentProxy') ?? '');

        sync.connect(wsUrl, newRoom, { token });
        applySpeakerSyncState();

        // Directly fetch the new room's deck via HTTP (avoids Y.Doc contamination).
        const serverBase = `${location.protocol}//${location.host}`;
        const newRoomProxyBase = getProxyBaseUrl(serverBase, newRoom);
        fetch(`${newRoomProxyBase}config.json`, { cache: 'no-store' })
          .then((res) => {
            if (res.ok) {
              // Prevent Yjs observe from double-reloading the same URL.
              lastSpeakerProxyRaw = JSON.stringify({ baseUrl: newRoomProxyBase, loadedAt: 0 });
              void reloadSpeakerFromProxy(newRoomProxyBase);
            } else {
              // New / empty room — just apply the Yjs slide position.
              speakerInitialCheckDone = false;
              checkSpeakerContentProxy();
            }
          })
          .catch(() => { /* network error — fall back to Yjs observe */ });
      } catch {
        // ignore invalid transfer data
      }
    };

    sync.doc.getMap('sessionState').observe(() => {
      checkRoomTransfer();
      checkSpeakerContentProxy();
      applySpeakerSyncState();
    });

    // Apply current room state immediately so speaker view opens in sync,
    // even before the presenter navigates again.
    checkRoomTransfer();
    checkSpeakerContentProxy();
    applySpeakerSyncState();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        const currentSlide = slides[speaker.currentIndex];
        if (currentSlide && speaker.currentPartial < currentSlide.partialCount) {
          const nextPartial = speaker.currentPartial + 1;
          speaker.updateSlide(speaker.currentIndex, nextPartial);
          sync.publishState(speaker.currentIndex, nextPartial, 'present');
          return;
        }

        const next = Math.min(speaker.currentIndex + 1, slides.length - 1);
        speaker.updateSlide(next, 0);
        sync.publishState(next, 0, 'present');
      } else if (e.key === 'ArrowLeft') {
        if (speaker.currentPartial > 0) {
          const prevPartial = speaker.currentPartial - 1;
          speaker.updateSlide(speaker.currentIndex, prevPartial);
          sync.publishState(speaker.currentIndex, prevPartial, 'present');
          return;
        }

        const prev = Math.max(speaker.currentIndex - 1, 0);
        const prevSlide = slides[prev];
        const prevPartial = prevSlide?.partialCount ?? 0;
        speaker.updateSlide(prev, prevPartial);
        sync.publishState(prev, prevPartial, 'present');
      }
    });

    speaker.addEventListener('geek:speaker:navigate', (e) => {
      const dir = e.detail?.direction;
      if (dir === 'next') {
        const currentSlide = slides[speaker.currentIndex];
        if (currentSlide && speaker.currentPartial < currentSlide.partialCount) {
          const nextPartial = speaker.currentPartial + 1;
          speaker.updateSlide(speaker.currentIndex, nextPartial);
          sync.publishState(speaker.currentIndex, nextPartial, 'present');
          return;
        }

        const next = Math.min(speaker.currentIndex + 1, slides.length - 1);
        speaker.updateSlide(next, 0);
        sync.publishState(next, 0, 'present');
      } else if (dir === 'prev') {
        if (speaker.currentPartial > 0) {
          const prevPartial = speaker.currentPartial - 1;
          speaker.updateSlide(speaker.currentIndex, prevPartial);
          sync.publishState(speaker.currentIndex, prevPartial, 'present');
          return;
        }

        const prev = Math.max(speaker.currentIndex - 1, 0);
        const prevSlide = slides[prev];
        const prevPartial = prevSlide?.partialCount ?? 0;
        speaker.updateSlide(prev, prevPartial);
        sync.publishState(prev, prevPartial, 'present');
      }
    });
  } else {
    const vtoken = params.get('vtoken');
    const hasToken = Boolean(params.get('token'));
    let isReadonly = params.has('readonly') || vtoken !== null;

    // Before rendering the UI, confirm room protection status with the server.
    // If the room is protected and the client provides no credential, force
    // read-only mode so the editor UI is never shown to unauthenticated visitors.
    // The WS-level 403 is the ultimate write-enforcement layer; this prevents
    // UI confusion when someone strips ?vtoken from the viewer URL.
    if (!isReadonly && !hasToken) {
      try {
        const _sc = config.sync || {};
        if (_sc.enabled !== false) {
          const _r = params.get('room') || _sc.room || 'default';
          const _res = await fetch(
            `${location.protocol}//${location.host}/api/rooms/${encodeURIComponent(_r)}/role`,
          );
          if (_res.ok) {
            const _d = await _res.json();
            if (_d.protected) {
              isReadonly = true;
            }
          }
        }
      } catch {
        // Sync server unavailable — fall back to URL-param-based detection
      }
    }

    document.body.innerHTML = isReadonly
      ? '<geek-slideshow id="slideshow"></geek-slideshow>'
      : '<geek-slideshow id="slideshow"></geek-slideshow><geek-terminal></geek-terminal>';
    const slideshow = document.getElementById('slideshow');

    if (combinedCss) {
      slideshow.loadStyles(combinedCss);
    }
    slideshow.loadSlides(slides);
    await applyProcessors(slideshow, config);
    slideshow.setAspectRatio(config.aspectRatio);

    const syncConfig = config.sync || {};
    const syncEnabled = syncConfig.enabled !== false;
    let sync = null;

    // --- Content-proxy tracking (hoisted to shared scope so both the initial
    //     upload IIFE and the interactive block can access them) ---------------
    // lastProxyRaw: deduplicates consecutive contentProxy Yjs values so we
    //   don't trigger redundant deck reloads for the same proxy URL.
    // lastUploadStartedAt: wall-clock ms when we last started an upload.
    //   Used to skip stale contentProxy values that pre-date our upload, which
    //   prevents a flicker where the old room proxy briefly replaces our deck.
    let lastProxyRaw = '';
    let lastUploadStartedAt = 0;

    if (syncEnabled) {
      try {
        sync = new SyncManager(document, { readonly: isReadonly });
        const wsUrl = syncConfig.server || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        const room = params.get('room') || syncConfig.room || 'default';
        const token = params.get('token') || undefined;
        sync.bind(slideshow);
        sync.connect(wsUrl, room, { token, viewerToken: vtoken ?? undefined });

        slideshow.addEventListener('geek:navigate', (e) => {
          sync.publishState(e.detail.slide, e.detail.partial, e.detail.mode);
        });

        // Content proxy: upload deck assets to server so remote viewers can access them.
        // Wait briefly for Yjs to sync the room state; only upload if the room has
        // no existing contentProxy (avoids overwriting another presenter's deck when
        // a second window joins an already-active room).
        void (async () => {
          try {
            console.log('[initial-upload] waiting 600ms for Yjs sync...');
            const serverBaseUrl = `${location.protocol}//${location.host}`;
            // Give Yjs ~600 ms to receive the room's existing state from the server.
            await new Promise((r) => setTimeout(r, 600));
            const existingProxyRaw = sync?.doc.getMap('sessionState').get('contentProxy');
            if (typeof existingProxyRaw === 'string') {
              try {
                const existingProxy = JSON.parse(existingProxyRaw);
                // Only skip if the existing proxy is for THIS room.
                // A proxy from a different room is CRDT contamination and should
                // be ignored (do not skip upload; let the correct proxy be set).
                if (existingProxy.room === room) {
                  console.log('[initial-upload] Room has existing deck \u2014 skipping. existingProxy:', existingProxyRaw);
                  return;
                }
                console.log(`[initial-upload] Existing proxy is for room=${existingProxy.room}, not ${room} \u2014 proceeding with upload`);
              } catch {
                // malformed JSON — proceed with upload
              }
            }
            console.log('[initial-upload] No existing proxy, uploading. configUrl:', configUrl, 'title:', config?.title);
            const manifest = buildManifest(configUrl, config, markdown, combinedCss);
            lastUploadStartedAt = Date.now();
            console.log(`[initial-upload] lastUploadStartedAt=${lastUploadStartedAt}`);
            await uploadDeck(serverBaseUrl, room, configBase, manifest,
              (url, init) => fetch(proxyUrlIfNeeded(url), init));
            const proxyBase = getProxyBaseUrl(serverBaseUrl, room);
            const proxyJson = JSON.stringify({
              room,
              baseUrl: proxyBase,
              loadedAt: Date.now(),
            });
            // Pre-set lastProxyRaw so our own observer doesn't trigger a redundant reload
            lastProxyRaw = proxyJson;
            sync?.doc.transact(() => {
              sync?.doc.getMap('sessionState').set('contentProxy', proxyJson);
            });
            console.log('[initial-upload] DONE. proxyBase:', proxyBase);
          } catch (err) {
            console.warn('[initial-upload] FAILED:', err.message);
          }
        })();

        console.log('[sync] Connected to', wsUrl, 'room:', room);
      } catch (err) {
        console.warn('[sync] Failed to connect:', err.message);
      }
    }

    // --- Readonly viewer mode: receive-only, no interaction ---
    if (isReadonly) {
      // Sync status dot
      if (sync) {
        const syncDot = document.createElement('div');
        syncDot.style.cssText = 'position:fixed;top:12px;right:12px;z-index:50;width:10px;height:10px;border-radius:50%;background:#888;transition:background 0.3s;pointer-events:none;';
        syncDot.title = 'Sync status';
        document.body.appendChild(syncDot);

        document.addEventListener('geek:sync:state', (e) => {
          const { connected } = e.detail || {};
          syncDot.style.background = connected ? '#4ade80' : '#888';
          syncDot.title = connected ? 'Sync: connected (view only)' : 'Sync: disconnected';
        });

        // Readonly badge
        const badge = document.createElement('div');
        badge.textContent = 'VIEW ONLY';
        badge.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;padding:2px 12px;border-radius:4px;background:rgba(0,0,0,0.5);color:#aaa;font:500 11px/1.4 system-ui,sans-serif;letter-spacing:0.05em;pointer-events:none;opacity:0.8;';
        document.body.appendChild(badge);

        // --- Feature system (readonly mode) ---
        const featuresContainer = document.createElement('div');
        featuresContainer.className = 'gs-features';
        slideshow.shadowRoot?.querySelector('.gs-container')?.appendChild(featuresContainer);

        const featureManager = new FeatureManager({
          slideshow,
          commands: { register() {} }, // No commands in readonly mode
          sync,
          config,
          role: 'viewer',
          featuresContainer,
          output: { show() {} },
        });

        // Load features from config
        for (const featureName of config.features) {
          try {
            const feature = await loadFeature(featureName, resolveUrl);
            featureManager.register(feature);
          } catch (err) {
            console.warn(`[features] Failed to load feature '${featureName}':`, err.message);
          }
        }

        // Emit initial navigation event for features
        let lastSlide = slideshow.currentSlide;
        slideshow.addEventListener('geek:navigate', (e) => {
          const prevSlide = lastSlide;
          lastSlide = e.detail.slide;
          if (prevSlide !== lastSlide) {
            featureManager.emit('slide:leave', { slideIndex: prevSlide, nextIndex: lastSlide });
            featureManager.emit('slide:enter', { slideIndex: lastSlide, previousIndex: prevSlide });
          }
        });

        featureManager.emit('presentation:ready', { slideCount: slideshow.slideCount });

        // Content proxy observer
        async function reloadDeckFromProxy(proxyBaseUrl) {
          try {
            const proxyConfigUrl = `${proxyBaseUrl}config.json`;
            const newConfig = await loadConfig(proxyConfigUrl);

            configUrl = proxyConfigUrl;
            configBase = proxyBaseUrl;
            updateDocumentBase(configBase);

            const newMarkdown = await fetchMarkdown(newConfig);
            const newCss = await fetchStyles(newConfig);

            combinedCss = newCss;
            updateDocumentTitle(newConfig);
            slideshow.loadStyles(newCss);

            const processedMd = await applyPreprocessors(newMarkdown, newConfig);
            currentLineMapping = processedMd.lineMapping;
            const newSlides = parse(processedMd.content, { lineMapping: currentLineMapping });
            currentSlideMap = computeSlideMap(newSlides);
            slideshow.loadSlides(newSlides);
            config = newConfig;
            await applyProcessors(slideshow, newConfig);
            slideshow.setAspectRatio(newConfig.aspectRatio);

            // Restore sync position after reloading slides
            const state = sync.doc.getMap('sessionState');
            const slide = state.get('slide');
            const partial = state.get('partial');
            if (typeof slide === 'number') {
              slideshow.goTo(slide, typeof partial === 'number' ? partial : 0);
            }

            console.log('[content-proxy] Loaded deck from proxy:', proxyBaseUrl);
          } catch (err) {
            console.warn('[content-proxy] Failed to load from proxy:', err.message);
          }
        }

        // Track the last contentProxy JSON seen so deck changes trigger reloads.
        let lastProxyRaw = '';
        const checkContentProxy = () => {
          const proxyRaw = sync.doc.getMap('sessionState').get('contentProxy');
          if (typeof proxyRaw !== 'string' || proxyRaw === lastProxyRaw) return;
          lastProxyRaw = proxyRaw;

          try {
            const proxy = JSON.parse(proxyRaw);
            if (proxy.baseUrl) {
              void reloadDeckFromProxy(proxy.baseUrl);
            }
          } catch {
            // ignore invalid proxy data
          }
        };

        sync.doc.getMap('sessionState').observe((event) => {
          if (event.keysChanged.has('contentProxy')) {
            checkContentProxy();
          }
        });

        checkContentProxy();
      }

      // No terminal, no keyboard nav, no touch input, no whiteboard drawing
      console.log('[readonly] View-only mode active');
    } else {

    // --- Interactive (presenter/peer) mode ---
    const commands = new CommandSystem();
    const terminal = document.querySelector('geek-terminal');

    // Track the base combined CSS (from config styles) and a separate theme
    // override CSS. When the user switches themes via the `theme` command,
    // we append the new theme CSS on top so its :host tokens win by cascade.
    let activeThemeOverrideCss = '';

    function showCmdOutput(msg) {
      terminal.setOutput(msg);
    }

    async function applyPresentationConfig(newConfig) {
      config = newConfig;
      updateDocumentTitle(newConfig);
      slideshow.setAspectRatio(newConfig.aspectRatio);

      const newCss = await fetchStyles(newConfig);
      combinedCss = newCss;
      slideshow.loadStyles(newCss);
      await registerHmrFiles(newConfig);
    }

    // Upload the current deck to a specific room and publish contentProxy.
    // Called on initial connect (empty room) and after a room change (new room).
    async function uploadDeckToRoom(targetRoom) {
      const uploadId = Math.random().toString(36).slice(2, 8);
      console.log(`[upload:${uploadId}] START uploadDeckToRoom room=${targetRoom} configUrl=${configUrl} configBase=${configBase} title=${config?.title}`);
      try {
        const serverBaseUrl = `${location.protocol}//${location.host}`;
        const manifest = buildManifest(configUrl, config, markdown, combinedCss);
        console.log(`[upload:${uploadId}] manifest: content=${manifest.contentPath} styles=${JSON.stringify(manifest.stylePaths)} images=${manifest.imagePaths.length}`);
        lastUploadStartedAt = Date.now();
        console.log(`[upload:${uploadId}] lastUploadStartedAt=${lastUploadStartedAt}`);
        await uploadDeck(serverBaseUrl, targetRoom, configBase, manifest,
          (url, init) => fetch(proxyUrlIfNeeded(url), init));
        console.log(`[upload:${uploadId}] upload HTTP complete`);
        const proxyBase = getProxyBaseUrl(serverBaseUrl, targetRoom);
        const proxyJson = JSON.stringify({
          room: targetRoom,
          baseUrl: proxyBase,
          loadedAt: Date.now(),
        });
        // Pre-set lastProxyRaw so the observer on THIS window doesn't
        // trigger a redundant reloadDeckFromProxy for our own upload.
        lastProxyRaw = proxyJson;
        console.log(`[upload:${uploadId}] pre-set lastProxyRaw to prevent self-trigger`);
        sync.doc.transact(() => {
          sync.doc.getMap('sessionState').set('contentProxy', proxyJson);
        });
        console.log(`[upload:${uploadId}] contentProxy set in Yjs, proxyBase=${proxyBase}`);
      } catch (err) {
        console.warn(`[upload:${uploadId}] FAILED for room:`, targetRoom, err.message);
      }
    }

    async function reloadDeck(newConfigUrl) {
      const reloadId = Math.random().toString(36).slice(2, 8);
      console.log(`[reloadDeck:${reloadId}] START newConfigUrl=${newConfigUrl}`);
      showCmdOutput('Loading...');
      try {
        const resolvedConfigUrl = normalizeConfigUrl(newConfigUrl);
        const proxiedConfigUrl = proxyUrlIfNeeded(resolvedConfigUrl);
        console.log(`[reloadDeck:${reloadId}] loading config from ${proxiedConfigUrl}`);
        const newConfig = await loadConfig(proxiedConfigUrl);
        console.log(`[reloadDeck:${reloadId}] config loaded: title=${newConfig.title} content=${newConfig.content}`);

        configUrl = resolvedConfigUrl;
        configBase = getConfigBase(resolvedConfigUrl);
        updateDocumentBase(configBase);

        const newMarkdown = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);

        combinedCss = newCss;
        updateDocumentTitle(newConfig);
        slideshow.loadStyles(newCss);

        const processedMd = await applyPreprocessors(newMarkdown, newConfig);
        currentLineMapping = processedMd.lineMapping;
        const newSlides = parse(processedMd.content, { lineMapping: currentLineMapping });
        currentSlideMap = computeSlideMap(newSlides);
        slideshow.loadSlides(newSlides);
        config = newConfig;
        await applyProcessors(slideshow, newConfig);
        await registerHmrFiles(newConfig);

        slideshow.setAspectRatio(newConfig.aspectRatio);
        slideshow.goTo(0);
        console.log(`[reloadDeck:${reloadId}] slides loaded, goTo(0), slideCount=${slideshow.slideCount}`);

        // Update the module-level markdown so buildManifest scans the
        // correct images when uploading the new deck.
        markdown = newMarkdown;

        if (sync && sync.isConnected) {
          // Clear whiteboard data from the previous deck for all clients
          sync.clearAllStrokes();

          sync.publishState(0, 0, 'present');
          console.log(`[reloadDeck:${reloadId}] published state(0,0,present)`);

          // Re-upload the new deck and broadcast its location via contentProxy
          // so all connected clients reload the new presentation automatically.
          const currentRoom = sync.currentRoom ?? 'default';
          console.log(`[reloadDeck:${reloadId}] starting uploadDeckToRoom(${currentRoom})`);
          void uploadDeckToRoom(currentRoom);
        }

        showCmdOutput(`✓ Loaded: ${resolvedConfigUrl}`);
        console.log(`[reloadDeck:${reloadId}] DONE title=${newConfig.title}`);
      } catch (err) {
        showCmdOutput(`✗ Failed to load: ${err.message}`);
        console.error('[load] Error:', err);
      }
    }

    async function reloadDeckFromProxy(proxyBaseUrl) {
      const proxyId = Math.random().toString(36).slice(2, 8);
      console.log(`[proxyReload:${proxyId}] START proxyBaseUrl=${proxyBaseUrl} currentTitle=${config?.title}`);
      try {
        const proxyConfigUrl = `${proxyBaseUrl}config.json`;
        const newConfig = await loadConfig(proxyConfigUrl);
        console.log(`[proxyReload:${proxyId}] config loaded: title=${newConfig.title} content=${newConfig.content}`);

        configUrl = proxyConfigUrl;
        configBase = proxyBaseUrl;
        updateDocumentBase(configBase);

        const newMarkdown = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);

        combinedCss = newCss;
        // Update module-level markdown for buildManifest
        markdown = newMarkdown;
        updateDocumentTitle(newConfig);
        slideshow.loadStyles(newCss);

        const processedMd = await applyPreprocessors(newMarkdown, newConfig);
        currentLineMapping = processedMd.lineMapping;
        const newSlides = parse(processedMd.content, { lineMapping: currentLineMapping });
        currentSlideMap = computeSlideMap(newSlides);
        slideshow.loadSlides(newSlides);
        config = newConfig;
        await applyProcessors(slideshow, newConfig);
        slideshow.setAspectRatio(newConfig.aspectRatio);

        // Restore sync position after reloading slides
        const state = sync.doc.getMap('sessionState');
        const slide = state.get('slide');
        const partial = state.get('partial');
        if (typeof slide === 'number') {
          slideshow.goTo(slide, typeof partial === 'number' ? partial : 0);
        }

        console.log(`[proxyReload:${proxyId}] DONE title=${newConfig.title} slideCount=${slideshow.slideCount} slide=${slide}`);
      } catch (err) {
        console.warn(`[proxyReload:${proxyId}] FAILED:`, err.message);
      }
    }

    async function changeRoom(roomName) {
      if (!sync) {
        showCmdOutput('✗ Sync not enabled');
        return;
      }
      if (sync.currentRoom === roomName) {
        showCmdOutput(`Already in room: ${roomName}`);
        return;
      }
      try {
        showCmdOutput('Connecting...');

        // 1. Tell the speaker view (and any other peers) we're leaving.
        //    Set roomTransfer BEFORE disconnecting so Yjs can broadcast it.
        sync.doc.transact(() => {
          sync.doc.getMap('sessionState').set('roomTransfer', JSON.stringify({
            toRoom: roomName,
            at: Date.now(),
          }));
        });

        // Give Yjs ~300 ms to propagate roomTransfer to connected peers.
        await new Promise((r) => setTimeout(r, 300));

        sync.disconnect();
        await new Promise((r) => setTimeout(r, 100));

        // 2. Reset contentProxy tracking so stale values from the old room
        //    don't interfere with the new room's state.
        lastProxyRaw = '';

        const wsUrl = config.sync?.server || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        sync.connect(wsUrl, roomName);

        // 3. Directly check whether the new room already has a deck via HTTP.
        //    This bypasses potential Y.Doc contamination from the old room's
        //    CRDT state and gives a clean, deterministic answer.
        const serverBaseUrl = `${location.protocol}//${location.host}`;
        const roomProxyBase = getProxyBaseUrl(serverBaseUrl, roomName);

        let roomHasDeck = false;
        try {
          const res = await fetch(`${roomProxyBase}config.json`, { cache: 'no-store' });
          roomHasDeck = res.ok;
        } catch {
          // Network error — treat as empty room
        }

        if (roomHasDeck) {
          // 4a. Room has an existing deck — load it and adopt as the current deck.
          showCmdOutput('Loading room deck...');
          // Build the correct contentProxy JSON for this room.
          const correctProxyJson = JSON.stringify({ room: roomName, baseUrl: roomProxyBase, loadedAt: Date.now() });
          // Pre-set lastProxyRaw so the observer on THIS window skips the
          // subsequent Yjs event (dedup by exact string match).
          lastProxyRaw = correctProxyJson;
          await reloadDeckFromProxy(roomProxyBase);
          // Re-assert the correct contentProxy in Yjs.  This heals any CRDT
          // contamination where the old room's proxy (higher clock) overwrote
          // this room's proxy during Y.Doc merge on reconnect.  Other clients
          // joining the room will now receive the correct room-scoped proxy.
          sync.doc.transact(() => {
            sync.doc.getMap('sessionState').set('contentProxy', correctProxyJson);
          });
          sync.publishState(slideshow.currentSlide, slideshow.currentPartial, slideshow.mode);
          showCmdOutput(`✓ Room changed: ${roomName} (loaded room deck)`);
        } else {
          // 4b. Empty room — upload our current deck so peers who join see it.
          sync.publishState(slideshow.currentSlide, slideshow.currentPartial, slideshow.mode);
          void uploadDeckToRoom(roomName);
          showCmdOutput(`✓ Room changed: ${roomName}`);
        }

        console.log('[room] Switched to:', roomName, roomHasDeck ? '(adopted room deck)' : '(uploaded own deck)');
      } catch (err) {
        showCmdOutput(`✗ Failed to change room: ${err.message}`);
        console.error('[room] Error:', err);
      }
    }

    commands.register({ name: 'next', label: 'Next slide/partial', execute: () => slideshow.next(), category: 'navigation' });
    commands.register({ name: 'prev', label: 'Previous slide/partial', execute: () => slideshow.prev(), category: 'navigation' });
    commands.register({ name: 'go-first', label: 'Go to first slide', execute: () => slideshow.goTo(0), category: 'navigation' });
    commands.register({ name: 'go-last', label: 'Go to last slide', execute: () => slideshow.goTo(slideshow.slideCount - 1), category: 'navigation' });
    commands.register({ name: 'go', label: 'Go to slide N (usage: go 5)', execute: (args) => {
      const n = Number.parseInt(args?.[0], 10);
      if (!Number.isNaN(n) && n >= 1 && n <= slideshow.slideCount) {
        slideshow.goTo(n - 1);
      }
    }, category: 'navigation' });
    commands.register({ name: 'load', label: 'Load a different deck (usage: load config.json)', execute: (args) => {
      const deckUrl = args?.[0];
      if (!deckUrl) {
        showCmdOutput('✗ Usage: load <config-url>');
        return;
      }
      void reloadDeck(deckUrl);
    }, category: 'config' });
    commands.register({ name: 'room', label: 'Switch sync room (usage: room my-talk)', execute: (args) => {
      const roomName = args?.[0];
      if (!roomName) {
        showCmdOutput('✗ Usage: room <room-name>');
        return;
      }
      void changeRoom(roomName);
    }, category: 'sync' });
    commands.register({ name: 'fullscreen', label: 'Toggle fullscreen', execute: () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void document.documentElement.requestFullscreen();
      }
    }, category: 'view' });
    commands.register({ name: 'overview', label: 'Toggle overview mode', execute: () => {
      slideshow.mode = slideshow.mode === 'overview' ? 'present' : 'overview';
    }, category: 'view' });
    commands.register({ name: 'speaker', label: 'Open speaker view', execute: () => {
      const speakerParams = new URLSearchParams({ view: 'speaker', config: configUrl });
      const currentRoom = sync?.currentRoom ?? params.get('room') ?? null;
      const token = params.get('token');
      if (currentRoom) speakerParams.set('room', currentRoom);
      if (token) speakerParams.set('token', token);
      window.open(`${location.pathname}?${speakerParams.toString()}`, '_blank');
    }, category: 'view' });

    // Activate keyboard and touch input early — before async feature loading —
    // so that navigation is responsive as soon as the slideshow is ready.
    terminal.setCommandSystem(commands);

    const keys = new KeyBindings(commands);
    keys.onTerminalToggle(() => terminal.toggle());
    keys.onShortcutsToggle(() => slideshow.toggleShortcutsOverlay());
    keys.activate();

    const touch = new TouchInput(commands, slideshow);
    touch.activate();

    slideshow.addEventListener('geek:toolbar:command', (e) => {
      commands.execute(e.detail.command);
    });

    terminal.addEventListener('geek:terminal:close', () => keys.closeTerminal());

    // --- Feature system (presenter/peer mode) ---
    const featuresContainer = document.createElement('div');
    featuresContainer.className = 'gs-features';
    slideshow.shadowRoot?.querySelector('.gs-container')?.appendChild(featuresContainer);

    const featureManager = new FeatureManager({
      slideshow,
      commands,
      sync,
      config,
      role: 'presenter',
      featuresContainer,
      output: { show: (msg) => showCmdOutput(msg) },
    });

    // Load features from config
    for (const featureName of config.features) {
      try {
        const feature = await loadFeature(featureName, resolveUrl);
        featureManager.register(feature);
      } catch (err) {
        console.warn(`[features] Failed to load feature '${featureName}':`, err.message);
      }
    }

    // Content proxy: watch for proxy info published by the active presenter.
    // lastProxyRaw and lastUploadStartedAt are hoisted at the top of this block.
    if (sync) {
      const checkContentProxy = () => {
        const proxyRaw = sync.doc.getMap('sessionState').get('contentProxy');
        console.log(`[checkContentProxy] called. proxyRaw type=${typeof proxyRaw} same=${proxyRaw === lastProxyRaw} lastUploadStartedAt=${lastUploadStartedAt}`);
        if (typeof proxyRaw !== 'string' || proxyRaw === lastProxyRaw) {
          console.log('[checkContentProxy] skipped (no change or not string)');
          return;
        }
        lastProxyRaw = proxyRaw;

        try {
          const proxy = JSON.parse(proxyRaw);
          if (!proxy.baseUrl) return;

          console.log(`[checkContentProxy] proxy room=${proxy.room} baseUrl=${proxy.baseUrl} loadedAt=${proxy.loadedAt} lastUploadStartedAt=${lastUploadStartedAt} currentRoom=${sync?.currentRoom}`);

          // Block proxies from a different room — CRDT contamination from
          // the Y.Doc being reused across room changes.
          if (proxy.room && sync?.currentRoom && proxy.room !== sync.currentRoom) {
            console.log(`[checkContentProxy] IGNORED stale proxy from room=${proxy.room} (current=${sync.currentRoom})`);
            return;
          }

          // Skip proxies that were set BEFORE our own upload started.  This
          // prevents the old room's contentProxy from briefly replacing our deck
          // when we join a room that has stale Yjs state.
          if (lastUploadStartedAt > 0 &&
              typeof proxy.loadedAt === 'number' &&
              proxy.loadedAt < lastUploadStartedAt) {
            console.log('[checkContentProxy] SKIPPED stale proxy (pre-dates our upload)');
            return;
          }

          console.log(`[checkContentProxy] → reloadDeckFromProxy(${proxy.baseUrl}) currentTitle=${config?.title}`);
          void reloadDeckFromProxy(proxy.baseUrl);
        } catch {
          // ignore invalid proxy data
        }
      };

      sync.doc.getMap('sessionState').observe((event) => {
        const keys = [...event.keysChanged];
        if (keys.length > 0 && (keys.includes('contentProxy') || keys.includes('roomTransfer'))) {
          console.log(`[sessionState:observe] keysChanged=${keys.join(',')} local=${event.transaction.local}`);
        }
        if (event.keysChanged.has('contentProxy')) {
          checkContentProxy();
        }
      });

      // Check immediately in case proxy was already set before we connected
      checkContentProxy();
    }

    // Track navigation for feature lifecycle events
    let lastSlide = slideshow.currentSlide;
    slideshow.addEventListener('geek:navigate', (e) => {
      const prevSlide = lastSlide;
      lastSlide = e.detail.slide;
      if (prevSlide !== lastSlide) {
        featureManager.emit('slide:leave', { slideIndex: prevSlide, nextIndex: lastSlide });
        featureManager.emit('slide:enter', { slideIndex: lastSlide, previousIndex: prevSlide });
      }
    });

    featureManager.emit('presentation:ready', { slideCount: slideshow.slideCount });

    commands.register({ name: 'toggle-toolbar', label: 'Toggle toolbar', execute: () => {
      slideshow.toggleToolbar();
    }, category: 'built-in' });

    commands.register({ name: 'theme-list', label: 'List all available built-in themes', execute: () => {
      const lines = BUILTIN_THEMES.map((t) => {
        const dark = t.dark ? ' [dark]' : '';
        return `  ${t.name.padEnd(12)} — ${t.description}${dark}`;
      });
      showCmdOutput('Built-in themes:\n' + lines.join('\n'));
    }, category: 'theme' });

    commands.register({ name: 'theme', label: 'Switch to a built-in theme (usage: theme aurora)', execute: (args) => {
      const name = args?.[0];
      if (!name) {
        showCmdOutput('✗ Usage: theme <name>  (run theme-list to see available themes)');
        return;
      }
      const found = BUILTIN_THEMES.find((t) => t.name === name);
      if (!found) {
        const names = BUILTIN_THEMES.map((t) => t.name).join(', ');
        showCmdOutput(`✗ Unknown theme: "${name}". Available: ${names}`);
        return;
      }
      activeThemeOverrideCss = found.css;
      slideshow.loadStyles(combinedCss + '\n' + activeThemeOverrideCss);
      showCmdOutput(`✓ Theme switched to: ${found.label}`);
      console.log('[theme] Switched to:', found.name);
    }, category: 'theme' });

    if (sync) {
      commands.register({ name: 'sync-follow', label: 'Toggle follow presenter', execute: () => {
        sync.toggleFollow();
      }, category: 'sync' });
      commands.register({ name: 'sync-disconnect', label: 'Disconnect from sync', execute: () => {
        sync.disconnect();
        showCmdOutput('✓ Sync disconnected');
        console.log('[sync] Disconnected');
      }, category: 'sync' });
      commands.register({ name: 'share', label: 'Create a viewer share link for this room', execute: () => {
        const room = sync.currentRoom;
        if (!room) {
          showCmdOutput('✗ Not connected to a room');
          return;
        }
        void (async () => {
          try {
            const serverBaseUrl = `${location.protocol}//${location.host}`;
            const res = await fetch(`${serverBaseUrl}/api/rooms/${encodeURIComponent(room)}/share`, {
              method: 'POST',
            });
            if (!res.ok) {
              showCmdOutput(`✗ Failed to create share link: ${res.statusText}`);
              return;
            }
            const data = await res.json();
            const viewerUrl = new URL(window.location.href);
            viewerUrl.searchParams.delete('token');
            viewerUrl.searchParams.delete('readonly');
            viewerUrl.searchParams.set('room', room);
            viewerUrl.searchParams.set('vtoken', data.viewerToken);
            const viewerLink = viewerUrl.toString();

            // Copy to clipboard (best-effort — requires HTTPS or localhost)
            let copied = false;
            try {
              await navigator.clipboard.writeText(viewerLink);
              copied = true;
            } catch {
              // Clipboard unavailable (insecure context or permission denied)
            }

            const prefix = copied ? '✓ Share link (copied to clipboard): ' : '✓ Share link: ';
            terminal.setOutputLink(prefix, viewerLink, { persist: true });
            console.log('[share] Presenter token:', data.presenterToken);
            console.log('[share] Viewer token:', data.viewerToken);
            console.log('[share] Viewer URL:', viewerLink);

            // Store the presenter token so future reconnections are authenticated
            sync.updateConnectionToken(data.presenterToken);

            // Update browser URL to include the token
            const presenterUrl = new URL(window.location.href);
            presenterUrl.searchParams.set('token', data.presenterToken);
            window.history.replaceState(null, '', presenterUrl.toString());
          } catch (err) {
            showCmdOutput(`✗ Share failed: ${err.message}`);
          }
        })();
      }, category: 'sync' });
    }

    if (import.meta.hot) {
      registerHotClient(import.meta.hot, {
        fetchMarkdown: async () => {
          const md = await fetchMarkdown(config);
          const processed = await applyPreprocessors(md, config);
          currentLineMapping = processed.lineMapping;
          return processed.content;
        },
        fetchStyles: async () => fetchStyles(config),
        fetchConfig,
        reloadSlides: async (md) => {
          const newSlides = parse(md, { lineMapping: currentLineMapping });
          currentSlideMap = computeSlideMap(newSlides);
          slideshow.loadSlides(newSlides);
          await applyProcessors(slideshow, config);
        },
        applyStyles: (css) => {
          combinedCss = css;
          slideshow.loadStyles(css);
        },
        applyConfig: async (nextConfig) => {
          await applyPresentationConfig(nextConfig);
        },
        getCurrentConfig: () => config,
        getCurrentSlide: () => slideshow.currentSlide,
        getCurrentPartial: () => slideshow.currentPartial,
        goTo: (slide, partial) => slideshow.goTo(slide, partial),
        getSlideCount: () => slideshow.slideCount,
        getStyleSheetPaths: () => getTrackedStylePaths(config),
        publishSlideMap: async () => publishSlideMap(currentSlideMap),
      });
    }
    } // end !isReadonly
  }
} catch (err) {
  const configLink = `<a href="${configUrl}" target="_blank" style="color: #c00;">${configUrl}</a>`;
  const errMsg = String(err);
  const errStack = err.stack ? String(err.stack) : '';
  // Firefox omits the error message from err.stack; show both when they differ
  const fullMessage = errStack.startsWith(errMsg) ? errStack : (errMsg + (errStack ? '\n\n' + errStack : ''));
  const message = fullMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  document.body.innerHTML =
    `<div style="padding: 2rem; font-family: system-ui, sans-serif;">` +
    `<h2 style="color: #c00; margin: 0 0 1rem;">Failed to load presentation</h2>` +
    `<pre style="color: #c00; white-space: pre-wrap; margin: 0 0 1.5rem;">${message}</pre>` +
    `<p>Config URL: ${configLink}</p>` +
    `</div>`;
}
