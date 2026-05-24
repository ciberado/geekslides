/**
 * GeekSlides v2 — Plugin Registry client.
 *
 * A registry is an HTTPS-accessible directory serving an `index.json` manifest
 * listing available plugin bundles. The client fetches and caches manifests,
 * resolving plugin entries to their remote bundle URLs.
 *
 * Registry manifest format (`index.json`):
 * ```json
 * {
 *   "name": "My Plugin Registry",
 *   "version": 1,
 *   "plugins": [
 *     { "name": "emoji", "version": "1.0.0", "description": "...", "entry": "emoji/plugin.json" }
 *   ]
 * }
 * ```
 */

import { createLogger } from '../logging.ts';

const log = createLogger('plugin-registry');

/**
 * A single plugin entry in a registry manifest.
 */
export interface RegistryPluginEntry {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** Relative path to the plugin's plugin.json manifest (relative to registry base URL). */
  readonly entry: string;
}

/**
 * The registry manifest shape (index.json).
 */
export interface RegistryManifest {
  readonly name: string;
  readonly version: number;
  readonly plugins: readonly RegistryPluginEntry[];
}

/**
 * A resolved plugin reference with its full URLs pinned for deterministic loading.
 */
export interface ResolvedRegistryPlugin {
  readonly registryUrl: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** Absolute URL to the plugin's plugin.json manifest. */
  readonly manifestUrl: string;
}

/**
 * Normalise a GitHub directory URL to its raw content equivalent.
 *
 * Handles:
 * - `https://github.com/user/repo/tree/branch/path`  → raw.githubusercontent.com
 * - `https://github.com/user/repo/blob/branch/path`  → raw.githubusercontent.com
 * - `https://github.com/user/repo` (root)            → raw.githubusercontent.com default branch
 *
 * Non-GitHub URLs pass through unchanged.
 */
export function normalizeGitHubUrl(url: string): string {
  const githubTreeOrBlob = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/(.+?)\/?\s*$/;
  const match = githubTreeOrBlob.exec(url);
  if (match) {
    const owner = match[1] ?? '';
    const repo = match[2] ?? '';
    const branch = match[4] ?? '';
    const path = match[5] ?? '';
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  // Root repo URL: https://github.com/user/repo or https://github.com/user/repo/
  const githubRoot = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;
  const rootMatch = githubRoot.exec(url);
  if (rootMatch) {
    const owner = rootMatch[1] ?? '';
    const repo = rootMatch[2] ?? '';
    return `https://raw.githubusercontent.com/${owner}/${repo}/main`;
  }

  return url;
}

/**
 * Fetches and caches plugin registry manifests.
 */
export class PluginRegistryClient {
  readonly #cache = new Map<string, RegistryManifest>();
  readonly #proxyBaseUrl: string;

  constructor(proxyBaseUrl: string = '/api/plugin-proxy') {
    this.#proxyBaseUrl = proxyBaseUrl;
  }

  /**
   * Fetch a registry manifest from the given URL.
   * Results are cached by URL. GitHub directory URLs are automatically
   * normalized to raw.githubusercontent.com equivalents.
   */
  async fetch(registryUrl: string): Promise<RegistryManifest> {
    const cached = this.#cache.get(registryUrl);
    if (cached) return cached;

    const normalized = normalizeGitHubUrl(registryUrl);

    const indexUrl = normalized.endsWith('/index.json')
      ? normalized
      : `${normalized.replace(/\/$/, '')}/index.json`;

    const proxyUrl = `${this.#proxyBaseUrl}?url=${encodeURIComponent(indexUrl)}`;
    log.info({ registryUrl, normalized: indexUrl, proxyUrl }, 'fetching registry manifest');

    const response = await globalThis.fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch registry "${registryUrl}": HTTP ${String(response.status)}`,
      );
    }

    const data = await response.json() as Record<string, unknown>;
    const manifest = this.#validateManifest(data, registryUrl);
    this.#cache.set(registryUrl, manifest);
    return manifest;
  }

  /**
   * Resolve all plugins in a registry to their absolute manifest URLs.
   * GitHub directory URLs are normalized before resolving.
   */
  async resolvePlugins(registryUrl: string): Promise<ResolvedRegistryPlugin[]> {
    const manifest = await this.fetch(registryUrl);
    const normalized = normalizeGitHubUrl(registryUrl);
    const baseUrl = normalized.endsWith('/index.json')
      ? normalized.replace(/\/index\.json$/, '/')
      : `${normalized.replace(/\/$/, '')}/`;

    return manifest.plugins.map((entry) => ({
      registryUrl,
      name: entry.name,
      version: entry.version,
      description: entry.description,
      manifestUrl: new URL(entry.entry, baseUrl).href,
    }));
  }

  /**
   * Invalidate the cache for a specific registry (or all if no URL given).
   */
  invalidate(registryUrl?: string): void {
    if (registryUrl) {
      this.#cache.delete(registryUrl);
    } else {
      this.#cache.clear();
    }
  }

  #validateManifest(data: Record<string, unknown>, url: string): RegistryManifest {
    if (typeof data['name'] !== 'string') {
      throw new Error(`Registry "${url}" missing required "name" field`);
    }
    if (!Array.isArray(data['plugins'])) {
      throw new Error(`Registry "${url}" missing required "plugins" array`);
    }

    const plugins: RegistryPluginEntry[] = [];
    for (const entry of data['plugins'] as unknown[]) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e['name'] !== 'string' || typeof e['entry'] !== 'string') continue;
      plugins.push({
        name: e['name'],
        version: typeof e['version'] === 'string' ? e['version'] : '0.0.0',
        description: typeof e['description'] === 'string' ? e['description'] : '',
        entry: e['entry'],
      });
    }

    return {
      name: data['name'],
      version: typeof data['version'] === 'number' ? data['version'] : 1,
      plugins,
    };
  }
}
