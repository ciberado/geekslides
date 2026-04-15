# CSS Slide Scaling Technique

## The Problem

Slides have a **fixed design resolution** (e.g. 1920×1080 for 16:9) but must display
correctly on any screen size — from a 13" laptop (1440×900) to a 4K projector (3840×2160)
to a smartphone (390×844). The content must appear identical on all screens: same layout,
same proportions, same relative font sizes.

## v1 Technique: `transform: scale()` + Programmatic Factor

### How It Works

v1 uses a **JavaScript-calculated scale factor** applied via CSS `transform`:

```
┌──────────────────────────────────────────────┐
│ Viewport (any size)                          │
│                                              │
│   ┌──────────────────────────────┐           │
│   │ Section (1920×1080 fixed)    │           │
│   │                              │           │
│   │  position: absolute          │           │
│   │  top: 50%; left: 50%        │           │
│   │  transform: translate(-50%, -50%)        │
│   │            scale(factor)     │           │
│   │                              │           │
│   │  Font sizes, padding, etc.   │           │
│   │  all in px at design res     │           │
│   └──────────────────────────────┘           │
│                                              │
└──────────────────────────────────────────────┘
```

**Step 1**: Each `<section>` gets a fixed `width` and `height` in px matching the design resolution. Sections are absolutely positioned with `top: 50%; left: 50%` for centering and `overflow: hidden`.

**Step 2**: JavaScript computes the scale factor every time the window resizes (in `Slideshow.updateSlidesScale()`). It divides the viewport width by the slide width to get a horizontal scale (`sx`), and the viewport height by the slide height to get a vertical scale (`sy`). It then picks whichever axis is the limiting factor — if `height < slideHeight * sx`, the height is limiting so it uses `sy`; otherwise it uses `sx`. This is "contain" behavior.

The computed factor is applied by directly modifying the CSS rule in the stylesheet: it finds the `.slidedeck section` rule by iterating `document.styleSheets` and sets `transform: translate(-50%, -50%) scale(factor)`.

**Step 3**: Centering via `translate(-50%, -50%)`. The slide is positioned at
`top: 50%; left: 50%` (which places its *top-left corner* at the viewport center),
then shifted back by half its own dimensions via `translate`. The `scale()` is
appended to the same `transform` so it scales around the center point.

### Strengths

- **Pixel-perfect**: content authored at 1920×1080 looks identical everywhere
- **Simple mental model**: author at fixed resolution, scaling is transparent
- **Works for all content**: images, text, code blocks, charts all scale uniformly
- **Proven**: used by reveal.js, Impress.js, and many slide frameworks

### Weaknesses

- **JavaScript dependency**: requires a resize listener and direct CSSOM manipulation
- **Blurry text at non-integer factors**: `scale(0.75)` can produce sub-pixel rendering
- **CSSOM mutation**: v1 directly modifies `cssRules`, fragile and hard to test
- **No container query support**: cannot scope scale to a container, only viewport
- **Speaker mode coupling**: scale factor halved for speaker view (`scale(factor/2)`)
  requires separate rule management

---

## v2 Technique: `transform: scale()` + CSS Custom Properties

v2 preserves the core approach (it works) but eliminates the CSSOM mutation in favor of
a single **CSS custom property** updated by a `ResizeObserver`:

A private `#setupScaling()` method creates a `ResizeObserver` that watches the `<geek-slideshow>` element. On each resize callback, it computes the horizontal and vertical scale factors (viewport dimensions divided by design resolution), picks the smaller one (contain behavior), and sets `--gs-scale-factor` on the element's style.

In the Shadow DOM CSS, `::slotted(geek-slide)` elements are absolutely positioned at the center (50%/50% + translate -50%/-50%) with fixed width/height from custom properties (`--gs-design-width: 1920px`, `--gs-design-height: 1080px`). The transform includes `scale(var(--gs-scale-factor))`, which reactively adapts as the custom property changes.

**Improvements over v1**:

| Aspect | v1 | v2 |
|--------|----|----|
| Scale application | `cssRules[].style.transform = ...` | `--gs-scale-factor` custom property |
| Resize detection | `window.addEventListener('resize')` | `ResizeObserver` (per-element, works in containers) |
| Speaker view scale | Separate cssRule mutation | `--gs-scale-factor` inherited, halved in speaker CSS |
| Testability | Requires real stylesheets | Property is readable/mockable |
| Container support | Viewport only | Any container (future: embedded slideshows) |

---

## Alternative Approaches Evaluated

### Alternative 1: CSS `zoom` Property

Apply `zoom: 0.75` on a fixed-size slide element instead of `transform: scale()`.

**Pros**: No `transform`, text renders crisply, affects layout (unlike `transform`).
**Cons**: Non-standard (only recently added to Firefox in 2024), still not in CSS spec
as a true standard. `zoom` changes the element's effective size in layout, which makes
centering and transition animations more complex. **Not recommended** for cross-browser
production use yet.

### Alternative 2: CSS `aspect-ratio` + Viewport Units

Use `aspect-ratio: 16/9` with viewport-relative sizing (`min(100vw, 100vh * 16/9)`) and all internal dimensions in `vw`/`vh`/`%`/`em` units (e.g. `font-size: min(1.8vw, 3.2vh)`).

**Pros**: Pure CSS, no JavaScript. Responsive by nature.
**Cons**: All internal dimensions must use relative units.
This breaks the **fixed-resolution mental model** — authors can't think in pixels.
Code blocks, images, and complex layouts become unpredictable. Every presentation's
CSS would need to avoid `px` units entirely. **Rejected** because it shifts complexity
to content authors.

### Alternative 3: CSS Container Queries + `cqi`/`cqb` Units

Set `container-type: size` on the slideshow and use `cqi` (container query inline) units for all content sizing (e.g. `font-size: 1.8cqi`).

**Pros**: Modern CSS, container-scoped, no JavaScript.
**Cons**: Same problem as viewport units — **all** content must use `cqi`/`cqb` instead
of `px`. The fixed-resolution authoring model breaks. Container queries are excellent for
component libraries but not for "design at 1920×1080" workflows. **Rejected** for the
same reason as viewport units.

### Alternative 4: CSS `@page` + `size` (Print Only)

Use `@page { size: 1920px 1080px; }` with fixed-size sections and `page-break-after: always`.

**Pros**: Perfect for PDF output.
**Cons**: Only applies to print media, not screen. Used by v2's `print.css` for
browser-backed PDF export, but not for browser presentation. **Used alongside** `transform: scale()`
for the print path only.

### Alternative 5: `<iframe>` Per Slide

Render each slide in its own `<iframe>` at native resolution, scaled via `transform` on the iframe element.

**Pros**: True isolation — each slide is its own document with its own styles.
**Cons**: Massive overhead (one document per slide), cross-origin restrictions for
embedded content, no shared state without `postMessage`, breaks accessibility, heavy
memory use for 50+ slide decks. **Rejected**.

---

## Decision: Preserve `transform: scale()` with Custom Properties

The `transform: scale()` approach is retained because:

1. **Proven** — used by every major slide framework (reveal.js, Impress.js, Marp)
2. **Author-friendly** — design at fixed resolution (1920×1080), everything just works
3. **Content-agnostic** — images, SVGs, code blocks, charts all scale uniformly
4. **Predictable** — one number (`--gs-scale-factor`) controls everything
5. **Testable** — custom property is observable and mockable

The v2 improvement is **how** the factor is applied (CSS custom property + ResizeObserver
instead of CSSOM mutation), not the fundamental scaling model.

### Sub-Pixel Rendering Mitigation

To minimize blurry text at non-integer scale factors, slotted slides use `will-change: transform` (GPU layer promotion for sharper subpixel rendering) and `-webkit-font-smoothing: antialiased` / `-moz-osx-font-smoothing: grayscale` for optimized text rendering.

On high-DPI displays (most modern screens), sub-pixel rendering is a non-issue because
the physical pixel density absorbs rounding errors. On 1080p screens, the scale factor
for 16:9 content is exactly 1.0, which is the most common presentation scenario.
