/**
 * GeekSlides v2 — Feature loader utilities.
 *
 * Resolves feature names to Feature objects using the same three-source
 * pattern as plugins: built-in names, local paths, remote URLs.
 */

import type { Feature } from './types.ts';
import { isLocalPluginPath, isRemotePluginUrl, importRemotePlugin } from '../plugins/local-plugin.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('feature-loader');

/** Registry of built-in feature names → lazy loaders. */
const BUILTIN_FEATURES: Record<string, () => Promise<Feature>> = {
  whiteboard: async () => {
    const mod = await import('./builtins/whiteboard-feature.ts');
    return mod.whiteboardFeature;
  },
  poll: async () => {
    const mod = await import('./builtins/poll-feature.ts');
    return mod.pollFeature;
  },
};

/**
 * Validate that a dynamically imported module exports a Feature-shaped object.
 */
function extractFeature(mod: Record<string, unknown>, source: string): Feature {
  const candidate = mod['default'] as Record<string, unknown> | undefined;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`Feature module ${source} must have a default export`);
  }
  if (typeof candidate['id'] !== 'string' || candidate['id'].length === 0) {
    throw new Error(`Feature module ${source} must export an object with a non-empty 'id' string`);
  }
  if (typeof candidate['label'] !== 'string') {
    throw new Error(`Feature module ${source} must export an object with a 'label' string`);
  }
  if (typeof candidate['activate'] !== 'function') {
    throw new Error(`Feature module ${source} must export an object with an 'activate' function`);
  }
  return candidate as unknown as Feature;
}

/**
 * Resolve a feature name to a Feature object.
 *
 * @param name - Built-in name, relative path (`./`), or HTTPS URL
 * @param resolveUrl - Resolves relative paths against the deck config base
 */
export async function loadFeature(
  name: string,
  resolveUrl: (path: string) => string,
): Promise<Feature> {
  if (isRemotePluginUrl(name)) {
    log.info({ name }, 'loading remote feature');
    const mod = await importRemotePlugin(name);
    return extractFeature(mod, name);
  }

  if (isLocalPluginPath(name)) {
    log.info({ name }, 'loading local feature');
    const url = resolveUrl(name);
    const mod = await import(/* @vite-ignore */ url) as Record<string, unknown>;
    return extractFeature(mod, name);
  }

  // Built-in feature
  const loader = BUILTIN_FEATURES[name];
  if (!loader) {
    throw new Error(`Unknown built-in feature: '${name}'. Available: ${Object.keys(BUILTIN_FEATURES).join(', ')}`);
  }

  log.info({ name }, 'loading built-in feature');
  return await loader();
}
