# Phase 2: Slide Rendering (Web Components)

**Status**: Not started
**Depends on**: Phase 1 (parser produces `SlideData[]`)
**Unlocks**: Phases 3, 4, 5, 6, 7 (all of which need a rendered slideshow)

## Goal

Implement the two core Web Components (`<geek-slideshow>` and `<geek-slide>`) that
render parsed slides in the browser with CSS scaling, transitions, partials, and
per-slide scoped styles. This is the visual heart of the engine.

At the end of this phase, opening the dev server shows a fully rendered slide deck
from markdown with arrow-key navigation (hardcoded, pre-CommandSystem), smooth
transitions, partial reveals, and correct aspect-ratio scaling on any viewport size.

## Deliverables

### 1. `<geek-slideshow>` (`packages/engine/src/core/Slideshow.ts`)

Root orchestrator component. Custom Element with open Shadow DOM.

**Responsibilities**:
- Receives `SlideData[]` via `loadSlides()` and creates `<geek-slide>` children.
- Manages current slide and partial indices.
- Handles aspect-ratio scaling via `transform: scale()` with `ResizeObserver`.
- Exposes `next()`, `prev()`, `goTo(slide, partial?)` for navigation.
- Dispatches `geek:navigate` after any position change.
- Dispatches `geek:slides:loaded` after `loadSlides()` completes.
- Listens for `geek:navigate` events (from future CommandSystem/SyncManager).
- Supports three modes: `present` (default), `speaker`, `overview`.

**Shadow DOM structure**: A single container div holding slotted `<geek-slide>` elements.
The `:host` fills `100vw × 100vh` with `overflow: hidden` and `position: relative`.

**CSS scaling**: The private `#rescale()` method reads the element's `clientWidth` and
`clientHeight`, computes horizontal and vertical scale factors against the target
aspect ratio (default 1920×1080 for 16:9), picks the limiting axis (contain behavior),
and sets a `--gs-scale-factor` CSS custom property on the container. The container
uses `transform: scale(var(--gs-scale-factor))` with `transform-origin: top left`.
A `ResizeObserver` calls `#rescale()` on every size change.

**Transitions**: Active slide gets the `[active]` attribute. CSS transitions handle
opacity (0→1) over `var(--gs-transition-duration, 0.3s)`. Previous and next slides
are positioned but invisible.

### 2. `<geek-slide>` (`packages/engine/src/core/Slide.ts`)

Individual slide container. Custom Element with open Shadow DOM.

**Responsibilities**:
- Renders HTML content in a `.content` div with a `<slot>`.
- Manages partial reveals: elements with `[partial]` attribute start hidden,
  `revealPartial(n)` shows the first `n` partials.
- Exposes `partialCount`, `notes` (HTML), `backgroundImage`, `backgroundColor`.
- Applies per-slide scoped CSS (received as pre-scoped CSS from StyleScoper).

**Shadow DOM styles**: `:host` uses flexbox centering with configurable padding
(`--gs-slide-padding`) and font size (`--gs-base-font-size`). Partial elements
start as `visibility: hidden` and become visible with the `[visible]` attribute.

### 3. CSS Custom Properties

Define the theming API that authors override in `local.css`:

- Slideshow: `--gs-bg`, `--gs-color`, `--gs-font-family`, `--gs-base-font-size`,
  `--gs-slide-padding`, `--gs-aspect-ratio`.
- Code blocks: `--gs-code-bg`, `--gs-code-font`, `--gs-code-font-size`.
- Transitions: `--gs-transition-duration`, `--gs-transition-timing`.

### 4. Entry point wiring

Update `packages/engine/src/index.ts` to:
- Register `geek-slideshow` and `geek-slide` custom elements.
- Export `Slideshow`, `Slide`, `SlideParser`, `StyleScoper`, `Config`, `SlideData`.

Create a minimal `index.html` in the project root (served by Vite dev server) that:
- Loads `@geekslides/engine`.
- Fetches `config.json` and content markdown.
- Calls `SlideParser.parse()` then `slideshow.loadSlides()`.
- Provides hardcoded arrow-key listeners calling `next()`/`prev()` (temporary,
  replaced by CommandSystem in Phase 4).

### 5. Tests

**`packages/engine/tests/integration/Slideshow.test.ts`** (Vitest browser mode):
- `loadSlides()` creates the expected number of `<geek-slide>` children.
- First slide is active after loading.
- `next()` reveals partials before advancing to the next slide.
- `prev()` reverses partial reveals, then goes to previous slide.
- `goTo(n)` jumps to the correct slide.
- `geek:navigate` event fires with correct `detail`.
- CSS scaling produces a non-zero `--gs-scale-factor` value.
- Per-slide scoped styles affect only their target slide.

## File List

```
packages/engine/src/core/
├── Slideshow.ts        (new)
├── Slide.ts            (new)
├── Config.ts           (from Phase 1)
├── SlideParser.ts      (from Phase 1)
└── StyleScoper.ts      (from Phase 1)

packages/engine/src/
└── index.ts            (updated: register + export)

packages/engine/tests/integration/
└── Slideshow.test.ts   (new)

index.html              (new — Vite dev entry)
```

## Acceptance Criteria

- [ ] Slides render visually in the browser via `npm run dev`.
- [ ] Arrow keys navigate between slides with smooth transitions.
- [ ] Partials reveal incrementally before slide advances.
- [ ] Slides scale correctly at any browser window size (resize test).
- [ ] Per-slide `<style>` blocks scope to the correct slide only.
- [ ] Background images and colors apply from separator syntax.
- [ ] `geek:navigate` and `geek:slides:loaded` events fire correctly.
- [ ] Integration tests pass in Vitest browser mode.
- [ ] No layout/rendering regressions when viewport is resized rapidly.

## Reference Docs

- [components.md](../components.md) — full component specs, Shadow DOM strategy
- [css-scaling.md](../css-scaling.md) — transform:scale() technique, ResizeObserver
- [architecture-v2.md](../architecture-v2.md) — component hierarchy diagram
