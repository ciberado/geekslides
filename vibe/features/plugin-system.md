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

### chart-processor

Converts `<table>` elements inside slides marked with the `.chart` class into Chart.js canvases (replacing v1's `ChartSlideController`).

A single processor function checks if the slide element has the `chart` class. If so, it queries all `<table>` elements, and for each one creates a `<geek-chart>` custom element, sets its `type` attribute based on additional CSS classes on the slide (`.bar`, `.line`, `.pie`, `.doughnut`, `.radar` — defaulting to `bar`), moves the table HTML inside the chart element, and replaces the table in the DOM.

### video-processor

Handles `<video>` elements with timestamp-based partials (replacing v1's `VideoSlideController`).

A single processor function queries for a `<video>` element inside the slide. If found, it creates a `<geek-video>` custom element, replaces the original `<video>` in the DOM, and appends the `<video>` as a child of the new component.

### iframe-processor

Lazy-loads iframes by converting `data-src` to `src` only when the slide becomes active.

A single processor function queries all `iframe[data-src]` elements in the slide. It sets up a `MutationObserver` on the slide element watching for changes to the `active` attribute. When the slide becomes active, each iframe's `data-src` value is copied to `src` (only once — it checks that `src` isn't already set).

## Plugin Registration via Config

Plugins are registered in `config.json` or programmatically:

### Via config.json

The `plugins` field in `config.json` lists built-in plugin short names:

```json
{
  "title": "My Presentation",
  "content": "README.md",
  "plugins": {
    "preprocessors": ["header"],
    "processors": ["chart", "video", "iframe"]
  }
}
```

All built-in plugins are available by short name. The engine maintains a `BUILTIN_PLUGINS` registry mapping short names (`'header'`, `'chart'`, `'video'`, `'iframe'`) to their corresponding plugin objects.

### Programmatic (custom plugins)

Plugins can also be registered programmatically by importing `PluginManager` from `@geekslides/engine` and calling `register()` with a plugin object. Custom plugins follow the same shape: a `name`, optional `preprocessors` array of `(md) => md` functions, and optional `processors` array of `(el) => void` functions. For example, a custom plugin could replace all `TODO` markers in markdown with a warning emoji, or add click-to-zoom handlers to images after rendering.

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
│  4. ...custom processors        │
└─────────────────────────────────┘
    │
    ▼
Slides Ready
```

## v1 → v2 Migration

| v1 | v2 |
|----|----|
| `SlideshowController.slidePreprocessors.push(fn)` | `pluginManager.register({ preprocessors: [fn] })` |
| `SlideshowController.slideProcessors.push(fn)` | `pluginManager.register({ processors: [fn] })` |
| `headerPreprocessor` (inline in SlideshowController) | `header-preprocessor.ts` (standalone plugin) |
| `ChartSlideController` (class, 200 LOC) | `chart-processor.ts` (function, ~30 LOC) + `<geek-chart>` |
| `VideoSlideController` (class) | `video-processor.ts` + `<geek-video>` |
| Hardcoded in SlideshowController constructor | Declarative via config.json or programmatic register |
