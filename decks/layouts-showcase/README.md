[](.layout-title#showcase-title)

# GeekSlides

## Layout Showcase

::: Notes
The `layout-title` class centers content vertically and horizontally, creating a
clean title card. Use it for opening and closing slides. The slide marker syntax
is `[](.class#id)` — the class controls layout, the id enables deep-linking.
:::

[](.slide#default-slide)

### Default Slide

Standard markdown-to-slide. No layout class needed.

- Heading levels map to h1–h4
- Lists become `<ul>` / `<ol>`
- Code blocks, tables, and blockquotes all work
- Images wrap in `.block-image`

::: Notes
The default slide needs no layout class — just write markdown. GeekSlides converts
standard markdown elements (headings, lists, code, tables, blockquotes, images) into
well-styled slide content. Use `.slide` explicitly or omit the class entirely.
:::

[](.layout-two-col#two-col)

### Two Columns

- Left column item A
- Left column item B
- Left column item C

#### Right Column

- Right column item A
- Right column item B
- Right column item C

::: Notes
`layout-two-col` splits the slide into two equal columns using CSS Grid. Content
before the first `#### heading` goes into the left column; content after goes right.
The h4 heading acts as the column separator and is rendered as a right-column title.
:::

[](.layout-img-text#img-text)

### Image + Text

![Cityscape](img/placeholder.svg)

- CSS Grid: image left, content right
- Optional `### heading` spans both columns
- Multiple lists and paragraphs stack in the right cell

::: Notes
`layout-img-text` places an image on the left and text on the right using CSS Grid.
The first image becomes the left column content; everything else flows into the right.
The optional h3 heading spans both columns as a full-width title above the split.
:::

[](.layout-img-text-bleed#img-bleed)

![Abstract](img/placeholder.svg)

### Full-Bleed Image

Image extends to the slide edge — no padding on the left.

- More dramatic than `layout-img-text`
- Good for full-height photography

::: Notes
`layout-img-text-bleed` is like `layout-img-text` but removes left padding so the
image extends to the slide edge. This creates a more dramatic visual impact, ideal
for full-height photography or hero images that need maximum visual presence.
:::

[](.layout-cover.mod-coverbg#cover,bgurl(img/placeholder.svg))

# Full-Bleed Cover

## Background image with overlay text

::: Notes
`layout-cover` with `mod-coverbg` fills the entire slide with a background image.
The `bgurl(...)` parameter in the slide marker sets the image URL. Text overlays
appear on top with a semi-transparent scrim for readability. Great for section
openers and dramatic visual breaks.
:::

[](.layout-section#section-break)

## Section Break

### Coming Up Next

::: Notes
`layout-section` creates a bold divider section typically a large heading centered 
on a contrasting background. Use it to signal a major topic transition. It visually
breaks the flow so the audience knows a new section is starting.
:::

[](.layout-three-col#three-col)

### Three-Column Cards

#### 🚀 Ship Fast

Deploy to production with a single command from your terminal.

#### 🔍 Observe

Real-time metrics, logs, and distributed traces in one view.

#### 🔄 Iterate

Instant feedback loops keep your team moving without friction.

::: Notes
`layout-three-col` arranges content into three equal-width columns. Each h4 heading
starts a new column, making it natural to present three related concepts side-by-side.
Ideal for feature highlights, comparison cards, or team role descriptions.
:::

[](.layout-features#features)

### Key Features

#### ⚡ Fast

Processes over one million events per second on commodity hardware.

#### 🔒 Secure

End-to-end encryption with zero-knowledge key management.

#### 📦 Simple

One-line install. No daemons, no agents, no configuration files.

#### 🌐 Global

Fifty edge locations across six continents for ultra-low latency.

::: Notes
`layout-features` displays items in a responsive grid of cards. Each h4 heading
creates a new card with an icon/title and description. The grid auto-adjusts to
2, 3, or 4 columns depending on the number of items. Best for feature lists,
benefit summaries, or value propositions.
:::

[](.layout-quote#quote)

> "Programs must be written for people to read, and only incidentally for machines to execute."

#### — Harold Abelson, SICP

::: Notes
`layout-quote` styles a blockquote prominently with large italicized text and
an attribution line below. Use it for impactful quotations that deserve their own
slide. The h4 below the blockquote becomes the citation/author line.
:::

[](.layout-big-stat#big-stat)

### 99.99 %

Uptime across all production regions, last twelve months

::: Notes
`layout-big-stat` renders the heading as a massive number/metric with supporting
text below in smaller type. Perfect for KPIs, achievements, or any single data
point you want to make unforgettable. The h3 becomes the hero number.
:::

[](.layout-timeline#timeline)

### Delivery Roadmap

1. **Plan** — Define scope, write specs, align stakeholders.
2. **Build** — Implement features in two-week sprints.
3. **Test** — Automated CI + manual exploratory QA.
4. **Ship** — Blue/green deploy with instant rollback.

::: Notes
`layout-timeline` displays an ordered list as a visual timeline with connected
steps. Each numbered item becomes a milestone node. Ideal for roadmaps, processes,
or any sequential workflow where you want to emphasize progression.
:::

[](.layout-compare#compare)

### Old Way vs New Way

- Slow manual deploys
- No observability
- Siloed teams
- Days to onboard

#### vs

- One-click releases
- Full-stack tracing
- Shared dashboards
- Minutes to onboard

::: Notes
`layout-compare` splits the slide into two opposing columns separated by a "vs"
divider. Content before `#### vs` goes on the left (typically the "before" or
"old" state); content after goes on the right (the "after" or "new" state).
Great for before/after comparisons and competitive positioning.
:::

[](.layout-chart#chart)

### Quarterly Revenue

| Quarter | ARR (M) | Growth |
|---------|--------:|-------:|
| Q1 2024 | $4.2    | —      |
| Q2 2024 | $5.8    | +38 %  |
| Q3 2024 | $7.4    | +28 %  |
| Q4 2024 | $9.1    | +23 %  |

::: Notes
`layout-chart` is optimized for data-heavy tables. It gives the table maximum
width, uses monospace numbers for alignment, and adds zebra striping for
readability. Use it whenever a markdown table is the primary slide content.
:::

[](.layout-team#team)

### Meet the Team

- ![Ada](img/placeholder.svg)
  **Ada Lovelace**
  Chief Architect

- ![Alan](img/placeholder.svg)
  **Alan Turing**
  Head of Algorithms

- ![Grace](img/placeholder.svg)
  **Grace Hopper**
  VP Engineering

::: Notes
`layout-team` renders a list of people as profile cards — each with a photo,
name, and role. Each list item contains an image, a bold name, and a plain-text
title. The layout arranges them in a responsive row of cards.
:::

[](.layout-grid#gallery)

### Image Gallery

![Alpha](img/placeholder.svg)

![Beta](img/placeholder.svg)

![Gamma](img/placeholder.svg)

![Delta](img/placeholder.svg)

::: Notes
`layout-grid` arranges images in an auto-fitting grid. The number of columns
adjusts based on the image count. Use it for photo galleries, logo showcases,
or any set of visual assets that should be displayed as equal-sized tiles.
:::

[](.layout-table#data-table)

### Performance Benchmarks

| Service     | P50 (ms) | P95 (ms) | P99 (ms) | Error % |
|-------------|:--------:|:--------:|:--------:|--------:|
| Auth        | 4        | 12       | 28       | 0.01    |
| Search      | 18       | 55       | 110      | 0.05    |
| Checkout    | 42       | 98       | 210      | 0.12    |
| Recommend   | 7        | 22       | 48       | 0.02    |

::: Notes
`layout-table` maximizes table readability with full-width styling, aligned columns,
and clear cell borders. Distinct from `layout-chart` — this one emphasizes raw
tabular data without chart-like visual treatment. Good for benchmarks and specs.
:::

[](.layout-agenda#agenda)

### Today's Agenda

1. **09:00** — Welcome & context-setting
2. **09:30** — Architecture deep-dive
3. **10:30** — Live demo
4. **11:15** — Q & A

::: Notes
`layout-agenda` styles an ordered list as a schedule with bold time stamps and
descriptions. Each item gets clear visual separation. Use at the start of a
presentation to set expectations or as a mid-talk roadmap check-in.
:::

[](.layout-blank#blank)

::: Notes
`layout-blank` produces an empty slide — no heading, no content. Use it as a
visual pause, a deliberate breathing moment, or a placeholder for live demos
where you switch to another window.
:::

[](.layout-title#thank-you)

# Thank You

## geekslides.io

::: Notes
Reuses `layout-title` as a closing slide. The centered layout with minimal
content makes a clean sign-off. Include a URL or call-to-action so the
audience knows where to follow up.
:::
