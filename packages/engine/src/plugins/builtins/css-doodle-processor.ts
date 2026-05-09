/**
 * GeekSlides v2 — CSS Doodle processor.
 *
 * Finds `.gs-doodle` placeholder divs created by the preprocessor and replaces
 * them with actual `<css-doodle>` custom elements, injecting pattern CSS with
 * theme-aware colors and applying positioning modes.
 */

import type { Processor } from '../types.ts';
import type { ParsedDoodleConfig, DoodlePatternConfig } from './css-doodle-patterns/types.ts';
import { patternRegistry } from './css-doodle-patterns/index.ts';
import { createLogger } from '../../logging.ts';

const log = createLogger('css-doodle');

/**
 * Lazy-load the css-doodle library only when needed.
 */
let cssDoodleReady: Promise<void> | null = null;

function loadCssDoodle(): Promise<void> {
  if (!cssDoodleReady) {
    // @ts-expect-error — css-doodle has no TypeScript definitions
    cssDoodleReady = import('css-doodle').then(() => {
      log.info('css-doodle library loaded');
    });
  }
  return cssDoodleReady;
}

/**
 * Parse config string like "pattern-name,grid=12,opacity=0.3,colors=pink|teal"
 */
export function parseConfig(raw: string): ParsedDoodleConfig {
  const parts = raw.split(',').map((s) => s.trim());
  const patternName = parts[0] ?? 'triangles';
  
  const config: ParsedDoodleConfig = { patternName };
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) {
      // Boolean flag (e.g., "bg", "cover", "animate")
      const key = part;
      if (key === 'bg') config.bg = true;
      else if (key === 'cover') config.cover = true;
      else if (key === 'animate') config.animate = true;
      else if (key === 'nohole') config.nohole = true;
    } else {
      const key = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      
      if (key === 'colors') {
        config.colors = value.split('|').map((c) => c.trim());
      } else if (key === 'speed') {
        config.speed = parseFloat(value) || 1;
      } else if (key === 'grid') {
        config.grid = value;
      } else if (key === 'size') {
        config.size = value;
      } else if (key === 'shape') {
        const shape = parseFloat(value);
        if (!Number.isNaN(shape)) {
          config.shape = Math.max(25, Math.min(300, shape));
        }
      } else if (key === 'opacity') {
        config.opacity = value;
      } else if (key === 'seed') {
        config.seed = value;
      }
    }
  }
  
  return config;
}

/**
 * Build the --doodle-c* CSS variable block.
 *
 * For theme colors we reference the slide's own CSS custom properties so the
 * palette always matches the active theme without any JavaScript colour reading.
 * For user-supplied colours we use the provided hex values directly.
 *
 * When nohole=true, all 5 slots become clearly visible accent-derived shades —
 * no near-white surface color, so shapes never disappear against a light background.
 */
export function buildColorVars(customColors: readonly string[] | undefined, nohole: boolean): string {
  if (customColors && customColors.length > 0) {
    const pad = (i: number) => customColors[i] ?? customColors[customColors.length - 1] ?? 'transparent';
    return `
      --doodle-c1: ${pad(0)};
      --doodle-c2: ${pad(1)};
      --doodle-c3: ${pad(2)};
      --doodle-c4: ${pad(3)};
      --doodle-c5: ${pad(4)};
    `;
  }
  if (nohole) {
    // All 5 slots are accent + black mixes only — zero white/surface involvement.
    // Produces a high-contrast monochromatic range: accent → progressively darker.
    return `
      --doodle-c1: var(--gs-color-accent, #3b55a0);
      --doodle-c2: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 85%, black);
      --doodle-c3: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 65%, black);
      --doodle-c4: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 45%, black);
      --doodle-c5: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 25%, black);
    `;
  }
  // Default palette: accent → lighter → lightest → darker → surface
  return `
    --doodle-c1: var(--gs-color-accent, #3b55a0);
    --doodle-c2: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 65%, var(--gs-color-surface, white));
    --doodle-c3: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 35%, var(--gs-color-surface, white));
    --doodle-c4: color-mix(in oklch, var(--gs-color-accent, #3b55a0) 85%, black);
    --doodle-c5: var(--gs-color-surface, white);
  `;
}

/**
 * Determine positioning mode based on context and config.
 */
function determinePositioning(
  placeholder: HTMLElement,
  config: ParsedDoodleConfig
): 'background' | 'inline' | 'cover' {
  if (config.cover) return 'cover';
  if (config.bg) return 'background';
  
  // Auto-detect: if placeholder is the only child, treat as background
  const parent = placeholder.parentElement;
  if (parent && parent.children.length === 1) {
    return 'background';
  }
  
  return 'inline';
}

/**
 * Apply initial positioning styles before the element is in the DOM.
 * For inline mode we use CSS aspect-ratio:1 so the element is always square.
 * css-doodle has its own internal ResizeObserver and re-renders automatically
 * when the element's bounding rect changes — no manual re-render needed.
 */
function applyPositioning(
  doodle: HTMLElement,
  config: ParsedDoodleConfig,
  mode: 'background' | 'inline' | 'cover',
  slideElement: HTMLElement,
): void {
  if (mode === 'background' || mode === 'cover') {
    // Square sized to the larger slide dimension so it covers the full 16:9 area.
    // section.content has overflow:hidden — the excess is clipped cleanly.
    const sz = Math.max(slideElement.clientWidth, slideElement.clientHeight);
    doodle.style.position = 'absolute';
    doodle.style.top = '50%';
    doodle.style.left = '50%';
    doodle.style.transform = 'translate(-50%, -50%)';
    doodle.style.width = sz > 0 ? `${String(sz)}px` : '100%';
    doodle.style.height = sz > 0 ? `${String(sz)}px` : '100%';
    doodle.style.zIndex = '-1';
  } else {
    if (config.size && config.size !== '100%') {
      doodle.style.width = config.size;
      doodle.style.height = config.size;
    } else {
      // Fill column width. aspect-ratio:1 makes the height equal the width so
      // css-doodle renders square cells. css-doodle's own ResizeObserver
      // triggers a re-render once the element has real dimensions — no extra
      // JS measurement needed.
      doodle.style.width = '100%';
      doodle.style.aspectRatio = '1';
    }
    doodle.style.display = 'block';
  }

  if (config.opacity) {
    doodle.style.opacity = config.opacity;
  }
}

/**
 * Scale grid density while keeping doodle area fixed.
 * shape=100 keeps original grid; >100 makes larger cells; <100 makes smaller cells.
 */
function applyShapeScaleToGrid(grid: string, shape: number): string {
  const scaleGridPart = (part: string): number | null => {
    const n = parseInt(part, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    // Bigger shape -> fewer cells. Smaller shape -> more cells.
    const scaled = Math.round((n * 100) / shape);
    return Math.max(1, Math.min(200, scaled));
  };

  const lower = grid.toLowerCase();
  if (lower.includes('x')) {
    const [colsRaw, rowsRaw] = lower.split('x');
    if (!colsRaw || !rowsRaw) return grid;
    const cols = scaleGridPart(colsRaw);
    const rows = scaleGridPart(rowsRaw);
    if (cols === null || rows === null) return grid;
    return `${String(cols)}x${String(rows)}`;
  }

  const single = scaleGridPart(grid);
  return single === null ? grid : String(single);
}

/**
 * Queue of doodle render tasks. Each entry is a function that creates and
 * inserts doodle elements for one slide. Processing is staggered across
 * animation frames so the main thread stays responsive during initial load.
 */
const renderQueue: Array<() => void> = [];
let renderScheduled = false;

function drainRenderQueue(): void {
  if (renderQueue.length === 0) {
    renderScheduled = false;
    return;
  }
  const task = renderQueue.shift();
  if (task) task();
  requestAnimationFrame(drainRenderQueue);
}

function enqueueRender(task: () => void): void {
  renderQueue.push(task);
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(drainRenderQueue);
  }
}

/**
 * CSS Doodle processor.
 */
export const cssDoodleProcessor: Processor = (slideElement: HTMLElement): void => {
  const placeholders = slideElement.querySelectorAll<HTMLElement>('.gs-doodle');
  if (placeholders.length === 0) return;

  // Check if this slide is currently active — active slides render immediately
  const slideHost = slideElement.getRootNode() instanceof ShadowRoot
    ? (slideElement.getRootNode() as ShadowRoot).host
    : null;
  const isActive = slideHost?.hasAttribute('active') ?? false;

  void loadCssDoodle().then(() => {
    const renderSlide = (): void => {
      for (const placeholder of placeholders) {
        renderPlaceholder(placeholder, slideElement, isActive);
      }
    };

    if (isActive) {
      renderSlide();
    } else {
      enqueueRender(renderSlide);
    }
  }).catch((err: unknown) => {
    log.error({ err }, 'Failed to load css-doodle library');
  });
};

function renderPlaceholder(
  placeholder: HTMLElement,
  slideElement: HTMLElement,
  isActive: boolean,
): void {
  const raw = decodeURIComponent(placeholder.dataset.doodle ?? '');
  const config = parseConfig(raw);

  const pattern = patternRegistry.get(config.patternName);
  if (!pattern) {
    log.warn({ patternName: config.patternName }, 'Pattern not found');
    return;
  }

  // Build pattern config — patterns reference --doodle-c1..c5 via var()
  // so we always supply 5 placeholder strings; the actual CSS values come
  // from buildColorVars() below.
  const THEME_COLOR_COUNT = 5;
  const colorRefs = Array.from({ length: THEME_COLOR_COUNT }, (_, i) => `var(--doodle-c${String(i + 1)})`);
  const baseGrid = config.grid ?? pattern.defaultGrid;
  const patternConfig: DoodlePatternConfig = {
    grid: applyShapeScaleToGrid(baseGrid, config.shape ?? 100),
    colors: colorRefs,
    animate: config.animate ?? false,
    speed: config.speed ?? 1,
  };
  if (config.seed) {
    patternConfig.seed = config.seed;
  }

  // Generate CSS content
  const cssContent = pattern.generate(patternConfig);

  // Create <css-doodle> element
  const doodle = document.createElement('css-doodle');
  if (patternConfig.seed) {
    doodle.setAttribute('seed', patternConfig.seed);
  }

  // Store config metadata as data attributes for discoverability by
  // custom components (e.g. <doodle-controls>).
  doodle.dataset.pattern = config.patternName;
  doodle.dataset.grid = baseGrid;
  if (config.shape !== undefined && config.shape !== 100) doodle.dataset.shape = String(config.shape);
  if (config.animate) doodle.dataset.animate = '';
  if (config.speed !== undefined) doodle.dataset.speed = String(config.speed);
  if (config.opacity) doodle.dataset.opacity = config.opacity;
  if (config.size) doodle.dataset.size = config.size;
  if (config.nohole) doodle.dataset.nohole = '';
  if (config.colors) doodle.dataset.colors = config.colors.join('|');
  if (config.seed) doodle.dataset.seed = config.seed;

  // Inject color variables and CSS content.
  // buildColorVars uses pure CSS var() references so theme changes are live.
  const styleWithVars = `
    :host {
      ${buildColorVars(config.colors, config.nohole ?? false)}
    }
    ${cssContent}
  `;
  doodle.textContent = styleWithVars;

  // Apply positioning
  const mode = determinePositioning(placeholder, config);
  applyPositioning(doodle, config, mode, slideElement);

  // Replace placeholder with doodle
  placeholder.replaceWith(doodle);

  // If the containing slide is not currently active, pause animations
  // immediately so we don't burn CPU on off-screen slides.
  if (!isActive) {
    requestAnimationFrame(() => {
      const sr = doodle.shadowRoot;
      if (sr && !sr.querySelector('.gs-animations-paused')) {
        const style = document.createElement('style');
        style.className = 'gs-animations-paused';
        style.textContent = '* { animation-play-state: paused !important; }';
        sr.appendChild(style);
      }
    });
  }
}
