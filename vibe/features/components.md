# Web Components Architecture

## Overview

geekslides v2 uses native Web Components (Custom Elements + Shadow DOM) for all UI
elements. This gives true style encapsulation, standard lifecycle hooks, and zero
framework overhead.

## Component Hierarchy

```
<geek-slideshow>                    # root component, owns slide state
├── <geek-slide>                    # one per slide section
│   ├── (slide HTML content)        # from markdown rendering
│   ├── <style>                     # scoped per-slide styles
│   └── <geek-chart>?               # optional chart component
│       └── <canvas>
├── <geek-toolbar>                  # bottom toolbar (touch/mouse)
│   ├── slide counter
│   ├── mode buttons
│   └── sync indicator
├── <geek-command-palette>          # modal command search (hidden by default)
│   ├── <input> (search)
│   └── <ul> (filtered commands)
├── <geek-whiteboard>               # canvas overlay (hidden by default)
│   └── <canvas>
└── <geek-video>?                   # video partial controller
    └── <video>
```

## Shadow DOM Strategy

### Browser Rendering (Shadow DOM ON)

Each component uses Shadow DOM for full style isolation:

`GeekSlideshow` extends `HTMLElement` and attaches an open `ShadowRoot` in the constructor. Its connected callback injects Shadow DOM styles that make the `:host` fill the viewport (`100vw × 100vh`, `overflow: hidden`, `position: relative`). The `:host([mode="speaker"])` selector applies a different layout for speaker mode. Slotted `<geek-slide>` elements are positioned absolutely with `inset: 0`, start at `opacity: 0`, and transition to `opacity: 1` when they receive the `[active]` attribute. Transitions on opacity and transform take 0.3 s.

### Print Rendering (Shadow DOM OFF)

WeasyPrint cannot pierce Shadow DOM boundaries. The `PrintRenderer` produces a flat
HTML document with equivalent styles inlined in the `<head>`:

`PrintRenderer` has a `render(slides, template)` method that accepts a `SlideData[]` array and a template name (`'slides'`, `'slides-notes'`, or `'book'`). It loads the corresponding HTML template, renders each slide as a plain `<section class="gs-slide">` element (no Custom Elements) with the slide's attributes, scoped CSS in a `<style>` tag, HTML content, and optionally an `<aside class="gs-notes">` containing speaker notes (depending on template). It returns the complete HTML string by substituting `{{slides}}` and `{{styles}}` placeholders in the template.

## Component Specifications

### `<geek-slideshow>`

The root orchestrator. Manages slide deck state, navigation, and aspect ratio scaling.

**Observed attributes**: `aspect-ratio`, `mode`, `current-slide`, `current-partial`.

**Public properties**: `currentSlide` (get/set number), `currentPartial` (get/set number), `mode` (get/set `'present' | 'speaker' | 'overview'`), `slideCount` (readonly).

**Public methods**: `loadSlides(sections: SlideData[])` populates from parsed markdown, `next()` advances to the next partial or slide, `prev()` goes back, `goTo(slide, partial?)` jumps to a specific position.

**Events emitted**: `geek:navigate` (after any navigation), `geek:slides:loaded` (after `loadSlides()`).

**Events listened**: `geek:navigate` (from CommandSystem/SyncManager), `geek:mode` (mode changes), `geek:hmr:update` (re-fetch and re-render markdown).

**Aspect ratio scaling**: A private `#rescale()` method computes the scale factor by comparing the element's bounding rect to the target aspect ratio. It calculates both horizontal (`width / targetWidth`) and vertical (`height / targetHeight`) scale factors, then picks whichever axis is limiting (contain behavior). The result is applied as `transform: scale(factor)` on the inner container.

### `<geek-slide>`

Individual slide. Lightweight wrapper around content HTML.

**Observed attributes**: `active`, `partial`.

**Properties**: `partialCount` (count of `[partial]` elements), `notes` (speaker notes HTML), `backgroundImage` and `backgroundColor` (from slide attributes).

**Internal structure**: Attaches Shadow DOM with a `.content` div containing a `<slot>`. The `:host` styles center content using flexbox with configurable padding (`--gs-slide-padding`, default 2 rem) and font size (`--gs-base-font-size`, default 1.8 rem). Slotted elements with the `[partial]` attribute start as `visibility: hidden` and become visible when given the `[visible]` attribute.

**`revealPartial(n)`**: Queries all `[partial]` elements and toggles the `visible` attribute on the first `n` of them, hiding the rest.

### `<geek-toolbar>`

Bottom toolbar for touch/presenter controls.

Renders prev/next buttons, a slide counter, mode toggle, and sync indicator. All actions dispatch CustomEvents that bubble up to the document.

The component uses Shadow DOM with a fixed-position bottom bar (48 px height). It uses a flexbox layout with space-between alignment, dark semi-transparent background (`rgba(0,0,0,0.8)`), and white text. By default the toolbar is hidden off-screen via `transform: translateY(100%)` and slides in when the `[visible]` attribute is set. The transition takes 0.2 s. The toolbar contains data-cmd buttons for `prev`, `next`, and `toggle-whiteboard`, plus a slide counter and sync status indicator.

### `<geek-command-palette>`

Modal command search UI activated by `:`.

Shadow DOM contains a backdrop overlay, a search input, a filtered command list, and keyboard navigation support (up/down/enter/escape). Exposes `open()` and `close()` methods plus `register(commands)` to populate the command list.

### `<geek-whiteboard>`

Canvas overlay for freehand drawing, synced via Yjs.

Contains a `<canvas>` element in Shadow DOM that handles pointer events for drawing. Supports color and width selection. Dispatches `geek:whiteboard:stroke` events for new strokes and listens for remote strokes from `WhiteboardSync`. Exposes `clear()`, `toggle()`, `setColor(color)`, and `setWidth(width)` methods.

### `<geek-chart>`

Replaces `<table>` content with a Chart.js canvas.

Observes the `type` attribute (bar, line, pie, etc.). On `connectedCallback`, it parses table data from the light DOM, creates a `<canvas>` in Shadow DOM, and initializes Chart.js with the extracted data and chart type.

## Per-Slide Style Scoping

When a markdown slide contains a `<style>` block:

```markdown
[](#my-slide)

<style>
h2 { color: red; }
.highlight { background: yellow; }
</style>

## This is red

Some <span class="highlight">highlighted</span> text.
```

The `StyleScoper` rewrites selectors at parse time:

`StyleScoper.scope(css, slideId)` takes a raw CSS string and a slide identifier. It parses the CSS using `CSSStyleSheet.replaceSync()`, iterates over all `CSSStyleRule` entries, and prefixes each selector with `geek-slide[data-id="<slideId>"]`. For example, `h2` becomes `geek-slide[data-id="my-slide"] h2`, and `.highlight` becomes `geek-slide[data-id="my-slide"] .highlight`. At-rules like `@keyframes` and `@media` are preserved without prefixing.

The scoped `<style>` is injected into the light DOM (not shadow) so it only affects
that specific slide's descendant elements.

## CSS Custom Properties (Theming)

Components expose CSS custom properties for theme customization. Authors can override these in their `local.css`:

**Slideshow**: `--gs-bg` (white), `--gs-color` (#333), `--gs-font-family` (system-ui), `--gs-base-font-size` (1.8 rem), `--gs-slide-padding` (2 rem), `--gs-aspect-ratio` (16/9).

**Code blocks**: `--gs-code-bg` (#f5f5f5), `--gs-code-font` (Fira Code, monospace), `--gs-code-font-size` (0.9 em).

**Transitions**: `--gs-transition-duration` (0.3 s), `--gs-transition-timing` (ease-in-out).

**Toolbar**: `--gs-toolbar-bg` (rgba(0,0,0,0.8)), `--gs-toolbar-color` (white), `--gs-toolbar-height` (48 px).

**Whiteboard**: `--gs-wb-default-color` (#ff0000), `--gs-wb-default-width` (3 px).

## Registration

All custom elements are registered in the engine's entry point (`packages/engine/src/index.ts`). The module exports all component classes and auto-registers them using `customElements.define()` if they haven't already been defined. The registered tag names are: `geek-slideshow`, `geek-slide`, `geek-toolbar`, `geek-command-palette`, `geek-whiteboard`, `geek-chart`, and `geek-video`.

## Smartphone / Mobile Browser Support

Audience members should be able to follow a presentation on a smartphone browser.
This requires specific design decisions across all components.

### Viewport & Scaling

The engine's HTML entry point sets the viewport meta tag with `width=device-width`, `initial-scale=1`, `maximum-scale=1`, and `user-scalable=no` to prevent accidental pinch-zoom conflicts with touch gestures.

- Slides always fill the viewport via the CSS scaling technique (see [CSS Scaling](css-scaling.md)).
- The `<geek-slideshow>` component detects screen size and adjusts layout:
  - **Desktop** (width > 768 px): standard presentation mode
  - **Mobile** (width ≤ 768 px): simplified layout, toolbar auto-visible, larger tap targets

### Mobile-Specific Component Behavior

| Component | Desktop | Mobile (≤ 768 px) |
|-----------|---------|---------------------|
| `<geek-toolbar>` | Hidden by default (Ctrl+B → t) | Always visible, bottom-fixed |
| `<geek-command-palette>` | Full palette with keyboard | Simplified action sheet |
| `<geek-whiteboard>` | Full canvas drawing | Disabled (view-only for remote strokes) |
| `<geek-slide>` | `transform: scale()` | Same scaling, but base font boosted |
| Navigation | Keyboard + mouse | Swipes + tap zones (see [Command System](command-system.md)) |

### Responsive CSS in Components

Inside `<geek-slideshow>` Shadow DOM, a CSS custom property `--gs-mobile-breakpoint` (768 px) gates responsive behavior. A `@media (max-width: 768px)` rule forces the slotted `<geek-toolbar>` to always be visible (no slide-down needed). An additional `@media` rule combining max-width and portrait orientation shows a brief "Rotate for best experience" hint via a `::after` pseudo-element that fades out after 3 seconds.

### Audience Sync Mode

On mobile the typical use case is an audience member following the presenter:

1. Open the presentation URL on the phone
2. Yjs sync connects automatically
3. Slides advance in lock-step with the presenter
4. Tap to temporarily break sync and browse freely
5. Toolbar button "Follow presenter" re-enables sync

This flow requires no typing, no keyboard, no prefix keys — just tap and swipe.
