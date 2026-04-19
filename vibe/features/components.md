# Web Components Architecture

## Overview

geekslides v2 uses native Web Components (Custom Elements + Shadow DOM) for slide
rendering and interactive features. The implementation favors small focused components
and orchestration from the root slideshow element.

## Implemented Components

| Component | Purpose |
|---|---|
| `<geek-slideshow>` | Root controller for slide state, navigation, scaling, and mode |
| `<geek-slide>` | One rendered slide with scoped styles and partial reveal support |
| `<geek-terminal>` | Terminal-like command prompt opened with `t` |
| `<geek-whiteboard>` | Per-slide canvas overlay for drawing, auto-activated on pen/mouse drag, synced via Yjs |
| `<geek-chart>` | Table-to-chart rendering component |
| `<geek-video>` | Video wrapper with partial-driven timestamp seeking |
| `<geek-speaker-view>` | Separate speaker UI for current/next slide, notes, and controls |

## Component Hierarchy

```
<geek-slideshow>
├── <geek-slide> x N
│   ├── slide HTML (from markdown)
│   ├── scoped style injection
│   └── optional rich elements (<geek-chart>, <geek-video>)
├── <geek-whiteboard> (overlay, per-slide canvas, auto-shown on draw)
└── <geek-terminal> (overlay prompt, hidden by default)

Separate route/tab:
<geek-speaker-view>
```

## Whiteboard Behavior

`<geek-whiteboard>` manages one canvas per slide. Key behaviors:

- **Per-slide persistence**: Each slide has its own stroke buffer. Navigating away and
  back restores previous drawings. Internally the component saves/restores an
  `ImageData` snapshot plus the stroke list keyed by slide index.
- **Auto-activation**: The host app listens for `pointerdown` + `pointermove` on the
  slideshow container. When a drag is detected (mouse button held or pen contact), the
  whiteboard is made visible via `setActive(true)` and drawing starts immediately via
  `beginStroke(e)`. Text selection is suppressed during the drag. No manual
  `whiteboard` command is required, though the command still works as a toggle.
- **Pointer capture**: When `pointerdown` fires directly on the canvas, the pointer is
  captured via `setPointerCapture()` to retain tracking even if the pointer drifts
  slightly outside the canvas bounds.
- **Stroke coalescing**: When a pen briefly loses contact (triggering `pointerup`), the
  stroke is not immediately finalized. A short timer (`COALESCE_MS`, 80 ms) waits for
  the pen to resume. If `pointerdown` fires within that window, the new segment is
  connected to the existing stroke — filling gaps and producing a single synced stroke
  instead of many fragments.
- **Sync**: Local strokes are dispatched as `geek:whiteboard:stroke` events with
  `composed: true` so they escape the shadow DOM. The `WhiteboardSync` bridge forwards
  them to `SyncManager.addStroke()`. Remote strokes arrive as
  `geek:whiteboard:remote-stroke` events and are rendered via `drawRemoteStroke()`.
  The whiteboard component listens for both event directions.
- **Late-join replay**: When a new client joins the room, existing strokes are read
  from the Yjs Y.Array via `SyncManager.getStrokes()` and replayed through
  `drawRemoteStroke()` so late joiners see the full whiteboard state.
- **Slide index**: The `slideIndex` property is set by the parent whenever navigation
  occurs, ensuring strokes are tagged to the correct slide.

## Rendering Strategy

### Browser Rendering (Shadow DOM on)

- `geek-slideshow` owns viewport layout and scaling (`transform: scale()` with contain behavior).
- Each `geek-slide` hosts content in Shadow DOM and keeps transitions isolated.
- In overview mode (`mode="overview"`), the container switches to a CSS grid showing
  all slide thumbnails. Clicking a thumbnail navigates to that slide and exits overview.
- External deck CSS is injected per slide and adapted for shadow context (`body` selectors rewritten to `:host`).
- Font `@import` rules are hoisted to document head to ensure consistent font loading.

### Print Rendering (Shadow DOM off)

Print output is generated as flat HTML (no custom-element/shadow dependencies) by the print renderer.
This supports browser-backed PDF export for four formats:

- slides
- slides + notes
- slides + details
- book

## Command UI

The command workflow is terminal-based:

- Press `t` to open `<geek-terminal>`.
- Type command (`help`, `go 8`, `speaker`, `whiteboard`, `overview`, `fullscreen`).
- Press Enter to execute; Esc closes the terminal.
- `help` output stays visible until manually dismissed (no auto-dismiss).
- Press `?` for a keyboard shortcuts overlay.
- Navigation keys remain direct and always available in normal mode.

## Accessibility

- `<geek-slideshow>`: `role="region"`, `aria-roledescription="slide deck"`
- `<geek-slide>`: `role="group"`, `aria-roledescription="slide"`, `aria-label="Slide N of M"`,
  `aria-hidden` on inactive slides
- `<geek-terminal>` input: `role="combobox"`, `aria-label="Command input"`
- `aria-live="polite"` region announces slide changes to screen readers

## Progress Indicator

The slideshow shadow DOM includes a thin progress bar at the bottom edge and a
slide counter (`N / M`) in the bottom-right corner. Both update on every
`geek:navigate` event and are hidden in overview mode.

## Smartphone Support

Mobile follow mode is supported in browser:

- Swipe/tap navigation through `TouchInput` (25/50/25 tap zone split: prev / dead zone / next)
- Long press toggles the floating toolbar (prev, next, overview, fullscreen, whiteboard, speaker)
- Room sync keeps audience clients following presenter state

The mobile model is interaction-first (touch + sync), not a reduced desktop clone.

## Registration

Component registration is centralized in the engine entrypoint:

- `packages/engine/src/index.ts`

Registered tags include:

- `geek-slideshow`
- `geek-slide`
- `geek-terminal`
- `geek-whiteboard`
- `geek-chart`
- `geek-video`
- `geek-speaker-view`

## Notes On Slide Styles

Per-slide style blocks are supported and scoped by parser/scoper flow. The current engine also supports legacy deck CSS patterns used by existing v1-style decks.
