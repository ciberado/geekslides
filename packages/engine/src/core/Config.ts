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

  const contentValue = obj['content'];
  if (typeof contentValue !== 'string' || contentValue.length === 0) {
    throw new Error("Config must include a non-empty 'content' field");
  }

  const rawSync = typeof obj['sync'] === 'object' && obj['sync'] !== null
    ? obj['sync'] as Record<string, unknown>
    : {};

  const rawPlugins = typeof obj['plugins'] === 'object' && obj['plugins'] !== null
    ? obj['plugins'] as Record<string, unknown>
    : {};

  return {
    title: typeof obj['title'] === 'string' ? obj['title'] : DEFAULT_CONFIG.title,
    content: contentValue,
    styles: Array.isArray(obj['styles']) ? (obj['styles'] as string[]) : [...DEFAULT_CONFIG.styles],
    plugins: {
      preprocessors: Array.isArray(rawPlugins['preprocessors'])
        ? (rawPlugins['preprocessors'] as string[])
        : [...DEFAULT_CONFIG.plugins.preprocessors],
      processors: Array.isArray(rawPlugins['processors'])
        ? (rawPlugins['processors'] as string[])
        : [...DEFAULT_CONFIG.plugins.processors],
    },
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
