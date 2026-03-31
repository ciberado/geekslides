/**
 * GeekSlides v2 — Typed configuration.
 */

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
  readonly content: string;
  readonly styles: readonly string[];
  readonly plugins: PluginsConfig;
  readonly aspectRatio: string;
  readonly sync: SyncConfig;
  readonly background: string;
  readonly class: string;
}

const DEFAULT_CONFIG: GeekSlidesConfig = {
  title: 'Untitled Presentation',
  content: 'README.md',
  styles: [],
  plugins: {
    preprocessors: ['header'],
    processors: ['iframe'],
  },
  aspectRatio: '16/9',
  sync: {
    enabled: false,
    server: 'ws://localhost:1234',
    room: 'default',
  },
  background: '',
  class: '',
};

export async function loadConfig(url: string): Promise<GeekSlidesConfig> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load config from ${url}: ${String(response.status)} ${response.statusText}`);
  }

  const raw: unknown = await response.json();

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Config must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  // v1 compat: content can be an array of filenames — join into first entry
  let contentValue: string;
  if (typeof obj['content'] === 'string' && obj['content'].length > 0) {
    contentValue = obj['content'];
  } else if (Array.isArray(obj['content']) && obj['content'].length > 0) {
    contentValue = String(obj['content'][0]);
  } else {
    throw new Error("Config must include a non-empty 'content' field");
  }

  // v1 compat: resolution "1920x1080" → aspectRatio "16/9"
  let aspectRatio = DEFAULT_CONFIG.aspectRatio;
  if (typeof obj['aspectRatio'] === 'string') {
    aspectRatio = obj['aspectRatio'];
  } else if (typeof obj['resolution'] === 'string') {
    const parts = obj['resolution'].split('x');
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (w > 0 && h > 0) {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const d = gcd(w, h);
      aspectRatio = `${String(w / d)}/${String(h / d)}`;
    }
  }

  const rawSync = typeof obj['sync'] === 'object' && obj['sync'] !== null
    ? obj['sync'] as Record<string, unknown>
    : {};

  // v1 compat: preprocessors/processors at root level → plugins.preprocessors/processors
  const rawPlugins = typeof obj['plugins'] === 'object' && obj['plugins'] !== null
    ? obj['plugins'] as Record<string, unknown>
    : {};

  const preprocessors = Array.isArray(rawPlugins['preprocessors'])
    ? (rawPlugins['preprocessors'] as string[])
    : Array.isArray(obj['preprocessors'])
      ? (obj['preprocessors'] as string[])
      : [...DEFAULT_CONFIG.plugins.preprocessors];

  const processors = Array.isArray(rawPlugins['processors'])
    ? (rawPlugins['processors'] as string[])
    : Array.isArray(obj['processors'])
      ? (obj['processors'] as string[])
      : [...DEFAULT_CONFIG.plugins.processors];

  return {
    title: typeof obj['title'] === 'string' ? obj['title'] : DEFAULT_CONFIG.title,
    content: contentValue,
    styles: Array.isArray(obj['styles']) ? (obj['styles'] as string[]) : [...DEFAULT_CONFIG.styles],
    plugins: {
      preprocessors,
      processors,
    },
    aspectRatio,
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
