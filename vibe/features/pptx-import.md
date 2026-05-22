# PPTX Import — Hub-Based Conversion

## Overview

Allow users to upload `.pptx` files through the Hub. The server converts them to HTML
at upload time using an internal fork of `pptx2html`'s `process_pptx.js` converter,
with server-side D3 chart rendering and numeric bullet resolution. The result is stored
as a standard deck (`config.json` + `slides.html` + `pptx.css`). The engine then
presents the deck like any other — no special runtime handling required.

## Goals

- Upload a PowerPoint file → get a presentable deck with full GeekSlides chrome
  (keyboard nav, overview, speaker view, PDF export, live sync)
- No CLI involvement — Hub is the import path
- Stored result is a normal deck — no "pptx mode" in the engine
- Charts rendered server-side as inline SVG (no browser-only D3 required at runtime)
- Fidelity: text, images, background colors, shapes, and charts all preserved

## Non-Goals

- Round-tripping back to PPTX
- PowerPoint animations or slide transitions
- Editing the converted slides as markdown
- Embedded audio/video from PPTX

## Conversion Architecture: Internal Fork of `pptx2html`

After evaluating available options and iterating on quality:

| Library | Node.js | Output | Fidelity | Notes |
|---------|---------|--------|----------|-------|
| `@jvmr/pptx-to-html` | ✅ | HTML | Medium | No charts; all inline styles |
| `pptx-svg` | ✅ | SVG | Medium | Text not selectable |
| **`pptx2html` (arantes555) fork** | **✅** | **HTML** | **High** | Charts, bullets, theme colors |

**The internal fork of `pptx2html/process_pptx.js` is used** because:
- `process_pptx.js` is a 3,500-line pure JS/ES module with zero jQuery usage (jQuery only
  appears in the browser-facing `main.js` shim, not the converter core)
- It emits `<section style='width:Xpx; height:Ypx; background-color:...'>` per slide
- Charts are emitted as placeholder `<div id='chart0' ...>` elements + a `Done` message
  carrying the chart data — the server then renders them to inline SVG via D3 v7 + jsdom
- Numeric bullet lists are resolved server-side via a TypeScript port of `setNumericBullets`
- PPTX theme colors (HSL/RGB math) handled by the `colz` package (same dep as `pptx2html`)

### Fork Structure

All fork files live in `packages/hub/src/server/services/pptx/`:

| File | Role |
|------|------|
| `process-pptx.ts` | Fork of `process_pptx.js` — 3,504 lines, `// @ts-nocheck`, 6 targeted patches |
| `txml.ts` | Fork of `tXml.js` — custom XML parser used by the converter |
| `pptx-css.ts` | Cleaned CSS from `pptx_css.js` — `section {}` overrides removed |
| `chart-renderer.ts` | D3 v7 + jsdom server-side chart rendering (bar/line/area/pie) |
| `bullet-numbering.ts` | TypeScript port of `setNumericBullets` (arabic/alpha/roman/hebrew) |

### Fork Patches Applied to `process-pptx.ts`

1. Added `/* eslint-disable */` + `// @ts-nocheck` header + fork attribution comment
2. Removed browser-specific `/* global btoa, JSZip */` comment + `'use strict'`
3. Added `import JSZip from 'jszip'` (was a global in browser; explicit import for Node)
4. Fixed `import tXml from './txml'` → `import tXml from './txml.ts'`
5. `base64ArrayBuffer`: replaced `btoa(loop)` with `Buffer.from(arrayBuff).toString('base64')`
6. `ppt/tableStyles.xml`: added null check guard (optional file, not all PPTX files have it)

### process-pptx.ts Shim-Worker API

The converter uses a Web Worker shim pattern — caller provides two callbacks:

```typescript
import processPptxFactory from './pptx/process-pptx.ts';

processPptxFactory(
  // setOnMessage: registers the inbound message handler
  (handler) => { sender.send = handler; },
  // postMessage: receives outbound messages from the converter
  (msg) => {
    switch (msg.type) {
      case 'slideSize': /* { width, height } in pixels */
      case 'slide':     /* HTML string for one slide */
      case 'globalCSS': /* per-deck CSS from PPTX theme */
      case 'Done':      /* { charts: ChartEntry[] } */
      case 'ERROR':     /* error string */
    }
  },
);

// Trigger conversion
sender.send({ type: 'processPPTX', data: arrayBuffer });
```

### Chart Rendering

Charts are emitted as placeholder divs in the slide HTML and separately in the `Done` message:

```html
<!-- In slide HTML: -->
<div id='chart0' class='block content' style='position:absolute; left:X; top:Y; width:W; height:H;'></div>
```

```typescript
// In Done message:
{ type: 'createChart', data: { chartID: 'chart0', chartType: 'barChart', chartData: [...] } }
```

`chart-renderer.ts` renders each chart to inline SVG using D3 v7 + jsdom.
`postProcessSlide()` in `pptx-convert.ts` does a single jsdom pass per slide: it finds
placeholder divs by ID and replaces them with SVG-wrapped divs preserving the position/size.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Hub Upload Flow (existing)         + PPTX Extension              │
│                                                                   │
│  Dashboard UI                                                     │
│  ├── Files tab                                                    │
│  ├── Zip tab                                                      │
│  ├── GitHub tab                                                   │
│  └── PPTX tab  ← NEW                                            │
│        │                                                          │
│        ▼                                                          │
│  POST /hub/api/presentations  (multipart, .pptx file)            │
│        │                                                          │
│        ▼                                                          │
│  ┌──────────────────────────────────────────────────┐             │
│  │ pptx-convert.ts (service)                        │             │
│  │                                                  │             │
│  │  1. processPptxFactory(setOnMessage, postMsg)    │             │
│  │     → slideSize, slide[], globalCSS, Done{charts}│             │
│  │  2. postProcessSlide() per slide:                │             │
│  │     a. jsdom: replace chart<div>s with SVG       │             │
│  │     b. resolveNumericBullets() on HTML           │             │
│  │  3. Auto-extract title from slide 1 (fallback)   │             │
│  │  4. Derive aspectRatio from slideSize            │             │
│  │  5. Concatenate slides → slides.html             │             │
│  │  6. pptxCss + globalCSS → pptx.css               │             │
│  │  7. Generate config.json:                        │             │
│  │     { title, content, styles, aspectRatio }      │             │
│  │  8. Return RepoFile[]                            │             │
│  └─────────────────────┬────────────────────────────┘             │
│                        │                                          │
│                        ▼                                          │
│  validateDeckFiles(files)  ← existing, unchanged                 │
│                        │                                          │
│                        ▼                                          │
│  createPresentation(db, { files, ... })  ← existing, unchanged   │
│                        │                                          │
│                        ▼                                          │
│  Git repo: config.json + slides.html + pptx.css                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Engine Rendering (at launch/present time)                         │
│                                                                   │
│  Browser fetches config.json → sees content: "slides.html"       │
│                        │                                          │
│                        ▼                                          │
│  Detects .html extension → fetches slides.html as text           │
│                        │                                          │
│                        ▼                                          │
│  HtmlSlideParser.parseHtmlSlides(html) → SlideData[]             │
│                        │                                          │
│                        ▼                                          │
│  Slideshow.loadSlides(slides) → normal presentation              │
└──────────────────────────────────────────────────────────────────┘
```

## `slides.html` and `pptx.css` Storage Format

The converter emits three files per PPTX deck:

**`slides.html`** — concatenated `<section>` elements, one per slide:

```html
<section style='width:960px; height:540px; background-color:#1B2A4A;'>
  <!-- Absolutely-positioned HTML from process-pptx.ts, inline styles -->
  <div style="position:absolute; top:153px; left:43px; ...">
    <span style="color:#fff; font-size:40pt; font-family:Trebuchet MS; font-weight:bold;">
      How LLM Inference Works
    </span>
  </div>
  <!-- Charts are rendered as inline SVG (no placeholder divs remain) -->
  <div style="position:absolute; left:X; top:Y; width:W; height:H;">
    <svg viewBox="0 0 W H">...</svg>
  </div>
</section>

<section style='width:960px; height:540px; background-color:#F4F7F9;'>
  <!-- slide 2 content -->
</section>
```

**`pptx.css`** — base layout CSS + per-deck theme CSS:

```css
/* pptxCss: base positioning and typography classes from process_pptx.js */
.block { position: absolute; }
.content { overflow: hidden; }
/* ... */

/* deck theme: globalCSS emitted by the converter for this specific PPTX */
.theme-color-1 { color: #1B2A4A; }
/* ... */
```

**`config.json`:**

```json
{
  "title": "My Presentation",
  "content": "slides.html",
  "styles": ["pptx.css"],
  "aspectRatio": "16/9"
}
```

The `styles` array causes the engine to inject `pptx.css` into the shadow DOM
before rendering, providing shared layout classes that the slide HTML references.

## Compatibility with GeekSlides Engine

| Aspect | Internal fork output | GeekSlides | Status |
|--------|---------------------|------------|--------|
| Slide container | `<section style='...'>` (native) | `loadContent(html)` into shadow DOM | ✅ Direct |
| Positioning | Absolute, mix of inline + CSS classes | Shadow DOM isolates class names | ✅ Direct |
| Aspect ratio | Derived from PPTX slideSize (e.g. 16/9) | `aspectRatio` in config.json | ✅ Direct |
| SVG shapes | Inline `<svg>` | Works in innerHTML | ✅ Direct |
| CSS classes | `.block`, `.content` etc via pptx.css | Loaded via `styles` config | ✅ Via pptx.css |
| Background color | Section inline style | Extracted by HtmlSlideParser | ✅ |
| Images | Inline base64 data URIs | Works in innerHTML | ✅ Direct |
| Charts | Server-rendered inline SVG | Static SVG in innerHTML | ✅ Direct |
| Numeric bullets | Resolved server-side (jsdom) | Static HTML text | ✅ Direct |
| Text selectability | HTML text nodes | Normal selection | ✅ |
| Navigation | N/A | Engine provides keyboard/touch/URL | ✅ Free |
| Speaker view | N/A | Works with any SlideData | ✅ Free |
| PDF export | N/A | PrintRenderer uses SlideData | ✅ Free |
| Animations | Not supported | N/A | ⚠️ Lost |

## Implementation Plan

### Phase 1: HtmlSlideParser (engine)

**New file:** `packages/engine/src/core/HtmlSlideParser.ts`

Parses a `slides.html` string (the format stored by the Hub) into `SlideData[]`.

```typescript
export function parseHtmlSlides(
  html: string,
  options?: { idPrefix?: string },
): SlideData[];
```

Algorithm:
1. Split on `<section` / `</section>` boundaries (regex-based, no DOMParser — works in
   both browser and Node headless)
2. For each section:
   - Extract `background-color` from the opening tag's `style` attribute → `backgroundColor`
   - The content between tags → `html`
   - Generate sequential ID from `idPrefix` → `id`
   - `rawCss: undefined` (all styles are inline in `@jvmr/pptx-to-html` output)
   - `partialCount: 0`, `classes: []`
3. Return `SlideData[]`

**Exported from:** `packages/engine/src/index.ts` and `packages/engine/src/headless.ts`

### Phase 2: Content detection (browser app)

**Modified file:** `packages/cli/app/main.js`

Rename `fetchMarkdown()` → `fetchContent()` and add an early-return branch:

```javascript
async function fetchContent(config) {
  const paths = Array.isArray(config.content) ? config.content : [config.content];
  // HTML content (pptx-imported decks) — bypass markdown pipeline entirely
  if (paths.length === 1 && paths[0].endsWith('.html')) {
    const url = proxyUrlIfNeeded(resolveUrl(paths[0]));
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
    const html = await res.text();
    return { type: 'html', slides: parseHtmlSlides(html) };
  }
  // Normal markdown path
  // ... existing logic ...
  return { type: 'markdown', source: parts.join('\n') };
}
```

~15 lines of new code; the downstream caller branches on `type`.

### Phase 3: Hub — PPTX conversion service

**File:** `packages/hub/src/server/services/pptx-convert.ts`
**Fork files:** `packages/hub/src/server/services/pptx/` (5 files — see Fork Structure above)

Key implementation details:
- `processPptxFactory` is called with a `setOnMessage` / `postMessage` callback pair
- `buffer.buffer.slice(byteOffset, byteOffset + byteLength)` used for pooled Buffer safety
- `config.json` includes `aspectRatio` derived via GCD from the `slideSize` message
- `config.json` includes `styles: ["pptx.css"]` — loaded by engine into shadow DOM
- Charts are post-processed in a single jsdom pass per slide via `postProcessSlide()`
- Bullet numbering applied after chart injection via `resolveNumericBullets()`
- `extractedTitle` always reflects slide 1 content (independent of `userTitle`)

```typescript
export interface PptxConvertResult {
  readonly files: readonly RepoFile[];
  readonly extractedTitle: string | null;
}

export async function convertPptx(
  pptxBuffer: Buffer,
  userTitle?: string,
): Promise<PptxConvertResult>
// Returns: [config.json, slides.html, pptx.css]
```

**Dependencies in `packages/hub/package.json`:**
```json
"colz": "^0.1.0",
"d3": "^7.9.0",
"jsdom": "^29.1.1",
"jszip": "^3.10.1"
```

### Phase 4: Hub route modification

**Modified file:** `packages/hub/src/server/routes/presentations.ts`

In the POST multipart handler, after collecting `data` and `filename`:

```typescript
if (filename.endsWith('.pptx')) {
  const { files, extractedTitle } = await convertPptx(data, title);
  if (extractedTitle && !titleManuallySet) title = extractedTitle;
  uploaded.push(...files);
} else if (filename.endsWith('.zip')) {
  // existing zip handling
} else {
  uploaded.push({ path: filename, data });
}
```

The rest of the pipeline (`validateDeckFiles` → `createPresentation`) is unchanged.

### Phase 5: Hub UI — PPTX upload tab

**Modified file:** `packages/hub/src/client/pages/dashboard-page.ts`

Add a "PPTX" tab (fourth tab after Files/Zip/GitHub):

```typescript
// Tab bar addition
{ id: 'pptx', label: 'PPTX' }

// Tab content
${this._uploadTab === 'pptx' ? html`
  <label>Select a PowerPoint file (.pptx)</label>
  <input type="file" id="pptx-input" accept=".pptx"
    @change=${(e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && !this._titleManuallyEdited) {
        this._uploadTitle = file.name.replace(/\.pptx$/i, '');
      }
    }}>
  <p class="hint">Slides are converted to HTML. Animations and transitions are not preserved.</p>
` : nothing}
```

Upload handler sends the `.pptx` as multipart — same code path as the zip tab,
just different `accept` and input id. The server handles the rest.

## File Changes Summary

| File | Change | Est. lines |
|------|--------|-----------|
| `packages/engine/src/core/HtmlSlideParser.ts` | **New** — parse slides.html → SlideData[] | ~60 |
| `packages/engine/src/index.ts` | Export `parseHtmlSlides` | +2 |
| `packages/engine/src/headless.ts` | Export `parseHtmlSlides` | +2 |
| `packages/cli/app/main.js` | Detect `.html` content, branch to HtmlSlideParser | ~20 |
| `packages/hub/src/server/services/pptx-convert.ts` | **Rewritten** — uses internal fork | ~180 |
| `packages/hub/src/server/services/pptx/process-pptx.ts` | **Fork** of pptx2html process_pptx.js | 3,504 |
| `packages/hub/src/server/services/pptx/txml.ts` | **Fork** of tXml.js | ~140 |
| `packages/hub/src/server/services/pptx/pptx-css.ts` | **Fork** of pptx_css.js (cleaned) | ~60 |
| `packages/hub/src/server/services/pptx/chart-renderer.ts` | **New** — D3 v7 + jsdom charts | ~150 |
| `packages/hub/src/server/services/pptx/bullet-numbering.ts` | **New** — numeric bullet resolution | ~80 |
| `packages/hub/package.json` | Replace `@jvmr/pptx-to-html` with `colz`, `d3`, `jszip` | ~4 |
| `packages/hub/src/server/routes/presentations.ts` | Detect `.pptx` in POST + PUT handlers | ~20 |
| `packages/hub/src/client/pages/dashboard-page.ts` | PPTX tab, upload handler, "Converting…" label | ~40 |

**Total: ~210 lines of production code, 2 new files**

## Test Plan

| Layer | Test | What it verifies |
|-------|------|-----------------|
| Unit | `parseHtmlSlides` with inline HTML fixtures | Splits sections, extracts background colors, assigns IDs |
| Unit | `convertPptx` with mocked `process-pptx.ts` | Produces 3 files, correct aspectRatio, title extraction, CSS merge |
| Unit | `extractLargestText` heuristic | Returns largest-font-size text from slide 1 |
| Unit | `chart-renderer.ts` (planned) | Each chart type returns `<svg` string; unknown type returns null |
| Integration | POST `.pptx` to Hub API | Creates presentation; git repo contains config.json + slides.html + pptx.css |
| Integration | GET launched room content | slides.html served correctly |
| E2E | Upload pptx → launch → navigate slides | Full user journey works |

## Test Fixtures

- `assets/llm_inference.pptx` — source PowerPoint (LLM inference walkthrough)
- `packages/hub/e2e/fixtures/sample.pptx` — minimal fixture for E2E tests
- Engine and hub unit tests use inline HTML strings (no external fixture file needed)

## Decisions

| Decision | Rationale |
|----------|-----------|
| Internal fork of `pptx2html/process_pptx.js` | Highest fidelity; chart data, theme colors, bullet types — pure JS with no jQuery |
| Rejected `@jvmr/pptx-to-html` | No chart support; medium fidelity for complex slides |
| Rejected `pptx-svg` | SVG output makes text non-selectable/searchable |
| `colz` + `jszip` explicit deps | `process_pptx.js` uses them; no `@types` needed under `@ts-nocheck` |
| D3 v7 + jsdom for server-side charts | `<script>` tags in innerHTML are inert by spec; D3 can write SVG to jsdom |
| Single jsdom pass per slide | Efficient: chart injection + bullet resolution in one DOM traversal |
| Three output files (config + html + css) | pptx.css needed for layout classes referenced by slide HTML |
| `styles: ["pptx.css"]` in config.json | Engine already processes `styles` array — no engine changes needed |
| `aspectRatio` derived from `slideSize` | Correct ratio for non-standard PPTX sizes (not always 16:9) |
| Convert at upload time, not render time | Stored deck is self-contained; no runtime conversion dep |
| Shadow DOM isolation | pptx inline styles can't collide with GeekSlides theme |
| Auto-extract title, fall back to filename | Better UX than always requiring manual title entry |

## Additional Scope

### Re-upload of PPTX

`PUT /hub/api/presentations/:id/files` also needs PPTX detection. Same conversion
path as POST — the same 3-line `.pptx` branch added to the PUT handler.

**Modified file:** `packages/hub/src/server/routes/presentations.ts` (PUT handler, same pattern as POST)

### Loading indicator during conversion

Converting a PPTX is CPU-bound work. A 24-slide deck takes <1s, but
a 200-slide deck with many embedded images could take several seconds.

**Change:** During PPTX upload, the dashboard UI shows a spinner with the label
"Converting…" instead of the generic "Uploading…" message. The existing
`_uploading` boolean state already drives the button disabled state; a separate
`_converting` state string drives the label.

```typescript
// In dashboard-page.ts upload handler
if (this._uploadTab === 'pptx') {
  this._uploadingLabel = 'Converting…';
}
// reset to 'Uploading…' or '' after done
```

**Modified file:** `packages/hub/src/client/pages/dashboard-page.ts` (label state, ~5 extra lines)

## Hub Dockerfile

No changes needed. `colz`, `jszip`, and `d3` are pure npm packages with no native binaries
or system dependencies. `jsdom` was already a dependency.
