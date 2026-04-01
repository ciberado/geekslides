# Phase 7: Speaker View

**Status**: Implemented
**Depends on**: Phase 2 (slideshow rendering), Phase 5 (Yjs sync between tabs)
**Unlocks**: Phase 12 (E2E test for speaker workflow)

## Goal

Implement the separate speaker view: a `<geek-speaker-view>` component that opens
in a second browser tab, connected to the same Yjs room, showing current slide
thumbnail, next slide preview, scrollable speaker notes, timer, and navigation
controls. This replaces v1's CSS overlay approach.

At the end of this phase, running `speaker` from terminal mode (`t`) opens a new tab with the full
speaker interface. Navigation in either tab syncs to the other. The timer starts
automatically and can be paused/reset.

## Deliverables

### 1. `<geek-speaker-view>` (`packages/engine/src/components/SpeakerView.ts`)

Dedicated Web Component for the speaker interface.

**Shadow DOM layout**: CSS Grid with three columns and two rows:
- Column 1, Row 1: Current slide thumbnail (scaled clone, blue border).
- Column 2, Row 1: Next slide thumbnail (dimmed, gray border).
- Column 3, Rows 1–2: Speaker notes panel (scrollable, dark background,
  1.2 rem font, 1.6 line height, full markdown-rendered content).
- Columns 1–2, Row 2: Controls bar with timer display (2 rem, `tabular-nums`),
  slide counter, prev/next buttons, pause/reset controls.

**`:host`**: Fills `100vh`, dark background (`#1a1a1a`), white text, 1 rem padding.

**`loadSlides(slides: SlideData[])`**: Stores the full slides array for thumbnail
rendering and notes access.

**`updateSlide(index)`**: Called on slide changes (from Yjs observer or local navigation).
Renders a 30% scale clone of the current and next slide HTML into the thumbnail
containers. Updates the notes panel with `slides[index].notesHtml` (or a "No notes"
fallback). Resets notes scroll position. Updates the counter text.

**Navigation**: Prev/next buttons call `SyncManager.publishState()` to navigate,
which syncs back to the presentation tab.

### 2. SpeakerTimer (`packages/engine/src/components/SpeakerTimer.ts`)

Presentation timer using `requestAnimationFrame`.

**State**: `#startTime`, `#elapsed` (accumulated ms), `#running` (boolean).
Constructor receives a callback `(formatted: string) => void`.

- **`start()`**: Records current time minus accumulated elapsed. Begins rAF loop
  that computes elapsed ms and calls the callback with `HH:MM:SS` formatted string.
- **`pause()`**: Stops the rAF loop, records elapsed.
- **`reset()`**: Clears state, calls callback with `'00:00:00'`.

The timer auto-starts when the speaker view opens.

### 3. Speaker view entry logic

Update the engine's initialization to check `URLSearchParams` for `view=speaker`.

- If present: Create and append `<geek-speaker-view>` instead of `<geek-slideshow>`.
  Connect to the same Yjs room. Load the same `SlideData[]`. Subscribe to the
  Y.Map observer to call `updateSlide()` on remote state changes.

- The presentation tab is unchanged — it doesn't know or care about the speaker tab.

### 4. Open speaker view command

The `toggle-speaker` command (already registered in Phase 4) constructs a URL from
the current location with `?view=speaker` appended and opens it via `window.open()`
with suggested dimensions `1200×800`. If a speaker window is already open, it focuses
it instead of opening a duplicate.

### 5. Custom element registration

Update `packages/engine/src/index.ts` to register `geek-speaker-view`.

### 6. Tests

**`packages/engine/tests/unit/SpeakerTimer.test.ts`**:
- `start()` begins calling the callback with incrementing time strings.
- `pause()` stops updates; `start()` resumes from paused position.
- `reset()` calls callback with `'00:00:00'` and stops.

**`packages/engine/tests/integration/SpeakerView.test.ts`** (Vitest browser mode):
- `loadSlides()` populates thumbnails and notes.
- `updateSlide(n)` changes the displayed slide and notes content.
- Notes panel scrolls when content overflows.
- Slide counter shows correct `n / total`.

## File List

```
packages/engine/src/components/
├── SpeakerView.ts
└── SpeakerTimer.ts

packages/engine/tests/unit/
└── SpeakerTimer.test.ts

packages/engine/tests/integration/
└── SpeakerView.test.ts
```

## Acceptance Criteria

- [ ] `speaker` command opens a new browser tab with the speaker view.
- [ ] Current slide thumbnail matches the presentation tab's active slide.
- [ ] Next slide preview shows the following slide.
- [ ] Speaker notes render with full markdown formatting and scroll independently.
- [ ] Timer starts on open, displays `HH:MM:SS`, pause/reset work.
- [ ] Navigation from speaker view syncs back to the presentation tab.
- [ ] Navigation from presentation tab updates the speaker view.
- [ ] "No notes for this slide" fallback when notes are absent.
- [ ] All unit and integration tests pass.

## Reference Docs

- [speaker-notes.md](../speaker-notes.md) — full speaker view architecture, two-tab model, v1 vs v2 comparison
- [sync.md](../sync.md) — Yjs shared state between tabs
- [components.md](../components.md) — `<geek-speaker-view>` component spec
