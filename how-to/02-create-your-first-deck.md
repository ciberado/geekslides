# Create Your First Deck

A GeekSlides deck is just a directory with a few files. This guide shows you how to scaffold one and understand what each piece does.

## Scaffold with the CLI

The fastest way to start:

```bash
npx geekslides create --title "My First Talk" --dir my-first-talk
```

This creates the following structure:

```
my-first-talk/
├── config.json       # Deck metadata and settings
├── README.md         # Your slide content (Markdown)
├── css/
│   └── local.css     # Custom styles
└── images/           # Image assets
```

## Anatomy of a deck

### config.json

The configuration file tells GeekSlides how to load and render your deck:

```json
{
  "title": "My First Talk",
  "content": "README.md",
  "styles": ["css/local.css"],
  "aspectRatio": "16/9",
  "plugins": {
    "preprocessors": ["header"],
    "processors": []
  }
}
```

| Field | What it does |
|---|---|
| `title` | Page title shown in the browser tab |
| `content` | Path to the Markdown file with your slides |
| `styles` | Array of CSS files to load (order matters) |
| `aspectRatio` | Slide aspect ratio — `"16/9"` or `"4/3"` |
| `plugins.preprocessors` | Markdown transforms applied before parsing |
| `plugins.processors` | Slide transforms applied after parsing |

> **Tip:** The `header` preprocessor converts `## Title` headings into proper slide markers automatically, so you can write natural Markdown without worrying about the slide separator syntax.

### README.md — Your slides

Each slide starts with a **slide marker** — an empty Markdown link:

```markdown
[](#intro)
# Welcome to My First Talk

This is the first slide.

[](#agenda)
## Agenda

- Topic one
- Topic two
- Topic three
```

The `#intro` and `#agenda` parts are optional IDs. They create anchor-friendly URLs and help you reference slides.

![A freshly created deck open in the browser](screenshots/new-deck.png)

### local.css — Custom styles

A minimal starting point for your deck's visual identity:

```css
:root {
  --gs-font-family: 'Inter', system-ui, sans-serif;
  --gs-heading-color: #1a1a2e;
  --gs-link-color: #e94560;
}

h1 {
  font-size: 3rem;
}
```

Changes to CSS files are hot-reloaded instantly — no page refresh needed.

### images/

Drop your images here and reference them in Markdown:

```markdown
![Architecture diagram](images/architecture.png)
```

## Launch the dev server

Point the dev server at your deck:

```bash
npx geekslides dev --config my-first-talk/config.json
```

Open `http://localhost:5173` and you'll see your slides. Edit `README.md` in your editor and watch the changes appear in real time — the current slide position is preserved.

![HMR in action — editing triggers a live update](screenshots/hmr-update.png)

## Deck file conventions

A few rules of thumb:

- **One Markdown file per deck.** All your slides live in a single `README.md` (or whatever `content` points to).
- **Images go in `images/`.** Keep paths relative: `images/photo.jpg`.
- **CSS supports @import.** Split stylesheets if they grow large.
- **config.json is authoritative.** The dev server watches it for changes. Non-structural edits (title, styles) hot-reload; structural changes (plugins) trigger a full reload.

---

Next: [Evolve Your Deck →](03-evolve-your-deck.md)
