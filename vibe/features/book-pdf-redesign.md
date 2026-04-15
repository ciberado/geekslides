# Book PDF Redesign

**Status**: In progress  
**Date started**: April 2026

## Goal

Transform the `book` PDF output from a slide-screenshot dump into something that reads like
a real reference document — structured around semantic headings, flowing prose, and inline
imagery rather than slide thumbnails.

---

## Design decisions

### Heading hierarchy maps to document structure

Slides are already written with a 3-level heading discipline:

| Slide heading | Role in book |
|---|---|
| `# h1` | Chapter opener — full-page treatment, `page-break-before` |
| `## h2` | Section heading |
| `### h3` (or deeper) | Content subsection — the typical "leaf" slide |

The heading text is extracted from `slide.html` via a simple regex and promoted into the
document outline as a real HTML heading (`<h1>`/`<h2>`/`<h3>`).

### Slide content comes from the `:::Details` block

`slide.html` is the *presentation* content (terse, punchy).  
`slide.detailsHtml` is the *reading* content (prose, extra context).  
The book uses **`detailsHtml`** as the page body, which is the right choice for a document.

### Slides without details follow per-level rules

| Level | No details → |
|---|---|
| h1 | Include as a chapter-opener page (heading only, no body) |
| h2 | Include as a subtle section-separator heading |
| h3 (or no heading) | **Skip** — a terse content slide with no explanation adds nothing to the book |

### Images float to the right

Instead of placing the slide screenshot, the book extracts any image that the *slide itself*
uses (as a visual aid, diagram, or decorative element):

1. First `<img>` found in `slide.html`
2. Fallback: `backgroundImage` field (`bgurl(...)` syntax in the separator marker)
3. No more fallback — if neither exists, the page has no image (text only)

Images are **only shown when the slide has details** (so separator pages stay clean).  
They are always floated **right** (avoiding the left-margin alignment problem with lists that
the user highlighted).

**Default width**: 25 % of the text column, configurable via `--book-image-width <n>`.

Paths are resolved relative to the deck's config directory and converted to `file://` URLs
for the assembly HTML.

### Chapter openers (h1)

- `page-break-before: always` for every h1 except the first visible one.
- Large prominent heading with a coloured bottom border.
- Body (detailsHtml) rendered below if present, with image floated right.

### Section separators (h2, no details)

- Styled `<h2>` with a subtle bottom border — no body, no image.
- Creates visual rhythm without consuming a full page.

### Section entries (h2 with details, h3 with details)

- Heading followed by body text.
- Image floated right if available.
- `page-break-inside: avoid` kept where possible.

### Typography

- Body: **Georgia** (serif) — more book-like than the system sans-serif used in slides-details.
- Line height: 1.65 — comfortable for longer prose.
- Page margins: 20 mm sides, 20 mm top, 25 mm bottom (matches notes format).
- A4 portrait.

---

## Implementation

### Modified files

- `packages/cli/src/commands/pdf.ts`
  - **New helpers** (after `escapeHtml`):
    - `extractHeadingFromHtml(html)` → `{ level, innerHtml } | null`
    - `resolveImageToFileUrl(src, deckDir)` → file:// URL string
    - `extractFirstBookImage(slide, deckDir)` → file:// URL string | null
  - **Rewritten** `buildBookPdfHtml(slides, title, deckDir, imageWidthPct)` — signature drops
    `screenshotPaths` (screenshots are still captured for other formats but unused here)
  - `generatePdf` gains two optional tail params: `deckDir` and `bookImageWidth`
  - CLI command: new `--book-image-width <percent>` option (default 25)

### `buildBookPdfHtml` logic sketch

```
masthead: config.title in small, subtle top-of-page text

for each slide:
  extract heading → level (default 4 if none)
  extract first image from slide.html or backgroundImage
  
  level === 1:
    append chapter section (page-break-before except first)
    include details + image if detailsHtml present
  
  level === 2 && !detailsHtml:
    append separator section (h2 heading only, no image)
  
  level === 2 && detailsHtml:
    append section (h2 heading + details + image)
  
  level >= 3:
    if !detailsHtml → skip
    append subsection (h3 heading + details + image)
```

---

## Open questions / future work

- Should inline `<code>` blocks inside details use a monospace serif (e.g. Courier New)?
  Currently yes — might look dated; could switch to a monospace sans-serif.
- Configuring the book colour scheme per-deck (via config.json `bookTheme` key) could be
  a nice follow-up.
- The `book-masthead` (deck title header) could optionally be suppressed if the first slide
  is an h1 that duplicates the deck title.
- Image cropping: very wide images (e.g. screenshots, wide diagrams) at 25 % width could
  look fine, but very tall/narrow images might look odd. A `max-height` CSS clamp may help.

## Mermaid diagrams

Mermaid is **not currently supported** in the engine. The behaviour depending on authoring approach:

| Approach | Book result |
|---|---|
| Pre-exported SVG/PNG referenced with `![](diagram.png)` | **Works today** — `extractFirstBookImage` picks up the `<img>` from `slide.html` |
| ` ```mermaid ``` ` fenced block in slide markdown | Rendered as a raw `<pre><code>` block — diagram is NOT rendered; appears as code text |
| Mermaid rendered live in the presentation | Would require a mermaid engine plugin that converts fenced blocks to `<img>` or inline `<svg>` at parse time; the book would then pick it up automatically |

Until a mermaid plugin exists, the recommended workaround is to export diagrams as image files and reference them via standard markdown image syntax.
