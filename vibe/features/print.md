# Print & PDF Generation (WeasyPrint)

## Overview

v2 replaces v1's Playwright-screenshot-to-PDFKit pipeline with **WeasyPrint**, which renders
HTML/CSS directly to PDF. This produces higher quality output (vector text, proper page
breaks) and supports three output formats.

## Output Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **Slides PDF** | One slide per page, no notes | Sharing deck, printing handouts |
| **Slides + Notes PDF** | Each page: slide on top, speaker notes below | Speaker reference |
| **Book PDF** | Flowing document: slides with expanded notes as paragraphs | Reading material, course handout |

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
│  WeasyPrint                  │
│  (Python, invoked via CLI)   │
│                              │
│  weasyprint input.html out.pdf│
└──────────────────────────────┘
               │
               ▼
          output.pdf
```

## Why WeasyPrint over Playwright Screenshots (v1)

| Aspect | v1 (Playwright → PDFKit) | v2 (WeasyPrint) |
|--------|--------------------------|-----------------|
| Text | Rasterized screenshots | Vector text (searchable, copyable) |
| File size | Large (images) | Small (vector) |
| Quality | Fixed resolution | Infinite zoom |
| Page breaks | Screenshot-per-slide (implicit) | CSS `@page` rules (explicit control) |
| Speaker notes | Not supported | Full support in templates |
| Book format | Not supported | Flowing document layout |
| Custom CSS | Limited | Full CSS print support |
| Code blocks | Rasterized | Syntax-highlighted text |
| Dependencies | Playwright + Chromium (~400MB) | WeasyPrint (~50MB Python pkg) |

## PrintRenderer

The `PrintRenderer` takes parsed slides and produces a flat HTML document suitable for
WeasyPrint. Key constraint: **no Shadow DOM, no Custom Elements, no JavaScript**.

`PrintRenderer` (in `packages/engine/src/print/PrintRenderer.ts`) accepts a `PrintOptions` object with: `template` (`'slides'`, `'slides-notes'`, or `'book'`), `title`, optional `theme` (CSS file path), `pageSize` (e.g. `'A4'`, `'Letter'`, `'16:9'`), and `orientation` (`'landscape'` or `'portrait'`).

The `render(slides, options)` method:

1. Loads the HTML template file matching the selected format.
2. Builds the print CSS based on options.
3. Renders slides differently based on template:

   - **Slides**: Each slide becomes a `<section class="gs-print-slide">` with its CSS classes, id, and background styles. Scoped CSS is included in an inline `<style>` tag. Content goes in a `.gs-print-slide-content` div.

   - **Slides + Notes**: Each slide gets a wrapper `<section class="gs-print-slide-with-notes">` containing the slide (same as above) plus an `<aside class="gs-print-notes">` with the speaker notes HTML.

   - **Book**: Each slide becomes an `<article class="gs-book-chapter">` containing a `<figure class="gs-book-slide">` with the slide content, followed by a `<div class="gs-book-notes">` for the notes as flowing body text.

4. Returns the complete HTML by substituting `{{title}}`, `{{styles}}`, and `{{content}}` placeholders in the template. Titles are HTML-escaped (`&`, `<`, `>` entities).

## Print CSS

The print stylesheet (`packages/engine/src/print/print.css`) defines three named page contexts:

**Slides PDF** (`@page slides`): Page size is 254 mm × 142.9 mm (16:9 landscape) with zero margins. Each `.gs-print-slide` fills the full page, uses flexbox to center content, has 2 rem padding, and triggers `page-break-after: always` (except the last one).

**Slides + Notes PDF** (`@page slides-notes`): A4 portrait with 15 mm margins. The `.gs-print-slide-with-notes` wrapper breaks after each page. The slide occupies ~55% of the page height inside a bordered box with `page-break-after: avoid` to keep slide and notes together. Notes use 0.9 rem font, 1.5 line height, dark text.

**Book PDF** (`@page book`): A4 portrait with 20 mm margins and a page number counter in the bottom center (10 pt, gray). Each `.gs-book-chapter` avoids page breaks within. The slide is shown in a bordered, padded box with light background (#fafafa). Notes are set in justified body text (1 rem, 1.6 line height).

**Shared rules**: All `[partial]` elements are forced visible (`visibility: visible !important`) since there's no navigation in print. Code blocks (`pre`) get light background, padding, border-radius, and `page-break-inside: avoid`. Images are constrained to `max-width: 100%`. Tables use `border-collapse: collapse`, full width, and avoid page breaks within.

## HTML Templates

Three minimal HTML templates live in `packages/engine/src/print/templates/`:

- **slides.html**: A standard HTML5 document with `{{title}}` in the `<title>` tag, `{{styles}}` in a `<style>` block in the head, and `{{content}}` in the `<body class="gs-print gs-print-slides">`.

- **slides-notes.html**: Same structure but with body class `gs-print gs-print-slides-notes`, title suffixed with " — Speaker Notes", and an `<h1>{{title}}</h1>` header before the content.

- **book.html**: Body class `gs-print gs-print-book`, with a cover page header `<h1>{{title}}</h1>` inside a `.gs-book-cover` wrapper before the content.

## CLI Integration

The `pdf` command (`packages/cli/src/commands/pdf.ts`) takes a config path, output format, and output PDF path. It:

1. Loads `config.json` and the referenced markdown file.
2. Parses and preprocesses the markdown using `SlideParser` and `PluginManager` with built-in plugins.
3. Renders to flat HTML via `PrintRenderer` with the selected template and title from config.
4. Writes the HTML to a temporary file in a system temp directory.
5. Invokes `weasyprint <input.html> <output.pdf>` via `child_process.execFile`.
6. Cleans up the temp directory.

### CLI Usage

- `npx geekslides pdf --config config.json --format slides -o slides.pdf`
- `npx geekslides pdf --config config.json --format slides-notes -o notes.pdf`
- `npx geekslides pdf --config config.json --format book -o book.pdf`

## WeasyPrint Installation

WeasyPrint is a Python package. It's required only for PDF generation, not for authoring or presenting.

- **Docker/CI**: Install via `pip install weasyprint` in the Dockerfile.
- **Local (pip)**: `pip install weasyprint`
- **Local (macOS)**: `brew install weasyprint`

## WeasyPrint Compatibility Notes

| CSS Feature | Support | Notes |
|-------------|---------|-------|
| Flexbox | Full | Used for slide centering |
| Grid | Full | Available for slide layouts |
| CSS variables | Full | Custom properties work |
| `@page` | Full | Size, margins, named pages |
| `page-break-*` | Full | Control pagination |
| `@bottom-center` | Full | Page numbers |
| Shadow DOM | None | Why we use flat HTML for print |
| JavaScript | None | Pure HTML/CSS rendering |
| `background-image` | Full | But `--presentational-hints` flag may be needed |
| Web fonts (`@font-face`) | Full | Loaded from URLs or local files |
| `@media print` | Full | Respected by WeasyPrint |
