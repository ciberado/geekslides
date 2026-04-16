/**
 * GeekSlides v2 — Local plugin loader utilities.
 *
 * Allows deck authors to ship plain JS plugins alongside their deck files
 * and reference them in config.json with relative paths (e.g. "./plugins/my-pp.js").
 */

import type { Preprocessor, Processor } from './types.ts';

/**
 * Returns true when the plugin name is a relative file path
 * rather than a built-in plugin name.
 */
export function isLocalPluginPath(name: string): boolean {
  return name.startsWith('./') || name.startsWith('../');
}

/**
 * Extract a Preprocessor function from a dynamically imported module.
 *
 * The module must have a `default` export that is a function.
 */
export function extractPreprocessor(mod: Record<string, unknown>, path: string): Preprocessor {
  const fn = mod['default'];
  if (typeof fn !== 'function') {
    throw new Error(
      `Local preprocessor plugin "${path}" must export a default function`,
    );
  }
  return fn as Preprocessor;
}

/**
 * Extract a Processor function from a dynamically imported module.
 *
 * The module must have a `default` export that is a function.
 */
export function extractProcessor(mod: Record<string, unknown>, path: string): Processor {
  const fn = mod['default'];
  if (typeof fn !== 'function') {
    throw new Error(
      `Local processor plugin "${path}" must export a default function`,
    );
  }
  return fn as Processor;
}
