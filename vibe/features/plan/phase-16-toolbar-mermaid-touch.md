# Phase 16: Toolbar, Mermaid & Touch Tuning

**Status**: Complete
**Depends on**: Phase 15 (UX Enhancements)
**Unlocks**: None (feature phase)

## Goal

Deliver three features deferred from Phase 15 and fix remaining lint errors:
a full presentation toolbar, a built-in Mermaid diagram processor, and
configurable touch zone ratios.

## Deliverables

### 1. Fix remaining lint errors

**Problem**: Two lint violations survive from Phase 15:
- `header-preprocessor.ts`: Forbidden non-null assertion (`lines[i]!`)
- `PluginProxy.ts`: Confusing void expression (`() => controller.abort()`)

**Fix**: Use a proper `undefined` guard in header-preprocessor; add braces to
the arrow function in PluginProxy.

**Files**: `packages/engine/src/plugins/builtins/header-preprocessor.ts`,
`packages/server/src/PluginProxy.ts`

**Resolution**: Used a local variable with `undefined` guard in
header-preprocessor; added braces to arrow function in PluginProxy.

---

### 2. Full toolbar implementation

**Problem**: `toggle-toolbar` is registered as a no-op placeholder. Long-press
on mobile and any future shortcut have no effect.

**Implementation**: Render a `.gs-toolbar` element inside the Slideshow shadow
DOM. The toolbar is a translucent horizontal bar anchored to the bottom of the
viewport with icon buttons for the most common commands:

| Button | Icon | Command |
|--------|------|---------|
| Previous | ◀ | `prev` |
| Next | ▶ | `next` |
| Overview | ⊞ | `overview` |
| Fullscreen | ⛶ | `fullscreen` |
| Whiteboard | ✎ | `whiteboard` |
| Speaker | 🎤 | `speaker` |

- Hidden by default; toggled via `toggleToolbar()` on Slideshow.
- Auto-hidden in overview mode.
- Each button calls `this.dispatchEvent(new CustomEvent('geek:toolbar:command'))`.
- The `toggle-toolbar` command in `index.html` wires to `slideshow.toggleToolbar()`.
- A `Toolbar` keyboard shortcut is not assigned (toolbar is touch / command-only).

**Files**: `packages/engine/src/core/Slideshow.ts`, `index.html`

**Resolution**: Toolbar rendered inside Slideshow shadow DOM with CSS for
translucent floating bar, 6 icon buttons (prev, next, overview, fullscreen,
whiteboard, speaker) with a separator. `toggleToolbar()` method added.
`toggle-toolbar` command wired in index.html. Toolbar button clicks dispatch
`geek:toolbar:command` custom events handled in index.html.

---

### 3. Mermaid diagram processor

**Problem**: ` ```mermaid ``` ` fenced blocks render as raw `<pre><code>` text.
Users must pre-export diagrams as images.

**Implementation**: A new built-in processor `mermaid-processor` that:
1. Finds `<pre>` elements containing `<code class="language-mermaid">`.
2. Extracts the text content as a Mermaid definition.
3. Dynamically imports the `mermaid` library (lazy — only loaded when needed).
4. Calls `mermaid.render()` to produce SVG.
5. Replaces the `<pre>` with a `<div class="gs-mermaid">` containing the SVG.

The processor is async-internally but conforms to the synchronous `Processor`
signature by using `void promise`. Render errors are caught and logged as
`console.warn`.

- Registered as built-in name `'mermaid'`.
- Users opt-in via `config.json`: `"plugins": { "processors": ["iframe", "mermaid"] }`.
- `mermaid` npm package added to `@geekslides/engine` dependencies.

**Files**: `packages/engine/src/plugins/builtins/mermaid-processor.ts`,
`packages/engine/src/index.ts`, `index.html`

**Resolution**: Processor dynamically imports `mermaid` (v11.4) only when
needed. Finds `<pre><code class="language-mermaid">` elements, renders to SVG
asynchronously, replaces `<pre>` with `<div class="gs-mermaid">`. Render
failures caught and marked with `.gs-mermaid-error` class. Registered as
built-in `'mermaid'` processor — users opt-in via config.

---

### 4. Touch zone ratio tuning

**Problem**: The fixed 33/67 tap-zone split is not configurable and has no
centre dead zone, causing accidental navigation taps.

**Implementation**:
- Add a `prevZoneRatio` constructor option to `TouchInput` (default `0.25`).
- Tap left of `prevZoneRatio × viewportWidth` → `prev`.
- Tap right of `(1 − prevZoneRatio) × viewportWidth` → `next`.
- Taps in the centre dead zone are ignored (no command fired).
- The ratio is passed from `index.html` when constructing `TouchInput`.

This creates a 25 / 50 / 25 split by default (prev / dead / next).

**Files**: `packages/engine/src/input/TouchInput.ts`, `index.html`

**Resolution**: Added `TouchInputOptions` interface with optional
`tapZoneRatio`. Default changed from 0.33 (no dead zone) to 0.25 (symmetric
25/50/25 split). Centre taps are now ignored, preventing accidental navigation.

---

## Testing

### Unit tests (all passing — 246 tests across 29 files)

- **Lint fixes**: `npm run lint` passes clean (0 errors).
- **Toolbar** (8 tests in `toolbar.test.ts`): Renders `.gs-toolbar` in shadow
  DOM; hidden by default; `toggleToolbar()` toggles open; contains all 6
  command buttons; button clicks dispatch correct events; buttons have
  aria-labels; separator elements present.
- **Mermaid processor** (6 tests in `mermaid-processor.test.ts`): Finds and
  renders mermaid blocks; ignores non-mermaid code; skips empty definitions;
  handles multiple blocks per slide; adds error class on render failure;
  ignores non-mermaid languages.
- **Touch zones** (10 tests in `TouchInput.test.ts`): Swipe left/right
  gestures; tap in left 25% → prev; tap in right 25% → next; centre dead zone
  fires no command; boundary taps; custom ratio respected; custom ratio dead
  zone; long-press triggers toggle-toolbar.

### E2E tests

- Toolbar visible on `toggle-toolbar` command, buttons functional.
- Mermaid diagram renders as SVG in a slide.

## Non-goals

- Toolbar customisation (button order, which buttons shown).
- Mermaid theme configuration beyond library defaults.
- Per-deck touch zone ratio in config.json (hardcoded default for now).
