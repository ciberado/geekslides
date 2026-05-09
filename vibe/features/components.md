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
  The whiteboard component listens for all remote event directions:
  - `geek:whiteboard:remote-stroke` — renders a completed stroke
  - `geek:whiteboard:remote-stroke-progress` — renders incremental live-stroke points
  - `geek:whiteboard:remote-clear` — clears and redraws the affected slide's strokes
    when the presenter calls clear, keeping all sessions in sync
  - `geek:whiteboard:remote-visibility` — calls `#setActiveInternal()` to mirror the
    presenter's canvas show/hide state on all connected sessions (bypasses readonly)
- **Progressive sync**: During a long continuous stroke, the component emits
  `geek:whiteboard:stroke-progress` events every `PROGRESS_MS` (100 ms) containing
  the cumulative points so far. `WhiteboardSync` bridges these to
  `SyncManager.updateLiveStroke()`, which writes to a shared Yjs Y.Map (`liveStrokes`).
  Remote clients render only the new points since the last update via `drawLiveStroke()`,
  so the stroke appears in real-time rather than only after the pen lifts. On
  finalization, the live entry is cleared and the completed stroke is added to the
  Y.Array as usual; `drawRemoteStroke()` skips re-drawing points already rendered
  by the live path.
- **Late-join replay**: When a new client joins the room, existing strokes are read
  from the Yjs Y.Array via `SyncManager.getStrokes()` and replayed through
  `drawRemoteStroke()` so late joiners see the full whiteboard state.
- **Slide index**: The `slideIndex` property is set by the parent whenever navigation
  occurs, ensuring strokes are tagged to the correct slide.
- **Canvas overlay & click-through**: While the whiteboard is active the canvas sits
  above the slide content (`pointer-events: auto`, `z-index: 100`), so links, iframes,
  and other interactive elements underneath cannot be clicked. The canvas stays
  displayed even on empty slides to keep pointer events working for drawing. To
  interact with slide content you have two options:
  - **Hide the whiteboard** (`⊘` button, `whiteboard` command, or `wb-hide`): hides
    the canvas via `display: none` and also controls `userDismissed` state. Restores
    click-through to links, sliders, and other interactive elements in the slide.
  - **Collapse the toolbar** (click `≡`): shrinks the toolbar to a collapsed strip, keeping it visible
- **Hide the toolbar** (run `wb-toolbar`): completely removes the toolbar from view (`display: none`)
    UI only. The toolbar is hidden by default in presenter mode and can be shown again
    with `wb-toolbar` or `wb-show`. The canvas remains visible so annotations stay on
    screen, and the canvas is immediately given `pointer-events: none` / `touch-action: auto`
    so swipe gestures and tap-zone navigation pass straight through to the slide. Slide
    navigation does not hide the canvas — drawings are preserved and visible after
    navigating away and back. Expanding the toolbar restores `pointer-events: auto` /
    `touch-action: none` for drawing. Collapsing does _not_ hide the canvas; use the
    **⊘** button or `whiteboard` command for that.
- **`toggleCanvas()`**: Toggles canvas visibility without setting `userDismissed`,
  so auto-activation on drag still works after hiding. Used by the toolbar `⊘` button
  via the `geek:whiteboard:hide-request` event. The `deactivate()` method (used by
  `wb-hide` and the `whiteboard` toggle command) sets `userDismissed = true` and
  suppresses auto-activation until the next explicit activation. Both are no-ops when
  `readonly` is set.
- **Readonly mode**: When the `readonly` attribute is set, the component disables all
  local drawing: pointer/touch listeners are not registered, and `toggle()`,
  `setActive()`, `beginStroke()`, `toggleCanvas()`, and `clear()` become no-ops. Remote
  strokes are still rendered and auto-show the canvas via the internal
  `#setActiveInternal()` path, so view-only clients see the presenter's drawings
  without being able to modify them.

## Whiteboard Toolbar

`<geek-whiteboard-toolbar>` is a collapsible vertical toolbar anchored to the right
edge of the whiteboard. It provides drawing controls without leaving the canvas and
starts hidden by default in presenter mode.

### Layout

```
┌────────────────────────────────┐
│                           [≡]  │ ← collapse toggle (always visible)
│                          ┌───┐ │
│                          │ P │ │ ← Pen (default tool)
│                          │ H │ │ ← Highlighter (semi-transparent, wider)
│                          │ E │ │ ← Eraser
│                          ├───┤ │
│       canvas             │4×4│ │ ← 16-color palette grid
│                          │   │ │
│                          ├───┤ │
│                          │ ⊘ │ │ ← Hide whiteboard (current slide)
│                          │ ✕ │ │ ← Clear current slide (with confirm)
│                          └───┘ │
└────────────────────────────────┘
```

### Tools

| Tool | Behavior |
|------|----------|
| **Pen** | Default: `globalCompositeOperation = 'source-over'`, width 3, full opacity |
| **Highlighter** | Semi-transparent (`globalAlpha = 0.3`), wider stroke (width 20) |
| **Eraser** | `globalCompositeOperation = 'destination-out'`, width 20 |

### Color Palette (4×4)

16 colors arranged in a grid: black, white, red, blue, green, yellow, orange, purple,
pink, cyan, brown, lime, navy, maroon, teal, grey.

### Terminal Commands

| Command | Description |
|---------|-------------|
| `wb-toolbar` | Completely show/hide the toolbar (`toggleVisibility()`) |
| `wb-hide` | Hide toolbar entirely (remove from DOM display) |
| `wb-show` | Show toolbar (restore DOM display) |
| `wb-pen` | Switch to pen tool |
| `wb-highlighter` | Switch to highlighter tool |
| `wb-eraser` | Switch to eraser tool |
| `wb-color <name\|hex>` | Set drawing color |

### Component Communication

The toolbar dispatches custom events that the Whiteboard component listens for:

- `geek:whiteboard:tool-change` — `{ tool: 'pen' | 'highlighter' | 'eraser' }`
- `geek:whiteboard:color-change` — `{ color: string }`
- `geek:whiteboard:clear-request` — triggers clear with confirmation
- `geek:whiteboard:hide-request` — hides the whiteboard for the current slide
- `geek:whiteboard:collapsed-change` — `{ collapsed: boolean }` — fires when the
  toolbar is collapsed or expanded; the whiteboard updates its `toolbarCollapsed`
  property and sets `pointer-events: none` / `touch-action: auto` on the canvas
  while collapsed so touch navigation is not blocked

The toolbar is created and owned by `<geek-whiteboard>` itself (inside its shadow root)
in non-readonly mode. It is exposed via the read-only `toolbar` getter for external
command wiring (e.g. `wb-pen`, `wb-color`). The toolbar re-emits `hide-request` and
`clear-request` as composed `geek:whiteboard:hide` / `geek:whiteboard:clear` events
so the feature sync layer can bridge them without directly managing toolbar DOM.

## Rendering Strategy

### Browser Rendering (Shadow DOM on)

- `geek-slideshow` owns viewport layout and scaling (`transform: scale()` with contain behavior).
- Each `geek-slide` hosts content in Shadow DOM and keeps transitions isolated.
- In overview mode (`mode="overview"`), the container switches to a CSS grid showing
  all slide thumbnails. Clicking a thumbnail navigates to that slide and exits overview.
  A `ResizeObserver` tracks the rendered cell width and sets `--gs-thumbnail-scale` on
  each slide element so slide content scales down proportionally inside Shadow DOM.
  The `.gs-features` wrapper (which holds the whiteboard overlay and toolbar) is hidden
  via `display: none` in overview CSS so the canvas cannot block thumbnail interaction.
  Auto-activation pointer handlers also guard against `mode !== 'present'` so drags
  in overview never activate the whiteboard.
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
- Type command (`help`, `go 8`, `speaker`, `whiteboard`, `overview`, `fullscreen`, `share`).
- Press Enter to execute; Esc closes the terminal.
- `help` output stays visible until manually dismissed (no auto-dismiss).
- `setOutput(message, isError?, { persist? })` displays command results. The terminal always stays open until Escape is pressed. With `persist: true`, also re-opens the terminal if it was already closed.
- `setOutputLink(prefix, url, { persist? })` renders the prefix as escaped text followed by a clickable `<a target="_blank">` link built via DOM manipulation (no innerHTML). Used by `share` to display the viewer URL.
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
