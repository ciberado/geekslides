/**
 * Static registry of all built-in GeekSlides slide classes, modifiers, and functions.
 *
 * - Layout classes: auto-generated from layouts.css by scripts/extract-css-docs.ts
 * - Layout-specific modifiers: auto-generated (nested in layout blocks with @modifier tags)
 * - Global modifiers: manually maintained here (mod-partial, mod-cols-4)
 * - Functions: manually maintained here (bgurl, bgcolor)
 */

import { LAYOUT_ENTRIES, LAYOUT_MODIFIER_ENTRIES } from './class-registry-generated.js';

export type ClassCategory = 'layout' | 'modifier' | 'function';

export interface ClassEntry {
  readonly name: string;
  readonly category: ClassCategory;
  readonly detail: string;
  readonly documentation: string;
  /** Snippet insert text (with $1 placeholders). Defaults to name if omitted. */
  readonly insertText?: string;
}

// ── Global Modifiers ─────────────────────────────────────────────────
// These modifiers apply to any layout/slide, not specific to one layout.
const GLOBAL_MODIFIER_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'mod-partial',
    category: 'modifier',
    detail: 'Progressive reveal for list items',
    documentation: '```md\n[](.mod-partial#benefits)\n```\nAll `li` and `tr` elements become reveal steps. Navigate with arrow keys.',
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
 * Combined registry:
 * - Generated layouts (from CSS @layout tags)
 * - Generated layout-specific modifiers (from CSS @modifier tags)
 * - Manual global modifiers (mod-partial, mod-cols-4)
 * - Manual functions (bgurl, bgcolor)
 */
export const BUILTIN_CLASSES: readonly ClassEntry[] = [
  ...LAYOUT_ENTRIES,
  ...LAYOUT_MODIFIER_ENTRIES,
  ...GLOBAL_MODIFIER_ENTRIES,
  ...FUNCTION_ENTRIES,
] as const;

/** Lookup map by name for fast access. */
export function buildClassMap(entries: readonly ClassEntry[]): ReadonlyMap<string, ClassEntry> {
  return new Map(entries.map((entry) => [entry.name, entry]));
}
