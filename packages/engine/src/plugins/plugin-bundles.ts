/**
 * GeekSlides v2 — Built-in plugin bundle registry.
 *
 * A plugin bundle groups preprocessors, processors, and features into a single
 * named unit that can be referenced in config.json as a simple string, e.g.
 *
 *   { "plugins": ["media", "whiteboard"] }
 *
 * Bundles may declare `dependsOn` to pull in another bundle automatically.
 * When expanding a list of bundle names, dependencies are resolved recursively
 * and all resulting lists are deduplicated while preserving first-seen order.
 */

export interface PluginBundleDef {
  readonly name: string;
  readonly description: string;
  readonly dependsOn: readonly string[];
  readonly preprocessors: readonly string[];
  readonly processors: readonly string[];
  readonly features: readonly string[];
}

export const BUILTIN_BUNDLES: Readonly<Record<string, PluginBundleDef>> = {
  /**
   * Core: heading-based slide separators and generic iframe embeds.
   * Automatically pulled in as a dependency of other bundles.
   */
  core: {
    name: 'core',
    description: 'Essential preprocessors: heading-based slide separators and basic iframe embeds',
    dependsOn: [],
    preprocessors: ['header'],
    processors: ['iframe'],
    features: [],
  },

  /**
   * Media: YouTube, audio, video, and generic iframe embeds with cross-client
   * playback sync via Yjs. Depends on core.
   */
  media: {
    name: 'media',
    description: 'YouTube, audio, video, and generic iframe embeds with cross-client playback sync',
    dependsOn: ['core'],
    preprocessors: ['youtube-url', 'audio-url', 'video-url', 'iframe-url'],
    processors: ['video', 'audio-url', 'iframe-url'],
    features: ['media-sync'],
  },

  /**
   * Whiteboard: drawing overlay for live annotation during presentations.
   */
  whiteboard: {
    name: 'whiteboard',
    description: 'Drawing overlay for live annotation during presentations',
    dependsOn: [],
    preprocessors: [],
    processors: [],
    features: ['whiteboard'],
  },

  /**
   * Chart: Chart.js-powered data visualisation in slides.
   */
  chart: {
    name: 'chart',
    description: 'Chart.js-powered data visualisation in slides',
    dependsOn: [],
    preprocessors: [],
    processors: ['chart'],
    features: [],
  },

  /**
   * Mermaid: Mermaid diagram rendering inside slides.
   */
  mermaid: {
    name: 'mermaid',
    description: 'Mermaid diagram rendering inside slides',
    dependsOn: [],
    preprocessors: [],
    processors: ['mermaid'],
    features: [],
  },

  /**
   * CSS Doodle: generative CSS doodle background patterns.
   */
  'css-doodle': {
    name: 'css-doodle',
    description: 'Generative CSS doodle background patterns',
    dependsOn: [],
    preprocessors: ['css-doodle'],
    processors: ['css-doodle'],
    features: [],
  },

  /**
   * Poll: live audience polling with real-time vote aggregation.
   */
  poll: {
    name: 'poll',
    description: 'Live audience polling with real-time vote aggregation',
    dependsOn: [],
    preprocessors: [],
    processors: [],
    features: ['poll'],
  },
};

/**
 * Expand a list of bundle names into the combined preprocessors, processors,
 * and features they collectively require. Dependencies declared via `dependsOn`
 * are resolved recursively. All result arrays are deduplicated, preserving
 * first-seen order (dependencies always appear before the bundle that needs them).
 *
 * @throws {Error} when an unknown bundle name is encountered
 */
export function expandBundles(bundleNames: readonly string[]): {
  preprocessors: string[];
  processors: string[];
  features: string[];
  remoteBundles: string[];
} {
  const preprocessors: string[] = [];
  const processors: string[] = [];
  const features: string[] = [];
  const remoteBundles: string[] = [];
  const visited = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);

    // Remote URLs are passed through for the plugin loader to handle at runtime
    if (name.startsWith('https://') || name.startsWith('http://')) {
      remoteBundles.push(name);
      return;
    }

    const bundle = BUILTIN_BUNDLES[name];
    if (!bundle) {
      const available = Object.keys(BUILTIN_BUNDLES).join(', ');
      throw new Error(`Unknown plugin bundle: '${name}'. Available bundles: ${available}`);
    }

    for (const dep of bundle.dependsOn) {
      visit(dep);
    }

    for (const pp of bundle.preprocessors) {
      if (!preprocessors.includes(pp)) preprocessors.push(pp);
    }
    for (const proc of bundle.processors) {
      if (!processors.includes(proc)) processors.push(proc);
    }
    for (const feat of bundle.features) {
      if (!features.includes(feat)) features.push(feat);
    }
  }

  for (const name of bundleNames) {
    visit(name);
  }

  return { preprocessors, processors, features, remoteBundles };
}
