# Print & PDF Generation (Playwright Chromium)

## Overview

v2 renders a flat print HTML document and exports it to PDF through **Playwright using
Chromium's `page.pdf()`**. This keeps output aligned with browser rendering, preserves vector
text, and supports slide-oriented and reading-oriented layouts.

## Output Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **Slides PDF** | One slide per page, no notes | Sharing deck, printing handouts |
| **Slides + Notes PDF** | Each page: slide on top, speaker notes below | Speaker reference |
| **Slides + Details PDF** | Each page pairs a slide thumbnail with the authored `::: Details` content | Reading handout, appendix, asynchronous review |
| **Book PDF** | Flowing document: slides with expanded notes/details as paragraphs | Reading material, course handout |

## Architecture

```
config.json + README.md
        │
        ▼
┌──────────────────────────────┐
│  @geekslides/engine          │
│  SlideParser.parse()         │
│  PluginManager.preprocess()  │
│  PluginManager.process()     │
└──────────────┬───────────────┘
               │
               ▼
        SlideData[]
               │
               ▼
┌──────────────────────────────┐
│  PrintRenderer               │
│                              │
│  Input: SlideData[]          │
│  Template: slides.html |     │
│           slides-notes.html |│
│           book.html          │
│                              │
│  Output: flat HTML string    │
│  (no Shadow DOM, no Custom   │
│   Elements, no JavaScript)   │
└──────────────┬───────────────┘
               │
               ▼
        Flat HTML + CSS
               │
               ▼
┌──────────────────────────────┐
│  Playwright / Chromium       │
│  (headless browser)          │
│                              │
│  page.goto(file://...)       │
│  page.pdf({...})             │
└──────────────────────────────┘
               │
               ▼
          output.pdf
```

## Why Chromium `page.pdf()` over Screenshot Pipelines

| Aspect | v1 (Playwright → PDFKit) | v2 (Playwright Chromium `page.pdf()`) |
|--------|--------------------------|-----------------|
| Text | Rasterized screenshots | Vector text (searchable, copyable) |
| File size | Large (images) | Small to moderate, depends on embedded assets |
| Quality | Fixed resolution | Browser print engine, vector where possible |
| Page breaks | Screenshot-per-slide (implicit) | CSS `@page` rules with browser print behavior |
| Speaker notes | Not supported | Full support in templates |
| Details handout | Not supported | Dedicated `slides-details` layout |
| Book format | Not supported | Flowing document layout |
| Custom CSS | Limited | Closest match to author-facing browser CSS |
| Code blocks | Rasterized | Real text rendered by Chromium |
| Dependencies | Playwright + Chromium (~400MB) | Playwright + Chromium (~400MB) |

## PrintRenderer

The `PrintRenderer` takes parsed slides and produces a flat HTML document suitable for
browser print export. Key constraint: **no Shadow DOM or Custom Elements in the print DOM**.

`PrintRenderer` (in `packages/engine/src/print/PrintRenderer.ts`) accepts a `PrintOptions` object that can include extra author CSS plus details-layout options for the `slides-details` export.

The `render(slides, options)` method:

1. Loads the HTML template file matching the selected format.
2. Builds the print CSS based on options.
3. Renders slides differently based on template:

   - **Slides**: Each slide becomes a `<section class="gs-print-slide">` with its CSS classes, id, and background styles. Scoped CSS is included in an inline `<style>` tag. Content goes in a `.gs-print-slide-content` div.

   - **Slides + Notes**: Each slide gets a wrapper `<section class="gs-print-slide-with-notes">` containing the slide (same as above) plus an `<aside class="gs-print-notes">` with the speaker notes HTML.

       - **Slides + Details**: Each page contains a slide thumbnail plus rendered `::: Details` content, with horizontal or vertical layout variants.

       - **Book**: Each slide becomes an `<article class="gs-book-chapter">` containing a `<figure class="gs-book-slide">` with the slide content, followed by flowing reading text.

4. Returns the complete HTML by substituting `{{title}}`, `{{styles}}`, and `{{content}}` placeholders in the template. Titles are HTML-escaped (`&`, `<`, `>` entities).

## Print CSS

The print stylesheet (`packages/engine/src/print/print.css`) defines three named page contexts:

**Slides PDF** (`@page slides`): Page size is 254 mm × 142.9 mm (16:9 landscape) with zero margins. Each `.gs-print-slide` fills the full page, uses flexbox to center content, has 2 rem padding, and triggers `page-break-after: always` (except the last one).

**Slides + Notes PDF** (`@page slides-notes`): A4 portrait with 15 mm margins. The `.gs-print-slide-with-notes` wrapper breaks after each page. The slide occupies ~55% of the page height inside a bordered box with `page-break-after: avoid` to keep slide and notes together. Notes use 0.9 rem font, 1.5 line height, dark text.

**Book PDF** (`@page book`): A4 portrait with 20 mm margins and a page number counter in the bottom center (10 pt, gray). Each `.gs-book-chapter` avoids page breaks within. The slide is shown in a bordered, padded box with light background (#fafafa). Notes are set in justified body text (1 rem, 1.6 line height).

**Shared rules**: All `[partial]` elements are forced visible (`visibility: visible !important`) since there's no navigation in print. Code blocks (`pre`) get light background, padding, border-radius, and `page-break-inside: avoid`. Images are constrained to `max-width: 100%`. Tables use `border-collapse: collapse`, full width, and avoid page breaks within.

## HTML Templates

Print templates live in `packages/engine/src/print/templates/` and are selected by the render format.

- **slides.html**: A standard HTML5 document with `{{title}}` in the `<title>` tag, `{{styles}}` in a `<style>` block in the head, and `{{content}}` in the `<body class="gs-print gs-print-slides">`.

- **slides-notes.html**: Same structure but with body class `gs-print gs-print-slides-notes`, title suffixed with " — Speaker Notes", and an `<h1>{{title}}</h1>` header before the content.

- **slides-details.html**: Body class for the details handout layout, with page content that pairs each slide preview with rendered detail text.

- **book.html**: Body class `gs-print gs-print-book`, with a cover page header `<h1>{{title}}</h1>` inside a `.gs-book-cover` wrapper before the content.

## CLI Integration

The `pdf` command (`packages/cli/src/commands/pdf.ts`) takes a config path, output format, and output PDF path. It:

1. Loads `config.json` and the referenced markdown file.
2. Parses and preprocesses the markdown using `SlideParser` and `PluginManager` with built-in plugins.
3. Renders to flat HTML via `PrintRenderer` with the selected template and title from config.
4. Writes the HTML to a temporary file in a system temp directory.
5. Launches Chromium through Playwright.
6. Opens the generated HTML file with `page.goto(file://...)`.
7. Calls `page.pdf()` with `preferCSSPageSize: true` and `printBackground: true`.
8. Writes the requested primary PDF and, unless the primary format is already `slides-details`, writes a companion `-details.pdf`.
9. Cleans up the temp HTML unless `--no-cleanup` is set.

### CLI Usage

- `npx geekslides pdf --config config.json --format slides -o slides.pdf`
- `npx geekslides pdf --config config.json --format slides-notes -o notes.pdf`
- `npx geekslides pdf --config config.json --format slides-details -o details.pdf`
- `npx geekslides pdf --config config.json --format book -o book.pdf`

## Browser Installation

Chromium is required only for PDF generation, not for authoring or presenting.

- **Docker/CI**: Run `npx playwright install chromium` during image build or job setup.
- **Local**: `npx playwright install chromium`

## Browser Print Notes

| CSS Feature | Support | Notes |
|-------------|---------|-------|
| Flexbox | Full | Used for slide centering and notes/details layouts |
| Grid | Good | Available for slide layouts |
| CSS variables | Full | Custom properties work |
| `@page` | Good | Size and margins are respected by Chromium print |
| `page-break-*` | Good | Use together with explicit page-sized wrappers |
| Shadow DOM | None in print DOM | Why the renderer flattens slides for export |
| JavaScript | Available before print | The CLI waits for the page to load before calling `page.pdf()` |
| `background-image` | Full | `printBackground: true` is enabled |
| Web fonts (`@font-face`) | Full | Loaded by Chromium if reachable from the temp HTML |
| `@media print` | Full | Respected by Chromium print |
