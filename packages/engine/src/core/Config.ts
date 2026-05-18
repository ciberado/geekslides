/**
 * GeekSlides v2 — Typed configuration.
 */

import { createLogger } from '../logging.ts';

const log = createLogger('config');

export interface SyncConfig {
  readonly enabled: boolean;
  readonly server: string;
  readonly room: string;
}

export interface PluginsConfig {
  readonly preprocessors: readonly string[];
  readonly processors: readonly string[];
}

export interface GeekSlidesConfig {
  readonly title: string;
  readonly content: readonly string[];
  readonly styles: readonly string[];
  readonly scripts: readonly string[];
  readonly plugins: PluginsConfig;
  readonly features: readonly string[];
  readonly aspectRatio: string;
  readonly sync: SyncConfig;
  readonly background: string;
  readonly class: string;
}

const DEFAULT_CONFIG: GeekSlidesConfig = {
  title: 'Untitled Presentation',
  content: ['README.md'],
  styles: [],
  scripts: [],
  plugins: {
    preprocessors: ['header'],
    processors: ['iframe'],
  },
  features: ['whiteboard', 'media-sync'],
  aspectRatio: '16/9',
  sync: {
    enabled: true,
    server: '',
    room: 'default',
  },
  background: '',
  class: '',
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Coerce legacy/alternative config shapes into the canonical form in-place.
 * All transformations are logged as warnings so authors know to update their config.
 */
function normalizeLegacyConfig(obj: Record<string, unknown>): void {
  // content: string → [string]  (arrays are now valid and used as-is)
  if (typeof obj['content'] === 'string') {
    obj['content'] = [obj['content']];
  }

  // styles: string → string[]
  if (typeof obj['styles'] === 'string') {
    obj['styles'] = [obj['styles']];
  }

  // resolution: "WxH" → aspectRatio: "W_r/H_r"
  if (typeof obj['resolution'] === 'string') {
    const m = /^(\d+)[xX](\d+)$/.exec(obj['resolution']);
    if (m) {
      const widthText = m[1];
      const heightText = m[2];
      if (widthText !== undefined && heightText !== undefined) {
        const w = parseInt(widthText, 10);
        const h = parseInt(heightText, 10);
        const d = gcd(w, h);
        const aspectRatio = `${String(w / d)}/${String(h / d)}`;
        obj['aspectRatio'] = aspectRatio;
        log.warn(`Legacy config: resolution "${obj['resolution']}" converted to aspectRatio "${aspectRatio}"`);
      }
    }
    delete obj['resolution'];
  }

  // Root-level preprocessors / processors → plugins.*
  if ('preprocessors' in obj || 'processors' in obj) {
    const plugins =
      typeof obj['plugins'] === 'object' && obj['plugins'] !== null
        ? (obj['plugins'] as Record<string, unknown>)
        : {};
    if ('preprocessors' in obj && !Array.isArray(plugins['preprocessors'])) {
      plugins['preprocessors'] = obj['preprocessors'];
    }
    if ('processors' in obj && !Array.isArray(plugins['processors'])) {
      plugins['processors'] = obj['processors'];
    }
    obj['plugins'] = plugins;
    delete obj['preprocessors'];
    delete obj['processors'];
    log.warn('Legacy config: root-level preprocessors/processors moved into plugins.*');
  }

  // slideWhiteBoards: false → exclude whiteboard from default features
  if (typeof obj['slideWhiteBoards'] === 'boolean') {
    if (!obj['slideWhiteBoards'] && !Array.isArray(obj['features'])) {
      obj['features'] = DEFAULT_CONFIG.features.filter((f) => f !== 'whiteboard');
    }
    delete obj['slideWhiteBoards'];
  }

  // Silently drop fields that were dev-server or runtime options in v1
  delete obj['liveReload'];

  // Normalize scripts: string → string[]
  if (typeof obj['scripts'] === 'string') {
    obj['scripts'] = [obj['scripts']];
  }
}

export async function loadConfig(url: string): Promise<GeekSlidesConfig> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Network error loading config from ${url}: ${cause}\n\n` +
      'Check that the dev server is running and the config path is correct.',
      { cause: err },
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to load config from ${url}: HTTP ${String(response.status)} ${response.statusText}\n\n` +
      (response.status === 404
        ? 'The config file was not found. Run `geekslides create` to scaffold a new deck, or check that config.json exists in the deck directory.'
        : 'Check that the server is running and the config path is correct.'),
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (contentType.includes('text/html') || text.trimStart().startsWith('<!')) {
    throw new Error(
      `Expected JSON but received HTML from ${url}\n\n` +
      'This usually means the server could not find the config file and returned\n' +
      'the fallback page instead. Check that the file exists and the path is correct.',
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    // SyntaxError.message typically includes line/column info, e.g.
    // "Unexpected token } in JSON at position 42" — preserve it.
    const parseDetail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Config is not valid JSON (${url}): ${parseDetail}\n\nFirst 200 chars of received content:\n${text.slice(0, 200)}`,
      { cause: err },
    );
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Config must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;
  normalizeLegacyConfig(obj);
  log.debug({ url }, 'config loaded');

  const rawContent = obj['content'];
  if (
    !Array.isArray(rawContent) ||
    rawContent.length === 0 ||
    rawContent.some((c) => typeof c !== 'string' || c.length === 0)
  ) {
    throw new Error("Config 'content' must be a non-empty string or array of non-empty strings");
  }

  const rawSync = typeof obj['sync'] === 'object' && obj['sync'] !== null
    ? obj['sync'] as Record<string, unknown>
    : {};

  const rawPlugins = typeof obj['plugins'] === 'object' && obj['plugins'] !== null
    ? obj['plugins'] as Record<string, unknown>
    : {};

  const preprocessors = Array.isArray(rawPlugins['preprocessors'])
    ? (rawPlugins['preprocessors'] as string[])
    : [...DEFAULT_CONFIG.plugins.preprocessors];

  const processors = Array.isArray(rawPlugins['processors'])
    ? (rawPlugins['processors'] as string[])
    : [...DEFAULT_CONFIG.plugins.processors];

  return {
    title: typeof obj['title'] === 'string' ? obj['title'] : DEFAULT_CONFIG.title,
    content: rawContent as string[],
    styles: Array.isArray(obj['styles']) ? (obj['styles'] as string[]) : [...DEFAULT_CONFIG.styles],
    scripts: Array.isArray(obj['scripts']) ? (obj['scripts'] as string[]) : [...DEFAULT_CONFIG.scripts],
    plugins: {
      preprocessors,
      processors,
    },
    features: Array.isArray(obj['features']) ? (obj['features'] as string[]) : [...DEFAULT_CONFIG.features],
    aspectRatio: typeof obj['aspectRatio'] === 'string' ? obj['aspectRatio'] : DEFAULT_CONFIG.aspectRatio,
    sync: {
      enabled: typeof rawSync['enabled'] === 'boolean' ? rawSync['enabled'] : DEFAULT_CONFIG.sync.enabled,
      server: typeof rawSync['server'] === 'string' ? rawSync['server'] : DEFAULT_CONFIG.sync.server,
      room: typeof rawSync['room'] === 'string' ? rawSync['room'] : DEFAULT_CONFIG.sync.room,
    },
    background: typeof obj['background'] === 'string' ? obj['background'] : DEFAULT_CONFIG.background,
    class: typeof obj['class'] === 'string' ? obj['class'] : DEFAULT_CONFIG.class,
  };
}

export { DEFAULT_CONFIG };
