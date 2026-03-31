# Speaker Notes Architecture

## Problem with v1

v1 implements speaker notes as a **CSS trick**: a `div.slide-notes` is absolutely positioned
at `left: 100%` of the active slide, becoming visible only when `.speaker` class is toggled
on the slideshow container. The notes panel overlays the right half of the viewport.

```css
/* v1: minislides.css */
.slidedeck.speaker section.active div.slide-notes {
  display: block;
  position: absolute;
  left: 100%;      /* pushed to the right of the slide */
  width: 100%;
  height: 200%;
  font-size: 40pt;
}
```

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

The speaker view opens in a **second browser tab/window** (via `window.open()` or Ctrl+B → s),
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

A dedicated Web Component that renders the full speaker interface:

```typescript
// packages/engine/src/components/SpeakerView.ts

class GeekSpeakerView extends HTMLElement {
  #shadow: ShadowRoot;
  #slides: SlideData[];
  #currentSlide = 0;
  #timer: SpeakerTimer;

  connectedCallback(): void {
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = `
      <style>
        :host {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          grid-template-rows: 1fr auto;
          gap: 1rem;
          height: 100vh;
          padding: 1rem;
          background: #1a1a1a;
          color: #fff;
          font-family: system-ui, sans-serif;
        }
        .current-slide {
          grid-column: 1;
          grid-row: 1;
          border: 2px solid #4a9eff;
          border-radius: 4px;
          overflow: hidden;
        }
        .next-slide {
          grid-column: 2;
          grid-row: 1;
          border: 1px solid #555;
          border-radius: 4px;
          overflow: hidden;
          opacity: 0.7;
        }
        .notes {
          grid-column: 3;
          grid-row: 1 / -1;
          overflow-y: auto;
          padding: 1rem;
          background: #2a2a2a;
          border-radius: 4px;
          font-size: 1.2rem;
          line-height: 1.6;
        }
        .controls {
          grid-column: 1 / 3;
          grid-row: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem;
        }
        .timer {
          font-size: 2rem;
          font-variant-numeric: tabular-nums;
        }
        .slide-counter {
          font-size: 1.2rem;
          opacity: 0.8;
        }
      </style>
      <div class="current-slide">
        <slot name="current"></slot>
      </div>
      <div class="next-slide">
        <slot name="next"></slot>
      </div>
      <div class="notes"></div>
      <div class="controls">
        <span class="timer">00:00:00</span>
        <span class="slide-counter"></span>
        <div class="nav-buttons">
          <button data-cmd="prev">◀ Prev</button>
          <button data-cmd="next">Next ▶</button>
        </div>
      </div>
    `;
  }

  /** Update view when slide changes (called by Yjs observer) */
  updateSlide(index: number): void {
    this.#currentSlide = index;
    
    // Render current slide thumbnail
    this.#renderThumbnail('current', this.#slides[index]);
    
    // Render next slide preview
    if (index + 1 < this.#slides.length) {
      this.#renderThumbnail('next', this.#slides[index + 1]);
    }
    
    // Update notes (full markdown rendering, independently scrollable)
    const notesEl = this.#shadow.querySelector('.notes')!;
    notesEl.innerHTML = this.#slides[index].notesHtml || '<em>No notes for this slide</em>';
    notesEl.scrollTop = 0;
    
    // Update counter
    const counter = this.#shadow.querySelector('.slide-counter')!;
    counter.textContent = `Slide ${index + 1} / ${this.#slides.length}`;
  }

  #renderThumbnail(slot: string, slide: SlideData): void {
    const container = this.#shadow.querySelector(`.${slot}-slide`)!;
    // Render a scaled-down clone of the slide HTML
    container.innerHTML = `
      <div style="transform: scale(0.3); transform-origin: top left; width: 333%; height: 333%;">
        ${slide.html}
      </div>
    `;
  }
}
```

### SpeakerTimer

```typescript
// packages/engine/src/components/SpeakerTimer.ts

export class SpeakerTimer {
  #startTime: number | null = null;
  #elapsed = 0;
  #running = false;
  #callback: (formatted: string) => void;
  #frameId: number | null = null;

  constructor(callback: (formatted: string) => void) {
    this.#callback = callback;
  }

  start(): void {
    this.#startTime = Date.now() - this.#elapsed;
    this.#running = true;
    this.#tick();
  }

  pause(): void {
    this.#running = false;
    this.#elapsed = Date.now() - (this.#startTime ?? Date.now());
    if (this.#frameId) cancelAnimationFrame(this.#frameId);
  }

  reset(): void {
    this.#startTime = null;
    this.#elapsed = 0;
    this.#running = false;
    this.#callback('00:00:00');
  }

  #tick(): void {
    if (!this.#running) return;
    const ms = Date.now() - (this.#startTime ?? Date.now());
    const secs = Math.floor(ms / 1000);
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    this.#callback(`${h}:${m}:${s}`);
    this.#frameId = requestAnimationFrame(() => this.#tick());
  }
}
```

### Opening the Speaker View

From the presentation tab:

```typescript
// Ctrl+B → s triggers this command
commands.register({
  name: 'open-speaker-view',
  label: 'Open Speaker View',
  category: 'mode',
  execute: () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'speaker');
    window.open(url.toString(), 'geek-speaker', 'width=1200,height=800');
  },
});
```

The engine's initialization detects `?view=speaker` and renders `<geek-speaker-view>`
instead of `<geek-slideshow>`:

```typescript
// packages/engine/src/index.ts (simplified)
const params = new URLSearchParams(window.location.search);
if (params.get('view') === 'speaker') {
  document.body.appendChild(document.createElement('geek-speaker-view'));
} else {
  document.body.appendChild(document.createElement('geek-slideshow'));
}
```

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
| Layout | Notes overlay right half of slide | Dedicated window/tab with grid layout |
| Slide size | Shrinks to ~50% in speaker mode | Full-screen presentation, unaffected |
| Scrolling | Fragile (overflow + transform conflicts) | Native scrollable container |
| Next slide preview | None | Thumbnail of next slide |
| Timer | None | Built-in, start/pause/reset |
| Navigation controls | Keyboard only | Buttons + keyboard |
| Sync mechanism | CSS class toggle | Yjs Y.Map shared state |
| Multi-monitor | Awkward (one window, split) | Tab 1 on projector, Tab 2 on laptop |
| Print | Same div reused with CSS overrides | Separate template, clean rendering |
| Mobile | Unusable (notes push slide off-screen) | Speaker view not relevant on mobile |
