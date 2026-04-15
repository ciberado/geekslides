import {
  loadConfig,
  parse,
  headerPreprocessor,
  CommandSystem,
  KeyBindings,
  TouchInput,
  SyncManager,
  iframeProcessor,
  chartProcessor,
  videoProcessor,
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

let configUrl = normalizeConfigUrl(params.get('config') || 'decks/slides-cuatro-cosas-aws/config.json');
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

function applyPreprocessors(markdown, config) {
  const ppNames = config.plugins.preprocessors;
  let result = markdown;
  for (const name of ppNames) {
    const pp = PREPROCESSORS[name];
    if (pp) {
      result = pp(result);
    }
  }
  return result;
}

function getActiveProcessors(config) {
  const processorNames = config.plugins.processors;
  return processorNames.map((name) => PROCESSORS[name]).filter(Boolean);
}

function applyProcessors(slideshow, config) {
  const activeProcessors = getActiveProcessors(config);
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

  const processedMarkdown = applyPreprocessors(markdown, config);
  const slides = parse(processedMarkdown);

  if (viewMode === 'speaker') {
    document.body.innerHTML = '<geek-speaker-view id="speaker"></geek-speaker-view>';
    const speaker = document.getElementById('speaker');
    const activeProcessors = getActiveProcessors(config);
    speaker.setAspectRatio(config.aspectRatio);
    if (combinedCss) {
      speaker.loadStyles(combinedCss);
    }
    speaker.loadSlides(slides);
    if (activeProcessors.length > 0) {
      speaker.loadProcessors(activeProcessors, config);
    }

    const syncConfig = config.sync || {};
    const wsUrl = syncConfig.server || `ws://${location.hostname}:1234`;
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
    applyProcessors(slideshow, config);
    slideshow.setAspectRatio(config.aspectRatio);

    const syncConfig = config.sync || {};
    const syncEnabled = syncConfig.enabled !== false;
    let sync = null;

    if (syncEnabled) {
      try {
        sync = new SyncManager();
        const wsUrl = syncConfig.server || `ws://${location.hostname}:1234`;
        const room = params.get('room') || syncConfig.room || 'default';
        sync.bind(slideshow);
        sync.connect(wsUrl, room);

        slideshow.addEventListener('geek:navigate', (e) => {
          sync.publishState(e.detail.slide, e.detail.partial, e.detail.mode);
        });

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

        const processedMd = applyPreprocessors(newMarkdown, newConfig);
        const newSlides = parse(processedMd);
        slideshow.loadSlides(newSlides);
        config = newConfig;
        applyProcessors(slideshow, newConfig);
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
        const wsUrl = config.sync?.server || `ws://${location.hostname}:1234`;
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
    commands.register({ name: 'whiteboard', label: 'Toggle whiteboard', execute: () => {
      let whiteboard = document.querySelector('geek-whiteboard');
      if (!whiteboard) {
        whiteboard = document.createElement('geek-whiteboard');
        slideshow.shadowRoot?.querySelector('.gs-container')?.appendChild(whiteboard);
      }
      whiteboard.toggle();
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
          return applyPreprocessors(md, config);
        },
        fetchStyles: async () => fetchStyles(config),
        fetchConfig,
        reloadSlides: (md) => {
          const newSlides = parse(md);
          slideshow.loadStyles(combinedCss);
          slideshow.loadSlides(newSlides);
          applyProcessors(slideshow, config);
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
  document.body.innerHTML = `<pre style="padding: 2rem; color: #c00;">${err.stack || err}</pre>`;
}
