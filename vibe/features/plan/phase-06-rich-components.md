# Phase 6: Rich Components

**Status**: Not started
**Depends on**: Phase 3 (plugin processors), Phase 5 (whiteboard sync)
**Unlocks**: Phase 12 (E2E tests for these components)

## Goal

Implement the three interactive components — `<geek-chart>` (table→Chart.js),
`<geek-video>` (timestamp partials), and `<geek-whiteboard>` (canvas drawing
synced via Yjs) — plus their corresponding plugin processors.

At the end of this phase, all v1 interactive features are available: tables
become charts, videos have timestamp-based partials, and the whiteboard draws
with cross-tab sync.

## Deliverables

### 1. `<geek-chart>` (`packages/engine/src/components/ChartSlide.ts`)

Converts tabular data into Chart.js visualizations.

**Observed attribute**: `type` (`bar`, `line`, `pie`, `doughnut`, `radar`; default `bar`).

**Behavior**: On `connectedCallback`, reads the `<table>` from light DOM (or inner HTML),
parses header row as labels and data rows as datasets. Creates a `<canvas>` in Shadow DOM
and initializes a Chart.js instance with the extracted data.

Supports datacards: footnotes in the table that map to Chart.js config overrides
(colors, borderWidth, etc.), same logic as v1's `ChartSlideController`.

**Destruction**: On `disconnectedCallback`, calls `chart.destroy()` to free the canvas.

### 2. chart-processor (`packages/engine/src/plugins/builtins/chart-processor.ts`)

Plugin processor for Phase 3's `PluginManager`.

Checks if the slide element has the `.chart` class. If so, queries all `<table>` elements.
For each table, creates a `<geek-chart>` element, sets `type` based on additional CSS
classes (`.bar`, `.line`, `.pie`, etc.), moves the table HTML inside, and replaces the
table in the DOM.

### 3. `<geek-video>` (`packages/engine/src/components/VideoSlide.ts`)

Video player with timestamp-based partial control.

**Behavior**: Wraps a `<video>` element. Reads timestamp marks from `data-timestamps`
attribute (comma-separated seconds). On partial reveal, seeks to the corresponding
timestamp and plays. On partial hide, pauses.

Listens for the parent `<geek-slide>`'s partial changes (via `MutationObserver` on the
`partial` attribute or `geek:navigate` events) to sync video position with slide partials.

### 4. video-processor (`packages/engine/src/plugins/builtins/video-processor.ts`)

Plugin processor. Queries for `<video>` elements in the slide. If found, creates a
`<geek-video>` element, replaces the original video, and appends the video as a child.

### 5. `<geek-whiteboard>` (`packages/engine/src/components/Whiteboard.ts`)

Canvas overlay for freehand drawing, synced via Yjs.

**Shadow DOM**: A full-viewport `<canvas>` element overlaying the slideshow, capturing
pointer events. Hidden by default (`display: none`), toggled via `Ctrl+B → w`.

**Drawing**: Handles `pointerdown` → `pointermove` → `pointerup` for smooth freehand
lines. Normalizes coordinates to 0–1 range (relative to canvas dimensions) for
resolution-independent storage.

**Local events**: On stroke completion, dispatches `geek:whiteboard:stroke` with the
stroke data (consumed by `WhiteboardSync` from Phase 5).

**Remote events**: Listens for `geek:whiteboard:remote-stroke` events and draws
the received stroke on the canvas.

**Methods**: `toggle()`, `clear()`, `setColor(color)`, `setWidth(width)`.

**Mobile**: On screens ≤ 768 px, whiteboard is view-only for remote strokes
(drawing disabled to avoid conflict with navigation gestures).

### 6. Command wiring

Wire the whiteboard commands registered as placeholders in Phase 4:
- `toggle-whiteboard` → `whiteboard.toggle()`.
- `clear-whiteboard` → `whiteboard.clear()`.

### 7. Custom element registration

Update `packages/engine/src/index.ts` to register `geek-chart`, `geek-video`,
and `geek-whiteboard`.

### 8. Tests

**`packages/engine/tests/unit/chart-processor.test.ts`**:
- Slide with `.chart` class has tables replaced with `<geek-chart>` elements.
- Chart type derived from CSS class (`.line` → `type="line"`).
- Slide without `.chart` class is unchanged.

**`packages/engine/tests/unit/video-processor.test.ts`**:
- Slide with `<video>` gets wrapped in `<geek-video>`.
- Slide without `<video>` is unchanged.

**`packages/engine/tests/integration/Whiteboard.test.ts`** (Vitest browser mode):
- Drawing on canvas produces normalized coordinates.
- `toggle()` shows/hides the canvas.
- `clear()` wipes all strokes.
- Remote strokes render on the canvas.

## File List

```
packages/engine/src/components/
├── ChartSlide.ts
├── VideoSlide.ts
└── Whiteboard.ts

packages/engine/src/plugins/builtins/
├── chart-processor.ts
└── video-processor.ts

packages/engine/tests/unit/
├── chart-processor.test.ts
└── video-processor.test.ts

packages/engine/tests/integration/
└── Whiteboard.test.ts
```

## Acceptance Criteria

- [ ] Tables in `.chart` slides render as Chart.js canvases.
- [ ] Chart type is configurable via CSS class.
- [ ] Videos seek to correct timestamps on partial reveal.
- [ ] Whiteboard draws smooth lines on canvas overlay.
- [ ] Whiteboard strokes sync between two tabs via Yjs.
- [ ] Whiteboard is view-only on mobile (no accidental draws).
- [ ] `Ctrl+B → w` toggles whiteboard, `Ctrl+B → c` clears it.
- [ ] All unit and integration tests pass.

## Reference Docs

- [components.md](../components.md) — ChartSlide, VideoSlide, Whiteboard specs
- [plugin-system.md](../plugin-system.md) — chart-processor, video-processor behavior
- [sync.md](../sync.md) — WhiteboardSync, Y.Array stroke format
