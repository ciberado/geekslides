# Plugin System

## Overview

v2 provides a clean, function-based plugin architecture with two extension points:

1. **Preprocessors** — transform raw markdown _before_ parsing (`string → string`)
2. **Processors** — transform rendered slide DOM _after_ HTML generation (`HTMLElement → void`)

Plugins are simple functions registered via config. No classes, no complex lifecycle.

## Plugin Types

Defined in `packages/engine/src/plugins/types.ts`:

- **`Preprocessor`**: A function `(markdown: string, config: GeekSlidesConfig) => string` that transforms raw markdown before markdown-it parsing. Receives the full markdown string and returns transformed markdown.

- **`Processor`**: A function `(slideElement: HTMLElement, context: ProcessorContext) => void` that transforms a rendered slide's DOM element after HTML generation. Called once per slide. Can modify the element in place, add event listeners, etc.

- **`ProcessorContext`**: An object passed to processors containing `slideIndex` (0-based), `slideCount` (total), `config` (the full config object), and `slideshow` (reference to the slideshow element).

- **`Plugin`**: A bundle with a `name` string, optional `preprocessors` array, and optional `processors` array. A plugin can provide both preprocessors and processors.

## PluginManager

`PluginManager` (in `packages/engine/src/plugins/PluginManager.ts`) maintains two private arrays: `#preprocessors` and `#processors`, each storing objects with `name` and `fn` fields.

- **`register(plugin)`**: Iterates the plugin's `preprocessors` and `processors` arrays, pushing each function into the corresponding internal array along with the plugin's name.

- **`preprocess(markdown, config)`**: Runs all registered preprocessors sequentially using `reduce()`. Each preprocessor receives the output of the previous one, forming a pipeline. Returns the final transformed markdown string.

- **`process(slideElement, context)`**: Runs all registered processors on a single slide element, calling each function in order.

- **`list()`**: Returns a diagnostic object with two arrays of plugin names for debugging.

## Built-in Plugins

### header-preprocessor

Converts `##` headers into slide separators with auto-generated anchors (same logic as v1's `headerPreprocessor`).

A single preprocessor function uses a regex to match lines starting with `## `. For each match, it generates a URL-friendly anchor by lowercasing the title, replacing non-alphanumeric runs with hyphens, and trimming leading/trailing hyphens. It inserts an empty link `[](.slide#anchor)` before the header line, which the slide parser later uses as a section separator.

> **Important:** The header preprocessor inserts a separator before *every* heading level (h1–h6). Decks that use explicit `[]()` slide markers and sub-headings within slides (e.g. `####` column breaks or `##` sub-titles) must disable it to avoid unintended slide splits. Set `"preprocessors": []` in `config.json`. The CLI `create` command scaffolds new decks with the preprocessor disabled by default.

### chart-processor

Converts `<table>` elements inside slides marked with the `.chart` class into Chart.js canvases (replacing v1's `ChartSlideController`).

A single processor function checks if the slide element has the `chart` class. If so, it queries all `<table>` elements, and for each one creates a `<geek-chart>` custom element, sets its `type` attribute based on additional CSS classes on the slide (`.bar`, `.line`, `.pie`, `.doughnut`, `.radar` — defaulting to `bar`), moves the table HTML inside the chart element, and replaces the table in the DOM.

### video-processor

Handles `<video>` elements with timestamp-based partials (replacing v1's `VideoSlideController`).

A single processor function queries for a `<video>` element inside the slide. If found, it creates a `<geek-video>` custom element, replaces the original `<video>` in the DOM, and appends the `<video>` as a child of the new component.

### iframe-processor

Lazy-loads iframes by converting `data-src` to `src` only when the slide becomes active.

A single processor function queries all `iframe[data-src]` elements in the slide. It sets up a `MutationObserver` on the slide element watching for changes to the `active` attribute. When the slide becomes active, each iframe's `data-src` value is copied to `src` (only once — it checks that `src` isn't already set).

### mermaid-processor

Renders Mermaid diagram code blocks into SVG diagrams at runtime.

A single processor function finds `<pre><code class="language-mermaid">` elements in the slide, extracts the text content as a Mermaid definition, dynamically imports the `mermaid` library (lazy — only loaded on first use), calls `mermaid.render()` to produce SVG, and replaces the `<pre>` with a `<div class="gs-mermaid">` containing the rendered SVG. The mermaid library is initialized with the `dark` theme. Render errors are caught and logged as `console.warn`, and the original `<pre>` element gains a `gs-mermaid-error` CSS class.

Users opt in via `config.json`: `"processors": ["iframe", "mermaid"]`.

## Plugin Registration via Config

Plugins are registered in `config.json` using three resolution modes:

### Built-in plugins (short names)

The engine maintains a registry mapping short names (`'header'`, `'chart'`, `'video'`, `'iframe'`, `'mermaid'`) to their bundled plugin functions:

```json
{
  "plugins": {
    "preprocessors": ["header"],
    "processors": ["chart", "video", "iframe"]
  }
}
```

### Local plugins (relative paths)

Deck authors can ship plain `.js` files alongside their deck and reference them with relative paths starting with `./` or `../`:

```json
{
  "plugins": {
    "preprocessors": ["header", "./plugins/emoji-preprocessor.js"],
    "processors": ["iframe", "./plugins/image-zoom-processor.js"]
  }
}
```

Local plugins are detected by `isLocalPluginPath()` and loaded via dynamic `import()`. Each file must export a `default` function matching the preprocessor or processor signature. The `extractPreprocessor()` and `extractProcessor()` utility functions validate the module shape.

### Remote plugins (full URLs)

Plugins can be hosted on any HTTPS server and referenced by full URL:

```json
{
  "plugins": {
    "preprocessors": ["https://plugins.example.com/emoji-preprocessor.js"],
    "processors": ["https://plugins.example.com/image-zoom-processor.js"]
  }
}
```

Remote plugins are detected by `isRemotePluginUrl()` and fetched through the server's `/api/plugin-proxy` endpoint to avoid CORS restrictions. The proxy fetches the `.js` file, and the browser creates a blob URL for dynamic import. See **Plugin Proxy** section below.

### Resolution order

When loading plugins, the app checks in this order:

1. **Remote URL** — starts with `http://` or `https://` → fetch via plugin proxy
2. **Local path** — starts with `./` or `../` → dynamic import from deck directory
3. **Built-in name** — looked up in the `PREPROCESSORS`/`PROCESSORS` maps

All three types can be mixed in the same `config.json` arrays. Order within each array determines execution sequence.

### Programmatic (custom built-in plugins)

Plugins can also be registered programmatically by importing `PluginManager` from `@geekslides/engine` and calling `register()` with a plugin object. Custom plugins follow the same shape: a `name`, optional `preprocessors` array of `(md) => md` functions, and optional `processors` array of `(el) => void` functions.

## Plugin Loader Utilities

Defined in `packages/engine/src/plugins/local-plugin.ts`:

- **`isLocalPluginPath(name)`** — returns `true` for paths starting with `./` or `../`
- **`isRemotePluginUrl(name)`** — returns `true` for `http://` or `https://` URLs
- **`extractPreprocessor(mod, path)`** — validates that a dynamically imported module has a `default` function export, returns it typed as `Preprocessor`
- **`extractProcessor(mod, path)`** — same validation for `Processor` type
- **`importRemotePlugin(url)`** — fetches a remote plugin through `/api/plugin-proxy`, creates a blob URL, and dynamically imports it

## Plugin Proxy

The server exposes `GET /api/plugin-proxy?url=<encoded-url>` to fetch remote JavaScript plugin files on behalf of the browser.

Security constraints:

- Only `.js` files are accepted
- Maximum response size: 1 MB
- `https:` required in production; `http:` allowed in dev mode (`NODE_ENV !== 'production'`)
- 10-second fetch timeout
- Response cached for 5 minutes (`Cache-Control: public, max-age=300`)

Implemented in `packages/server/src/PluginProxy.ts` and wired into the HTTP handler in `packages/server/src/index.ts`.

## Pipeline Execution Order

```
Raw Markdown
    │
    ▼
┌─────────────────────────────────┐
│  Preprocessor Pipeline          │
│  (sequential, order matters)    │
│                                 │
│  1. header-preprocessor         │
│  2. ...custom preprocessors     │
└─────────────────────────────────┘
    │
    ▼
Transformed Markdown
    │
    ▼
┌─────────────────────────────────┐
│  SlideParser.parse()            │
│  (markdown-it → HTML → slides)  │
│  + StyleScoper (per-slide CSS)  │
└─────────────────────────────────┘
    │
    ▼
SlideData[] (HTML sections)
    │
    ▼
<geek-slideshow>.loadSlides()
    │
    ▼
┌─────────────────────────────────┐
│  Processor Pipeline             │
│  (per slide, sequential)        │
│                                 │
│  For each <geek-slide>:         │
│  1. chart-processor             │
│  2. video-processor             │
│  3. iframe-processor            │
│  4. mermaid-processor            │
│  5. ...custom processors        │
└─────────────────────────────────┘
    │
    ▼
Slides Ready
```

## Plugins vs Features

Plugins handle **content transformation** at parse time. For **interactive, stateful extensions** that need ongoing access to navigation, sync, commands, and the DOM at runtime, see the [Feature System](feature-system.md).

Examples of features (not plugins): whiteboard, live surveys, Q&A overlays, audience reactions.

## v1 → v2 Migration

| v1 | v2 |
|----|----|
| `SlideshowController.slidePreprocessors.push(fn)` | `pluginManager.register({ preprocessors: [fn] })` |
| `SlideshowController.slideProcessors.push(fn)` | `pluginManager.register({ processors: [fn] })` |
| `headerPreprocessor` (inline in SlideshowController) | `header-preprocessor.ts` (standalone plugin) |
| `ChartSlideController` (class, 200 LOC) | `chart-processor.ts` (function, ~30 LOC) + `<geek-chart>` |
| `VideoSlideController` (class) | `video-processor.ts` + `<geek-video>` |
| Hardcoded in SlideshowController constructor | Declarative via config.json or programmatic register |
