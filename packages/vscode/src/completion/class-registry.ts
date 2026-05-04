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
    documentation: `**Markdown:**
\`\`\`md
[](.layout-title#my-slide)
# Big Title
## Subtitle
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│                         │
│      # BIG TITLE        │  ← h1, centered
│      ## Subtitle        │  ← h2, optional
│                         │
└─────────────────────────┘
\`\`\`

Full-screen centered title with optional subtitle. Perfect for opening slides or section dividers.`,
  },
  {
    name: 'layout-cover',
    category: 'layout',
    detail: 'Cover slide with background image overlay',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-cover#id,bgurl(hero.jpg))
# Hero Title
## Tagline
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│  [BACKGROUND IMAGE]     │
│         with            │
│    gradient overlay     │
│                         │
│  ┌───────────────────┐  │
│  │ # Title           │  │  ← content at bottom
│  │ ## Subtitle       │  │
│  └───────────────────┘  │
└─────────────────────────┘
\`\`\`

Combine with \`.mod-coverbg\` for full-bleed background images.`,
  },
  {
    name: 'layout-section',
    category: 'layout',
    detail: 'Section divider — h2 + optional h3',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-section#chapter-2)
## Chapter 2
### Advanced Topics
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│                         │
│    ## Chapter Name      │  ← h2, large
│    ### Subtitle         │  ← h3, optional
│                         │
└─────────────────────────┘
\`\`\`

Use for chapter breaks or section transitions.`,
  },
  {
    name: 'layout-big-stat',
    category: 'layout',
    detail: 'Big statistic — h3 + p centered',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-big-stat#growth)
### 247%
Growth this quarter
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│                         │
│      ### 247%           │  ← h3, huge number
│   Growth this quarter   │  ← p, description
│                         │
└─────────────────────────┘
\`\`\`

Perfect for highlighting a single key metric.`,
  },
  {
    name: 'layout-two-col',
    category: 'layout',
    detail: 'Two-column grid layout',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-two-col#comparison)
### Features
- Item 1
- Item 2
#### (column break)
- Item 3
- Item 4
\`\`\`

**Structure:**
\`\`\`
┌───────────┬───────────┐
│ ### Left  │ ### Right │
│ - Item 1  │ - Item 3  │
│ - Item 2  │ - Item 4  │
└───────────┴───────────┘
\`\`\`

**Key:** Use \`#### Heading\` (h4) as a hidden column break marker.`,
  },
  {
    name: 'layout-img-text',
    category: 'layout',
    detail: 'Image left, text right — 2-col grid',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-img-text#product)
![Product](img.jpg)
#### Details
- Feature 1
- Feature 2
\`\`\`

**Structure:**
\`\`\`
┌─────────┬─────────────┐
│         │ #### Title  │
│  IMAGE  │ - Feature 1 │
│         │ - Feature 2 │
└─────────┴─────────────┘
\`\`\`

Image in left column, text/list in right column.`,
  },
  {
    name: 'layout-img-text-bleed',
    category: 'layout',
    detail: 'Full-height image left — 2-col grid',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-img-text-bleed#hero)
![Hero](bg.jpg)
#### Story
Content here...
\`\`\`

**Structure:**
\`\`\`
┌───────┬───────────────┐
│ IMAGE │ #### Heading  │
│ FULL  │               │
│ BLEED │ Content...    │
└───────┴───────────────┘
\`\`\`

Image spans full height of left half. More dramatic than \`layout-img-text\`.`,
  },
  {
    name: 'layout-three-col',
    category: 'layout',
    detail: 'Three-column grid layout',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-three-col#pillars)
#### Column 1
Content
#### Column 2
Content
#### Column 3
Content
\`\`\`

**Structure:**
\`\`\`
┌───────┬───────┬───────┐
│ ####  │ ####  │ ####  │
│ Col 1 │ Col 2 │ Col 3 │
└───────┴───────┴───────┘
\`\`\`

Use \`#### Heading\` (h4) to head each card.`,
  },
  {
    name: 'layout-timeline',
    category: 'layout',
    detail: 'Timeline with ordered list steps',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-timeline#roadmap)
1. **Q1** — Launch
2. **Q2** — Growth
3. **Q3** — Scale
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│ 1 ──── 2 ──── 3 ────    │  ← CSS Grid auto-columns
│ Q1     Q2     Q3        │     with ::before line
│ Launch Growth Scale     │
└─────────────────────────┘
\`\`\`

Ordered list rendered as horizontal timeline. Steps support images.`,
  },
  {
    name: 'layout-chart',
    category: 'layout',
    detail: 'Chart layout — table gets flex: 1',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-chart#revenue)
### Revenue Growth
| Q  | Revenue |
|----|---------|
| Q1 | $1.2M   |
| Q2 | $2.4M   |
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│ ### Heading             │
│ ┌─────────────────────┐ │
│ │  TABLE (stretches)  │ │  ← flex: 1
│ │                     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
\`\`\`

Table stretches to fill available space.`,
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
