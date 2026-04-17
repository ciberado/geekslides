# Phase 15: UX Enhancements

**Status**: In progress
**Depends on**: Phase 14 (CLI Docker Image)
**Unlocks**: None (polish phase)

## Goal

Address UX gaps across the presentation view, terminal, CLI, accessibility,
sync feedback, and mobile input. Each item is scoped as a self-contained change
that can be implemented and tested independently.

## Deliverables

### 1. Fix `build` command CSS copy path (Bug)

**Problem**: `build.ts` copies style files with `basename(stylePath)`, so
`css/local.css` lands at `dist/local.css` instead of `dist/css/local.css`,
breaking the relative path in config.json.

**Fix**: Use the original relative path as the destination inside `dist/`.

**File**: `packages/cli/src/commands/build.ts`

---

### 2. Fix terminal auto-dismiss for `help`

**Problem**: The terminal auto-dismisses after 1 200 ms — even for `help`
output, which lists 15+ commands. Users can't read it.

**Fix**: Skip auto-dismiss when the executed command is `help`. Only
auto-dismiss for single-line results.

**File**: `packages/engine/src/components/Terminal.ts`

---

### 3. Eliminate `goto` / `go` command duplication

**Problem**: The terminal has a hard-coded `goto <n>` built-in *and* the
command system registers a `go <n>` command. Two names, same action.

**Fix**: Remove the hard-coded `goto` built-in from Terminal and keep only the
`go` command registered in index.html. Add a `goto` alias that delegates to
`go`. Add error feedback when `go` receives an invalid argument.

**Files**: `packages/engine/src/components/Terminal.ts`, `index.html`

---

### 4. Register missing `toggle-toolbar` command

**Problem**: `TouchInput` executes `toggle-toolbar` on long-press, but no such
command is registered. The call silently fails.

**Fix**: Register a no-op `toggle-toolbar` command now (logged as placeholder),
so the long-press at least doesn't produce a console warning. In the future
this can be wired to an actual toolbar.

**File**: `index.html`

---

### 5. Add slide counter / progress bar

**Problem**: No visual indicator of position within the deck.

**Implementation**: Render a minimal `<div class="gs-progress">` inside the
slideshow shadow DOM. It contains a thin bottom-edge progress bar and a
`Slide N / M` counter in the bottom-right corner. Hidden in overview mode.
Updated on every `geek:navigate` event.

**File**: `packages/engine/src/core/Slideshow.ts`

---

### 6. Add keyboard shortcut overlay (`?`)

**Problem**: Users have no way to discover shortcuts without reading docs or
typing `help` in the terminal.

**Implementation**: Pressing `?` in normal mode toggles a semi-transparent
overlay listing all key bindings and terminal commands. Pressing `?` or
`Escape` dismisses it. Implemented as a method on Slideshow and triggered from
KeyBindings.

**Files**: `packages/engine/src/core/Slideshow.ts`,
`packages/engine/src/input/KeyBindings.ts`, `index.html`

---

### 7. Add basic ARIA attributes

**Problem**: Zero accessibility markup across all components.

**Implementation**:
- `<geek-slideshow>`: `role="region"`, `aria-roledescription="slide deck"`,
  `aria-label` set to deck title.
- `<geek-slide>`: `role="group"`, `aria-roledescription="slide"`,
  `aria-label="Slide N of M"`, `aria-hidden` on inactive slides.
- `<geek-terminal>`: `role="combobox"` on the input.
- `aria-live="polite"` region announces slide changes.

**Files**: `packages/engine/src/core/Slideshow.ts`,
`packages/engine/src/core/Slide.ts`,
`packages/engine/src/components/Terminal.ts`

---

### 8. Add sync status indicator

**Problem**: Users don't know if sync is working, disconnected, or following.

**Implementation**: Render a small dot indicator in the top-right corner of the
slideshow. Green = connected + following, orange = connected + not following,
grey = disconnected, hidden = sync disabled. Updated via `geek:sync:state`
events.

**File**: `index.html` (appended to slideshow shadow DOM)

---

### 9. Add PDF export progress logging

**Problem**: PDF export of large decks produces no output for 30+ seconds.

**Fix**: Log `Capturing slide N/M...` to stdout during screenshot capture.

**File**: `packages/cli/src/commands/pdf.ts`

---

### 10. Add loading state for initial deck render

**Problem**: While the deck loads (fetch config, markdown, CSS, parse), the
page is blank. On slow connections or large decks this is confusing.

**Fix**: Show a lightweight CSS-only loading indicator in the `<body>` before
the slideshow mounts. Remove it when slides are loaded.

**File**: `index.html`

---

### 11. Add error feedback for `go` command invalid args

**Problem**: `go abc` or `go 0` silently does nothing.

**Fix**: Show an error message in the terminal when the argument is invalid or
out of range.

**File**: `index.html`

---

## Testing

- **Unit tests**: Terminal auto-dismiss behavior, `go` command error cases.
- **Integration tests**: Slide counter renders, ARIA attributes present.
- **E2E tests**: Keyboard `?` overlay opens/closes, progress bar visible,
  sync indicator color changes on connect/disconnect.

## Non-goals

- Full toolbar implementation (future phase).
- Overview mode grid layout (separate design task).
- Speaker view slide counter (separate task, similar pattern).
- Touch zone ratio change (needs user testing data first).
