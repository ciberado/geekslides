/**
 * GeekSlides v2 — create command.
 *
 * Scaffolds a new presentation repository with the layout system,
 * a default theme, and a showcase deck that demonstrates every layout.
 * Pass `--template <name>` to bootstrap from a community deck template
 * hosted in the upstream GitHub repository instead of the built-in scaffold.
 */

import type { Command } from 'commander';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../logging.ts';
import { layoutsCss } from '../templates/layouts-css.ts';
import { THEME_NAMES, findTheme } from '../templates/themes.ts';
import {
  GITIGNORE_CONTENT,
  AGENTS_MD_TEMPLATE,
  SKILL_ADD_SLIDE,
  SKILL_EXPORT_PDF,
  SKILL_UPDATE_THEME,
} from '../scaffold/assets.ts';
import {
  listGithubTemplates,
  downloadGithubTemplate,
  DEFAULT_REPO,
  DEFAULT_REF,
} from '../scaffold/github.ts';

const log = createLogger('create');

const execFileAsync = promisify(execFile);

/** Build the showcase README.md that exercises every layout. */
function buildReadme(title: string): string {
  return `[](.layout-title#title,bgurl(https://picsum.photos/seed/geekslides-hero/1920/1080))

# ${title}

## A modern slide deck

::: Notes
**layout-title** — centred flex column over a background image.
Markdown: \`[](.layout-title#id,bgurl(image.jpg))\` then \`# Heading\` + \`## Subtitle\`.
:::

[](.layout-cover.mod-coverbg#vision,bgurl(https://picsum.photos/seed/geekslides-cover/1920/1080))

# Think Bold, Ship Fast

Empowering teams to communicate ideas that matter.

::: Notes
**layout-cover** — full-bleed background with a gradient overlay.
Content sits at the bottom. Add \`.mod-coverbg\` so the parser treats the
marker's bgurl as a full-bleed background.
:::

[](.layout-section#chapter-story)

## The Story

### Why we built this

::: Notes
**layout-section** — accent-background section divider.
Uses \`h2\` for the chapter title and optional \`h3\` for the tagline.
:::

[](.layout-section#chapter-solo)

## Single-Line Section

::: Notes
A section divider without a tagline — just the \`h2\`.
:::

[](.layout-agenda#agenda)

### Today's Agenda

1. The story behind the product
2. Layouts & content combinations
3. Data, comparisons & tables
4. Team, gallery & closing

::: Notes
**layout-agenda** — numbered items fill the available height evenly.
Use an \`ol\` after the \`h3\` heading.
:::

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
**layout-two-col** — two equal columns separated by a hidden \`h4\`.
This example uses bullet lists in both columns.
:::

[](.layout-two-col#two-col-paragraphs)

### Design Philosophy

The layout file controls **structure** — grids, flex, spacing.
It never sets colours or fonts.

#### Theme Responsibility

The theme file controls **appearance** — colours, typography,
decorative treatments. Swap themes without touching layouts.

::: Notes
**layout-two-col with paragraphs** — the same two-column grid works
with paragraphs, not just lists.
:::

[](.layout-img-text#product)

### The Product

![Product screenshot](https://picsum.photos/seed/geekslides-product/800/600)

- **15+ built-in layouts** for any content type
- **Theme system** separates color from structure
- **Real-time sync** across devices via Yjs
- **PDF export** with a single CLI command

::: Notes
**layout-img-text** — image on the left, heading + content on the right.
Works with \`ul\`, \`ol\`, or \`p\` elements on the right side.
:::

[](.layout-img-text#product-steps)

### Getting Started

![Setup](https://picsum.photos/seed/geekslides-setup/800/600)

1. Install the CLI with \`npm i -g @geekslides/cli\`
2. Scaffold a deck with \`geekslides create\`
3. Start the dev server with \`geekslides dev\`
4. Edit your markdown — changes appear live

::: Notes
**layout-img-text with ordered list** — numbered steps on the right.
:::

[](.layout-img-text-bleed#product-bleed)

![Full-bleed shot](https://picsum.photos/seed/geekslides-bleed/960/1080)

### Edge-to-Edge Imagery

- Image fills the entire left half — no gaps
- Heading and content sit comfortably on the right
- Great for product screenshots or hero photos

::: Notes
**layout-img-text-bleed** — image touches the north, south, and west
edges of the slide. The right column has standard padding.
:::

[](.layout-img-text-bleed#bleed-paragraph)

![Architecture](https://picsum.photos/seed/geekslides-arch/960/1080)

### Architecture Overview

The engine runs entirely in the browser as a set of Web Components.
Each slide is a \`<geek-slide>\` with its own Shadow DOM, which
isolates styles and keeps slides independent.

The server provides real-time sync via Yjs CRDTs over WebSocket,
so multiple presenters can co-navigate the same deck.

The plugin pipeline cleanly separates text preprocessing from DOM
processing, so teams can extend behavior without forking core code.

::: Notes
**layout-img-text-bleed with paragraphs** — text-heavy variant.
:::

[](.layout-big-stat#traction)

### 42M+

Slides rendered across 120 countries

::: Notes
**layout-big-stat** — giant \`h3\` number with a plain paragraph label.
:::

[](.layout-big-stat#quote)

### "Simple wins."

A pull quote works just as well as a number in this layout.

::: Notes
**layout-big-stat as pull quote** — any short text in the \`h3\` works.
:::

[](.layout-three-col#pillars)

### Our Three Pillars

#### Speed

Author slides in seconds using plain Markdown. No drag-and-drop, no bloated editors — just text.

#### Flexibility

15+ layout classes handle any content pattern, from data tables to image grids to timelines.

#### Consistency

Theme tokens ensure every slide looks polished. Change one variable, update the entire deck.

::: Notes
**layout-three-col with text** — each \`h4\` starts a card, followed
by a \`p\` body.
:::

[](.layout-three-col#pillars-lists)

### How It Works

#### Author

- Write in Markdown
- Use layout classes
- Add speaker notes

#### Preview

- Live dev server
- Hot CSS reload
- Mobile sync

#### Ship

- PDF export
- Docker deploy
- Static hosting

::: Notes
**layout-three-col with lists** — card bodies can be \`ul\` or \`ol\`.
:::

[](.layout-three-col#pillars-images)

### Platform Highlights

#### Dashboard

![Dashboard](https://picsum.photos/seed/geekslides-card-dash/600/400)

#### Editor

![Editor](https://picsum.photos/seed/geekslides-card-editor/600/400)

#### Mobile

![Mobile](https://picsum.photos/seed/geekslides-card-mobile/600/400)

::: Notes
**layout-three-col with images** — card bodies can be images.
:::

[](.layout-three-col#pillars-mixed)

### What We Offer

#### Consulting

Expert guidance on architecture, performance, and developer experience. ![Workshop](https://picsum.photos/seed/geekslides-consult/640/360) From first audit to production rollout.

#### Training

![Training session](https://picsum.photos/seed/geekslides-train/600/400) Live cohorts for engineering teams.

#### Open Source

We build in public and ship reusable tools. ![Open source](https://picsum.photos/seed/geekslides-oss/640/360) Community-driven roadmap and examples.

::: Notes
**layout-three-col with mixed content** — shows text+image+text,
image+text, and text+image+text patterns.
:::

[](.layout-timeline#roadmap)

### Product Roadmap

1. **Research**: interview 200 presenters across industries.
2. **Prototype**: build the layout engine and theme system.
3. **Beta**: ship to early adopters, gather feedback.
4. **Launch**: public release with documentation and CLI.

::: Notes
**layout-timeline** — horizontal process steps with numbered circles
and a connecting line. Each \`li\` starts with a \`**bold label**\`.
:::

[](.mod-partial#partial-list)

### Key Benefits

- **Fast authoring** — write, don't design [partial]
- **Live preview** — instant feedback as you type [partial]
- **PDF export** — one command, print-ready [partial]
- **Team sync** — real-time via WebSocket [partial]

::: Notes
**Partial reveal (list)** — add \`[partial]\` after each \`li\` to reveal
bullets one at a time. The slide class \`.mod-partial\` enables the feature.
:::

[](.mod-partial.layout-two-col#partial-cols)

### Markdown vs Design Tools

- Plain text files [partial]
- Version control friendly [partial]
- Works in any editor [partial]

#### Design Tools

- Binary formats [partial]
- Merge conflicts [partial]
- Vendor lock-in [partial]

::: Notes
**Partial reveal in two-col** — partials work inside any layout.
Each bullet appears on its own step.
:::

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

::: Notes
**layout-chart** — heading at top, table fills remaining height.
:::

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

::: Notes
**layout-compare** — two panels with a bold VS divider in the centre.
The \`h4\` appears as an accent badge between the columns.
:::

[](.layout-compare#compare-ordered)

### Deployment Options

1. **Docker Compose** — single-command setup
2. **Managed host** — zero maintenance
3. **CI pipeline** — automated builds

#### vs

1. **Static export** — no server needed
2. **CDN** — global edge caching
3. **GitHub Pages** — free hosting

::: Notes
**layout-compare with ordered lists** — numbered items work too.
:::

[](.layout-compare#compare-tables)

### Performance Benchmarks

| Metric     | Before |
|-----------|--------|
| Build     | 12s    |
| Bundle    | 4.2 MB |
| LCP       | 2.8s   |

#### vs

| Metric     | After  |
|-----------|--------|
| Build     | 3s     |
| Bundle    | 980 KB |
| LCP       | 0.9s   |

::: Notes
**layout-compare with tables** — tables produce equal-height rows,
so both panels line up perfectly.
:::

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

::: Notes
**layout-table** — heading + full-width feature matrix.
:::

[](.layout-team#team)

### Meet the Team

![Alice Chen](https://picsum.photos/seed/geekslides-alice/400/400)

![Bob Martinez](https://picsum.photos/seed/geekslides-bob/400/400)

![Carol Okonkwo](https://picsum.photos/seed/geekslides-carol/400/400)

![Dan Kim](https://picsum.photos/seed/geekslides-dan/400/400)

::: Notes
**layout-team** — header at the top, circular headshots below.
Images grow to fill horizontal space; works with any count.
:::

[](.layout-team.mod-heading-center#team-pair)

### Co-Founders

![Alice Chen](https://picsum.photos/seed/geekslides-alice/400/400)

![Bob Martinez](https://picsum.photos/seed/geekslides-bob/400/400)

::: Notes
**layout-team.mod-heading-center** — modifier that centres the heading
vertically with the images. Good for small groups (2–3 people).
:::

[](.layout-team#team-with-text)

### Engineering Team Profiles

- ![Alice Chen](https://picsum.photos/seed/geekslides-alice/400/400)
  **Alice Chen**
  Platform lead — build and release systems.
- ![Bob Martinez](https://picsum.photos/seed/geekslides-bob/400/400)
  **Bob Martinez**
  Runtime lead — rendering and performance.
- ![Carol Okonkwo](https://picsum.photos/seed/geekslides-carol/400/400)
  **Carol Okonkwo**
  UX lead — interaction and accessibility.

::: Notes
**layout-team with optional text** — use a markdown list where each
item contains image + name + short description.
:::

[](.layout-grid.mod-cols-2#gallery-two-col)

### Product Gallery — 2 Columns

![Dashboard](https://picsum.photos/seed/geekslides-dash/800/600)

![Editor](https://picsum.photos/seed/geekslides-editor/800/600)

![Presenter view](https://picsum.photos/seed/geekslides-present/800/600)

![Mobile sync](https://picsum.photos/seed/geekslides-mobile/800/600)

::: Notes
**layout-grid.mod-cols-2** — explicit two-column layout for wider tiles.
:::

[](.layout-grid#gallery-four)

### Product Gallery — Four Images

![Dashboard](https://picsum.photos/seed/geekslides-dash/800/600)

![Editor](https://picsum.photos/seed/geekslides-editor/800/600)

![Presenter view](https://picsum.photos/seed/geekslides-present/800/600)

![Mobile sync](https://picsum.photos/seed/geekslides-mobile/800/600)

::: Notes
**layout-grid (default)** — defaults to three columns.
:::

[](.layout-grid.cols-3#gallery-six)

### Product Gallery — Six Images

![Themes](https://picsum.photos/seed/geekslides-themes/800/600)

![Plugins](https://picsum.photos/seed/geekslides-plugins/800/600)

![Export](https://picsum.photos/seed/geekslides-export/800/600)

![Sync](https://picsum.photos/seed/geekslides-sync/800/600)

![CLI](https://picsum.photos/seed/geekslides-cli/800/600)

![Deploy](https://picsum.photos/seed/geekslides-deploy/800/600)

::: Notes
**layout-grid.cols-3** — explicit three-column grid.
:::

[](.layout-grid.mod-cols-4#gallery-four-col)

### Product Gallery — 4 Columns

![Runtime](https://picsum.photos/seed/geekslides-runtime/800/600)

![Sync](https://picsum.photos/seed/geekslides-sync2/800/600)

![Whiteboard](https://picsum.photos/seed/geekslides-wb2/800/600)

![CLI](https://picsum.photos/seed/geekslides-cli2/800/600)

::: Notes
**layout-grid.mod-cols-4** — four-column variation for denser galleries.
:::

[](.layout-grid.cols-3#gallery-three)

### Product Gallery — Three Images

![Whiteboard](https://picsum.photos/seed/geekslides-wb/800/600)

![Terminal](https://picsum.photos/seed/geekslides-term/800/600)

![Diagrams](https://picsum.photos/seed/geekslides-diagram/800/600)

::: Notes
**layout-grid.cols-3 (3 images)** — each image expands to fill one
of the three columns.
:::

[](.layout-grid.mod-cols-2#gallery-two)

### Side by Side

![Before](https://picsum.photos/seed/geekslides-before/800/600)

![After](https://picsum.photos/seed/geekslides-after/800/600)

::: Notes
**layout-grid.mod-cols-2 (2 images)** — two images fill the entire row.
:::

[](.layout-team#team-six)

### Engineering Team

![Alice](https://picsum.photos/seed/geekslides-alice/400/400)

![Bob](https://picsum.photos/seed/geekslides-bob/400/400)

![Carol](https://picsum.photos/seed/geekslides-carol/400/400)

![Dan](https://picsum.photos/seed/geekslides-dan/400/400)

![Eve](https://picsum.photos/seed/geekslides-eve/400/400)

![Frank](https://picsum.photos/seed/geekslides-frank/400/400)

::: Notes
**layout-team (6 images)** — images resize and wrap automatically.
Compare with the 4-person and 2-person team slides.
:::

[](#code-example)

### Per-Slide Style Override

\`\`\`css
/* Inside your markdown — scoped to this slide only */
<style>
section.content { background: #1a1a2e; color: #eee; }
h3 { color: #e94560; }
</style>
\`\`\`

::: Notes
**Default layout with code** — no layout class. Works well for
code samples, CLI output, or configuration snippets.
You can also embed a real \`<style>\` tag to override this slide's look.
:::

[](#blockquote-slide)

### What People Say

> "GeekSlides changed how our team communicates technical ideas.
> We went from spending hours in design tools to minutes in Markdown."
>
> — **Engineering Lead, Acme Corp**

::: Notes
**Default layout with blockquote** — great for testimonials or
key quotes from customers, users, or articles.
:::

[](#closing)

### Thank You

> The best presentations are written, not designed.

Get started today:

\`\`\`bash
npx @geekslides/cli create --title "My Next Talk"
\`\`\`

::: Notes
**Default layout** — no layout class needed. Works well for closing
slides, Q&A prompts, or simple text content.
:::

[](.layout-blank#whiteboard)

::: Notes
**layout-blank** — empty canvas. Use the whiteboard feature (\`W\` key)
to draw on this slide during your presentation.
:::
`;
}

/**
 * Write the universal scaffold assets (.gitignore, AGENTS.md, Copilot skills)
 * into the deck directory. These files are written regardless of whether the
 * deck was created from the built-in template or a GitHub deck template.
 */
async function writeScaffoldAssets(dir: string, title: string): Promise<void> {
  const slug = dir.replace(/\\/g, '/').split('/').pop() ?? dir;

  // .gitignore
  await writeFile(join(dir, '.gitignore'), GITIGNORE_CONTENT, 'utf-8');

  // AGENTS.md — AI-agent guidance document for this deck
  const agentsMd = AGENTS_MD_TEMPLATE
    .replaceAll('%%TITLE%%', title)
    .replaceAll('%%DIR%%', slug);
  await writeFile(join(dir, 'AGENTS.md'), agentsMd, 'utf-8');

  // .copilot/skills/ — Copilot skill scripts for common deck tasks
  const skillsDir = join(dir, '.copilot', 'skills');
  await mkdir(skillsDir, { recursive: true });
  await writeFile(join(skillsDir, 'add-slide.md'), SKILL_ADD_SLIDE, 'utf-8');
  await writeFile(join(skillsDir, 'export-pdf.md'), SKILL_EXPORT_PDF, 'utf-8');
  await writeFile(join(skillsDir, 'update-theme.md'), SKILL_UPDATE_THEME, 'utf-8');
}

/** Patch the title field in a config.json without altering other fields. */
async function patchConfigTitle(configPath: string, title: string): Promise<void> {
  const raw = await readFile(configPath, 'utf-8');
  const config = JSON.parse(raw) as Record<string, unknown>;
  config['title'] = title;
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

type CreateOpts = {
  title: string;
  dir?: string;
  git: boolean;
  theme?: string;
  template?: string;
  listTemplates: boolean;
  repo: string;
  ref: string;
};

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new presentation')
    .requiredOption('--title <string>', 'Presentation title')
    .option('--dir <path>', 'Target directory (default: slugified title)')
    .option('--no-git', 'Skip git init')
    .option(`--theme <name>`, `Built-in theme (default: default). Available: ${THEME_NAMES.join(', ')}`)
    .option('--template <name>', 'Bootstrap from a GitHub deck template (see --list-templates)')
    .option('--list-templates', 'List available GitHub deck templates and exit', false)
    .option('--repo <owner/repo>', 'GitHub repository to fetch templates from', DEFAULT_REPO)
    .option('--ref <branch>', 'Git ref (branch/tag/SHA) for template fetching', DEFAULT_REF)
    .action(async (opts: CreateOpts) => {
      // --list-templates: print available templates and exit
      if (opts.listTemplates) {
        try {
          const names = await listGithubTemplates(opts.repo, opts.ref);
          if (names.length === 0) {
            console.log('No deck templates found in the repository.');
          } else {
            console.log('Available deck templates:');
            for (const name of names) {
              console.log(`  ${name}`);
            }
          }
        } catch (err) {
          console.error(`Failed to list templates: ${String(err)}`);
          process.exit(1);
        }
        return;
      }

      const slug = opts.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const dir = opts.dir ?? slug;

      console.log(`Creating presentation: ${opts.title}`);

      if (opts.template) {
        // ── GitHub template path ──────────────────────────────────────────
        try {
          await downloadGithubTemplate(opts.template, dir, opts.repo, opts.ref);
        } catch (err) {
          console.error(`Failed to download template "${opts.template}": ${String(err)}`);
          process.exit(1);
        }

        // Patch the title in the downloaded config.json
        const configPath = join(dir, 'config.json');
        try {
          await patchConfigTitle(configPath, opts.title);
        } catch {
          // config.json may not exist in all templates — that's fine
        }

        await writeScaffoldAssets(dir, opts.title);

        if (opts.git) {
          try {
            await execFileAsync('git', ['init', dir]);
            console.log('  Git repository initialized');
          } catch {
            console.log('  Git init skipped (git not available)');
          }
        }

        console.log(`  Created: ${dir}/  (from template: ${opts.template})`);
        log.debug({ dir, title: opts.title, template: opts.template }, 'presentation scaffolded from template');
      } else {
        // ── Built-in scaffold path ────────────────────────────────────────
        const themeName = opts.theme ?? 'default';
        const theme = findTheme(themeName);
        if (!theme) {
          console.error(`Unknown theme: "${themeName}". Available themes: ${THEME_NAMES.join(', ')}`);
          process.exit(1);
        }

        await mkdir(join(dir, 'images'), { recursive: true });
        await mkdir(join(dir, 'css'), { recursive: true });

        const themeFileName = `theme-${theme.name}.css`;

        // config.json — layout + theme + local overrides
        // The template uses explicit []() separators, so disable the header
        // preprocessor that would auto-split on every heading.
        const config = {
          title: opts.title,
          content: 'README.md',
          styles: ['css/layouts.css', `css/${themeFileName}`, 'css/local.css'],
          features: ['whiteboard', 'whiteboard-canvas'],
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

        // css/theme-<name>.css — chosen color/typography theme
        await writeFile(join(dir, 'css', themeFileName), theme.css, 'utf-8');

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

        await writeScaffoldAssets(dir, opts.title);

        if (opts.git) {
          try {
            await execFileAsync('git', ['init', dir]);
            console.log('  Git repository initialized');
          } catch {
            console.log('  Git init skipped (git not available)');
          }
        }

        console.log(`  Created: ${dir}/`);
        console.log(`  Files: config.json, README.md, css/{layouts,${themeFileName},local}.css, images/, .gitignore, AGENTS.md`);
        log.debug({ dir, title: opts.title, theme: theme.name }, 'presentation scaffolded');
      }
    });
}
