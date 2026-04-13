# Presentation Format & Authoring Guide

## How presentations are structured

Each presentation lives in its own Git repository (or directory), containing:

```
my-presentation/
├── config.json         Configuration for the engine
├── README.md           Slide content (markdown) — readable on GitHub!
├── local.css           Presentation-specific styling
├── images/             Media assets
│   ├── photo.jpg
│   └── icon.svg
└── demos/              (optional) Live coding materials
```

The key insight: **`README.md` is both the presentation content AND
a readable GitHub document**. The slide metadata is encoded in invisible
markdown links.

## Real-world example: `slides-cuatro-cosas-aws`

Repository: https://github.com/ciberado/slides-cuatro-cosas-aws

```
slides-cuatro-cosas-aws/
├── .devcontainer/      Dev container for live demos
├── demos/              Demo instructions and scripts
├── images/             SVG icons, PNG photos
├── config.json         Engine configuration
├── README.md           All slide content
├── local.css           Custom typography + layout
├── Dockerfile          Dev environment (Docker-in-Docker, Tailscale, etc.)
└── cuatro-cosicas-aws.pdf  Pre-exported PDF
```

Its `config.json`:
```json
{
  "content": ["README.md"],
  "styles": ["local.css"],
  "resolution": "1920x1080",
  "liveReload": true,
  "slideWhiteBoards": false,
  "preprocessors": ["headerPreprocessor"],
  "processors": [],
  "scripts": []
}
```

Notable choices:
- `content: ["README.md"]` — the GitHub README **is** the slideshow
- `"headerPreprocessor"` — auto-generates slide separators from `##` headers
- `liveReload: true` — edit README, browser updates automatically
- `slideWhiteBoards: false` — no per-slide whiteboards
- Custom `1920x1080` resolution (instead of preset ratio)
- Empty `processors` — relies only on preprocessor-generated sections

---

## config.json — full schema reference

```jsonc
{
  // CONTENT
  "content": "content.md",
  // String: single markdown file path (relative to presentation base URL)
  // String[]: array of markdown files, concatenated in order
  // null: generates synthetic slides from SVG images (Slide1.SVG, Slide2.SVG, ...)

  // STYLES
  "styles": "css/theme.css",
  // String or String[]: CSS files to load into the page
  // Relative paths are resolved against the presentation base URL
  // Absolute URLs (http://...) are loaded as-is

  // RESOLUTION
  "resolution": "16:9",
  // "16:9" → 1920×1080 (default)
  // "4:3"  → 960×720
  // "1:1"  → 1080×1080
  // "WxH"  → custom resolution (e.g. "1920x1080")

  // PREPROCESSORS (run on raw markdown text, before markdown-it)
  "preprocessors": ["headerPreprocessor"],
  // String[]: function names from SlideshowController scope
  // Available built-ins:
  //   "headerPreprocessor"                  — auto-section anchors from ## headers
  //   "threeEmptyLinesSlicerPreprocessor"   — 3 blank lines → slide separator
  //   "emptyLineSeparatorPreprocessor"      — blank line → HTML comment (preserve spacing)

  // PROCESSORS (run on each <section> element after DOM insertion)
  "processors": [
    "hiddenSlidesProcessor",
    "bgUrlProcessor",
    "bgColorProcessor",
    "footnotesProcessor",
    "chartProcessor",
    "iframeProcessor"
  ],
  // String[]: function names from SlideshowController scope
  // Available built-ins:
  //   "hiddenSlidesProcessor"   — removes .hidden slides
  //   "bgUrlProcessor"         — data-bgurl → CSS background image
  //   "bgColorProcessor"       — data-bgcolor → CSS background color
  //   "footnotesProcessor"     — moves footnotes to slide's .slide-notes
  //   "chartProcessor"         — data-chart → Chart.js visualization
  //   "iframeProcessor"        — data-iframe → embedded <iframe>
  //   "partializeProcessor"    — adds .partial to slides with lists

  // SCRIPTS
  "script": "custom.js",     // single JS module to load
  "scripts": ["a.js", "b.js"], // multiple JS modules

  // BEHAVIOR
  "liveReload": false,        // poll content for changes (1s interval)
  "slideWhiteBoards": true    // attach drawing canvas to each slide
}
```

---

## Markdown slide conventions

### Slide separators — the empty link

```markdown
[](#slide-id,.class1,.class2,bgurl(image.png),bgcolor(#f0f0f0))
```

This renders as an invisible empty link in GitHub/GitLab but is decoded by
the engine into:

```html
<section id="slide-id" class="class1 class2 bgurl bgcolor"
         data-bgurl="image.png" data-bgcolor="#f0f0f0">
```

#### Separator attribute syntax

| Token | Result |
|---|---|
| `#my-id` | `id="my-id"` |
| `.my-class` | `class="... my-class"` |
| `bgurl(url)` | `data-bgurl="url"` + `class="... bgurl"` |
| `bgcolor(color)` | `data-bgcolor="color"` + `class="... bgcolor"` |
| `chart(options)` | `data-chart="options"` + `class="... chart"` |
| `iframe(url)` | `data-iframe="url"` + `class="... iframe"` |

Multiple attributes are comma-separated:
```markdown
[](#intro,.title,.coverbg,bgurl(hero.jpg),bgcolor(navy))
```

#### Minimal separator (empty)

```markdown
[]()
```

Creates a `<section>` with no id, classes, or attributes.

### Auto-generated separators (`headerPreprocessor`)

When `headerPreprocessor` is enabled, `##` and `###` headers automatically
get a slide separator inserted above them (if not already present):

```markdown
## My Great Topic        ←  headerPreprocessor inserts [](#my-great-topic,.default) above

Some content here.

### Sub-point             ←  [](#sub-point,.default) inserted above
```

The id is derived from the first 30 characters of the header text (lowercase,
alphanumeric, spaces → hyphens). Duplicate ids get a line-number suffix.

### Three empty lines separator (`threeEmptyLinesSlicerPreprocessor`)

Three consecutive blank lines in the markdown are converted to slide separators:

```markdown
Content of slide 1


                          ← three blank lines → becomes []()

Content of slide 2
```

### Speaker notes

Use the `::: Notes` container:

```markdown
[](#my-slide)

## Title

Main content here.

::: Notes

These notes are only visible in speaker mode (S key).
They are hidden in presentation mode via `.slide-notes { display: none }`.

:::
```

### Partials (incremental reveal)

Add `.partial` to the slide separator:

```markdown
[](.partial)

## Features

* First point       ← hidden initially
* Second point      ← revealed on next click
* Third point       ← revealed on next click
```

Each `gotoNextSlide()` call reveals one `<li>` (or `<tr>` in tables) until
all are shown, then advances to the next slide.

Items inside `::: Notes` blocks are excluded from partial counting.

### Background images

```markdown
[](.coverbg)

## Title

![Alt text](images/background.jpg)
```

Combined with CSS, the first image in a `.coverbg` slide covers the full slide
as a background. This works because `bgUrlProcessor` sets the data attribute,
and the theme CSS (like `local.css`) positions `.block-image:nth-of-type(1) img`
as `position: absolute; width: 100%; object-fit: cover`.

Alternatively, use the `bgurl()` attribute directly:

```markdown
[](bgurl(images/background.jpg))

## Title
```

### Charts

```markdown
[](#revenue,.chart,chart(type: line, netflix: red, blockbuster: blue))

### Streaming Revenue

| Year | Netflix | Blockbuster |
|------|---------|-------------|
| 2007 | 1200    | 5500        |
| 2008 | 1500    | 5000        |
| 2009 | 2000    | 4000        |
```

The `chartProcessor` converts the table into a Chart.js line chart. With
`.partial`, data rows are revealed one at a time with animation.

Footnote images in table cells become animated datacards.

### Video slides

```markdown
[](.bigvideo.partial)

### Demo recording

![](demo.mp4)

* 00:00 Introduction
* 00:05 First step
* 00:15 Second step
```

Each partial reveals a list item and plays the video from that timestamp
to the next. The video element is created from the `.mp4` image link
(the engine detects video extensions and converts `<img>` to `<video>`).

### Iframes

```markdown
[](iframe(https://example.com))

### Live Demo
```

The `iframeProcessor` injects an `<iframe>` and a "next slide" button.
The `lockNextSlide` mechanism prevents keyboard navigation from leaving
the iframe slide accidentally.

### Hidden slides

```markdown
[](.hidden)

## This slide won't appear

Draft content here.
```

Removed from DOM by `hiddenSlidesProcessor`.

### Succession (instant replacement)

```markdown
[](.succession)

## Replaces previous slide instantly
```

The `.succession` class disables the CSS transition, making the slide swap
instantaneous (no slide-in animation).

### Content groups

```markdown
::: ...

Grouped content

:::
```

Triple dots create a `<div class="content-group">` container. Other names
create divs with that name as class: `::: sidebar` → `<div class="sidebar">`.

---

## CSS theming

Presentations include a `local.css` (or theme CSS via `config.styles`) that
builds on top of `minislides.css`. Common patterns:

```css
/* Base typography */
body { font-family: "Open Sans", system-ui; font-size: 40pt; }

/* Slide backgrounds */
.slidedeck section { background-color: white; }

/* Cover slides: first image becomes background */
section.coverbg .block-image:nth-of-type(1) img {
  position: absolute; top: 0; z-index: -10;
  width: 100%; object-fit: cover;
}

/* Illustration layout: image left, content right */
section.illustration > *:not(.block-image:nth-of-type(1)) {
  margin-left: 50%;
}
section.illustration .block-image:nth-of-type(1) {
  width: 45%; height: 100%; position: absolute; top: 0;
}
```

The `demo/` directory includes a theme called **Alyssum** (`css/alyssum.css` +
`scss/alyssum.scss`) as a reference theme.

---

## Typical authoring workflow

1. **Create a new repo** with `README.md`, `config.json`, `local.css`, `images/`
2. **Write slides** in `README.md` using the empty-link separator convention
3. **Preview on GitHub** — the markdown is readable as a regular document
4. **Run locally**:
   ```bash
   # In the geekslides repo
   npm run install && npm run start
   # Open http://localhost:1234/?url=https://raw.githubusercontent.com/user/repo/main/
   ```
   Or with `liveReload: true`, edit and see changes instantly.
5. **Present**:
   - Use keyboard shortcuts (→ next, ← prev, S speaker, W whiteboard)
   - Press J to join an MQTT room for remote sync
   - Press E to start emitting position
6. **Export PDF** with `gs2pdf` tool
7. **Commit PDF** alongside the markdown for offline distribution

### Loading a presentation

The engine resolves presentation URLs in this priority:
1. `?url=<base-url>` query parameter
2. Same URL as the page (fetches `config.json` from current location)

The base URL must point to a directory containing `config.json`. The engine
fetches `<base-url>/config.json`, then resolves all paths relative to it.
