// Auto-generated from layouts.css by scripts/extract-css-docs.ts
// DO NOT EDIT MANUALLY - changes will be overwritten on next build

import type { ClassEntry } from './class-registry.js';

export const LAYOUT_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'layout-title',
    category: 'layout' as const,
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
    category: 'layout' as const,
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

Combine with .mod-coverbg for full-bleed background images.`,
  },
  {
    name: 'layout-section',
    category: 'layout' as const,
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
    category: 'layout' as const,
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
    category: 'layout' as const,
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

**Key:** Use #### Heading (h4) as a hidden column break marker.`,
  },
  {
    name: 'layout-img-text',
    category: 'layout' as const,
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
    category: 'layout' as const,
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

Image spans full height of left half. More dramatic than layout-img-text.`,
  },
  {
    name: 'layout-three-col',
    category: 'layout' as const,
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

Use #### Heading (h4) to head each card.`,
  },
  {
    name: 'layout-timeline',
    category: 'layout' as const,
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
    category: 'layout' as const,
    detail: 'Chart layout — table gets flex: 1',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-chart#revenue)
### Revenue Growth
| Q  | Revenue |
|----|---------|
| Q1 | \$1.2M   |
| Q2 | \$2.4M   |
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
    category: 'layout' as const,
    detail: 'Comparison layout — 3-col with VS badge',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-compare#comparison)
#### Option A
- Feature 1
- Feature 2
#### VS
#### Option B
- Feature 3
- Feature 4
\`\`\`

**Structure:**
\`\`\`
┌─────────┬────┬─────────┐
│ #### A  │ VS │ #### B  │  ← 1fr auto 1fr grid
│ Content │    │ Content │
└─────────┴────┴─────────┘
\`\`\`

The middle #### Heading becomes styled VS badge in centre column.`,
  },
  {
    name: 'layout-team',
    category: 'layout' as const,
    detail: 'Team members — flex wrap, space-evenly',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-team#team)
![Alice](alice.jpg) **Alice** — CEO
![Bob](bob.jpg) **Bob** — CTO
![Carol](carol.jpg) **Carol** — CFO
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│  ●      ●      ●        │  ← Images (circular)
│ Alice  Bob  Carol       │  ← Names wrap
└─────────────────────────┘
\`\`\`

Images render as circles. Use .mod-heading-center to center the heading.`,
  },
  {
    name: 'layout-grid',
    category: 'layout' as const,
    detail: 'Auto-fit responsive grid',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-grid#gallery)
![](img1.jpg)
![](img2.jpg)
![](img3.jpg)
![](img4.jpg)
\`\`\`

**Structure:**
\`\`\`
┌─────┬─────┬─────┐
│ IMG │ IMG │ IMG │  ← auto-fit grid
├─────┼─────┼─────┤    minmax(350px, 1fr)
│ IMG │     │     │
└─────┴─────┴─────┘
\`\`\`

Responsive grid with auto-fit. Combine with .mod-cols-2 or .mod-cols-4 to force column count.`,
  },
  {
    name: 'layout-table',
    category: 'layout' as const,
    detail: 'Table layout — table gets flex: 1',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-table#features)
### Feature Matrix
| Feature | Basic | Pro |
|---------|-------|-----|
| Users   | 5     | ∞   |
| Storage | 1GB   | 1TB |
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│ ### Heading             │
│ ┌─────────────────────┐ │
│ │ TABLE (stretches)   │ │  ← flex: 1
│ │                     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
\`\`\`

Table stretches to fill available vertical space.`,
  },
  {
    name: 'layout-blank',
    category: 'layout' as const,
    detail: 'Blank canvas with guide border',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-blank#canvas)
<div style="position:absolute; top:50%; left:50%;">
  Custom positioned content
</div>
\`\`\`

**Structure:**
\`\`\`
┌─────────────────────────┐
│                         │  ← Empty container
│   (your content here)   │     with guide border
│                         │
└─────────────────────────┘
\`\`\`

No structure applied. Use HTML/CSS for absolute positioning. ::after shows guide border.`,
  },
  {
    name: 'layout-agenda',
    category: 'layout' as const,
    detail: 'Agenda layout with accent circles',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-agenda#agenda)
1. **9:00** — Opening
2. **10:00** — Keynote
3. **11:00** — Workshop
4. **12:00** — Lunch
\`\`\`

**Structure:**
\`\`\`
┌───────────┬───────────┐
│ ● 9:00    │ ● 11:00   │  ← 2-row grid
│   Opening │   Workshop│     accent circles
├───────────┼───────────┤
│ ● 10:00   │ ● 12:00   │
│   Keynote │   Lunch   │
└───────────┴───────────┘
\`\`\`

Ordered list items displayed in 2-row grid with decorative circles.`,
  },
] as const;

export const LAYOUT_MODIFIER_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'mod-coverbg',
    category: 'modifier' as const,
    detail: 'Apply background image to the slide (full-bleed)',
    documentation: `Combine with parent layout: [](.layout-cover.mod-coverbg#id)
[](.layout-cover.mod-coverbg#id,bgurl(hero.jpg))
Use with bgurl() function to set the background image.`,
  },
  {
    name: 'mod-heading-center',
    category: 'modifier' as const,
    detail: 'Center heading and images vertically',
    documentation: `Combine with parent layout: [](.layout-team.mod-heading-center#id)
[](.layout-team.mod-heading-center#id)
Centers the h3 heading and aligns content vertically in the middle.`,
  },
  {
    name: 'mod-cols-2',
    category: 'modifier' as const,
    detail: 'Force 2-column grid',
    documentation: `Combine with parent layout: [](.layout-grid.mod-cols-2#id)
[](.layout-grid.mod-cols-2#my-slide)
Override auto-fit behavior to display exactly 2 columns.`,
  },
] as const;
