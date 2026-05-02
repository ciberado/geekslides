/**
 * Extracts CSS class selectors from deck stylesheet files.
 *
 * Reads the `styles` array from a deck's `config.json`, resolves
 * each path relative to the config directory, and parses the CSS
 * to find `.layout-*` and `.mod-*` class selectors.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ClassEntry } from './class-registry.ts';

export interface CssExtractorDeps {
  readonly readText?: (path: string, encoding: 'utf8') => Promise<string>;
}

/**
 * Extract custom class names from a deck's CSS files.
 *
 * Returns ClassEntry items for any `.layout-*` or `.mod-*` classes
 * found that are NOT already in the built-in registry.
 */
export async function extractClassesFromDeck(
  configPath: string,
  builtinNames: ReadonlySet<string>,
  deps: CssExtractorDeps = {},
): Promise<ClassEntry[]> {
  const readText = deps.readText ?? ((path: string, encoding: 'utf8') => readFile(path, encoding));
  const configDir = dirname(configPath);

  let styles: string[];
  try {
    const rawText = await readText(configPath, 'utf8');
    const parsed: unknown = JSON.parse(rawText);
    const config = typeof parsed === 'object' && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
    const rawStyles = config['styles'];
    styles = Array.isArray(rawStyles)
      ? rawStyles.filter((s): s is string => typeof s === 'string')
      : [];
  } catch {
    return [];
  }

  const discovered = new Map<string, ClassEntry>();

  for (const stylePath of styles) {
    const fullPath = resolve(configDir, stylePath);
    try {
      const css = await readText(fullPath, 'utf8');
      const classes = extractClassSelectorsFromCss(css);
      for (const cls of classes) {
        if (!builtinNames.has(cls) && !discovered.has(cls)) {
          discovered.set(cls, {
            name: cls,
            category: cls.startsWith('layout-') ? 'layout' : 'modifier',
            detail: `Custom class from ${stylePath}`,
            documentation: `Discovered in \`${stylePath}\`.`,
          });
        }
      }
    } catch {
      // File not readable — skip silently
    }
  }

  return [...discovered.values()];
}

/**
 * Extract `.layout-*` and `.mod-*` class selectors from raw CSS text.
 * Also extracts any other `.xyz` classes used with `section.content.`
 * selector patterns common in GeekSlides layouts.
 */
export function extractClassSelectorsFromCss(css: string): string[] {
  const classes = new Set<string>();
  // Match .layout-* or .mod-* class selectors
  const regex = /\.(layout-[a-z0-9-]+|mod-[a-z0-9-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    if (match[1]) {
      classes.add(match[1]);
    }
  }
  return [...classes];
}
