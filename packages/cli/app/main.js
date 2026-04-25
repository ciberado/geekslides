import {
  loadConfig,
  parse,
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

function normalizeConfigUrl(url) {
  // Transform GitHub repo URLs to raw.githubusercontent.com
  const ghMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/);
  if (ghMatch) {
    const [, owner, repo, branch = 'main'] = ghMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/config.json`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/')) {
    return url;
  }
  return `/${url.replace(/^\.\//, '')}`;
}

function getConfigBase(url) {
  const lastSlash = url.lastIndexOf('/');
  return lastSlash >= 0 ? url.substring(0, lastSlash + 1) : '/';
}

function updateDocumentBase(baseHref) {
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

function resolveUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path;
  }
  return configBase + path;
}

async function fetchConfig() {
  return await loadConfig(`${configUrl}${configUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
}

async function fetchMarkdown(config) {
  const contentUrl = resolveUrl(config.content);
  const res = await fetch(`${contentUrl}${contentUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    cache: 'no-store',
  });
  return await res.text();
}

async function fetchStyles(config) {
  const styleUrls = Array.isArray(config.styles) ? config.styles : [];
  const cssTexts = await Promise.all(
    styleUrls.map(async (url) => {
      try {
        const resolvedUrl = resolveUrl(url);
        const separator = resolvedUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${resolvedUrl}${separator}raw&t=${Date.now()}`, {
          cache: 'no-store',
        });
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
      } catch {
        console.warn(`Failed to load style: ${url}`);
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
  const files = [configUrl, resolveUrl(activeConfig.content), ...getTrackedStylePaths(activeConfig)];
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
      result = pp(result);
    }
  }
  return result;
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
  const markdown = await fetchMarkdown(config);
  let combinedCss = await fetchStyles(config);
  updateDocumentTitle(config);
  await registerHmrFiles(config);

  if (configBase) {
    updateDocumentBase(configBase);
  }

  const processedMarkdown = await applyPreprocessors(markdown, config);
  const slides = parse(processedMarkdown);

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

    const sync = new SyncManager();
    sync.connect(wsUrl, room);

    document.addEventListener('geek:sync:state', (e) => {
      if (e.detail?.connected) {
        console.log('[speaker] Connected to sync server');
      }
    });

    sync.doc.getMap('sessionState').observe(() => {
      const state = sync.doc.getMap('sessionState');
      const slide = state.get('slide');
      const partial = state.get('partial');
      if (typeof slide === 'number') {
        speaker.updateSlide(slide, typeof partial === 'number' ? partial : 0);
      }
    });

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
    let isContentUploader = false;

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

        // Mark as uploader immediately so checkContentProxy() never
        // overwrites the locally-loaded deck with stale proxy data.
        if (!isReadonly) {
          isContentUploader = true;
        }

        // Content proxy: upload deck assets to server so remote viewers can access them
        // Fire-and-forget — don't block the rest of initialization
        void (async () => {
          try {
            const serverBaseUrl = `${location.protocol}//${location.host}`;
            const manifest = buildManifest(configUrl, config, markdown, combinedCss);
            await uploadDeck(serverBaseUrl, room, configBase, manifest);

            // Publish proxy info so audience clients know where to find content
            const proxyBase = getProxyBaseUrl(serverBaseUrl, room);
            sync.doc.transact(() => {
              sync.doc.getMap('sessionState').set('contentProxy', JSON.stringify({
                room,
                baseUrl: proxyBase,
              }));
            });

            console.log('[content-proxy] Deck uploaded for room:', room);
          } catch (err) {
            console.warn('[content-proxy] Upload failed (remote viewers may not see content):', err.message);
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
        let proxyLoaded = false;

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
            const newSlides = parse(processedMd);
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

        const checkContentProxy = () => {
          if (proxyLoaded || isContentUploader) return;
          const proxyRaw = sync.doc.getMap('sessionState').get('contentProxy');
          if (typeof proxyRaw !== 'string') return;

          try {
            const proxy = JSON.parse(proxyRaw);
            if (proxy.baseUrl) {
              proxyLoaded = true;
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

    async function reloadDeck(newConfigUrl) {
      showCmdOutput('Loading...');
      try {
        const resolvedConfigUrl = normalizeConfigUrl(newConfigUrl);
        const newConfig = await loadConfig(resolvedConfigUrl);

        configUrl = resolvedConfigUrl;
        configBase = getConfigBase(resolvedConfigUrl);
        updateDocumentBase(configBase);

        const newMarkdown = await fetchMarkdown(newConfig);
        const newCss = await fetchStyles(newConfig);

        combinedCss = newCss;
        updateDocumentTitle(newConfig);
        slideshow.loadStyles(newCss);

        const processedMd = await applyPreprocessors(newMarkdown, newConfig);
        const newSlides = parse(processedMd);
        slideshow.loadSlides(newSlides);
        config = newConfig;
        await applyProcessors(slideshow, newConfig);
        await registerHmrFiles(newConfig);

        slideshow.setAspectRatio(newConfig.aspectRatio);
        slideshow.goTo(0);

        if (sync && sync.isConnected) {
          sync.publishState(0, 0, 'present');
        }

        showCmdOutput(`✓ Loaded: ${resolvedConfigUrl}`);
        console.log('[load] Switched to:', resolvedConfigUrl);
      } catch (err) {
        showCmdOutput(`✗ Failed to load: ${err.message}`);
        console.error('[load] Error:', err);
      }
    }

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
        const newSlides = parse(processedMd);
        slideshow.loadSlides(newSlides);
        config = newConfig;
        await applyProcessors(slideshow, newConfig);
        slideshow.setAspectRatio(newConfig.aspectRatio);

        console.log('[content-proxy] Loaded deck from proxy:', proxyBaseUrl);
      } catch (err) {
        console.warn('[content-proxy] Failed to load from proxy:', err.message);
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
        sync.disconnect();
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
        const wsUrl = config.sync?.server || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        sync.connect(wsUrl, roomName);
        sync.publishState(slideshow.currentSlide, slideshow.currentPartial, slideshow.mode);
        showCmdOutput(`✓ Room changed: ${roomName}`);
        console.log('[room] Switched to:', roomName);
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
      window.open(`${location.pathname}?view=speaker&config=${configUrl}`, '_blank');
    }, category: 'view' });

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

    // Content proxy: watch for proxy info published by presenter
    // Skip if this client is the uploader (presenter already has content loaded)
    if (sync) {
      let proxyLoaded = false;
      const checkContentProxy = () => {
        if (proxyLoaded || isContentUploader) return;
        const proxyRaw = sync.doc.getMap('sessionState').get('contentProxy');
        if (typeof proxyRaw !== 'string') return;

        try {
          const proxy = JSON.parse(proxyRaw);
          if (proxy.baseUrl) {
            proxyLoaded = true;
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

    terminal.setCommandSystem(commands);

    const keys = new KeyBindings(commands);
    keys.onTerminalToggle(() => terminal.toggle());
    keys.activate();

    const touch = new TouchInput(commands, slideshow);
    touch.activate();

    // Toolbar button clicks → execute command
    slideshow.addEventListener('geek:toolbar:command', (e) => {
      commands.execute(e.detail.command);
    });

    terminal.addEventListener('geek:terminal:close', () => keys.closeTerminal());

    if (import.meta.hot) {
      registerHotClient(import.meta.hot, {
        fetchMarkdown: async () => {
          const md = await fetchMarkdown(config);
          return await applyPreprocessors(md, config);
        },
        fetchStyles: async () => fetchStyles(config),
        fetchConfig,
        reloadSlides: async (md) => {
          const newSlides = parse(md);
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
      });
    }
    } // end !isReadonly
  }
} catch (err) {
  const configLink = `<a href="${configUrl}" target="_blank" style="color: #c00;">${configUrl}</a>`;
  const message = (err.stack || String(err)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  document.body.innerHTML =
    `<div style="padding: 2rem; font-family: system-ui, sans-serif;">` +
    `<h2 style="color: #c00; margin: 0 0 1rem;">Failed to load presentation</h2>` +
    `<pre style="color: #c00; white-space: pre-wrap; margin: 0 0 1.5rem;">${message}</pre>` +
    `<p>Config URL: ${configLink}</p>` +
    `</div>`;
}
