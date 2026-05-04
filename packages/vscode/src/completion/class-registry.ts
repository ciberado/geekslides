/**
 * Static registry of all built-in GeekSlides slide classes, modifiers, and functions.
 *
 * Layout classes are auto-generated from layouts.css by scripts/extract-css-docs.ts.
 * Modifier and function entries are maintained manually here.
 */

import { LAYOUT_ENTRIES } from './class-registry-generated.js';

export type ClassCategory = 'layout' | 'modifier' | 'function';

export interface ClassEntry {
  readonly name: string;
  readonly category: ClassCategory;
  readonly detail: string;
  readonly documentation: string;
  /** Snippet insert text (with $1 placeholders). Defaults to name if omitted. */
  readonly insertText?: string;
}

// ── Modifiers ────────────────────────────────────────────────────────
const MODIFIER_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'mod-coverbg',
    category: 'modifier',
    detail: 'Full-bleed background image treatment',
    documentation: '```md\n[](.layout-cover.mod-coverbg#id,bgurl(hero.jpg))\n```\nFirst image fills the slide background. Typically used with `layout-cover`.',
  },
  {
    name: 'mod-heading-center',
    category: 'modifier',
    detail: 'Centre heading with team images',
    documentation: '```md\n[](.layout-team.mod-heading-center#team)\n```\nCentres the heading above team member images.',
  },
  {
    name: 'mod-partial',
    category: 'modifier',
    detail: 'Progressive reveal for list items',
    documentation: '```md\n[](.mod-partial#benefits)\n```\nAll `li` and `tr` elements become reveal steps. Navigate with arrow keys.',
  },
  {
    name: 'mod-cols-2',
    category: 'modifier',
    detail: 'Force 2-column grid layout',
    documentation: '```md\n[](.layout-grid.mod-cols-2#gallery)\n```\nOverrides auto-fit with explicit 2-column grid.',
  },
  {
    name: 'mod-cols-4',
    category: 'modifier',
    detail: 'Force 4-column grid layout',
    documentation: '```md\n[](.layout-grid.mod-cols-4#gallery)\n```\nOverrides auto-fit with explicit 4-column grid.',
  },
] as const;

// ── Functions ────────────────────────────────────────────────────────
const FUNCTION_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'bgurl',
    category: 'function',
    detail: 'Set slide background image URL',
    documentation: '```md\n[](.layout-cover#id,bgurl(https://example.com/bg.jpg))\n```\nAccepts relative paths or absolute URLs.',
    insertText: 'bgurl($1)',
  },
  {
    name: 'bgcolor',
    category: 'function',
    detail: 'Set slide background colour',
    documentation: '```md\n[](#id,bgcolor(#1a1a2e))\n```\nAccepts any CSS colour value.',
    insertText: 'bgcolor($1)',
  },
] as const;

/**
 * Combined registry: generated layouts + manual modifiers + functions.
 */
export const BUILTIN_CLASSES: readonly ClassEntry[] = [
  ...LAYOUT_ENTRIES,
  ...MODIFIER_ENTRIES,
  ...FUNCTION_ENTRIES,
] as const;

/** Lookup map by name for fast access. */
export function buildClassMap(entries: readonly ClassEntry[]): ReadonlyMap<string, ClassEntry> {
  return new Map(entries.map((entry) => [entry.name, entry]));
}
