import {
  loadConfig,
  parse,
  headerPreprocessor,
  CommandSystem,
  KeyBindings,
  TouchInput,
  SyncManager,
  WhiteboardSync,
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

const PREPROCESSORS = {
  header: headerPreprocessor,
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
    document.body.innerHTML = '<geek-slideshow id="slideshow"></geek-slideshow><geek-terminal></geek-terminal>';
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
        sync = new SyncManager();
        const wsUrl = syncConfig.server || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        const room = params.get('room') || syncConfig.room || 'default';
        sync.bind(slideshow);
        sync.connect(wsUrl, room);

        slideshow.addEventListener('geek:navigate', (e) => {
          sync.publishState(e.detail.slide, e.detail.partial, e.detail.mode);
        });

        // Content proxy: upload deck assets to server so remote viewers can access them
        // Fire-and-forget — don't block the rest of initialization
        void (async () => {
          try {
            const serverBaseUrl = `${location.protocol}//${location.host}`;
            const manifest = buildManifest(configUrl, config, markdown, combinedCss);
            await uploadDeck(serverBaseUrl, room, configBase, manifest);

            isContentUploader = true;
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

    const commands = new CommandSystem();
    const terminal = document.querySelector('geek-terminal');

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
    // --- Whiteboard setup ---
    const whiteboard = document.createElement('geek-whiteboard');
    slideshow.shadowRoot?.querySelector('.gs-container')?.appendChild(whiteboard);
    whiteboard.slideIndex = slideshow.currentSlide;

    // Update whiteboard slide index on navigation
    slideshow.addEventListener('geek:navigate', (e) => {
      whiteboard.slideIndex = e.detail.slide;
    });

    // Auto-activate whiteboard on pointer drag over the slideshow
    const gsContainer = slideshow.shadowRoot?.querySelector('.gs-container');
    if (gsContainer) {
      let pointerStartedOnSlide = false;
      gsContainer.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.composedPath().some((el) => el.tagName === 'GEEK-WHITEBOARD')) return;
        pointerStartedOnSlide = true;
        e.preventDefault(); // prevent text selection during drag
      });
      gsContainer.addEventListener('pointermove', (e) => {
        if (!pointerStartedOnSlide) return;
        if (e.buttons === 0) { pointerStartedOnSlide = false; return; }
        if (!whiteboard.isVisible) {
          whiteboard.setActive(true);
          whiteboard.beginStroke(e);
        }
      });
      gsContainer.addEventListener('pointerup', () => { pointerStartedOnSlide = false; });
    }

    // Activate WhiteboardSync to bridge local strokes to SyncManager
    if (sync) {
      const wbSync = new WhiteboardSync(sync);
      wbSync.activate();

      // Replay existing strokes from the Y.Array (late-joining clients)
      for (const stroke of sync.getStrokes()) {
        whiteboard.drawRemoteStroke(stroke);
      }

      // Content proxy: watch for proxy info published by presenter
      // Skip if this client is the uploader (presenter already has content loaded)
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

    commands.register({ name: 'whiteboard', label: 'Toggle whiteboard', execute: () => {
      whiteboard.toggle();
    }, category: 'built-in' });

    commands.register({ name: 'whiteboard-clear', label: 'Clear whiteboard on current slide', execute: () => {
      whiteboard.clear();
    }, category: 'built-in' });

    commands.register({ name: 'toggle-toolbar', label: 'Toggle toolbar', execute: () => {
      slideshow.toggleToolbar();
    }, category: 'built-in' });

    if (sync) {
      commands.register({ name: 'sync-follow', label: 'Toggle follow presenter', execute: () => {
        sync.toggleFollow();
      }, category: 'sync' });
      commands.register({ name: 'sync-disconnect', label: 'Disconnect from sync', execute: () => {
        sync.disconnect();
        showCmdOutput('✓ Sync disconnected');
        console.log('[sync] Disconnected');
      }, category: 'sync' });
    }

    terminal.setCommandSystem(commands);

    const keys = new KeyBindings(commands);
    keys.onTerminalOpen(() => terminal.open());
    keys.activate();

    const touch = new TouchInput(commands, slideshow);
    touch.activate();

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
