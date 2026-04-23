# Style Your Deck

GeekSlides uses a three-layer CSS system: engine base styles, presentation-wide stylesheets, and per-slide scoped CSS. This guide explains each layer and shows you how to control the visual identity of your deck.

## The three CSS layers

Every slide rendered by GeekSlides has styles applied in this order:

| Layer | Source | Scope |
|---|---|---|
| **Base styles** | Built into the engine | Every slide, automatic |
| **Presentation CSS** | Files listed in `config.json` `styles` | Every slide in the deck |
| **Per-slide CSS** | `<style>` blocks in your Markdown | One slide only |

Higher layers override lower ones — a per-slide `<style>` wins over presentation CSS, which wins over base styles.

## Layer 1: Base styles (automatic)

Each slide is a `<geek-slide>` web component with its own Shadow DOM. The engine injects foundational styles automatically — transitions, positioning, partial reveal visibility, and semantic element defaults.

You never edit these. They ensure every deck works out of the box.

## Layer 2: Presentation-wide CSS

This is where your deck's visual identity lives. List one or more CSS files in `config.json`:

```json
{
  "styles": ["css/layouts.css", "css/theme-default.css", "css/local.css"]
}
```

These files are fetched, concatenated in order, and injected into every slide's Shadow DOM. Because slides use Shadow DOM, use the `:host` selector to target the `<geek-slide>` element itself:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');

:host {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 40pt;
}

section.content {
  background-color: #1a1a2e;
  color: #eee;
}

h1, h2 {
  color: #e94560;
}
```

> **Tip:** `@import` rules for web fonts are automatically hoisted to the document `<head>`, so fonts load correctly even though the CSS lives inside Shadow DOM.

### The layout / theme split

Every scaffolded deck ships with three CSS files that have distinct responsibilities:

| File | Responsibility | Edit it when… |
|---|---|---|
| `css/layouts.css` | Grid and flex structure — how content is *arranged* | Rarely; only if you're building custom layouts |
| `css/theme-default.css` | Colours, fonts, decorations — how content *looks* | You want a different visual theme |
| `css/local.css` | Per-deck overrides | You need small tweaks for this talk only |

Order matters — later files win. Keep structural rules out of your theme and colour rules out of your layouts.

### Available layout classes

Add a layout class to a slide's marker to activate its layout:

```markdown
[](.layout-two-col#my-slide)
### Heading
#### Column A
- Point 1
#### Column B
- Point 2
```

| Class | Description |
|---|---|
| `layout-title` | Centered hero — use for the opening slide (`h1` + `h2`) |
| `layout-cover` | Full-bleed image with text at the bottom |
| `layout-section` | Accent-background section break (`h2` + optional `h3`) |
| `layout-two-col` | Two-column grid (use `####` as a column break) |
| `layout-img-text` | Image on the left, text/list on the right |
| `layout-img-text-bleed` | Image fills left edge-to-edge, text/list on the right |
| `layout-big-stat` | Giant centred `h3` for key metrics + paragraph label |
| `layout-three-col` | Three card columns (each `####` starts a card; body: `p`, `ul`, `ol`, or image) |
| `layout-timeline` | Horizontal steps with numbered circles; steps support images |
| `layout-chart` | Heading + full-height data table |
| `layout-compare` | Two panels with a bold VS divider in the centre |
| `layout-team` | Row of circular headshots (add `.heading-center` to centre heading with images) |
| `layout-grid` | Responsive image grid / mood board |
| `layout-table` | Heading + full-width feature matrix table |
| `layout-agenda` | Numbered session agenda with accent circles |
| `layout-blank` | Empty canvas (whiteboard-friendly) |

### Extending layouts.css with a custom layout

If none of the built-in layouts fit a slide, add your own to `css/layouts.css`. Follow the structural-only rule: no colours, no fonts — only `display`, grid/flex properties, and spacing.

```css
/* css/layouts.css — append at the bottom */

/* Custom: heading + two-row content + footer strip */
section.content.layout-hero-split {
  display: grid;
  grid-template-rows: auto 1fr auto;
  row-gap: var(--gs-gap);

  > h2 { grid-row: 1; }
  > p  { grid-row: 2; align-self: center; }
  > ul { grid-row: 3; }
}
```

Then add matching decorative rules in `css/theme-default.css` (or your theme file):

```css
/* css/theme-default.css — append under layout-specific overrides */
section.content.layout-hero-split {
  > ul {
    background: color-mix(in oklch, var(--gs-color-accent) 8%, transparent);
    border-radius: var(--gs-radius);
    padding: 0.6em 1em;
  }
}
```

Activate it with a slide marker:

```markdown
[](.layout-hero-split#intro)
## Key Message
Main content paragraph.
- Footer point A
- Footer point B
```

### Customising design tokens

The theme exposes all visual values as CSS custom properties on `:host`. Override any of them in `css/local.css` without touching the theme file:

```css
/* css/local.css */
:host {
  --gs-color-accent:   #e94560;   /* brand red */
  --gs-font-size-h1:  80pt;       /* bigger hero text */
  --gs-radius:         4px;        /* sharper cards */
}
```

| Token | Default | Controls |
|---|---|---|
| `--gs-pad-x` | `80px` | Horizontal slide padding |
| `--gs-pad-y` | `60px` | Vertical slide padding |
| `--gs-gap` | `32px` | Gap between grid/flex children |
| `--gs-font-family` | `system-ui, …` | Body typeface |
| `--gs-font-mono` | `ui-monospace, …` | Code typeface |
| `--gs-font-size-base` | `32pt` | Body text size |
| `--gs-font-size-h1` | `72pt` | `h1` size |
| `--gs-font-size-h2` | `48pt` | `h2` size |
| `--gs-font-size-h3` | `40pt` | `h3` size |
| `--gs-font-size-h4` | `24pt` | `h4` size |
| `--gs-line-height` | `1.5` | Body line height |
| `--gs-color-text` | `#1a1a2e` | Body text |
| `--gs-color-heading` | `#0f0f23` | Heading text |
| `--gs-color-muted` | `#6b7280` | Secondary text |
| `--gs-color-accent` | `#3B55A0` | Accent / brand colour |
| `--gs-color-surface` | `#ffffff` | Slide background |
| `--gs-color-border` | `rgba(0,0,0,0.1)` | Table / card borders |
| `--gs-radius` | `12px` | Card / image border radius |

> **Tip:** All layout-specific decorative rules in `theme-default.css` consume these tokens via `var()`, so a single token change ripples through every layout automatically.

### Creating your own theme

To replace the default theme entirely, create a new CSS file and update `config.json`:

```json
{
  "styles": ["css/layouts.css", "css/my-theme.css", "css/local.css"]
}
```

Your theme targets the same `:host` and `section.content` selectors. Start from `theme-default.css` as a reference — it shows every design token and layout-specific override.

To share a theme across multiple decks, point all their `config.json` files to the same file:

```json
{
  "styles": ["css/layouts.css", "../shared/dark-theme.css", "css/local.css"]
}
```

## Layer 3: Per-slide scoped CSS

Drop a `<style>` tag inside any slide. It's automatically scoped — it won't leak into other slides:

```markdown
[](#highlight)
## The Big Number

**4.2 billion** requests per day.

<style>
h2 { color: #e94560; font-size: 3.5rem; }
section.content {
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
```

Use per-slide styles for one-off visual treatments — a dark slide in a light deck, a splash of color for a key metric, or a custom layout for a diagram.

## CSS custom properties

The engine exposes a few custom properties you can use in your stylesheets:

| Property | What it does |
|---|---|
| `--gs-scale-factor` | Current scale ratio (set automatically by the resize observer) |
| `--gs-transition-duration` | Slide transition speed (default: `0.3s`) |

Override transition speed in your presentation CSS:

```css
:host {
  --gs-transition-duration: 0.5s;
}
```

## Live reload

CSS files listed in `config.json` are watched by the dev server. Edit any of them and the changes appear instantly — no page refresh, no slide position lost.

```bash
npx geekslides dev --config my-talk/config.json
# Edit css/local.css → changes appear immediately
```

## Useful selectors

Because slides use Shadow DOM, the selectors you write target elements *inside* the slide. Here are the most common:

| Selector | What it targets |
|---|---|
| `:host` | The `<geek-slide>` element itself |
| `section.content` | The main content area of a slide |
| `h1`, `h2`, `h3` | Headings |
| `ul`, `ol`, `li` | Lists |
| `pre`, `code` | Code blocks and inline code |
| `img` | Images |
| `a` | Links |

## Putting it all together

A typical setup for a polished deck:

**config.json**
```json
{
  "title": "Scaling on AWS",
  "content": "README.md",
  "styles": ["css/layouts.css", "css/theme-default.css", "css/local.css"],
  "aspectRatio": "16/9",
  "plugins": {
    "preprocessors": []
  }
}
```

**css/theme-default.css** — colours and fonts for the whole deck:
```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');

:host {
  --gs-font-family: 'Open Sans', system-ui, sans-serif;
  --gs-accent: #e94560;
  font-family: var(--gs-font-family);
  font-size: 40pt;
}

h1, h2, h3 { color: var(--gs-accent); }
a { color: var(--gs-accent); }
```

**css/local.css** — one-off tweaks specific to this deck:
```css
:host {
  --gs-accent: #0078d4;  /* Override accent for this talk */
}
```

**README.md** — a slide with one-off per-slide styling:
```markdown
[](.layout-cover#hero)
# Scaling on AWS

![AWS re:Invent](images/aws-bg.jpg)

<style>
h1 { color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
</style>
```

The result: base engine styles → layout rules → theme colours → local overrides → per-slide custom background, all composing cleanly.

---

Next: [Write a Custom Plugin →](08-write-a-custom-plugin.md)
