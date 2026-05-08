# How to Add Generative CSS Doodle Backgrounds

**Level**: Intermediate  
**Time**: 5 minutes

Learn how to add beautiful parametric CSS patterns as decorative backgrounds using the css-doodle plugin.

---

## What You'll Learn

- How to enable the css-doodle plugin
- Available pattern categories and names
- Configuration options for customizing patterns
- Positioning modes (background, inline, cover)

---

## Prerequisites

- A GeekSlides deck (see [02-create-your-first-deck.md](02-create-your-first-deck.md))
- Basic markdown knowledge

---

## Step 1: Enable the Plugin

Edit your `config.json` to include the css-doodle plugin:

```json
{
  "title": "My Presentation",
  "content": ["README.md"],
  "styles": ["css/layouts.css", "css/theme-default.css"],
  "plugins": {
    "preprocessors": ["css-doodle"],
    "processors": ["css-doodle"]
  }
}
```

The plugin is built-in—no installation required.

---

## Step 2: Add Your First Doodle

Use markdown image syntax with a `#pattern-name` anchor:

```markdown
# My Title Slide

![css-doodle](#triangles)
```

This creates a triangular mosaic pattern sized at 300×300px inline.

---

## Step 3: Use as Background

Add the `bg` flag to position the doodle behind your content:

```markdown
[](#.mod-coverbg)

![css-doodle](#triangles,opacity=0.15,bg)

# Welcome

Subtitle text here
```

The pattern fills the entire slide at reduced opacity.

---

## Available Patterns

### Geometric
- `triangles` — Triangular mosaic
- `squares` — Rotated squares
- `hexagons` — Honeycomb grid
- `diamonds` — Diamond lattice
- `circles` — Overlapping circles

### Organic
- `waves` — Sinusoidal waves
- `bubbles` — Floating bubbles
- `petals` — Flower petals
- `branches` — Tree branches

### Abstract
- `dots` — Dot matrix
- `lines` — Parallel lines
- `crosshatch` — Cross-hatched texture
- `noise` — Noise texture
- `gradient-grid` — Gradient transitions

### Tech
- `circuit` — Circuit board
- `matrix` — Digital rain
- `pixels` — Retro pixels
- `binary` — Binary digits

### Decorative
- `confetti` — Scattered shapes
- `stars` — Star field
- `mosaic` — Stained glass

---

## Configuration Options

Customize patterns with comma-separated key=value pairs:

```markdown
![css-doodle](#pattern-name,grid=12,opacity=0.5,size=400px)
```

| Parameter | Description | Example |
|-----------|-------------|---------|
| `grid` | Grid dimensions | `12`, `16x8`, `20x1` |
| `size` | Container size | `400px`, `50%` |
| `opacity` | Overall opacity (0–1) | `0.3` |
| `colors` | Pipe-separated colors | `#ff0000\|#00ff00\|#0000ff` |
| `seed` | Fixed seed for reproducibility | `42` |
| `bg` | Force background mode | (flag, no value) |
| `cover` | Force cover mode | (flag, no value) |
| `animate` | Enable animations | (flag, no value) |
| `speed` | Animation speed multiplier | `2`, `0.5` |

---

## Positioning Modes

### Background (behind content)
```markdown
![css-doodle](#dots,bg,opacity=0.2)
```

### Inline (sized figure)
```markdown
[](#.mod-cols-2)

## Left Column
Text content here

![css-doodle](#hexagons,size=250px)
```

### Cover (full-bleed)
```markdown
![css-doodle](#waves,cover)
```

---

## Theme Integration

Patterns automatically use your theme's color palette:
- `--gs-color-accent` → Primary pattern color
- `--gs-color-text` → Secondary color
- `--gs-color-muted` → Tertiary color
- `--gs-color-surface` → Background color
- `--gs-color-heading` → Accent color

Override with custom colors:
```markdown
![css-doodle](#triangles,colors=#ff6b6b|#4ecdc4|#45b7d1)
```

---

## Animation

Add motion to patterns with the `animate` flag:

```markdown
![css-doodle](#squares,animate,speed=2)
```

Control speed with the `speed` parameter (1 is default, 2 is 2× faster, 0.5 is half speed).

---

## Reproducible Patterns

Use the `seed` parameter for consistent output across renders:

```markdown
![css-doodle](#confetti,seed=42)
```

Useful for:
- Consistent branding across presentations
- Version control (same seed = same pattern)
- Sharing decks with identical visuals

---

## Examples

### Title Slide with Subtle Background
```markdown
[](#.mod-coverbg)

![css-doodle](#triangles,opacity=0.1,bg)

# Presentation Title
## Subtitle
```

### Two-Column Layout with Inline Doodle
```markdown
[](#.mod-cols-2)

## Features

- Feature A
- Feature B
- Feature C

![css-doodle](#circuit,size=300px)
```

### Animated Tech Pattern
```markdown
## Code Architecture

![css-doodle](#matrix,animate,speed=1.5,grid=20x30,size=500px)
```

### Custom Colors Matching Brand
```markdown
![css-doodle](#gradient-grid,colors=#8b5cf6|#06b6d4|#ec4899,size=400px)
```

---

## Tips

1. **Performance**: Limit animated patterns to 1–2 per deck
2. **Accessibility**: Use low opacity for backgrounds (0.1–0.3) to maintain text readability
3. **Consistency**: Stick to 2–3 pattern styles per presentation
4. **Print-ready**: Patterns render as static images in PDF exports

---

## Next Steps

- Explore all 21 built-in patterns in `/decks/css-doodle-demo`
- Create custom themes with unique color palettes
- Combine with layout modifiers for sophisticated designs

---

## See Also

- [07-style-your-deck.md](07-style-your-deck.md) — Theme customization
- [08-write-a-custom-plugin.md](08-write-a-custom-plugin.md) — Extend functionality
- [19-create-layout-with-modifiers.md](19-create-layout-with-modifiers.md) — Layout system
