/**
 * GeekSlides v2 — create command.
 *
 * Scaffolds a new presentation repository with the layout system,
 * a default theme, and a showcase deck that demonstrates every layout.
 */

import type { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../logging.ts';
import { layoutsCss } from '../templates/layouts-css.ts';
import { themeDefaultCss } from '../templates/theme-default-css.ts';

const log = createLogger('create');

const execFileAsync = promisify(execFile);

/** Build the showcase README.md that exercises every layout. */
function buildReadme(title: string): string {
  return `[](.layout-title#title,bgurl(https://picsum.photos/seed/geekslides-hero/1920/1080))

# ${title}

## A modern slide deck

[](.layout-cover.coverbg#vision,bgurl(https://picsum.photos/seed/geekslides-cover/1920/1080))

# Think Bold, Ship Fast

Empowering teams to communicate ideas that matter.

::: Notes
This cover slide uses \`layout-cover\` with a background image.
The gradient overlay is provided by the theme.
:::

[](.layout-section#chapter-story)

## The Story

### Why we built this

[](.layout-two-col#problem-solution)

### Problem & Solution

- **Fragmented tooling** leads to inconsistent decks
- **Design fatigue** slows down content creation
- **No versioning** makes collaboration painful

#### Solution

- **Markdown-first** — write, don't drag-and-drop
- **Layout system** — consistent structure every time
- **Git-native** — branch, merge, review

::: Notes
Two-column layout: the h4 acts as a hidden column separator.
Everything before the h4 is column 1; everything after is column 2.
:::

[](.layout-img-text#product)

### The Product

![Product screenshot](https://picsum.photos/seed/geekslides-product/800/600)

- **15+ built-in layouts** for any content type
- **Theme system** separates color from structure
- **Real-time sync** across devices via Yjs
- **PDF export** with a single CLI command

[](.layout-img-text-bleed#product-bleed)

![Full-bleed shot](https://picsum.photos/seed/geekslides-bleed/960/1080)

### Edge-to-Edge Imagery

- Image fills the entire left half — no gaps
- Heading and content sit comfortably on the right
- Great for product screenshots or hero photos

[](.layout-big-stat#traction)

### 42M+

Slides rendered across 120 countries

[](.layout-three-col#pillars)

### Our Three Pillars

#### Speed

Author slides in seconds using plain Markdown. No drag-and-drop, no bloated editors — just text.

#### Flexibility

15+ layout classes handle any content pattern, from data tables to image grids to timelines.

#### Consistency

Theme tokens ensure every slide looks polished. Change one variable, update the entire deck.

[](.layout-three-col#pillars-images)

### Platform Highlights

#### Dashboard

![Dashboard](https://picsum.photos/seed/geekslides-card-dash/600/400)

#### Editor

![Editor](https://picsum.photos/seed/geekslides-card-editor/600/400)

#### Mobile

![Mobile](https://picsum.photos/seed/geekslides-card-mobile/600/400)

[](.layout-timeline#roadmap)

### Product Roadmap

1. **Research**: interview 200 presenters across industries.
2. **Prototype**: build the layout engine and theme system.
3. **Beta**: ship to early adopters, gather feedback.
4. **Launch**: public release with documentation and CLI.

::: Notes
The timeline layout converts an ordered list into a horizontal
process diagram with numbered circles and a connecting line.
:::

[](.layout-agenda#agenda)

### Today's Agenda

1. Introduction & vision
2. Architecture deep-dive
3. Live demo
4. Q & A

[](.layout-section#chapter-data)

## The Data

### Numbers that speak

[](.layout-chart#revenue)

### Quarterly Revenue (K$)

| Region       | Q1   | Q2   | Q3   | Q4   |
|-------------|------|------|------|------|
| Americas    | 320  | 410  | 480  | 560  |
| Europe      | 180  | 220  | 270  | 340  |
| Asia-Pacific| 90   | 140  | 195  | 260  |
| Total       | 590  | 770  | 945  | 1160 |

[](.layout-compare#comparison)

### Traditional Tools vs GeekSlides

- **Traditional**: drag-and-drop interface
- **Traditional**: per-seat license fees
- **Traditional**: binary file format
- **Traditional**: email-based sharing

#### vs

- **GeekSlides**: Markdown text files
- **GeekSlides**: open-source, free forever
- **GeekSlides**: Git-friendly plain text
- **GeekSlides**: real-time WebSocket sync

[](.layout-table#features)

### Feature Matrix

| Capability        | Free         | Pro          | Enterprise   |
|-------------------|-------------|-------------|-------------|
| Slides per deck   | Unlimited   | Unlimited   | Unlimited   |
| Layouts           | 15+         | 15+ custom  | Bespoke     |
| Themes            | Default     | 5 built-in  | White-label |
| PDF export        | Watermarked | Clean       | Branded     |
| Sync              | 2 devices   | 10 devices  | Unlimited   |
| Support           | Community   | Email       | Dedicated   |

[](.layout-team#team)

### Meet the Team

![Alice Chen](https://picsum.photos/seed/geekslides-alice/400/400)

![Bob Martinez](https://picsum.photos/seed/geekslides-bob/400/400)

![Carol Okonkwo](https://picsum.photos/seed/geekslides-carol/400/400)

![Dan Kim](https://picsum.photos/seed/geekslides-dan/400/400)

[](.layout-grid#gallery-large)

### Product Gallery — Four Images

![Dashboard](https://picsum.photos/seed/geekslides-dash/800/600)

![Editor](https://picsum.photos/seed/geekslides-editor/800/600)

![Presenter view](https://picsum.photos/seed/geekslides-present/800/600)

![Mobile sync](https://picsum.photos/seed/geekslides-mobile/800/600)

[](.layout-grid#gallery-six)

### Product Gallery — Six Images

![Themes](https://picsum.photos/seed/geekslides-themes/800/600)

![Plugins](https://picsum.photos/seed/geekslides-plugins/800/600)

![Export](https://picsum.photos/seed/geekslides-export/800/600)

![Sync](https://picsum.photos/seed/geekslides-sync/800/600)

![CLI](https://picsum.photos/seed/geekslides-cli/800/600)

![Deploy](https://picsum.photos/seed/geekslides-deploy/800/600)

[](#closing)

### Thank You

> The best presentations are written, not designed.

Get started today:

\`\`\`bash
npx @geekslides/cli create --title "My Next Talk"
\`\`\`

::: Notes
This is the default "title + content" layout — no layout class needed.
It works well for closing slides, Q&A prompts, or simple text content.
:::

[](.layout-blank#whiteboard)
`;
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new presentation')
    .requiredOption('--title <string>', 'Presentation title')
    .option('--dir <path>', 'Target directory (default: slugified title)')
    .option('--no-git', 'Skip git init')
    .action(async (opts: { title: string; dir?: string; git: boolean }) => {
      const slug = opts.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const dir = opts.dir ?? slug;

      console.log(`Creating presentation: ${opts.title}`);

      await mkdir(join(dir, 'images'), { recursive: true });
      await mkdir(join(dir, 'css'), { recursive: true });

      // config.json — layout + theme + local overrides
      // The template uses explicit []() separators, so disable the header
      // preprocessor that would auto-split on every heading.
      const config = {
        title: opts.title,
        content: 'README.md',
        styles: ['css/layouts.css', 'css/theme-default.css', 'css/local.css'],
        features: ['whiteboard'],
        aspectRatio: '16/9',
        plugins: {
          // source-notes: auto-injects each slide's markdown source into the
          // speaker notes so this showcase deck teaches by example.
          preprocessors: ['source-notes'],
        },
      };
      await writeFile(join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');

      // README.md — showcase deck with all layouts
      await writeFile(join(dir, 'README.md'), buildReadme(opts.title), 'utf-8');

      // css/layouts.css — structural layout system
      await writeFile(join(dir, 'css', 'layouts.css'), layoutsCss, 'utf-8');

      // css/theme-default.css — default color/typography theme
      await writeFile(join(dir, 'css', 'theme-default.css'), themeDefaultCss, 'utf-8');

      // css/local.css — user overrides (loaded last)
      const localCss = `/* ${opts.title} — local style overrides.
 *
 * This file is loaded AFTER layouts.css and theme-default.css.
 * Override any design token here:
 *
 *   :host {
 *     --gs-color-accent: #E63946;
 *     --gs-font-family: "Inter", sans-serif;
 *   }
 *
 * Or add slide-specific rules:
 *
 *   section.content.layout-title > h1 {
 *     font-size: 96pt;
 *   }
 */
`;
      await writeFile(join(dir, 'css', 'local.css'), localCss, 'utf-8');

      // images/.gitkeep
      await writeFile(join(dir, 'images', '.gitkeep'), '', 'utf-8');

      // Git init
      if (opts.git) {
        try {
          await execFileAsync('git', ['init', dir]);
          console.log('  Git repository initialized');
        } catch {
          console.log('  Git init skipped (git not available)');
        }
      }

      console.log(`  Created: ${dir}/`);
      console.log('  Files: config.json, README.md, css/{layouts,theme-default,local}.css, images/');
      log.debug({ dir, title: opts.title }, 'presentation scaffolded');
    });
}
