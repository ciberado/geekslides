# Slides Engine — Deep Dive

The `slides/` directory contains the browser-side presentation engine. It is bundled
by Parcel from `src/index.html` and served as a static SPA.

## Module dependency graph

```
index.js (entry point - IIFE)
  ├── Slideshow              DOM slide engine
  ├── UserInputDevices       Keyboard/touch → event dispatcher
  ├── SlideshowController    Orchestrator (loads config, markdown, manages pipeline)
  │     ├── MarkdownToHTML   Markdown → sectioned HTML
  │     ├── WhiteboardLayer  Per-slide canvas drawing
  │     ├── VideoSlideController  Video partial playback
  │     └── ChartSlideController  Table → Chart.js
  ├── SyncController         Real-time sync bridge
  │     ├── LocalHub         BroadcastChannel transport
  │     └── MqttHub          Paho MQTT transport
  ├── GlobalWhiteboard       Full-screen whiteboard overlay
  │     └── WhiteboardLayer  Canvas drawing (reused)
  └── Toolbar                Touch-friendly control bar
```

## Bootstrap sequence (`index.js`)

```js
const slideshow = new Slideshow(document.querySelector('#s1'), { aspectRatio: '16:9' });
const uid = new UserInputDevices(slideshow);
const slideshowController = new SlideshowController(slideshow);
const syncController = new SyncController(slideshowController);
const globalWhiteboardCtrl = new GlobalWhiteboard();
await loadSlideshow(slideshowController);
const toolbar = new Toolbar(document.body);
```

`loadSlideshow()` resolves the presentation URL from:
1. `?url=` query parameter (highest priority)
2. `sessionStorage.lastInputSlideshowUrl` + `location.hash` (reload case)
3. `location.href` (default — the page itself)

Then calls `slideshowController.changeSlideshowContent(url, index)`.

---

## Class: `Slideshow`

**File**: `src/Slideshow.js` (~500 lines)

Pure DOM engine. It **does not** react to keys or events — it only exposes an API.
The container element holds `<section>` children, each representing one slide.

### Slide state machine (CSS classes)

```
  ┌──────────┐  gotoNextSlide()  ┌──────────┐  gotoNextSlide()  ┌──────────┐
  │  .prev   │◀─────────────────│  .active  │──────────────────▶│  .next   │
  │ left:-150│                   │ left: 50% │                   │left:150% │
  │ opacity  │  gotoPrevSlide()  │ opacity:1 │  gotoPrevSlide()  │ opacity  │
  │  0.25    │──────────────────▶│           │◀─────────────────│  0.25    │
  └──────────┘                   └──────────┘                   └──────────┘
```

Transitions are CSS-driven: `transition: left 0.5s ease-in-out, opacity 0.5s ease-out`.

### Aspect ratio and scaling

Two base resolutions:
- `4:3` → 960×720 px
- `16:9` → 1920×1080 px
- `1:1` → 1080×1080 px
- Custom: `WxH` format (e.g., `1920x1080`)

`updateSlidesScale()` calculates a `transform: scale(factor)` applied to
`.slidedeck section` by finding the limiting dimension:
```
factor = min(containerWidth / slideWidth, containerHeight / slideHeight)
```
Speaker view uses `factor/2`.

The scale factor is applied by directly mutating the CSS rule's `style.transform`
property on the stylesheet (not inline styles).

### Partials

Slides with class `.partial` require multiple `gotoNextSlide()` calls. Each call
reveals one `<li>` (or `<tr>` in tables) by adding `.partial-shown`.

`getCurrentSlidePartials()` returns `{shown: HTMLElement[][], unshown: HTMLElement[][]}`.
Items inside `.slide-notes` are excluded from partial counting.

### View modes

| Mode | HTML class | Slideshow class | Section class | Description |
|---|---|---|---|---|
| Presentation | `.fullviewport` | `.slidedeck.presentation` | `.presentation` | Standard full-screen |
| Speaker | `.fullviewport` | `.slidedeck.speaker` | `.speaker` | Current + next slide + notes panel |

Toggled by `toggleSpeakerView(enforceMode?)`.

### Events fired

- `slideShown` — dispatched on the current `<section>` element after navigation
- `partialShown` — dispatched on the newly-shown partial `<li>` element

Payload: `{slideshow, currentSlideElem, currentSlideIndex, lastPartialShownIndex, lastPartialShownElem?}`

### Key methods

| Method | Description |
|---|---|
| `gotoNextSlide()` | Show next partial or advance to next section |
| `gotoPreviousSlide()` | Go to previous section (does not hide partials) |
| `gotoSlideIndex(i, p?)` | Navigate to slide `i` (0-based), optional partial `p` |
| `setAspectRatio(ratio)` | Change resolution and rescale |
| `refreshSlideshowContent()` | Re-process sections after innerHTML change |
| `getCurrentSlideIndex()` | Returns 0-based index |
| `getCurrentPartialIndex()` | Returns partial count shown, 0 if none, -1 if not partial |
| `toggleSpeakerView(mode?)` | Switch between 'presentation' and 'speaker' |

---

## Class: `SlideshowController`

**File**: `src/SlideshowController.js` (~600 lines)

The orchestrator. Owns the full lifecycle: loading config, fetching markdown,
running preprocessors, converting to HTML, inserting into DOM, running processors,
loading CSS/JS, and initializing sub-controllers.

### Default configuration

```js
static DEFAULT_CONFIG = {
  content: null,          // null → synthetic SVG image slides
  resolution: '16:9',
  styles: '',
  preprocessor: [],
  processors: [hiddenSlidesProcessor, bgUrlProcessor, bgColorProcessor,
               footnotesProcessor, chartProcessor, iframeProcessor],
  script: '',
  scripts: [],
  liveReload: false,
  slideWhiteBoards: true,
};
```

### `changeSlideshowContent(newBaseUrl, newSlideIndex)` — the main method

1. Fetch `config.json` from `newBaseUrl` (falls back to `DEFAULT_CONFIG`)
2. Fetch markdown: single file, array of files, or synthetic SVG
3. Set `<base href>` to the presentation URL
4. Load CSS files (`config.styles`)
5. Load JS modules (`config.scripts`, `config.script`)
6. Run **preprocessors** on raw markdown text
7. `new MarkdownToHTML(markdown, baseUrl).convert()`
8. `slideshow.slideshowElem.innerHTML = html`
9. For each `<section>`: assign id if missing, add `.regular` class, run **processors**
10. Set aspect ratio
11. `slideshow.refreshSlideshowContent()`
12. Initialize `WhiteboardLayer` per slide (if `config.slideWhiteBoards`)
13. Initialize `VideoSlideController` for slides with `<video>`
14. Store URL in `sessionStorage`
15. Dispatch `slideshowLoaded` event

### Built-in preprocessors (text → text)

| Function | Description |
|---|---|
| `headerPreprocessor` | Scans for `## ` / `### ` headers without a preceding `[]()` link. Inserts `[](#slug,.default)` above them, using the first 30 chars of the title as the id. |
| `threeEmptyLinesSlicerPreprocessor` | Replaces 4 consecutive `\n` with `\n\n[]()\n\n` (auto slide separator). |
| `emptyLineSeparatorPreprocessor` | Replaces `\n\n` with `\n\n<!-- -->\n\n` to preserve blank lines in HTML. |

### Built-in processors (HTMLElement → void)

| Function | Description |
|---|---|
| `hiddenSlidesProcessor` | Removes slides with `.hidden` class from DOM |
| `bgUrlProcessor` | Reads `data-bgurl` → sets `background: url(...) no-repeat center; background-size: cover` |
| `bgColorProcessor` | Reads `data-bgcolor` → sets `background-color` |
| `footnotesProcessor` | Moves footnote references from end of document to `.slide-notes` of the current slide |
| `chartProcessor` | Reads `data-chart` → instantiates `ChartSlideController` |
| `iframeProcessor` | Reads `data-iframe` → creates `<iframe>` + next-slide button |
| `partializeProcessor` | Adds `.partial` to slides containing `<ul>` or `<ol>` |

### Hash-based navigation

Format: `#<slideIndex>.<partialIndex>` (e.g., `#4.2` = 5th slide, 2 partials shown).
`matchHashIndex()` parses the hash and calls `slideshow.gotoSlideIndex()`.
The `slideShown`/`partialShown` listeners update `location.hash` to stay in sync.

### Live reload

When `config.liveReload === true`, polls the content URL every 1 second checking
the `last-modified` header. If changed, triggers `window.location.reload()`.

### Event listeners registered

| Event | Handler |
|---|---|
| `nextSlide` | `slideshow.gotoNextSlide()` (unless `slideElem.dataset.lockNextSlide === "true"`) |
| `previousSlide` | `slideshow.gotoPreviousSlide()` (unless `event.defaultPrevented`) |
| `toggleSpeakerView` | `slideshow.toggleSpeakerView()` |
| `slideShown` | Updates `location.hash` |
| `partialShown` | Updates `location.hash` |
| `hashchange` | `matchHashIndex()` |
| `cloneWindow` | Opens new window with same presentation |
| `changeAspectRatio` | Toggles between 4:3 and 16:9 |
| `openSlides` | Prompts user for new presentation URL |

---

## Class: `MarkdownToHTML`

**File**: `src/MarkdownToHTML.js` (~260 lines)

Transforms a markdown string into sectioned HTML compatible with the slideshow.

### The empty-link encoding

The key innovation: slide metadata is encoded as markdown links with empty display
text and a "href" that encodes attributes:

```markdown
[](#slide-id,.class1,.class2,bgurl(image.png),bgcolor(white))
```

This is **invisible** when rendered by GitHub, GitLab, or any standard markdown
viewer — making presentations readable as regular markdown documents.

### `#parseSectionAttrs(line)` — attribute decoder

Parses the HTML generated by markdown-it for an empty link and extracts:
- `#id` → section id
- `.class` → section classes (multiple supported)
- `bgurl(url)` → `data-bgurl` attribute
- `bgcolor(color)` → `data-bgcolor` attribute
- `chart(options)` → `data-chart` attribute
- `bgimg(url)` → `data-bgimg` attribute
- `iframe(url)` → `data-iframe` attribute

### `#replaceEmptyLinksWithSections(htmlWithLinks)`

Iterates through all empty `<a>` tags in the HTML, replacing each with a
`</section><section id='...' class='...' data-*='...'>` boundary.

### Custom markdown-it renderers

| Renderer | Behavior |
|---|---|
| `image` | Prepends `baseUrl` to relative media paths. Converts `.mp4`/`.mkv`/`.avi` to `<video>` tags with poster image |
| `link_open` | Prepends `baseUrl` to relative media hrefs |
| `text` | Wraps every text token in `<span>` for CSS targeting |

### markdown-it plugins used

| Plugin | Purpose |
|---|---|
| `markdown-it-footnote` | `[^1]` footnote syntax |
| `markdown-it-block-image` | Wraps images in `<div>` containers |
| `markdown-it-container` | `::: Notes` → `<div class="slide-notes">`, `::: ...` → `<div class="content-group">`, `::: anyname` → `<div class="anyname">` |

---

## Class: `UserInputDevices`

**File**: `src/UserInputDevices.js` (~120 lines)

Maps keyboard and touch events to `CustomEvent` dispatches.

### Keyboard mappings

| Key | KeyCode | Event dispatched |
|---|---|---|
| ← Left | 37 | `previousSlide` |
| Page Up | 33 | `previousSlide` |
| H | 72 | `previousSlide` |
| → Right | 39 | `nextSlide` |
| Page Down | 34 | `nextSlide` |
| L | 76 | `nextSlide` |
| S | 83 | `toggleSpeakerView` |
| A | 65 | `changeAspectRatio` |
| C | 67 | `cloneWindow` |
| E | 69 | `toggleEmission` |
| O | 79 | `openSlides` |
| W | 87 | `toggleGlobalWhiteboard` |
| J | 74 | `joinRoom` |
| T | 84 | `translucentWhiteboard` |

### Touch/swipe handling

- Swipe right (>150px) → `nextSlide`
- Swipe left (<-150px) → `previousSlide`
- Pen events (touch with `force > 0`) are ignored by swipe handler (handled by whiteboard)

Events on INPUT/TEXTAREA are ignored to avoid capturing text entry.

Navigation events (`nextSlide`, `previousSlide`) are dispatched on the active slide
element; all others on `document`.

---

## Class: `SyncController`

**File**: `src/SyncController.js` (~300 lines)

Bridges DOM events ↔ Hub messages. Detailed in [architecture.md](architecture.md).

### Room connection format

Input at the "Join" prompt:

| Format | Example | Meaning |
|---|---|---|
| `<room>` | `myroom` | Connect to default host with room name |
| `<room> <password>` | `myroom secret` | Connect with publish authorization |
| `//<host>/<room>` | `//mqtt.example.com/myroom` | Custom host |
| `//<host>:<port>/<room> <pass>` | `//mqtt.example.com:443/myroom secret` | Full specification |

Default host: `geekslides.aprender.cloud:443`

The `username` is automatically set to `"producer"` (if password provided) or
`"consumer"` (read-only).

---

## Class: `ChartSlideController`

**File**: `src/ChartSlideController.js` (~190 lines)

Transforms an HTML table inside a `.chart` slide into a Chart.js visualization.

### How it works

1. Creates a `<canvas>` element after the first header
2. Parses `data-chart` attribute: `"type: line, netflix: red, blockbuster: blue, yAxesSuggestedMax: 6500"`
3. First table column → X-axis labels
4. Subsequent columns → datasets, colored per parsed options
5. If the slide is `.partial`, data is added row-by-row via `partialShown` events
6. Footnote images in table cells become animated "datacards" displayed over the chart

The HTML table is hidden via CSS (`.slidedeck section.chart > table { display: none }`).

---

## Class: `VideoSlideController`

**File**: `src/VideoSlideController.js` (~80 lines)

Manages step-by-step video playback driven by partials.

### Timestamp marks

List items must contain `MM:SS` timestamps:
```html
<li>00:00 Introduction</li>
<li>00:05 First scene</li>
<li>00:15 Second scene</li>
```

Each `partialShown` event starts playback from `marks[currentPartialIndex]` and
pauses at `marks[currentPartialIndex + 1]`.

The video list is hidden in presentation mode (`.slidedeck .bigvideo > ul { display: none }`)
and shown in speaker mode.

---

## Class: `GlobalWhiteboard`

**File**: `src/whiteboard/GlobalWhiteboard.js` (~100 lines)

Full-screen whiteboard overlay. Creates a `<div id="globalwbc">` positioned over
the entire viewport, containing a `WhiteboardLayer`.

- Scaled to match 1920×1080 base size using CSS `transform: scale(sx)`.
- Toggled by `toggleGlobalWhiteboard` event (W key).
- Fires `whiteboardShown`/`whiteboardHidden` events for remote sync.
- Responds to `remoteWhiteboard` events for open/close state sync.

---

## Class: `WhiteboardLayer`

**File**: `src/whiteboard/WhiteboardLayer.js` (~250 lines)

A canvas-based drawing layer attached to a parent element (per-slide or global).

### Drawing model

- Static class-level state: `color`, `penSize`, `opacity` (shared across all instances)
- Compositing: `"lighter"` for drawing, `"destination-out"` for eraser
- `shadowBlur: 1` for opaque strokes, `0` for highlighter mode
- Right-click (button 2) clears the canvas

### Input handling

- **Pointer events** → standard mouse/trackpad drawing
- **Touch events** → only processed if `radiusX >= 1000` (pen/pencil detection)
- Touch-to-screen coordinate transformation accounts for canvas scaling within the
  slide's transformed coordinate system

### Events fired

| Event | Trigger |
|---|---|
| `startWhiteboardStroke` | Pointer/touch down |
| `whiteboardStroke` | Pointer/touch move (if moved >2px) |
| `endWhiteboardStroke` | Pointer/touch up |
| `clearWhiteboard` | Right-click |

### Remote whiteboard protocol

`remoteWhiteboard` events contain an `action` field that maps to local operations:
`startWhiteboardStroke`, `whiteboardStroke`, `clearWhiteboard`, `changeWhiteboardPen`.

---

## Class: `Toolbar`

**File**: `src/toolbar/Toolbar.js` (~140 lines)

Touch-friendly button bar rendered at the bottom of the screen. Becomes visible
on `touchstart`.

### Actions

| Button | Event dispatched | Detail |
|---|---|---|
| Emit | `toggleEmission` | — |
| White/Black/Red/Green/Yellow | `changeWhiteboardPen` | `{color}` |
| Big/Thin | `changeWhiteboardPen` | `{penSize: 18 or 3}` |
| HL | `changeWhiteboardPen` | `{opacity: 0.01}` |
| Pen | `changeWhiteboardPen` | `{opacity: 1}` |
| Eraser | `changeWhiteboardPen` | `{color: 'eraser'}` |
| WB | `toggleGlobalWhiteboard` | — |
| Clear | `clearVisibleWhiteboard` | — |
| Join | `joinRoom` | — |

---

## CSS architecture

### `minislides.css` — core slideshow styles

Slide positioning: absolute, centered at `left: 50%; top: 50%` with
`transform: translate(-50%, -50%) scale(factor)`. Transitions on `left` and `opacity`.

Key selectors:
- `.slidedeck section` — base slide (absolute positioned, hidden by default)
- `.slidedeck section.active` — visible at `left: 50%`, `opacity: 1`
- `.slidedeck section.prev` — off-screen left at `left: -150%`
- `.slidedeck section.next` — off-screen right at `left: 150%`
- `.succession` — disables transition for instant slide replacement
- `.partial ul li` / `.partial ol li` — `opacity: 0` until `.partial-shown`
- `.slide-notes` — `display: none` in presentation mode
- `.speaker section.active div.slide-notes` — visible notes panel (100% width, right of slide)

### `chartslide.css`

Hides the source table and chart monitor. Positions datacards centered with
a white background overlay.

### `videoslide.css`

`.bigvideo` class: video covers full slide area. Marks list hidden in
presentation, visible in speaker mode.

### `whiteboard.css`

`.whiteboard-container` — full-page overlay with chalkboard background,
`z-index: -1` when hidden, `z-index: 10` when `.active`.
Canvas overlay per slide, toggleable transparency with `.translucent`.

### `toolbar/styles.css`

Fixed bottom positioning, `opacity: 0` initially, `opacity: 0.7` when `.active`.
Inline-block buttons with gray background.

---

## Tests

Located in `slides/tests/`, run with Jest.

### `MarkdownToHTML.test.js`

| Test | Validates |
|---|---|
| Empty links generate sections | `[]()` × 3 → 3 `<section>` |
| `#id` in separator → section id | `[](#this-is-the-id)` |
| `.class` in separator → section classes | `[](.first-class.second-class)` |
| `bgurl()` → background image | `[](bgurl(image.png))` |
| `bgcolor()` → background color | `[](bgcolor(white))` |

### `Slideshow.test.js`

| Test | Validates |
|---|---|
| Aspect ratio defaults (16:9, 4:3) | Correct slide dimensions in CSS rules |
| Partial recovery | `partial-shown` vs unshown items |
| Next/previous navigation | `.active` class moves correctly |
| Navigation beyond bounds | No crash at first/last slide |
| Partial navigation | Shows correct number of partials |
| Previous ignores shown partials | Goes to previous section, not partial |
| Slide index retrieval | 0-based index correctness |
| Partial index retrieval | -1 for non-partial, 0 for none shown, N for shown |

Uses `emmet` library (`expand()`) to quickly generate test DOM structures.

---

## Build

```bash
# Install dependencies
npm --prefix slides install

# Development server (Parcel, port 1234)
npm --prefix slides run start

# Production build → slides/dist/
npm --prefix slides run build

# Run tests
npm --prefix slides run test
```

Parcel bundles from `src/index.html`, resolving all ES module imports. The
production build generates minified JS/CSS in `slides/dist/`.
