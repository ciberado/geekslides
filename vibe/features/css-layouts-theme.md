# CSS Layout and Theme System

## Overview

Every GeekSlides deck is styled by two template files that ship with the CLI and are
copied into new decks by `geekslides new`:

| File | Location (template) | Responsibility |
|------|---------------------|----------------|
| `layouts.css` | `packages/cli/src/templates/layouts.css` | Structural: grid, flex, spacing tokens |
| `theme-default.css` | `packages/cli/src/templates/theme-default.css` | Visual: colours, fonts, decorative styles |

They are designed to be independent and composable. `layouts.css` defines *where* things
go; `theme-default.css` defines *how* they look. A custom theme replaces
`theme-default.css` without touching `layouts.css`.

```json
{
  "styles": ["css/layouts.css", "css/theme-default.css", "css/local.css"]
}
```

Order matters — later files win. `local.css` provides per-deck overrides on top of the
theme.

---

## layouts.css

### Purpose

Pure structural CSS. No colours, no fonts, no box-shadows. Only:

- CSS custom property tokens for spacing
- Display rules (`grid`, `flex`, `flex-direction`, `align-items`, …)
- Grid template definitions
- Element baseline resets (margin, padding, line-height)
- Pseudo-element skeleton for the cover overlay and timeline line

### Spacing tokens (`:host`)

```css
:host {
  --gs-pad-x: 80px;   /* horizontal slide padding */
  --gs-pad-y: 60px;   /* vertical slide padding */
  --gs-gap:   32px;   /* default gap between grid/flex children */
}
```

Override these on `:host` in any subsequent stylesheet to adjust spacing without
duplicating layout rules.

### Sections

| Section | What it defines |
|---------|-----------------|
| 1. Spacing tokens | `--gs-pad-x`, `--gs-pad-y`, `--gs-gap` on `:host` |
| 2. Base element structure | `h1–h4`, `p`, `ul/ol`, `table`, `pre`, `blockquote`, `.block-image` resets |
| 3. Default layout | `section.content` padding — applies when no `.layout-*` class is present |
| 4–17, 9b, 18. Named layouts | One numbered section per layout class (see table below) |

### Available layout classes

| CSS class | Markdown usage | Grid / flex model |
|-----------|----------------|-------------------|
| *(none)* | Default — title + content | Block flow with `padding` |
| `.layout-title` | `[](.layout-title#id)` | `flex` column, center/center |
| `.layout-cover` | `[](.layout-cover#id,bgurl(img.jpg))` | `flex` column, end + `::before` overlay |
| `.layout-section` | `[](.layout-section#id)` — `h2` + optional `h3` | `flex` column, center/center |
| `.layout-big-stat` | `[](.layout-big-stat#id)` — `h3` + `p` | `flex` column, center/center |
| `.layout-two-col` | `[](.layout-two-col#id)` | 2-col grid; `h4` is hidden column break |
| `.layout-img-text` | `[](.layout-img-text#id)` | 2-col grid; image left, text/list right |
| `.layout-img-text-bleed` | `[](.layout-img-text-bleed#id)` | 2-col grid; image spans full height of left half |
| `.layout-three-col` | `[](.layout-three-col#id)` | 3-col grid; `h4` heads each card; body: `p`, `ul`, `ol`, or image |
| `.layout-timeline` | `[](.layout-timeline#id)` | `ol` → CSS Grid auto-columns + `::before` line; steps support images |
| `.layout-chart` | `[](.layout-chart#id)` | `flex` column; `table` gets `flex: 1` |
| `.layout-compare` | `[](.layout-compare#id)` | 3-col grid (`1fr auto 1fr`); `h4` is VS badge in centre column |
| `.layout-team` | `[](.layout-team#id)` | `flex` wrap, space-evenly; add `.mod-heading-center` to centre heading with images |
| `.layout-grid` | `[](.layout-grid#id)` | `auto-fit` grid with `minmax(350px, 1fr)` |
| `.layout-table` | `[](.layout-table#id)` | `flex` column; `table` gets `flex: 1` |
| `.layout-agenda` | `[](.layout-agenda#id)` | 2-row grid; `ol` items flex-column with accent circles |
| `.layout-blank` | `[](.layout-blank#id)` | No inner structure; `::after` guide border |

### Adding a new layout

1. Pick a name: `.layout-my-name`.
2. Add a JSDoc-style documentation comment and CSS rule to `packages/cli/src/templates/layouts.css`:
   ```css
   /**
    * @layout layout-my-name
    * @detail Brief one-line description
    * @markdown
    * [](.layout-my-name#id)
    * # Content
    * @structure
    * ┌─────────────┐
    * │   Layout    │  ← ASCII diagram
    * └─────────────┘
    * @usage
    * Usage notes here.
    */
   section.content.layout-my-name {
     display: flex;
     /* ... */
   }
   ```
3. Add theme overrides for it in `packages/cli/src/templates/theme-default.css` under
   section 3 (layout-specific theme overrides).
4. Update the `how-to/07-style-your-deck.md` layout class table.
5. **Rebuild VSCode extension:** `cd packages/vscode && npm run build`
   - The prebuild script automatically extracts CSS documentation
   - Generates `src/completion/class-registry-generated.ts`
   - Autocomplete will show your layout with full documentation
6. If the new layout is part of a per-deck customisation (not the engine template), add
   the CSS to your deck's `css/layouts.css` instead of the template.

**Documentation format**: See `packages/vscode/src/completion/css-doc-format.md` for complete specification.
The CSS comment is the **single source of truth** — no manual TypeScript updates needed!

---

## theme-default.css

### Purpose

All visual tokens and decorative styles. No `display`, no `grid-template`, no structural
positioning (except `border-radius`, `box-shadow`, and background gradients on named
layouts). Concretely:

- CSS custom property design tokens
- Typography (`font-family`, `font-size`, `color`, `line-height`)
- Colour treatments for base elements (`h1–h4`, `a`, `code`, `blockquote`, `table`)
- Decorative overrides per layout (gradient overlays, card backgrounds, circle borders)

### Design tokens (`:host`)

```css
:host {
  /* Typography */
  --gs-font-family:    system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --gs-font-mono:      ui-monospace, "Cascadia Code", "Fira Code", monospace;
  --gs-font-size-base: 32pt;
  --gs-font-size-h1:   72pt;
  --gs-font-size-h2:   48pt;
  --gs-font-size-h3:   40pt;
  --gs-font-size-h4:   24pt;
  --gs-line-height:    1.5;

  /* Colors */
  --gs-color-text:     #1a1a2e;
  --gs-color-heading:  #0f0f23;
  --gs-color-muted:    #6b7280;
  --gs-color-accent:   #3B55A0;
  --gs-color-surface:  #ffffff;
  --gs-color-border:   rgba(0, 0, 0, 0.1);

  /* Decoration */
  --gs-radius: 12px;
}
```

All layout-specific theme rules consume these tokens via `var()`. Overriding them on
`:host` in a subsequent stylesheet re-themes every layout simultaneously.

### Sections

| Section | What it defines |
|---------|-----------------|
| 1. Design tokens | All `--gs-*` custom properties on `:host`, plus `font-family`, `font-size`, `line-height`, `color` |
| 2. Base element styles | Colors and fonts for `h1–h4`, `li > strong`, `table`, `code`, `pre`, `blockquote`, `img`, `a` |
| 3. Layout-specific overrides | One block per layout class that needs decorative treatment |

### Creating a custom theme

Option A — **token override** (minimal change, keeps the default visual structure):

```css
/* css/my-theme.css */
:host {
  --gs-font-family:    'Montserrat', sans-serif;
  --gs-color-accent:   #e94560;
  --gs-color-text:     #f5f5f5;
  --gs-color-heading:  #ffffff;
  --gs-color-surface:  #1a1a2e;
  font-family: var(--gs-font-family);
  background: var(--gs-color-surface);
}
```

```json
{ "styles": ["css/layouts.css", "css/my-theme.css", "css/local.css"] }
```

Option B — **full replacement** (copy `theme-default.css`, rename, modify freely):

```bash
cp css/theme-default.css css/theme-dark.css
```

Edit `css/theme-dark.css`. Replace `theme-default.css` with `theme-dark.css` in
`config.json`. The theme file must supply values for all tokens consumed by
`layouts.css` (the spacing tokens live in `layouts.css` and have their own defaults, so
they are not required in the theme).

Option C — **shared theme** across multiple decks:

```json
{ "styles": ["css/layouts.css", "../shared/theme-brand.css", "css/local.css"] }
```

Point all `config.json` files at the same theme file. Only `local.css` varies per deck.

---

## Engine-set properties

The following custom properties are **written by the engine** at runtime — not defined
in the template files. They are available for use in any stylesheet.

| Property | Set by | What it does |
|----------|--------|--------------|
| `--gs-scale-factor` | `<geek-slideshow>` resize observer | Current scale ratio applied to slides (see [css-scaling.md](css-scaling.md)) |
| `--gs-transition-duration` | Engine default (`0.3s`), overridable | Slide transition speed |

Override `--gs-transition-duration` in any presentation CSS:

```css
:host {
  --gs-transition-duration: 0.5s;
}
```

`--gs-scale-factor` is read-only from a stylesheet perspective — do not set it manually.

---

## Separation of concerns — quick reference

When you want to change… | Edit…
---|---
Spacing between elements | `--gs-pad-x`, `--gs-pad-y`, `--gs-gap` in any `:host` block
Font faces | `--gs-font-family`, `--gs-font-mono` in the theme
Type scale | `--gs-font-size-*` tokens in the theme
Accent / brand colour | `--gs-color-accent` in the theme
Background colour | `--gs-color-surface` and `:host { background: … }`
Grid structure of a layout | The matching `.layout-*` rule in `layouts.css`
Decorative overlay on `.layout-cover` | `section.content.layout-cover::before { background: … }` in the theme
Add a completely new layout | New rule in `layouts.css` + theme overrides in the theme

---

## CSS feature requirements

Both files use modern CSS that requires:

- **CSS nesting** — Chrome 120+, Firefox 117+, Safari 17.2+
- **`color-mix()` in oklch** — Chrome 111+, Firefox 113+, Safari 16.2+ (`theme-default.css` only)
- **CSS logical properties** (`margin-inline`, `padding-block`) — all modern browsers

The Vite build does **not** post-process these files (no autoprefixer, no polyfills). They
are injected verbatim into each slide's Shadow DOM at runtime.

---

## Related docs

- [css-scaling.md](css-scaling.md) — how the engine scales the 1920×1080 canvas to any viewport
- [how-to/07-style-your-deck.md](../../how-to/07-style-your-deck.md) — user-facing guide: applying and customising styles
- [components.md](components.md) — Shadow DOM structure the CSS targets
