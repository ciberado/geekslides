/**
 * GeekSlides v2 — Dynamic Plugin Loader.
 *
 * Resolves plugin bundle names to their compiled modules, loads them, and
 * activates them with the PluginAPI. Supports:
 *
 * 1. Built-in short names (e.g. "media") → loads from /plugins/dist/{name}/index.js
 *    or directly from source in dev mode.
 * 2. Local paths (./my-plugin.js) → dynamic import from deck directory.
 * 3. Remote URLs ending in .json → treated as remote bundle manifests.
 * 4. Remote URLs ending in .js → single-file remote plugin.
 *
 * The loader uses the activate(api) pattern: each plugin module exports an
 * `activate` function that receives the PluginAPI and returns PluginExports.
 */

/**
 * @typedef {import('../../plugins/sdk/types.ts').PluginAPI} PluginAPI
 * @typedef {import('../../plugins/sdk/types.ts').PluginExports} PluginExports
 * @typedef {import('../../plugins/sdk/types.ts').PluginActivate} PluginActivate
 * @typedef {import('../../plugins/sdk/types.ts').Preprocessor} Preprocessor
 * @typedef {import('../../plugins/sdk/types.ts').Processor} Processor
 * @typedef {import('../../plugins/sdk/types.ts').Feature} Feature
 */

/**
 * Registry mapping member names (preprocessor/processor/feature IDs) to their
 * parent bundle. Used to know which bundle to load for a given short name.
 */
const MEMBER_TO_BUNDLE = {
  // core bundle
  'header': 'core',
  'source-notes': 'core',
  'iframe': 'core',
  // media bundle
  'youtube-url': 'media',
  'audio-url': 'media',
  'video-url': 'media',
  'iframe-url': 'media',
  'video': 'media',
  'media-sync': 'media',
  // whiteboard bundle
  'whiteboard': 'whiteboard',
  // chart bundle
  'chart': 'chart',
  // mermaid bundle
  'mermaid': 'mermaid',
  // css-doodle bundle
  'css-doodle': 'css-doodle',
  // poll bundle
  'poll': 'poll',
};

/**
 * Bundle dependency graph.
 */
const BUNDLE_DEPS = {
  'core': [],
  'media': ['core'],
  'whiteboard': [],
  'chart': [],
  'mermaid': [],
  'css-doodle': [],
  'poll': [],
};

/** Set of known bundle names. */
const KNOWN_BUNDLES = new Set(Object.keys(BUNDLE_DEPS));

/** Cache of loaded and activated bundle exports. */
const bundleCache = new Map();

/** The PluginAPI instance — set by initPluginLoader(). */
let pluginAPI = null;

/**
 * Initialize the plugin loader with the PluginAPI that will be injected
 * into all loaded bundles.
 */
export function initPluginLoader(api) {
  pluginAPI = api;
}

/**
 * Detect if a name is a remote URL.
 */
function isRemoteUrl(name) {
  return name.startsWith('https://') || name.startsWith('http://');
}

/**
 * Detect if a name is a local path.
 */
function isLocalPath(name) {
  return name.startsWith('./') || name.startsWith('../');
}

/**
 * Load a single bundle by name, resolving dependencies first.
 * Returns the activated PluginExports from the bundle.
 */
async function loadBundle(bundleName, resolveUrl) {
  if (bundleCache.has(bundleName)) {
    return bundleCache.get(bundleName);
  }

  // Load dependencies first
  const deps = BUNDLE_DEPS[bundleName] || [];
  for (const dep of deps) {
    await loadBundle(dep, resolveUrl);
  }

  let mod;
  if (import.meta.env?.DEV) {
    // Dev mode: import source directly (Vite compiles TS on the fly)
    mod = await import(/* @vite-ignore */ `/plugins/${bundleName}/index.ts`);
  } else {
    // Production: import compiled bundle
    mod = await import(/* @vite-ignore */ `/plugins/dist/${bundleName}/index.js`);
  }

  const exports = mod.activate(pluginAPI);
  bundleCache.set(bundleName, exports);
  return exports;
}

/**
 * Load a remote bundle manifest from a URL.
 * The manifest is a plugin.json file; the compiled bundle is loaded from
 * dist/index.js relative to the manifest URL.
 */
async function loadRemoteBundle(manifestUrl) {
  if (bundleCache.has(manifestUrl)) {
    return bundleCache.get(manifestUrl);
  }

  // Fetch the manifest
  const proxyUrl = `/api/plugin-proxy?url=${encodeURIComponent(manifestUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote plugin manifest: ${manifestUrl} (HTTP ${response.status})`);
  }
  const manifest = await response.json();

  // Load dependencies (may be other remote manifests or built-in names)
  if (manifest.dependsOn && Array.isArray(manifest.dependsOn)) {
    for (const dep of manifest.dependsOn) {
      if (isRemoteUrl(dep)) {
        await loadRemoteBundle(dep);
      } else if (KNOWN_BUNDLES.has(dep)) {
        await loadBundle(dep);
      }
    }
  }

  // Resolve the module URL relative to the manifest
  const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
  const moduleUrl = `${baseUrl}dist/index.js`;

  // Fetch and import the module via blob URL
  const moduleProxyUrl = `/api/plugin-proxy?url=${encodeURIComponent(moduleUrl)}`;
  const moduleResponse = await fetch(moduleProxyUrl);
  if (!moduleResponse.ok) {
    throw new Error(`Failed to fetch remote plugin module: ${moduleUrl} (HTTP ${moduleResponse.status})`);
  }
  const source = await moduleResponse.text();
  const blob = new Blob([source], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  let mod;
  try {
    mod = await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  const exports = mod.activate(pluginAPI);
  bundleCache.set(manifestUrl, exports);
  return exports;
}

/**
 * Expand bundle names in a plugins array, returning the resolved config.
 * Handles the three forms:
 * - Built-in bundle name ("media") → expand to preprocessors/processors/features
 * - Remote manifest URL ("https://…/plugin.json") → fetch and expand
 * - Kept as-is for member-level names in the explicit syntax
 */
export async function expandPluginBundles(bundleNames, resolveUrl) {
  const preprocessors = {};
  const processors = {};
  const features = {};
  const loaded = new Set();

  async function processBundleName(name) {
    if (loaded.has(name)) return;
    loaded.add(name);

    let exports;
    if (isRemoteUrl(name) && name.endsWith('.json')) {
      exports = await loadRemoteBundle(name);
    } else if (KNOWN_BUNDLES.has(name)) {
      exports = await loadBundle(name, resolveUrl);
    } else {
      // Not a bundle name — skip (handled as member-level names later)
      return;
    }

    if (exports.preprocessors) {
      Object.assign(preprocessors, exports.preprocessors);
    }
    if (exports.processors) {
      Object.assign(processors, exports.processors);
    }
    if (exports.features) {
      Object.assign(features, exports.features);
    }
  }

  for (const name of bundleNames) {
    await processBundleName(name);
  }

  return { preprocessors, processors, features };
}

/**
 * Resolve a single preprocessor or processor by name.
 * First checks already-loaded bundles, then loads the parent bundle if known.
 */
export async function resolvePlugin(name, type, resolveUrl) {
  // Check if already loaded
  for (const [, exports] of bundleCache) {
    const registry = type === 'preprocessor' ? exports.preprocessors : exports.processors;
    if (registry && registry[name]) {
      return registry[name];
    }
  }

  // Try to find the parent bundle
  const bundleName = MEMBER_TO_BUNDLE[name];
  if (bundleName) {
    const exports = await loadBundle(bundleName, resolveUrl);
    const registry = type === 'preprocessor' ? exports.preprocessors : exports.processors;
    if (registry && registry[name]) {
      return registry[name];
    }
  }

  return null;
}

/**
 * Resolve a feature by name.
 */
export async function resolveFeature(name, resolveUrl) {
  // Check if already loaded
  for (const [, exports] of bundleCache) {
    if (exports.features && exports.features[name]) {
      return exports.features[name];
    }
  }

  // Try to find the parent bundle
  const bundleName = MEMBER_TO_BUNDLE[name];
  if (bundleName) {
    const exports = await loadBundle(bundleName, resolveUrl);
    if (exports.features && exports.features[name]) {
      return exports.features[name];
    }
  }

  return null;
}

/**
 * Get the list of known bundle names.
 */
export function getKnownBundles() {
  return [...KNOWN_BUNDLES];
}

/**
 * Check if a name is a known bundle.
 */
export function isKnownBundle(name) {
  return KNOWN_BUNDLES.has(name);
}

/**
 * Reset the loader (for testing).
 */
export function resetPluginLoader() {
  bundleCache.clear();
  pluginAPI = null;
}
