# Speaker Notes Architecture

## Problem with v1

v1 implements speaker notes as a **CSS trick**: a `div.slide-notes` is absolutely positioned
at `left: 100%` of the active slide, becoming visible only when `.speaker` class is toggled
on the slideshow container. The notes panel overlays the right half of the viewport.

In v1's `minislides.css`, the `.slidedeck.speaker section.active div.slide-notes` rule sets `display: block`, `position: absolute`, `left: 100%` (pushed to the right of the slide), `width: 100%`, `height: 200%`, and `font-size: 40pt`.

**Limitations**:

1. **Single viewport** — notes and slides fight for the same screen. The slide shrinks to
   ~50% to make room for notes alongside it.
2. **No independent scrolling** — notes taller than the visible area overflow without a
   usable scroll container (the `overflow: scroll` fights with slide transforms).
3. **Scaling conflicts** — the `transform: scale()` that sizes the slide also scales the
   notes panel, making font sizes unpredictable.
4. **No timer / slide preview** — presenters using notes typically also need a timer
   and a preview of the next slide. CSS-only approaches can't provide this.
5. **Print coupling** — the same notes div is reused for print, requiring CSS overrides
   that clash with the presentation layout.

## v2: Separate Speaker View

v2 treats speaker notes as a **first-class separate view** rather than a CSS overlay.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Speaker's Device                             │
│                                                                     │
│  ┌─ Browser Tab 1 ──────────────────────────────────────────────┐   │
│  │  Presentation View  (geek-slideshow, mode="present")         │   │
│  │  ├── Full-screen slide rendering                             │   │
│  │  └── Projected to audience                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                     │                                               │
│                     │  Yjs Y.Map sync (same room, local)            │
│                     │  ├── currentSlide                             │
│                     │  ├── currentPartial                           │
│                     │  └── whiteboardStrokes                        │
│                     │                                               │
│  ┌─ Browser Tab 2 ──┴──────────────────────────────────────────┐   │
│  │  Speaker View  (geek-speaker-view)                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │   │
│  │  │ Current Slide│  │  Next Slide  │  │   Speaker Notes    │ │   │
│  │  │  (thumbnail) │  │  (thumbnail) │  │   (scrollable)     │ │   │
│  │  │              │  │              │  │                    │ │   │
│  │  │              │  │              │  │   Markdown-rendered │ │   │
│  │  │              │  │              │  │   with full         │ │   │
│  │  └──────────────┘  └──────────────┘  │   formatting       │ │   │
│  │  ┌─────────────────────────────────┐ │                    │ │   │
│  │  │ Timer: 00:14:32   Slide 5/28   │ │                    │ │   │
│  │  │ [Reset] [Pause]  [◀] [▶]      │ │                    │ │   │
│  │  └─────────────────────────────────┘ └────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Two-Tab Model

The speaker view opens in a **second browser tab/window** (via `window.open()` or the `speaker` terminal command),
connected to the same Yjs room. Both tabs share the same session state:

| Shared State (Y.Map) | Written by | Read by |
|-----------------------|------------|---------|
| `currentSlide` | Presentation tab | Speaker tab |
| `currentPartial` | Presentation tab | Speaker tab |
| `mode` | Either tab | Both tabs |
| `whiteboardStrokes` | Either tab | Both tabs |
| `timer` | Speaker tab | Speaker tab |

Navigation can happen from **either tab**: the speaker can advance slides from the speaker
view's controls, and the change syncs back to the presentation tab via Yjs.

### `<geek-speaker-view>` Component

A dedicated Web Component that renders the full speaker interface.

`GeekSpeakerView` extends HTMLElement with Shadow DOM. The current implementation uses a two-part layout:

- **Left pane**: speaker notes in a dedicated card with its own scroll container.
- **Right pane**: current slide preview above next slide preview.
- **Bottom row**: elapsed timer, wall clock (HH:MM), slide counter, and navigation controls.

The main notes/preview split and the current/next preview split are both draggable in desktop layouts. The notes card header also includes `A-` and `A+` controls to adjust notes font size without affecting slide previews.

The component no longer injects raw slide HTML into simple thumbnail divs. Instead, it renders real `geek-slide` instances in both preview panes, which means the speaker view now reuses:

- slide Shadow DOM rendering
- per-slide scoped CSS
- presentation-wide deck CSS
- active slide processors (iframe/chart/video/etc.)
- the deck's configured aspect ratio

Preview stages are scaled to fit their panes while keeping the slide centered both horizontally and vertically.

**`updateSlide(index, partial)`**: Called when slide or partial state changes (via Yjs observer or local speaker navigation). It renders the current slide preview using the active partial index and renders the next slide preview at partial `0`.

Speaker preview partial semantics differ intentionally from presentation mode:

- already revealed partials render normally
- unrevealed partials remain visible but de-emphasized

This gives the presenter full context without losing which parts of the slide have already been shown.

### SpeakerTimer

`SpeakerTimer` manages the presentation timer using `requestAnimationFrame` for smooth updates.

It tracks a start time, accumulated elapsed milliseconds, and a running state. It receives a callback function `(formatted: string) => void` that is called with an `HH:MM:SS` formatted string on each animation frame.

- **`start()`**: Records the current time (minus any previously accumulated elapsed time for resume) and begins the `requestAnimationFrame` loop.
- **`pause()`**: Stops the loop and records the elapsed time.
- **`reset()`**: Clears all state and calls the callback with `'00:00:00'`.

### Opening the Speaker View

The `speaker` terminal command constructs a new URL from the current location with `?view=speaker` appended, then opens it via `window.open()` with suggested dimensions of 1200×800.

On initialization, the engine checks `URLSearchParams` for `view=speaker`. If present, it creates and appends a `<geek-speaker-view>` element instead of the normal `<geek-slideshow>`. The speaker view receives the same deck CSS, active processors, slide index, and partial index as the presentation view. Both connect to the same Yjs room, so they share state automatically.

### Notes Authoring Format

Notes in markdown remain the same `::: Notes` container syntax parsed by
`SlideParser`, extracted as `SlideData.notesHtml`:

```markdown
[](#my-slide)

## Slide Title

Main content here.

::: Notes
These are speaker notes. They support **full markdown** formatting:

- Bullet points for talking points
- `code` references
- Links to demos

They can be as long as needed — the speaker view scrolls independently.
:::
```

### Notes in Print

The `PrintRenderer` uses the same `SlideData.notesHtml` field to populate:

- **slides.pdf**: notes omitted
- **slides-notes.pdf**: notes rendered below each slide in a dedicated `<aside>`
- **book.pdf**: notes rendered as body text between slide images

No CSS tricks needed — print templates explicitly place notes using standard HTML layout.

### Comparison: v1 vs v2

| Aspect | v1 (CSS trick) | v2 (Separate view) |
|--------|----------------|---------------------|
| Layout | Notes overlay right half of slide | Dedicated window/tab with resizable notes and preview panes |
| Slide size | Shrinks to ~50% in speaker mode | Full-screen presentation, unaffected |
| Scrolling | Fragile (overflow + transform conflicts) | Native scrollable container |
| Next slide preview | None | Thumbnail of next slide |
| Timer | None | Built-in, start/pause/reset |
| Navigation controls | Keyboard only | Buttons + keyboard |
| Notes readability | Scaled with slide CSS hack | Independent font-size controls |
| Sync mechanism | CSS class toggle | Yjs Y.Map shared state |
| Multi-monitor | Awkward (one window, split) | Tab 1 on projector, Tab 2 on laptop |
| Print | Same div reused with CSS overrides | Separate template, clean rendering |
| Mobile | Unusable (notes push slide off-screen) | Speaker view not relevant on mobile |
