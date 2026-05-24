import {
  loadConfig,
  parse,
  parseHtmlSlides,
  computeSlideMap,
  CommandSystem,
  KeyBindings,
  TouchInput,
  UserKeyBindings,
  KeybindingNotification,
  ShortcutsPanel,
  SyncManager,
  FeatureManager,
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
  createLogger,
  waitForProcessedElement,
  registerLayoutTransform,
  PluginRegistryClient,
  RoomPluginManager,
  createQrOverlayFeature,
  VALID_TRANSITIONS,
} from '@geekslides/engine';
import { registerHotClient } from '../../engine/src/hmr/hot-client.ts';
import { patternRegistry } from '../../../plugins/css-doodle/css-doodle-patterns/index.ts';
import { buildColorVars, parseConfig as parseDoodleConfig } from '../../../plugins/css-doodle/css-doodle-processor.ts';
import {
  initPluginLoader,
  resolvePlugin,
  resolveFeature,
} from './plugin-loader.js';
import { registerPluginCommands } from './plugin-commands.js';

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

// Initialize the plugin runtime API — plugins receive this via activate(api)
const PLUGIN_API = {
  version: 1,
  createLogger,
};
initPluginLoader(PLUGIN_API);

// Expose engine utilities for deck-local custom components.
// Scripts loaded via config.scripts can use window.__geekslides to access
// the pattern registry, color variable builder, config parser, and layout transform registry.
window.__geekslides = {
  patternRegistry,
  buildColorVars,
  parseDoodleConfig,
  waitForProcessedElement,
  registerLayoutTransform,
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

// On reload, prefer the last-known content proxy URL from localStorage so the
// user doesn't see a flash of the default filesystem deck before Yjs connects.
// Speaker view skips the cached proxy: it always uses the explicit config URL
// from its query params (faster — served directly from filesystem by Vite).
// The speaker view will sync content via Yjs after connecting anyway.
const _room = params.get('room') || 'default';
const _cachedProxy = viewMode === 'speaker' ? null : (() => {
  try {
    const raw = localStorage.getItem(`geekslides:proxy:${_room}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
})();

let configUrl = _cachedProxy?.configUrl
  ? _cachedProxy.configUrl
  : normalizeConfigUrl(params.get('config') || '/deck/config.json');
let configBase = getConfigBase(configUrl);

/**
 * Wrap a URL through the server-side deck proxy when the browser would block
 * it as mixed content (http:// URL loaded from an https:// page).
 */
function proxyUrlIfNeeded(url) {
  if (url.startsWith('http://') && window.location.protocol === 'https:') {
    return `${window.location.origin}/api/deck-proxy?url=${encodeURIComponent(url)}`;
  }
  // Resolve absolute-path URLs against the actual origin so they are immune
  // to <base href> pointing at a different (previously-loaded) remote origin.
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`;
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

  // HTML content (pptx-imported decks) — bypass markdown pipeline entirely.
  // Only supported for a single .html content file.
  if (contentPaths.length === 1 && contentPaths[0]?.endsWith('.html')) {
    const url = proxyUrlIfNeeded(resolveUrl(contentPaths[0]));
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      cache: 'no-store',
    });
    const html = await res.text();
    return { __htmlSlides: parseHtmlSlides(html) };
  }

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

/**
 * Process the result of fetchMarkdown() into slides, slide map, and line mapping.
 * HTML decks (pptx-imported, .html content) bypass the markdown pipeline entirely.
 * Returns { slides, slideMap, lineMapping, markdown } where markdown is '' for HTML decks.
 */
async function processContent(fetchResult, config) {
  if (typeof fetchResult === 'object' && fetchResult.__htmlSlides !== undefined) {
    return {
      slides: fetchResult.__htmlSlides,
      slideMap: [],
      lineMapping: createIdentityLineMapping(''),
      markdown: '',
    };
  }
  const processed = await applyPreprocessors(fetchResult, config);
  const parsedSlides = parse(processed.content, { lineMapping: processed.lineMapping });
  return {
    slides: parsedSlides,
    slideMap: computeSlideMap(parsedSlides),
    lineMapping: processed.lineMapping,
    markdown: fetchResult,
  };
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
        const text = await res.text();
        return extractCssText(text);
      } catch (err) {
        console.warn(`Failed to load style: ${url}`, err);
        return '';
      }
    }),
  );
  return cssTexts.join('\n');
}

function extractCssText(rawText) {
  const text = rawText.replace(/\/\/# sourceMappingURL=.*$/gm, '').trim();

  // Most responses are plain CSS; keep fast path simple.
  if (!text.includes('__vite__') && !text.includes('export default')) {
    return text;
  }

  // Vite raw modules can export a JSON-encoded CSS string.
  const exportDefaultLiteral = text.match(/export\s+default\s+("(?:\\.|[^"\\])*");?\s*$/s)?.[1];
  if (exportDefaultLiteral) {
    try {
      return JSON.parse(exportDefaultLiteral);
    } catch {
      // Fall through to other extraction patterns.
    }
  }

  // Vite CSS HMR modules commonly assign css to __vite__css.
  const viteCssLiteral =
    text.match(/\bconst\s+__vite__css\s*=\s*("(?:\\.|[^"\\])*")\s*;?/s)?.[1]
    ?? text.match(/__vite__updateStyle\([^,]+,\s*("(?:\\.|[^"\\])*")\)/s)?.[1];
  if (viteCssLiteral) {
    try {
      return JSON.parse(viteCssLiteral);
    } catch {
      // If parsing fails, use the original text to avoid dropping styles.
    }
  }

  return text;
}

/**
 * Load custom scripts declared in config.scripts.
 * Scripts are loaded sequentially via dynamic import(). If a script exports
 * a default function, it is called with the config object.
 */
async function loadScripts(config) {
  const scripts = Array.isArray(config.scripts) ? config.scripts : [];
  for (const script of scripts) {
    try {
      const url = isRemotePluginUrl(script)
        ? `/api/plugin-proxy?url=${encodeURIComponent(script)}`
        : resolveUrl(script);
      const mod = await import(/* @vite-ignore */ url);
      if (mod.default && typeof mod.default === 'function') {
        mod.default(config);
      }
      if (mod.init && typeof mod.init === 'function') {
        mod.init(config);
      }
      console.log(`[scripts] Loaded: ${script}`);
    } catch (err) {
      console.warn(`[scripts] Failed to load '${script}':`, err.message);
    }
  }
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
  const scriptPaths = Array.isArray(activeConfig.scripts) ? activeConfig.scripts.filter((s) => !isRemotePluginUrl(s)) : [];
  const files = [configUrl, ...contentPaths.map(resolveUrl), ...getTrackedStylePaths(activeConfig), ...scriptPaths.map(resolveUrl)];
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
      // Resolve from plugin bundles
      pp = await resolvePlugin(name, 'preprocessor', resolveUrl);
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
      // Resolve from plugin bundles
      const proc = await resolvePlugin(name, 'processor', resolveUrl);
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
  // If we're loading from a cached proxy and it fails, fall back to default deck
  let config;
  try {
    config = await fetchConfig();
  } catch (proxyErr) {
    if (_cachedProxy?.configUrl) {
      console.warn('[init] Cached proxy config unavailable, falling back to default deck:', proxyErr.message);
      localStorage.removeItem(`geekslides:proxy:${_room}`);
      configUrl = normalizeConfigUrl(params.get('config') || '/deck/config.json');
      configBase = getConfigBase(configUrl);
      config = await fetchConfig();
    } else {
      throw proxyErr;
    }
  }
  const _rawContent = await fetchMarkdown(config);
  let combinedCss = await fetchStyles(config);
  await loadScripts(config);
  updateDocumentTitle(config);
  // Speaker view doesn't need HMR file watching or slide-map publishing
  // (those are presenter-only concerns). Skipping them speeds up initial load.
  if (viewMode !== 'speaker') {
    await registerHmrFiles(config);
  }
  let currentSlideMap = [];
  let currentLineMapping = createIdentityLineMapping('');

  if (configBase) {
    updateDocumentBase(configBase);
  }

  const _initContent = await processContent(_rawContent, config);
  let markdown = _initContent.markdown;
  currentLineMapping = _initContent.lineMapping;
  let slides = _initContent.slides;
  currentSlideMap = _initContent.slideMap;
  if (viewMode !== 'speaker') {
    await publishSlideMap(currentSlideMap);
  }

  if (viewMode === 'speaker') {
    document.body.innerHTML = '<geek-speaker-view id="speaker"></geek-speaker-view>';
    const speaker = document.getElementById('speaker');
    const activeProcessors = await getActiveProcessors(config);
    speaker.setAspectRatio(config.aspectRatio);
    if (config.slideWidth && config.slideHeight) {
      speaker.setDesignDimensions(config.slideWidth, config.slideHeight);
    }
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
        const _fetchResult2 = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);
        const _content2 = await processContent(_fetchResult2, newConfig);
        slides = _content2.slides;
        speaker.setAspectRatio(newConfig.aspectRatio);
        if (newConfig.slideWidth && newConfig.slideHeight) {
          speaker.setDesignDimensions(newConfig.slideWidth, newConfig.slideHeight);
        }
        combinedCss = newCss;
        const themeCss = lastAppliedThemeName
          ? (BUILTIN_THEMES.find((t) => t.name === lastAppliedThemeName)?.css || '')
          : '';
        const fullCss = themeCss
          ? (newCss ? newCss + '\n' + themeCss : themeCss)
          : newCss;
        if (fullCss) speaker.loadStyles(fullCss);
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

    // Track the last theme applied so we don't re-apply unchanged theme.
    let lastAppliedThemeName = '';

    const applySpeakerTheme = () => {
      const state = sync.doc.getMap('sessionState');
      const themeName = state.get('theme');
      if (typeof themeName !== 'string' || themeName === lastAppliedThemeName) return;
      lastAppliedThemeName = themeName;
      const found = BUILTIN_THEMES.find((t) => t.name === themeName);
      const themeCss = found ? found.css : '';
      const fullCss = themeCss
        ? (combinedCss ? combinedCss + '\n' + themeCss : themeCss)
        : combinedCss;
      if (fullCss) speaker.loadStyles(fullCss);
      console.log(`[speaker] Theme synced: ${themeName}`);
    };

    sync.doc.getMap('sessionState').observe(() => {
      checkRoomTransfer();
      checkSpeakerContentProxy();
      applySpeakerSyncState();
      applySpeakerTheme();
    });

    // Apply current room state immediately so speaker view opens in sync,
    // even before the presenter navigates again.
    checkRoomTransfer();
    checkSpeakerContentProxy();
    applySpeakerSyncState();
    applySpeakerTheme();

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
    if (config.slideWidth && config.slideHeight) {
      slideshow.setDesignDimensions(config.slideWidth, config.slideHeight);
    }
    slideshow.setTransition(config.transition);

    const syncConfig = config.sync || {};
    const syncEnabled = syncConfig.enabled !== false;
    let sync = null;

    // The initial room — used to disable navigation sync in the default room
    // so multiple users don't fight for slide control.
    const initialRoom = params.get('room') || syncConfig.room || 'default';
    let isDefaultRoom = initialRoom === 'default';

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
        // Expose sync for e2e testing (Yjs doc access)
        window.__geekslides_sync = sync;
        const wsUrl = syncConfig.server || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        const room = initialRoom;
        const token = params.get('token') || undefined;
        // In the default room, navigation is independent for each user to
        // avoid conflicts. We still connect for contentProxy/features but
        // don't bind the slideshow (no remote nav) and don't publish state.
        if (!isDefaultRoom) {
          sync.bind(slideshow);
        }
        sync.connect(wsUrl, room, { token, viewerToken: vtoken ?? undefined });

        slideshow.addEventListener('geek:navigate', (e) => {
          if (!isDefaultRoom) {
            sync.publishState(e.detail.slide, e.detail.partial, e.detail.mode);
          }
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
                  // Still cache the proxy URL for instant reload
                  try {
                    localStorage.setItem(`geekslides:proxy:${room}`, JSON.stringify({ configUrl: `${existingProxy.baseUrl}config.json` }));
                  } catch { /* localStorage unavailable */ }
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
            // Cache for instant reload
            try {
              localStorage.setItem(`geekslides:proxy:${room}`, JSON.stringify({ configUrl: `${proxyBase}config.json` }));
            } catch { /* localStorage unavailable */ }
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
            let feature;
            if (isRemotePluginUrl(featureName) || isLocalPluginPath(featureName)) {
              // Remote or local feature — use legacy loading
              const { loadFeature } = await import('@geekslides/engine');
              feature = await loadFeature(featureName, resolveUrl);
            } else {
              // Built-in feature — resolve from plugin bundles
              feature = await resolveFeature(featureName, resolveUrl);
              if (!feature) {
                console.warn(`[features] Unknown feature: '${featureName}'`);
                continue;
              }
            }
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

            const _fetchResult3 = await fetchMarkdown(newConfig);
            const newCss = await fetchStyles(newConfig);

            combinedCss = newCss;
            updateDocumentTitle(newConfig);
            slideshow.loadStyles(newCss);

            const _content3 = await processContent(_fetchResult3, newConfig);
            currentLineMapping = _content3.lineMapping;
            currentSlideMap = _content3.slideMap;
            slideshow.loadSlides(_content3.slides);
            config = newConfig;
            await applyProcessors(slideshow, newConfig);
            slideshow.setAspectRatio(newConfig.aspectRatio);
            if (newConfig.slideWidth && newConfig.slideHeight) {
              slideshow.setDesignDimensions(newConfig.slideWidth, newConfig.slideHeight);
            }
            slideshow.setTransition(newConfig.transition);

            // Reload features from new config
            featureManager.deactivateAll();
            for (const featureName of newConfig.features || []) {
              try {
                let feature;
                if (isRemotePluginUrl(featureName) || isLocalPluginPath(featureName)) {
                  const { loadFeature } = await import('@geekslides/engine');
                  feature = await loadFeature(featureName, resolveUrl);
                } else {
                  feature = await resolveFeature(featureName, resolveUrl);
                  if (!feature) {
                    console.warn(`[content-proxy] Unknown feature: '${featureName}'`);
                    continue;
                  }
                }
                featureManager.register(feature);
              } catch (err) {
                console.warn(`[content-proxy] Failed to load feature '${featureName}':`, err.message);
              }
            }

            // Restore sync position after reloading slides
            const state = sync.doc.getMap('sessionState');
            const slide = state.get('slide');
            const partial = state.get('partial');
            if (typeof slide === 'number') {
              slideshow.goTo(slide, typeof partial === 'number' ? partial : 0);
            }

            // Emit presentation:ready and slide:enter for newly loaded features.
            featureManager.emit('presentation:ready', { slideCount: slideshow.slideCount });
            const currentSlideAfterReload = slideshow.currentSlide;
            lastSlide = currentSlideAfterReload;
            featureManager.emit('slide:enter', { slideIndex: currentSlideAfterReload, previousIndex: -1 });

            console.log('[content-proxy] Loaded deck from proxy:', proxyBaseUrl);
            // Cache for instant reload
            try {
              localStorage.setItem(`geekslides:proxy:${_room}`, JSON.stringify({ configUrl: `${proxyBaseUrl}config.json` }));
            } catch { /* localStorage unavailable */ }
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
    let activeThemeIndex = -1;

    function showCmdOutput(msg) {
      terminal.setOutput(msg);
    }

    async function applyPresentationConfig(newConfig) {
      config = newConfig;
      updateDocumentTitle(newConfig);
      slideshow.setAspectRatio(newConfig.aspectRatio);
      if (newConfig.slideWidth && newConfig.slideHeight) {
        slideshow.setDesignDimensions(newConfig.slideWidth, newConfig.slideHeight);
      }

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
        // Cache the proxy URL so page reload instantly uses it
        try {
          localStorage.setItem(`geekslides:proxy:${targetRoom}`, JSON.stringify({ configUrl: `${proxyBase}config.json` }));
        } catch { /* localStorage unavailable */ }
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
        // Reset <base> to the current origin before fetching so that a stale
        // <base href> from a previously-loaded remote deck doesn't redirect
        // local fetches to the wrong origin.
        if (!resolvedConfigUrl.startsWith('http')) {
          updateDocumentBase(getConfigBase(resolvedConfigUrl));
        }
        const proxiedConfigUrl = proxyUrlIfNeeded(resolvedConfigUrl);
        console.log(`[reloadDeck:${reloadId}] loading config from ${proxiedConfigUrl}`);
        const newConfig = await loadConfig(proxiedConfigUrl);
        console.log(`[reloadDeck:${reloadId}] config loaded: title=${newConfig.title} content=${newConfig.content}`);

        configUrl = resolvedConfigUrl;
        configBase = getConfigBase(resolvedConfigUrl);
        updateDocumentBase(configBase);

        const _fetchResult4 = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);
        await loadScripts(newConfig);

        combinedCss = newCss;
        updateDocumentTitle(newConfig);
        slideshow.loadStyles(newCss);

        const _content4 = await processContent(_fetchResult4, newConfig);
        currentLineMapping = _content4.lineMapping;
        currentSlideMap = _content4.slideMap;
        slideshow.loadSlides(_content4.slides);
        config = newConfig;
        await applyProcessors(slideshow, newConfig);
        await registerHmrFiles(newConfig);

        slideshow.setAspectRatio(newConfig.aspectRatio);
        if (newConfig.slideWidth && newConfig.slideHeight) {
          slideshow.setDesignDimensions(newConfig.slideWidth, newConfig.slideHeight);
        }
        slideshow.setTransition(newConfig.transition);
        slideshow.goTo(0);
        console.log(`[reloadDeck:${reloadId}] slides loaded, goTo(0), slideCount=${slideshow.slideCount}`);

        // Update the module-level markdown so buildManifest scans the
        // correct images when uploading the new deck.
        markdown = _content4.markdown;

        // Reload features from new config (deck may have different plugins)
        featureManager.deactivateAll();
        for (const featureName of newConfig.features || []) {
          try {
            let feature;
            if (isRemotePluginUrl(featureName) || isLocalPluginPath(featureName)) {
              const { loadFeature } = await import('@geekslides/engine');
              feature = await loadFeature(featureName, resolveUrl);
            } else {
              feature = await resolveFeature(featureName, resolveUrl);
              if (!feature) {
                console.warn(`[reloadDeck:${reloadId}] Unknown feature: '${featureName}'`);
                continue;
              }
            }
            featureManager.register(feature);
          } catch (err) {
            console.warn(`[reloadDeck:${reloadId}] Failed to load feature '${featureName}':`, err.message);
          }
        }
        featureManager.emit('presentation:ready', { slideCount: slideshow.slideCount });
        featureManager.emit('slide:enter', { slideIndex: 0, previousIndex: -1 });

        if (sync && sync.isConnected) {
          // Notify plugins (e.g. whiteboard) to clear state from the previous deck
          document.dispatchEvent(new CustomEvent('geek:presentation:reload'));

          // Clear all Yjs feature state from the previous deck so viewers don't
          // see stale data (e.g. poll votes from a previous presentation).
          sync.doc.transact(() => {
            const featuresRoot = sync.doc.getMap('features');
            featuresRoot.forEach((_value, key) => {
              featuresRoot.delete(key);
            });
          });

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

    // Track whether the first proxy check loaded from localStorage cache
    let firstProxyReloadFromCache = !!_cachedProxy?.configUrl;

    async function reloadDeckFromProxy(proxyBaseUrl) {
      const proxyId = Math.random().toString(36).slice(2, 8);
      console.log(`[proxyReload:${proxyId}] START proxyBaseUrl=${proxyBaseUrl} currentTitle=${config?.title}`);
      try {
        const proxyConfigUrl = `${proxyBaseUrl}config.json`;

        // When the page was loaded from localStorage cache and the same proxy is
        // confirmed via Yjs, skip the full deck reload (slides, markdown, CSS) but
        // still re-activate features so Yjs-synced data (e.g. strokes) is replayed.
        if (firstProxyReloadFromCache && configUrl === proxyConfigUrl) {
          firstProxyReloadFromCache = false;
          console.log(`[proxyReload:${proxyId}] FAST PATH (same proxy, re-activating features only)`);

          // Re-activate features now that Yjs has synced
          featureManager.deactivateAll();
          for (const featureName of config.features || []) {
            try {
              let feature;
              if (isRemotePluginUrl(featureName) || isLocalPluginPath(featureName)) {
                const { loadFeature } = await import('@geekslides/engine');
                feature = await loadFeature(featureName, resolveUrl);
              } else {
                feature = await resolveFeature(featureName, resolveUrl);
                if (!feature) continue;
              }
              featureManager.register(feature);
            } catch (err) {
              console.warn(`[proxyReload:${proxyId}] Failed to load feature '${featureName}':`, err.message);
            }
          }
          featureManager.emit('presentation:ready', { slideCount: slideshow.slideCount });
          featureManager.emit('slide:enter', { slideIndex: slideshow.currentSlide, previousIndex: -1 });
          return;
        }
        firstProxyReloadFromCache = false;

        const newConfig = await loadConfig(proxyConfigUrl);
        console.log(`[proxyReload:${proxyId}] config loaded: title=${newConfig.title} content=${newConfig.content}`);

        configUrl = proxyConfigUrl;
        configBase = proxyBaseUrl;
        updateDocumentBase(configBase);

        const _fetchResult5 = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);

        const _content5 = await processContent(_fetchResult5, newConfig);
        combinedCss = newCss;
        // Update module-level markdown for buildManifest
        markdown = _content5.markdown;
        updateDocumentTitle(newConfig);
        slideshow.loadStyles(newCss);

        currentLineMapping = _content5.lineMapping;
        currentSlideMap = _content5.slideMap;
        slideshow.loadSlides(_content5.slides);
        config = newConfig;
        await applyProcessors(slideshow, newConfig);
        slideshow.setAspectRatio(newConfig.aspectRatio);
        if (newConfig.slideWidth && newConfig.slideHeight) {
          slideshow.setDesignDimensions(newConfig.slideWidth, newConfig.slideHeight);
        }
        slideshow.setTransition(newConfig.transition);

        // Clear Yjs feature state from previous deck before registering new features
        sync.doc.transact(() => {
          const featuresRoot = sync.doc.getMap('features');
          featuresRoot.forEach((_value, key) => {
            featuresRoot.delete(key);
          });
        });

        // Reload features from new config
        featureManager.deactivateAll();
        for (const featureName of newConfig.features || []) {
          try {
            let feature;
            if (isRemotePluginUrl(featureName) || isLocalPluginPath(featureName)) {
              const { loadFeature } = await import('@geekslides/engine');
              feature = await loadFeature(featureName, resolveUrl);
            } else {
              feature = await resolveFeature(featureName, resolveUrl);
              if (!feature) {
                console.warn(`[proxyReload:${proxyId}] Unknown feature: '${featureName}'`);
                continue;
              }
            }
            featureManager.register(feature);
          } catch (err) {
            console.warn(`[proxyReload:${proxyId}] Failed to load feature '${featureName}':`, err.message);
          }
        }

        // Restore sync position after reloading slides (skip in default room
        // where navigation is independent per user — always start at slide 0).
        if (!isDefaultRoom) {
          const state = sync.doc.getMap('sessionState');
          const slide = state.get('slide');
          const partial = state.get('partial');
          if (typeof slide === 'number') {
            slideshow.goTo(slide, typeof partial === 'number' ? partial : 0);
          }
        }

        // Emit presentation:ready and slide:enter for newly loaded features.
        // The slide:enter is needed because the navigate tracker's lastSlide may
        // already equal the target slide (from the pre-reload Yjs state), causing
        // the geek:navigate handler to skip the emission.
        featureManager.emit('presentation:ready', { slideCount: slideshow.slideCount });
        const currentSlideAfterReload = slideshow.currentSlide;
        lastSlide = currentSlideAfterReload;
        featureManager.emit('slide:enter', { slideIndex: currentSlideAfterReload, previousIndex: -1 });

        // Cache the proxy URL so page reload instantly uses it (no Yjs wait).
        try {
          const currentRoom = sync?.currentRoom ?? 'default';
          localStorage.setItem(`geekslides:proxy:${currentRoom}`, JSON.stringify({ configUrl: proxyConfigUrl }));
        } catch { /* localStorage unavailable */ }

        console.log(`[proxyReload:${proxyId}] DONE title=${newConfig.title} slideCount=${slideshow.slideCount} slide=${slideshow.currentSlide}`);
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

        // Update default-room flag and bind slideshow for nav sync if leaving
        // the default room (or unbind if returning to it).
        const wasDefault = isDefaultRoom;
        isDefaultRoom = roomName === 'default';
        if (wasDefault && !isDefaultRoom) {
          sync.bind(slideshow);
        }

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
          if (!isDefaultRoom) {
            sync.publishState(slideshow.currentSlide, slideshow.currentPartial, slideshow.mode);
          }
          showCmdOutput(`✓ Room changed: ${roomName} (loaded room deck)`);
        } else {
          // 4b. Empty room — upload our current deck so peers who join see it.
          if (!isDefaultRoom) {
            sync.publishState(slideshow.currentSlide, slideshow.currentPartial, slideshow.mode);
          }
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
    commands.register({ name: 'go', label: 'Go to slide N (usage: go 5)', hasArgs: true, execute: (args) => {
      const n = Number.parseInt(args?.[0], 10);
      if (!Number.isNaN(n) && n >= 1 && n <= slideshow.slideCount) {
        slideshow.goTo(n - 1);
      }
    }, category: 'navigation' });
    commands.register({ name: 'load', label: 'Load a different deck (usage: load config.json)', hasArgs: true, execute: (args) => {
      const currentRoom = sync?.currentRoom ?? params.get('room') ?? 'default';
      if (currentRoom === 'default') {
        showCmdOutput('✗ Cannot load a deck in the default room. Use "room <name>" to switch to your own room first.');
        return;
      }
      const deckUrl = args?.[0];
      if (!deckUrl) {
        showCmdOutput('✗ Usage: load <config-url>');
        return;
      }
      void reloadDeck(deckUrl);
    }, category: 'config' });
    commands.register({ name: 'room', label: 'Switch sync room (usage: room my-talk)', hasArgs: true, execute: (args) => {
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
    commands.register({ name: 'transition', label: 'Set transition (slide, fade, none)', hasArgs: true, execute: (args) => {
      const name = args?.[0];
      if (!name || !VALID_TRANSITIONS.includes(name)) {
        showCmdOutput(`Usage: transition <${VALID_TRANSITIONS.join('|')}>`);
        return;
      }
      slideshow.setTransition(name);
      showCmdOutput(`Transition set to: ${name}`);
    }, category: 'view' });

    // Activate keyboard and touch input early — before async feature loading —
    // so that navigation is responsive as soon as the slideshow is ready.
    terminal.setCommandSystem(commands);

    const keys = new KeyBindings(commands);
    const userBindings = new UserKeyBindings(commands);
    keys.setUserBindings(userBindings);

    // Shortcuts panel and notification (attached to slideshow shadow root)
    const shadowRoot = slideshow.shadowRoot;
    let shortcutsPanel;
    if (shadowRoot) {
      // Inject panel + notification styles
      const panelStyle = document.createElement('style');
      panelStyle.textContent = ShortcutsPanel.styles() + KeybindingNotification.styles();
      shadowRoot.appendChild(panelStyle);

      const notification = new KeybindingNotification(shadowRoot);
      keys.setNotification(notification);

      shortcutsPanel = new ShortcutsPanel(shadowRoot, commands, userBindings);
      keys.setPanelIsOpen(() => shortcutsPanel.isOpen);
    }

    keys.onTerminalToggle(() => terminal.toggle());
    keys.onShortcutsToggle(() => {
      if (shortcutsPanel) shortcutsPanel.toggle();
    });
    slideshow.addEventListener('geek:shortcuts:toggle', () => {
      if (shortcutsPanel) shortcutsPanel.toggle();
    });
    keys.activate();

    const touch = new TouchInput(commands, slideshow);
    touch.activate();

    slideshow.addEventListener('geek:toolbar:command', (e) => {
      commands.execute(e.detail.command);
    });

    terminal.addEventListener('geek:terminal:close', () => keys.closeTerminal());

    // --- Feature system (presenter/peer mode) ---
    // Tracks feature IDs that were activated by room plugins (not from config.features),
    // so they can be cleanly deactivated when the plugin set changes.
    const roomPluginFeatureIds = new Set();

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
        let feature;
        if (isRemotePluginUrl(featureName) || isLocalPluginPath(featureName)) {
          const { loadFeature } = await import('@geekslides/engine');
          feature = await loadFeature(featureName, resolveUrl);
        } else {
          feature = await resolveFeature(featureName, resolveUrl);
          if (!feature) {
            console.warn(`[features] Unknown feature: '${featureName}'`);
            continue;
          }
        }
        featureManager.register(feature);
      } catch (err) {
        console.warn(`[features] Failed to load feature '${featureName}':`, err.message);
      }
    }

    // --- QR overlay feature (always active for room-synced share-qr) ---
    if (sync) {
      featureManager.register(createQrOverlayFeature());
    }

    // --- Plugin registry system (room-scoped) ---
    const registryClient = new PluginRegistryClient();
    const roomPluginManager = sync ? new RoomPluginManager(sync.doc) : null;

    // Reprocess the deck when room plugins change (non-destructive: preserves navigation)
    async function reprocessDeckForPlugins() {
      try {
        const _rawContent = await fetchMarkdown(config);
        const result = await processContent(_rawContent, config);
        markdown = result.markdown;
        currentLineMapping = result.lineMapping;
        slides = result.slides;
        currentSlideMap = result.slideMap;
        const currentSlide = slideshow.currentSlide;
        const currentPartial = slideshow.currentPartial;
        slideshow.loadSlides(slides);
        await applyProcessors(slideshow, config);
        // Also load room plugins' processors and activate their features
        if (roomPluginManager) {
          // Deactivate features from the previous room-plugin set (skip any
          // that are also in config.features — they weren't room-owned).
          for (const id of roomPluginFeatureIds) {
            featureManager.unregister(id);
          }
          roomPluginFeatureIds.clear();

          const roomPlugins = roomPluginManager.listPlugins();
          for (const rp of roomPlugins) {
            try {
              const { importRemotePlugin } = await import('@geekslides/engine');
              const mod = await importRemotePlugin(rp.manifestUrl);
              if (mod.activate) {
                const exports = mod.activate(PLUGIN_API);
                if (exports?.processors) {
                  const slideElements = slideshow.shadowRoot?.querySelectorAll('geek-slide') || [];
                  for (const slideEl of slideElements) {
                    const content = slideEl.shadowRoot?.querySelector('section.content');
                    if (!content) continue;
                    for (const proc of Object.values(exports.processors)) {
                      if (typeof proc === 'function') proc(content);
                    }
                  }
                }
                // Activate features exported by the room plugin.
                // Only register features not already active (e.g. from config.features)
                // to avoid unregistering config-owned features on the next reprocess.
                if (exports?.features) {
                  const activeIds = new Set(featureManager.list());
                  for (const [featureId, feature] of Object.entries(exports.features)) {
                    if (!activeIds.has(featureId)) {
                      featureManager.register(feature);
                      roomPluginFeatureIds.add(featureId);
                    }
                  }
                }
              }
            } catch (err) {
              console.warn(`[room-plugins] Failed to apply plugin '${rp.name}':`, err.message);
            }
          }
        }
        slideshow.goTo(currentSlide, currentPartial);
      } catch (err) {
        console.warn('[room-plugins] Reprocess failed:', err.message);
      }
    }

    if (roomPluginManager) {
      roomPluginManager.onChange(() => {
        void reprocessDeckForPlugins();
      });
    }

    registerPluginCommands({
      commands,
      roomPluginManager,
      registryClient,
      showOutput: showCmdOutput,
      showError: (msg) => terminal.setOutput(msg, true),
      reprocessDeck: reprocessDeckForPlugins,
    });

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

    commands.register({ name: 'theme-list', label: 'List all available built-in themes', bindable: false, execute: () => {
      const lines = BUILTIN_THEMES.map((t) => {
        const dark = t.dark ? ' [dark]' : '';
        return `  ${t.name.padEnd(12)} — ${t.description}${dark}`;
      });
      showCmdOutput('Built-in themes:\n' + lines.join('\n'));
    }, category: 'theme' });

    commands.register({ name: 'theme', label: 'Switch to a built-in theme (usage: theme aurora)', hasArgs: true, execute: (args) => {
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
      if (sync) sync.doc.getMap('sessionState').set('theme', name);
      showCmdOutput(`✓ Theme switched to: ${found.label}`);
      console.log('[theme] Switched to:', found.name);
    }, category: 'theme' });

    commands.register({ name: 'theme-cycle', label: 'Cycle to next theme', execute: () => {
      activeThemeIndex = (activeThemeIndex + 1) % BUILTIN_THEMES.length;
      const next = BUILTIN_THEMES[activeThemeIndex];
      activeThemeOverrideCss = next.css;
      slideshow.loadStyles(combinedCss + '\n' + activeThemeOverrideCss);
      if (sync) sync.doc.getMap('sessionState').set('theme', next.name);
    }, category: 'theme' });

    if (sync) {
      commands.register({ name: 'sync-toggle', label: 'Toggle sync (pause/resume following)', execute: () => {
        sync.toggleFollow();
      }, category: 'sync' });
      commands.register({ name: 'sync-disconnect', label: 'Disconnect from sync', bindable: false, execute: () => {
        sync.disconnect();
        showCmdOutput('✓ Sync disconnected');
        console.log('[sync] Disconnected');
      }, category: 'sync' });
      commands.register({ name: 'share', label: 'Create a viewer share link for this room', bindable: false, execute: () => {
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

      // --- share-qr command: display QR code across all room clients ---
      commands.register({ name: 'share-qr', label: 'Show QR code with viewer link on all room screens', bindable: false, execute: () => {
        const room = sync.currentRoom;
        if (!room) {
          showCmdOutput('✗ Not connected to a room');
          return;
        }
        void (async () => {
          try {
            const serverBaseUrl = `${location.protocol}//${location.host}`;
            // Create or reuse share link
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

            // Create short URL for denser QR code
            let qrUrl = viewerLink;
            try {
              const shortRes = await fetch(`${serverBaseUrl}/api/short`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: viewerLink }),
              });
              if (shortRes.ok) {
                const shortData = await shortRes.json();
                qrUrl = shortData.short;
              }
            } catch {
              // Fall back to full URL if shortening fails
            }

            // Store presenter token
            sync.updateConnectionToken(data.presenterToken);

            // Broadcast QR URL to all room clients via feature shared state
            const featuresMap = sync.doc.getMap('features');
            let qrMap = featuresMap.get('qr-overlay');
            if (!qrMap) {
              const Y = await import('yjs');
              qrMap = new Y.Map();
              featuresMap.set('qr-overlay', qrMap);
            }
            qrMap.set('qrUrl', qrUrl);

            showCmdOutput(`✓ QR code shown (${qrUrl})`);
          } catch (err) {
            showCmdOutput(`✗ Share QR failed: ${err.message}`);
          }
        })();
      }, category: 'sync' });
    }

    // --- Keybinding terminal commands ---
    commands.register({ name: 'bind', label: 'Bind a key to a command (usage: bind Ctrl+S sync-toggle)', hasArgs: true, execute: (args) => {
      if (!args || args.length < 2) {
        showCmdOutput('✗ Usage: bind <key> <command> [command2 ...]');
        return;
      }
      const [key, ...cmdNames] = args;
      for (const cmdName of cmdNames) {
        if (!commands.has(cmdName)) {
          showCmdOutput(`✗ Unknown command: "${cmdName}"`);
          return;
        }
        userBindings.bind(key, cmdName);
      }
      showCmdOutput(`✓ Bound ${key} → ${cmdNames.join(', ')}`);
    }, category: 'config' });

    commands.register({ name: 'unbind', label: 'Remove a key binding (usage: unbind Ctrl+S)', hasArgs: true, execute: (args) => {
      const key = args?.[0];
      if (!key) {
        showCmdOutput('✗ Usage: unbind <key> [command]');
        return;
      }
      const cmdName = args?.[1];
      userBindings.unbind(key, cmdName);
      showCmdOutput(`✓ Unbound ${key}${cmdName ? ` → ${cmdName}` : ''}`);
    }, category: 'config' });

    commands.register({ name: 'export-bindings', label: 'Export keybindings to console', bindable: false, execute: () => {
      const json = userBindings.exportConfig();
      showCmdOutput('Keybindings:\n' + json);
      console.log('[keybindings] Export:', json);
    }, category: 'config' });

    commands.register({ name: 'import-bindings', label: 'Import keybindings from JSON (usage: import-bindings {"key":["cmd"]})', hasArgs: true, execute: (args) => {
      const json = args?.join(' ');
      if (!json) {
        showCmdOutput('✗ Usage: import-bindings <json>');
        return;
      }
      try {
        userBindings.importConfig(json, true);
        showCmdOutput('✓ Keybindings imported');
      } catch {
        showCmdOutput('✗ Invalid JSON');
      }
    }, category: 'config' });

    if (import.meta.hot) {
      registerHotClient(import.meta.hot, {
        fetchMarkdown: async () => {
          const _hmrFetch = await fetchMarkdown(config);
          if (typeof _hmrFetch === 'object' && _hmrFetch.__htmlSlides !== undefined) {
            // HTML decks (pptx-imported) don't support HMR
            return '';
          }
          const processed = await applyPreprocessors(_hmrFetch, config);
          currentLineMapping = processed.lineMapping;
          return processed.content;
        },
        fetchStyles: async () => fetchStyles(config),
        fetchConfig,
        reloadSlides: async (md) => {
          const previousSlideCount = slideshow.slideCount;
          const previousSlide = slideshow.currentSlide;
          const previousPartial = slideshow.currentPartial;
          const newSlides = parse(md, { lineMapping: currentLineMapping });
          currentSlideMap = computeSlideMap(newSlides);
          const preservePosition = previousSlideCount === newSlides.length;
          slideshow.loadSlides(
            newSlides,
            preservePosition
              ? {
                  initialSlide: previousSlide,
                  initialPartial: previousPartial,
                  suppressTransition: true,
                }
              : undefined,
          );
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
