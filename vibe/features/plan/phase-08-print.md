# Phase 8: Print & PDF

**Status**: Implemented
**Depends on**: Phase 1 (SlideData), Phase 3 (plugin pipeline for preprocessing)
**Unlocks**: Phase 9 (CLI `pdf` command invokes PrintRenderer and exports via Chromium)

## Goal

Implement the `PrintRenderer` that produces flat HTML (no Shadow DOM, no Custom
Elements in the print DOM) from `SlideData[]`, template-specific layouts for the
supported output formats, and print CSS with `@page` rules. The PDF generation itself
(via Playwright/Chromium) is part of Phase 9's CLI.

At the end of this phase, calling `PrintRenderer.render(slides, 'slides-notes')`
produces a complete, self-contained HTML document that the CLI can open in Chromium
and export as a high-quality PDF.

## Deliverables

### 1. PrintRenderer (`packages/engine/src/print/PrintRenderer.ts`)

Produces flat HTML documents from parsed slides.

**Key constraint**: Output must contain zero Shadow DOM and zero Custom Elements in
the print DOM so browser print rendering does not depend on runtime component behavior.

**`render(slides: SlideData[], template: TemplateName, config: GeekSlidesConfig): string`**:
1. Loads the HTML template for the specified format.
2. For each slide, generates a `<section class="gs-slide">` element with:
   - The slide's HTML content.
   - `data-id`, class, background attributes.
   - A `<style>` tag with the slide's scoped CSS (if any).
   - An `<aside class="gs-notes">` with rendered speaker notes (for `slides-notes`
     and `book` templates only).
3. Assembles global styles: base print CSS + any author CSS from config.
4. Substitutes `{{title}}`, `{{slides}}`, `{{styles}}` placeholders in the template.
5. Returns the complete HTML string.

### 2. Templates (`packages/engine/src/print/templates/`)

HTML templates, each a complete `<!DOCTYPE html>` document with placeholder markers:

**`slides.html`**: One slide per page. Each `<section class="gs-slide">` gets
`page-break-after: always`. No speaker notes. Clean, minimal layout matching the
presentation aspect ratio.

**`slides-notes.html`**: Each page has the slide in the top portion and speaker
notes below in an `<aside>`. The slide area uses a fixed height (e.g. 60% of page)
with the aspect ratio preserved. Notes fill the remaining space with smaller font.

**`slides-details.html`**: Each page pairs a slide preview with rendered `::: Details`
content. Supports horizontal and vertical layouts for the reading block.

**`book.html`**: Flowing document layout. Slides appear as bordered figures with
captions. Speaker notes are full paragraphs between slides. Suitable for reading
material or course handouts. Page breaks between chapters (sections with `<h1>`).

### 3. Print CSS (`packages/engine/src/print/print.css`)

Global print styles applied to all templates:

- `@page` rules: A4 size, margins (2 cm), page numbers in footer.
- `.gs-slide`: dimensions matching aspect ratio, centered, no overflow.
- Code blocks: `white-space: pre-wrap` (no horizontal scroll in print).
- Images: `max-width: 100%`, `break-inside: avoid`.
- Slide-scoped styles: applied as-is (already prefixed by StyleScoper).
- `page-break-inside: avoid` on slides and notes.
- `@page :first` for title page styling (larger font, centered).

### 4. Tests

**`packages/engine/tests/unit/PrintRenderer.test.ts`**:
- `render()` with `'slides'` template produces correct number of `<section>` elements.
- `render()` with `'slides-notes'` includes `<aside class="gs-notes">` for each slide.
- `render()` with `'book'` produces flowing layout with notes as paragraphs.
- Output contains no `<geek-*>` custom elements.
- Output contains no `<script>` tags.
- Scoped CSS is included in the output.
- Slides without notes have no empty `<aside>`.
- Template placeholders (`{{title}}`, etc.) are all substituted.

## File List

```
packages/engine/src/print/
├── PrintRenderer.ts
├── print.css
└── templates/
    ├── slides.html
    ├── slides-notes.html
    └── book.html

packages/engine/tests/unit/
└── PrintRenderer.test.ts
```

## Acceptance Criteria

- [ ] `render(slides, 'slides')` produces a valid HTML document with one section per slide.
- [ ] `render(slides, 'slides-notes')` includes speaker notes for slides that have them.
- [ ] `render(slides, 'book')` produces a flowing document layout.
- [ ] Output is pure HTML/CSS — no Custom Elements, no Shadow DOM, no JS.
- [ ] `print.css` produces correct page breaks when opened in a browser's print preview.
- [ ] Author CSS from config is included in the output.
- [ ] All unit tests pass.

## Reference Docs

- [print.md](../print.md) — full PrintRenderer spec, template descriptions, Chromium export notes
- [components.md](../components.md) — dual rendering strategy (Shadow DOM off for print)
- [decisions.md](../decisions.md) — D4 (dual rendering), D9 (PDF backend)
