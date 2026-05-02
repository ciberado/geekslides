/**
 * Static registry of all built-in GeekSlides slide classes, modifiers, and functions.
 *
 * Each entry includes metadata used by the CompletionItemProvider to display
 * labels, detail, and documentation in the autocomplete popup.
 */

export type ClassCategory = 'layout' | 'modifier' | 'function';

export interface ClassEntry {
  readonly name: string;
  readonly category: ClassCategory;
  readonly detail: string;
  readonly documentation: string;
  /** Snippet insert text (with $1 placeholders). Defaults to name if omitted. */
  readonly insertText?: string;
}

export const BUILTIN_CLASSES: readonly ClassEntry[] = [
  // ── Layouts ──────────────────────────────────────────────────────────
  {
    name: 'layout-title',
    category: 'layout',
    detail: 'Centered title slide — flex column, center/center',
    documentation: '```md\n[](.layout-title#my-slide)\n```\nFull-screen centered title with optional subtitle.',
  },
  {
    name: 'layout-cover',
    category: 'layout',
    detail: 'Cover slide with background image overlay',
    documentation: '```md\n[](.layout-cover#id,bgurl(hero.jpg))\n```\nContent at bottom with `::before` gradient overlay. Combine with `.mod-coverbg` for full-bleed images.',
  },
  {
    name: 'layout-section',
    category: 'layout',
    detail: 'Section divider — h2 + optional h3',
    documentation: '```md\n[](.layout-section#chapter)\n```\nFlex column, centered. Use for chapter breaks.',
  },
  {
    name: 'layout-big-stat',
    category: 'layout',
    detail: 'Big statistic — h3 + p centered',
    documentation: '```md\n[](.layout-big-stat#stat)\n```\nFlex column, center/center. Perfect for highlighting a single number.',
  },
  {
    name: 'layout-two-col',
    category: 'layout',
    detail: 'Two-column grid layout',
    documentation: '```md\n[](.layout-two-col#cols)\n```\n2-col grid. Use `#### Heading` (h4) as a hidden column break.',
  },
  {
    name: 'layout-img-text',
    category: 'layout',
    detail: 'Image left, text right — 2-col grid',
    documentation: '```md\n[](.layout-img-text#product)\n```\nImage in left column, text/list in right column.',
  },
  {
    name: 'layout-img-text-bleed',
    category: 'layout',
    detail: 'Full-height image left — 2-col grid',
    documentation: '```md\n[](.layout-img-text-bleed#hero)\n```\nImage spans full height of left half.',
  },
  {
    name: 'layout-three-col',
    category: 'layout',
    detail: 'Three-column grid layout',
    documentation: '```md\n[](.layout-three-col#pillars)\n```\n3-col grid. `#### Heading` (h4) heads each card.',
  },
  {
    name: 'layout-timeline',
    category: 'layout',
    detail: 'Timeline with ordered list steps',
    documentation: '```md\n[](.layout-timeline#roadmap)\n```\n`ol` → CSS Grid auto-columns with `::before` line. Steps support images.',
  },
  {
    name: 'layout-chart',
    category: 'layout',
    detail: 'Chart layout — table gets flex: 1',
    documentation: '```md\n[](.layout-chart#revenue)\n```\nFlex column; `table` stretches to fill available space.',
  },
  {
    name: 'layout-compare',
    category: 'layout',
    detail: 'Comparison layout — 3-col with VS badge',
    documentation: '```md\n[](.layout-compare#comparison)\n```\n3-col grid (`1fr auto 1fr`). `#### Heading` becomes VS badge in centre.',
  },
  {
    name: 'layout-team',
    category: 'layout',
    detail: 'Team members — flex wrap, space-evenly',
    documentation: '```md\n[](.layout-team#team)\n```\nCircular headshots. Add `.mod-heading-center` to centre heading with images.',
  },
  {
    name: 'layout-grid',
    category: 'layout',
    detail: 'Auto-fit responsive grid',
    documentation: '```md\n[](.layout-grid#gallery)\n```\n`auto-fit` grid with `minmax(350px, 1fr)`. Combine with `.mod-cols-2` or `.mod-cols-4`.',
  },
  {
    name: 'layout-table',
    category: 'layout',
    detail: 'Table layout — table gets flex: 1',
    documentation: '```md\n[](.layout-table#features)\n```\nFlex column; `table` stretches to fill.',
  },
  {
    name: 'layout-agenda',
    category: 'layout',
    detail: 'Agenda layout with accent circles',
    documentation: '```md\n[](.layout-agenda#agenda)\n```\n2-row grid. `ol` items flex-column with accent circles.',
  },
  {
    name: 'layout-blank',
    category: 'layout',
    detail: 'Blank canvas with guide border',
    documentation: '```md\n[](.layout-blank#canvas)\n```\nNo inner structure. `::after` guide border.',
  },

  // ── Modifiers ────────────────────────────────────────────────────────
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

  // ── Functions ────────────────────────────────────────────────────────
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

/** Lookup map by name for fast access. */
export function buildClassMap(entries: readonly ClassEntry[]): ReadonlyMap<string, ClassEntry> {
  return new Map(entries.map((entry) => [entry.name, entry]));
}
