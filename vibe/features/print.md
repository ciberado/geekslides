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

```typescript
// packages/engine/src/print/PrintRenderer.ts

export interface PrintOptions {
  template: 'slides' | 'slides-notes' | 'book';
  title: string;
  theme?: string;        // CSS file path
  pageSize?: string;     // e.g. 'A4', 'Letter', '16:9'
  orientation?: 'landscape' | 'portrait';
}

export class PrintRenderer {
  render(slides: SlideData[], options: PrintOptions): string {
    const template = this.#loadTemplate(options.template);
    const css = this.#buildPrintCSS(options);
    
    let slidesHtml: string;
    
    switch (options.template) {
      case 'slides':
        slidesHtml = this.#renderSlides(slides);
        break;
      case 'slides-notes':
        slidesHtml = this.#renderSlidesWithNotes(slides);
        break;
      case 'book':
        slidesHtml = this.#renderBook(slides);
        break;
    }

    return template
      .replace('{{title}}', this.#escapeHtml(options.title))
      .replace('{{styles}}', css)
      .replace('{{content}}', slidesHtml);
  }

  #renderSlides(slides: SlideData[]): string {
    return slides.map((slide, i) => `
      <section class="gs-print-slide ${slide.classes.join(' ')}"
               id="${slide.id || `slide-${i}`}"
               style="${this.#bgStyles(slide)}">
        ${slide.scopedCss ? `<style>${slide.scopedCss}</style>` : ''}
        <div class="gs-print-slide-content">
          ${slide.html}
        </div>
      </section>
    `).join('\n');
  }

  #renderSlidesWithNotes(slides: SlideData[]): string {
    return slides.map((slide, i) => `
      <section class="gs-print-slide-with-notes">
        <div class="gs-print-slide ${slide.classes.join(' ')}"
             id="${slide.id || `slide-${i}`}"
             style="${this.#bgStyles(slide)}">
          ${slide.scopedCss ? `<style>${slide.scopedCss}</style>` : ''}
          <div class="gs-print-slide-content">
            ${slide.html}
          </div>
        </div>
        ${slide.notes ? `
          <aside class="gs-print-notes">
            ${slide.notes}
          </aside>
        ` : ''}
      </section>
    `).join('\n');
  }

  #renderBook(slides: SlideData[]): string {
    return slides.map((slide, i) => `
      <article class="gs-book-chapter">
        <figure class="gs-book-slide ${slide.classes.join(' ')}"
                id="${slide.id || `slide-${i}`}">
          <div class="gs-book-slide-content">
            ${slide.html}
          </div>
        </figure>
        ${slide.notes ? `
          <div class="gs-book-notes">
            ${slide.notes}
          </div>
        ` : ''}
      </article>
    `).join('\n');
  }

  #bgStyles(slide: SlideData): string {
    const styles: string[] = [];
    if (slide.backgroundImage) {
      styles.push(`background-image: url('${slide.backgroundImage}')`);
      styles.push('background-size: cover');
      styles.push('background-position: center');
    }
    if (slide.backgroundColor) {
      styles.push(`background-color: ${slide.backgroundColor}`);
    }
    return styles.join('; ');
  }

  #escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
```

## Print CSS

```css
/* packages/engine/src/print/print.css */

/* === Slides PDF === */

@page slides {
  size: 254mm 142.9mm; /* 16:9 landscape */
  margin: 0;
}

.gs-print-slide {
  page: slides;
  page-break-after: always;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.gs-print-slide:last-child {
  page-break-after: auto;
}

/* === Slides + Notes PDF === */

@page slides-notes {
  size: A4 portrait;
  margin: 15mm;
}

.gs-print-slide-with-notes {
  page: slides-notes;
  page-break-after: always;
}

.gs-print-slide-with-notes .gs-print-slide {
  /* Slide as a bordered box, 60% of page height */
  border: 1px solid #ccc;
  height: 55%;
  margin-bottom: 1rem;
  page-break-after: avoid;
}

.gs-print-notes {
  font-size: 0.9rem;
  line-height: 1.5;
  color: #333;
}

/* === Book PDF === */

@page book {
  size: A4 portrait;
  margin: 20mm;
  
  @bottom-center {
    content: counter(page);
    font-size: 10pt;
    color: #666;
  }
}

.gs-book-chapter {
  page: book;
  page-break-inside: avoid;
  margin-bottom: 2rem;
}

.gs-book-slide {
  border: 1px solid #ddd;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #fafafa;
}

.gs-book-notes {
  font-size: 1rem;
  line-height: 1.6;
  text-align: justify;
}

/* === Shared === */

/* Remove partials — show all content */
[partial] {
  visibility: visible !important;
}

/* Code blocks */
pre {
  background: #f5f5f5;
  padding: 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  overflow-x: auto;
  page-break-inside: avoid;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  page-break-inside: avoid;
}

th, td {
  border: 1px solid #ddd;
  padding: 0.4rem 0.8rem;
  text-align: left;
}
```

## HTML Templates

### slides.html

```html
<!-- packages/engine/src/print/templates/slides.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>{{styles}}</style>
</head>
<body class="gs-print gs-print-slides">
  {{content}}
</body>
</html>
```

### slides-notes.html

```html
<!-- packages/engine/src/print/templates/slides-notes.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}} — Speaker Notes</title>
  <style>{{styles}}</style>
</head>
<body class="gs-print gs-print-slides-notes">
  <header class="gs-print-header">
    <h1>{{title}}</h1>
  </header>
  {{content}}
</body>
</html>
```

### book.html

```html
<!-- packages/engine/src/print/templates/book.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>{{styles}}</style>
</head>
<body class="gs-print gs-print-book">
  <header class="gs-book-cover">
    <h1>{{title}}</h1>
  </header>
  {{content}}
</body>
</html>
```

## CLI Integration

```typescript
// packages/cli/src/commands/pdf.ts
import { execFile } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface PdfOptions {
  config: string;       // path to config.json
  format: 'slides' | 'slides-notes' | 'book';
  output: string;       // output PDF path
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  // 1. Load config and markdown
  const config = JSON.parse(await readFile(options.config, 'utf-8'));
  const markdown = await readFile(config.content, 'utf-8');

  // 2. Parse and render to flat HTML
  const parser = new SlideParser();
  const plugins = new PluginManager();
  // ... register built-in plugins
  
  const processed = plugins.preprocess(markdown, config);
  const slides = parser.parse(processed);
  
  const renderer = new PrintRenderer();
  const html = renderer.render(slides, {
    template: options.format,
    title: config.title,
  });

  // 3. Write to temp file
  const tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-'));
  const htmlPath = join(tmpDir, 'input.html');
  await writeFile(htmlPath, html);

  // 4. Invoke WeasyPrint
  try {
    await new Promise<void>((resolve, reject) => {
      execFile('weasyprint', [htmlPath, options.output], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    console.log(`PDF generated: ${options.output}`);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
}
```

### CLI Usage

```bash
# Generate all three formats
npx geekslides pdf --config config.json --format slides -o slides.pdf
npx geekslides pdf --config config.json --format slides-notes -o notes.pdf
npx geekslides pdf --config config.json --format book -o book.pdf
```

## WeasyPrint Installation

WeasyPrint is a Python package. It's required only for PDF generation, not for authoring or presenting.

```dockerfile
# In the CLI Docker image or CI
RUN pip install weasyprint
```

```bash
# Local development
pip install weasyprint
# or
brew install weasyprint  # macOS
```

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
