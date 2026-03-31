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

**Step 1**: Each `<section>` gets a fixed `width` and `height` in px matching the design resolution:

```css
/* v1: set by JavaScript in Slideshow.setAspectRatio() */
.slidedeck section {
  position: absolute;
  top: 50%;
  left: 50%;              /* centered via translate */
  width: 1920px;          /* fixed design width */
  height: 1080px;         /* fixed design height */
  overflow: hidden;
}
```

**Step 2**: JavaScript computes the scale factor every time the window resizes:

```javascript
// v1: Slideshow.updateSlidesScale()
updateSlidesScale() {
  const slideSize = this.calcSlideWidthForCurrentAspectRatio();
  // slideSize = { w: 1920, h: 1080 } for 16:9

  const sx = this.slideshowElem.clientWidth / slideSize.w;   // horizontal scale
  const sy = this.slideshowElem.clientHeight / slideSize.h;  // vertical scale

  // Use whichever axis is the limiting factor (contain behavior)
  let factor;
  if (this.slideshowElem.clientHeight < slideSize.h * sx) {
    factor = sy;  // height is limiting → scale by vertical ratio
  } else {
    factor = sx;  // width is limiting → scale by horizontal ratio
  }

  // Apply to CSS rule directly (modifies stylesheet)
  const css = [...document.styleSheets].filter(s => s.href?.includes('index'))[0];
  const slideRule = [...css.cssRules].filter(r => r.selectorText === '.slidedeck section')[0];
  slideRule.style.transform = `translate(-50%, -50%) scale(${factor})`;
}
```

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

```typescript
// packages/engine/src/core/Slideshow.ts

#setupScaling(): void {
  const observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const { w, h } = this.#designResolution; // e.g. { w: 1920, h: 1080 }
    
    const sx = width / w;
    const sy = height / h;
    const factor = Math.min(sx, sy); // "contain" behavior
    
    this.style.setProperty('--gs-scale-factor', String(factor));
  });
  
  observer.observe(this);
}
```

```css
/* Inside <geek-slideshow> Shadow DOM */
:host {
  --gs-scale-factor: 1;
  --gs-design-width: 1920px;
  --gs-design-height: 1080px;
}

::slotted(geek-slide) {
  position: absolute;
  width: var(--gs-design-width);
  height: var(--gs-design-height);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(var(--gs-scale-factor));
}
```

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

```css
geek-slide {
  width: 1920px;
  height: 1080px;
  zoom: 0.75; /* browser calculates */
}
```

**Pros**: No `transform`, text renders crisply, affects layout (unlike `transform`).
**Cons**: Non-standard (only recently added to Firefox in 2024), still not in CSS spec
as a true standard. `zoom` changes the element's effective size in layout, which makes
centering and transition animations more complex. **Not recommended** for cross-browser
production use yet.

### Alternative 2: CSS `aspect-ratio` + Viewport Units

```css
geek-slide {
  aspect-ratio: 16 / 9;
  width: min(100vw, 100vh * 16 / 9);
  height: min(100vh, 100vw * 9 / 16);
  font-size: min(1.8vw, 3.2vh);
}
```

**Pros**: Pure CSS, no JavaScript. Responsive by nature.
**Cons**: All internal dimensions must use relative units (`vw`, `vh`, `%`, `em`).
This breaks the **fixed-resolution mental model** — authors can't think in pixels.
Code blocks, images, and complex layouts become unpredictable. Every presentation's
CSS would need to avoid `px` units entirely. **Rejected** because it shifts complexity
to content authors.

### Alternative 3: CSS Container Queries + `cqi`/`cqb` Units

```css
geek-slideshow {
  container-type: size;
  container-name: slideshow;
}

geek-slide {
  font-size: 1.8cqi; /* 1.8% of container inline size */
  padding: 2cqb;
}
```

**Pros**: Modern CSS, container-scoped, no JavaScript.
**Cons**: Same problem as viewport units — **all** content must use `cqi`/`cqb` instead
of `px`. The fixed-resolution authoring model breaks. Container queries are excellent for
component libraries but not for "design at 1920×1080" workflows. **Rejected** for the
same reason as viewport units.

### Alternative 4: CSS `@page` + `size` (Print Only)

```css
@page {
  size: 1920px 1080px;
}
section {
  width: 1920px;
  height: 1080px;
  page-break-after: always;
}
```

**Pros**: Perfect for PDF output.
**Cons**: Only applies to print media, not screen. Used by v2's `print.css` for
WeasyPrint output, but not for browser presentation. **Used alongside** `transform: scale()`
for the print path only.

### Alternative 5: `<iframe>` Per Slide

Each slide renders in an `<iframe>` at native resolution, scaled via `transform`:

```html
<iframe src="slide-1.html" style="width:1920px; height:1080px; transform:scale(0.5)"></iframe>
```

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

To minimize blurry text at non-integer scale factors:

```css
::slotted(geek-slide) {
  /* Promote to GPU layer for sharper subpixel rendering */
  will-change: transform;
  /* Ensure text rendering is optimized */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

On high-DPI displays (most modern screens), sub-pixel rendering is a non-issue because
the physical pixel density absorbs rounding errors. On 1080p screens, the scale factor
for 16:9 content is exactly 1.0, which is the most common presentation scenario.
