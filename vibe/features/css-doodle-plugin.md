# CSS Doodle Plugin

## Overview

A GeekSlides plugin that integrates [css-doodle](https://css-doodle.com/) to generate
beautiful, parametric CSS patterns as decorative elements in slides. It ships with a
curated collection of named patterns and automatically adapts colors to the current
theme's `--gs-color-*` palette.

The plugin uses markdown image syntax as its invocation mechanism:

```markdown
![css-doodle](#triangles)
![css-doodle](#waves,grid=12,opacity=0.3)
![css-doodle](#dots,colors=pink|teal,size=200px)
```

## Design Decisions

### Plugin Type: Preprocessor + Processor

1. **Preprocessor** — Finds `![css-doodle](#pattern,config)` in markdown and replaces it
   with a `<div class="gs-doodle" data-pattern="pattern" data-config="...">` placeholder.
   This avoids markdown-it mangling the `<css-doodle>` custom element.

2. **Processor** — After HTML render, finds `.gs-doodle` placeholders and creates the
   actual `<css-doodle>` elements with the resolved pattern CSS, injecting theme colors
   and applying config overrides.

### Positioning Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Background** | Image is the *only* content in a slide section or has `bg` in config | Full-slide decorative background behind all content (absolute positioned, z-index: -1) |
| **Inline** | Image appears within other content (paragraphs, columns) | Sized figure (default 300×300), rendered inline where the image tag appears |
| **Cover** | `cover` in config | Full-bleed, covers entire slide (good for title slides) |

### Syntax

```
![css-doodle](#<pattern-name>[,key=value[,key=value...]])
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `grid` | Grid dimensions (e.g., `8`, `12x6`, `20x1`) | Pattern's default |
| `size` | Container size (e.g., `400px`, `100%`) | `100%` for bg/cover, `300px` for inline |
| `opacity` | Overall opacity (0–1) | `1` |
| `colors` | Pipe-separated color list overriding theme colors | Theme palette |
| `seed` | Fixed seed for reproducible randomness | Auto-generated |
| `bg` | Force background mode | — |
| `cover` | Force cover mode | — |
| `animate` | Enable CSS animations in pattern | `false` |
| `speed` | Animation speed multiplier | `1` |

### Theme Integration

Patterns reference colors through CSS custom properties that map to the theme:

```css
/* Injected by the processor at runtime */
:host {
  --doodle-c1: var(--gs-color-accent);
  --doodle-c2: var(--gs-color-text);
  --doodle-c3: var(--gs-color-muted);
  --doodle-c4: var(--gs-color-surface);
  --doodle-c5: var(--gs-color-heading);
}
```

Pattern definitions use `var(--doodle-c1)` etc., so they automatically adapt when the
theme changes. When the user provides explicit `colors=pink|teal|gold`, those override
the CSS variables.

### Pattern Collection

The plugin ships with a curated library of ~20 named patterns organized by category:

#### Geometric
- `triangles` — Randomized triangular mosaic via clip-path
- `squares` — Rotated/scaled squares with varying opacity
- `hexagons` — Honeycomb grid using clip-path polygons
- `diamonds` — Diamond lattice pattern
- `circles` — Overlapping circles with gradient fills

#### Organic
- `waves` — Sinusoidal wave interference pattern
- `bubbles` — Floating circular shapes with opacity variance
- `petals` — Flower-petal radial arrangement
- `branches` — Tree-like branching lines

#### Abstract
- `dots` — Dot matrix with size/color variation
- `lines` — Parallel lines with random gaps and angles
- `crosshatch` — Cross-hatched texture
- `noise` — Perlin-noise-like visual texture
- `gradient-grid` — Smooth gradient transitions across cells

#### Tech
- `circuit` — Circuit-board-like connected lines
- `matrix` — Digital rain / matrix characters
- `pixels` — Retro pixelated blocks
- `binary` — Binary digit patterns

#### Decorative
- `confetti` — Scattered colorful shapes
- `stars` — Star field with twinkling
- `mosaic` — Stained-glass mosaic effect

### Architecture

```
packages/engine/src/plugins/builtins/
  css-doodle-preprocessor.ts    — Markdown transform
  css-doodle-processor.ts       — DOM initialization
  css-doodle-patterns/
    index.ts                    — Pattern registry & types
    geometric.ts                — Geometric pattern definitions
    organic.ts                  — Organic patterns
    abstract.ts                 — Abstract patterns
    tech.ts                     — Tech-themed patterns
    decorative.ts               — Decorative patterns
```

### Pattern Definition Format

Each pattern is a function that accepts a config object and returns the CSS rules
string for `<css-doodle>`:

```typescript
interface DoodlePatternConfig {
  readonly grid: string;
  readonly colors: readonly string[];
  readonly animate: boolean;
  readonly speed: number;
  readonly seed?: string;
}

interface DoodlePattern {
  readonly name: string;
  readonly category: string;
  readonly defaultGrid: string;
  readonly description: string;
  readonly generate: (config: DoodlePatternConfig) => string;
}
```

### Example Pattern Implementation

```typescript
// geometric.ts
export const triangles: DoodlePattern = {
  name: 'triangles',
  category: 'geometric',
  defaultGrid: '18',
  description: 'Randomized triangular mosaic via clip-path',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    --hue: calc(180 + 1.5 * @x * @y);
    background: @pick(${colors.map(c => `var(--doodle-c${c})`).join(', ')});
    margin: -.5px;
    clip-path: polygon(@pick(
      '0 0, 100% 0, 100% 100%',
      '0 0, 100% 0, 0 100%',
      '0 0, 100% 100%, 0 100%',
      '100% 0, 100% 100%, 0 100%'
    ));
  `,
};
```

### Preprocessor Logic

```typescript
// Regex matches: ![css-doodle](#pattern-name) or ![css-doodle](#pattern,key=val,key=val)
const DOODLE_RE = /!\[css-doodle\]\(#([a-z][a-z0-9-]*(?:,[^)]*)?)\)/gi;

function doodlePreprocessor(markdown: string): string {
  return markdown.replace(DOODLE_RE, (match, params) => {
    const escaped = encodeURIComponent(params);
    return `<div class="gs-doodle" data-doodle="${escaped}"></div>`;
  });
}
```

### Processor Logic

```typescript
function doodleProcessor(slideElement: HTMLElement, context: ProcessorContext): void {
  const placeholders = slideElement.querySelectorAll<HTMLElement>('.gs-doodle');
  if (placeholders.length === 0) return;

  // Lazy-load css-doodle library (like mermaid pattern)
  void loadCssDoodle().then(() => {
    for (const placeholder of placeholders) {
      const raw = decodeURIComponent(placeholder.dataset.doodle ?? '');
      const { patternName, config } = parseConfig(raw);
      const pattern = patternRegistry.get(patternName);
      if (!pattern) { /* warn and skip */ return; }

      // Resolve theme colors from computed styles
      const themeColors = resolveThemeColors(slideElement);
      const finalColors = config.colors ?? themeColors;

      // Create <css-doodle> element
      const doodle = document.createElement('css-doodle');
      if (config.grid) doodle.setAttribute('grid', config.grid);
      if (config.seed) doodle.setAttribute('seed', config.seed);
      doodle.textContent = pattern.generate({ ...config, colors: finalColors });

      // Apply positioning mode
      applyPositioning(doodle, placeholder, config);
      placeholder.replaceWith(doodle);
    }
  });
}
```

### css-doodle Library Loading

The `css-doodle` library (~40KB gzipped) is loaded lazily via dynamic import only when
a slide contains a doodle placeholder. This follows the same pattern as the mermaid
processor:

```typescript
let cssDoodleReady: Promise<void> | null = null;

function loadCssDoodle(): Promise<void> {
  if (!cssDoodleReady) {
    cssDoodleReady = import('css-doodle').then(() => undefined);
  }
  return cssDoodleReady;
}
```

The library registers the `<css-doodle>` custom element globally, so after import it's
available for use.

### Registration

```json
{
  "plugins": {
    "preprocessors": ["header", "css-doodle"],
    "processors": ["iframe", "css-doodle"]
  }
}
```

Both the preprocessor and processor are registered under the short name `"css-doodle"`.
The plugin bundle exposes both:

```typescript
export const cssDoodlePlugin: Plugin = {
  name: 'css-doodle',
  preprocessors: [doodlePreprocessor],
  processors: [doodleProcessor],
};
```

### Print / PDF Export

For print rendering (which uses flat HTML without Shadow DOM), the processor detects
print mode via `context.config` and renders a static snapshot:
- Uses `css-doodle`'s `.export()` JS API to produce a PNG/SVG
- Replaces the `<css-doodle>` with an `<img>` for reliable PDF output

### Dependencies

- `css-doodle` npm package (peer dependency, loaded dynamically)
- No other external dependencies

### Future Enhancements

- **Custom patterns**: Allow users to define patterns in a `doodles/` directory in their
  deck and reference them by filename: `![css-doodle](#./doodles/my-pattern)`
- **Gallery CLI command**: `geekslides doodle-gallery` to preview all built-in patterns
  with the current theme
- **Interactive editor**: In dev mode, clicking a doodle opens a live CSS editor
- **Transition patterns**: Use doodles as slide transition overlays

---

## Usage Examples

### Decorative background on a title slide

```markdown
[](#cover.mod-coverbg)

![css-doodle](#triangles,opacity=0.15,bg)

# Welcome to My Talk
```

### Inline figure in a two-column layout

```markdown
[](#.mod-cols-2)

## Design Patterns

Here are some common patterns...

![css-doodle](#hexagons,size=250px)
```

### Full-cover animated pattern

```markdown
[](#.mod-coverbg)

![css-doodle](#waves,cover,animate,speed=0.5,grid=20)
```

### Custom colors overriding theme

```markdown
![css-doodle](#dots,colors=#ff6b6b|#4ecdc4|#45b7d1,grid=10)
```

### Reproducible pattern with seed

```markdown
![css-doodle](#confetti,seed=42,opacity=0.2,bg)
```
