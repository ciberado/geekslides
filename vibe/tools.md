# Tools — Deep Dive

Four standalone utilities in the `tools/` directory, each with its own
`package.json`.

---

## gs2pdf — Presentation to PDF exporter

**Directory**: `tools/gs2pdf/`
**Entry point**: `src/index.js` (ES module)

### Purpose

Captures every slide (including partials) as a screenshot and compiles them
into a single PDF. Used to distribute presentations in print-friendly format.

### How it works

1. Launches Firefox via **Playwright** (headless: false for debugging)
2. Opens `<server-url>/?url=<presentation-url>` in a 1920×1080 viewport
3. Loops:
   - Takes a screenshot → `/tmp/gs/000.png`, `001.png`, …
   - Dispatches `CustomEvent("nextSlide")` in the page context
   - Waits 1 second for transitions
   - Compares `location.hash` before/after — stops when hash doesn't change
     (end of presentation)
4. Creates a **PDFKit** document (page size: 1440×810, no margins)
5. Inserts each screenshot as a full-page image, then deletes the PNG
6. Writes `/tmp/gs/output.pdf`

### Usage

```bash
cd tools/gs2pdf
npm install
npx playwright install-deps && npx playwright install firefox
node src/index.js <server-url> <presentation-url>
```

**Example**:
```bash
node src/index.js http://localhost:1234 https://example.com/my-slides/
```

### Dependencies

| Package | Purpose |
|---|---|
| playwright | Browser automation (Firefox) |
| pdfkit | PDF generation |
| pino + pino-pretty | Structured logging |

### Limitations

- Requires a running geekslides server (the `<server-url>`)
- Fixed 1-second delay per slide/partial; may need tuning for heavy slides
- Output resolution: 1440×810 (75% of capture resolution)

---

## imageoptimizer — Bulk image download and resize

**Directory**: `tools/imageoptimizer/`
**Entry point**: `index.js` (CommonJS)

### Purpose

Downloads images from URLs listed in a JSON manifest, then optimizes them
(resize + JPEG compression) for use in presentations.

### Pipeline

```
sample.json → downloadImages() → optimizeImages()
                    │                    │
                    ▼                    ▼
           /tmp/downloaded/      /tmp/optimized/
```

### JSON manifest format (`sample.json`)

```json
[
  {
    "alt": "Description of the image",
    "src": "https://example.com/photo.jpeg"
  }
]
```

### `downloadImages(data, directory)`

- Downloads each image via axios (30s timeout)
- Sanitizes filename from `alt` (first 40 chars, lowercase, special chars → `-`)
- Falls back to URL basename if no alt
- Stores as `sanitizedFileName` on each manifest entry

### `optimizeImage(fileName, inputDir, outputDir)`

- Max dimensions: 1920×1080 (fits inside, no enlargement)
- JPEG quality: 95, progressive
- Only processes `.jpg`/`.jpeg` files; others are copied as-is
- Uses **sharp** for processing

### Usage

Designed to be called programmatically (no CLI interface). Load `index.js`
and call the exported functions.

### Dependencies

| Package | Purpose |
|---|---|
| sharp | Image resize and compression |
| axios | HTTP image download |
| winston | Logging |

---

## imageattr — Markdown image token processor

**Directory**: `tools/imageattr/`
**Entry point**: `index.js` (CommonJS)

### Purpose

A standalone markdown-it token processing script. Reads a markdown file,
processes image tokens to uppercase `alt` text and resolve relative `src`
paths to absolute paths.

### How it works

1. Reads input markdown file with `fs.readFileSync`
2. Parses with `markdown-it` into token stream
3. Walks tokens, finding `image` type children:
   - `alt` → uppercased
   - `src` → resolved to absolute path if relative
4. Reconstructs markdown from tokens
5. Writes result to output file

### Limitations

This is a proof-of-concept utility. The token-to-markdown reconstruction is
simplistic and may lose formatting for non-image tokens. Input/output paths
are currently hardcoded in the source.

---

## pptx — PowerPoint to Geekslides converter

**Directory**: `tools/pptx/`

### Scripts

#### `export-notes.py` (Python)

Converts a `.pptx` file into geekslides markdown format.

**How it works:**
1. Opens PPTX with `python-pptx` library
2. For each slide:
   - Generates `[](#slideN,bgurl(SlideN.SVG))` anchor (references pre-exported SVG)
   - If speaker notes exist, wraps them in `::: Notes ... :::`
3. Outputs complete markdown to stdout

**Usage:**
```bash
python export-notes.py /path/to/presentation.pptx > slides.md
```

**Expected workflow:**
1. Export PPTX slides as SVG images (e.g., via LibreOffice or `export.ps1`)
2. Run `export-notes.py` to generate the markdown with SVG references
3. Place both in a geekslides presentation directory

#### `export.ps1` (PowerShell)

PowerShell companion script for exporting slides (likely from PowerPoint on Windows).

### Dependencies

| Tool | Language | Library |
|---|---|---|
| export-notes.py | Python | python-pptx |
| export.ps1 | PowerShell | — |
