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
  "styles": ["css/local.css"]
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

### Using a theme file

There's no built-in theme registry, but you can create reusable theme files. Put your theme in a shared location and reference it alongside a local override file:

```json
{
  "styles": ["../themes/allysum.css", "css/local.css"]
}
```

Order matters — files listed later override earlier ones. This lets you keep a consistent look across decks while tweaking individual presentations:

```
themes/
├── allysum.css       # Shared visual identity
└── monochrome.css    # Another theme option
my-talk/
├── config.json       # styles: ["../themes/allysum.css", "css/local.css"]
├── css/
│   └── local.css     # Overrides specific to this deck
└── README.md
```

### What goes in a theme vs. local CSS?

| Theme CSS | Local CSS |
|---|---|
| Font families and sizes | Slide-specific font overrides |
| Color palette | One-off background colors |
| Base heading styles | Title slide typography |
| Link appearance | Deck-specific image treatment |
| List and code block styling | Layout tweaks for this talk |

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
  "styles": ["../themes/allysum.css", "css/local.css"],
  "aspectRatio": "16/9",
  "plugins": {
    "preprocessors": ["header"],
    "processors": []
  }
}
```

**themes/allysum.css** — shared across decks:
```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');

:host {
  font-family: 'Open Sans', system-ui, sans-serif;
  font-size: 40pt;
}

h1, h2, h3 {
  font-weight: 700;
}

a { color: #e94560; }
```

**css/local.css** — specific to this deck:
```css
h1 {
  font-size: 100pt;
  text-align: center;
}
```

**README.md** — a slide with one-off styling:
```markdown
[](#hero)
# Scaling on AWS

<style>
section.content {
  background: url('../images/aws-bg.jpg') center/cover;
}
h1 { color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
</style>
```

The result: base engine styles → allysum theme → local overrides → hero slide custom background, all composing cleanly.

---

Next: [Write a Custom Plugin →](08-write-a-custom-plugin.md)
