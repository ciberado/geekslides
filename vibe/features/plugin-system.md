# Plugin System

## Overview

v2 provides a clean, function-based plugin architecture with two extension points:

1. **Preprocessors** — transform raw markdown _before_ parsing (`string → string`)
2. **Processors** — transform rendered slide DOM _after_ HTML generation (`HTMLElement → void`)

Plugins are simple functions registered via config. No classes, no complex lifecycle.

## Plugin Types

```typescript
// packages/engine/src/plugins/types.ts

/**
 * Preprocessor: transforms raw markdown before markdown-it parsing.
 * Receives the full markdown string, returns transformed markdown.
 */
export type Preprocessor = (markdown: string, config: GeekSlidesConfig) => string;

/**
 * Processor: transforms a rendered slide's DOM element after HTML generation.
 * Called once per slide. Can modify the element in place, add event listeners, etc.
 */
export type Processor = (slideElement: HTMLElement, context: ProcessorContext) => void;

/**
 * Context passed to processors.
 */
export interface ProcessorContext {
  /** 0-based slide index */
  slideIndex: number;
  /** Total number of slides */
  slideCount: number;
  /** The full config object */
  config: GeekSlidesConfig;
  /** Reference to the slideshow element */
  slideshow: GeekSlideshow;
}

/**
 * A plugin bundle can provide preprocessors, processors, or both.
 */
export interface Plugin {
  name: string;
  preprocessors?: Preprocessor[];
  processors?: Processor[];
}
```

## PluginManager

```typescript
// packages/engine/src/plugins/PluginManager.ts

export class PluginManager {
  #preprocessors: Array<{ name: string; fn: Preprocessor }> = [];
  #processors: Array<{ name: string; fn: Processor }> = [];

  /**
   * Register a plugin bundle.
   */
  register(plugin: Plugin): void {
    for (const pp of plugin.preprocessors ?? []) {
      this.#preprocessors.push({ name: plugin.name, fn: pp });
    }
    for (const proc of plugin.processors ?? []) {
      this.#processors.push({ name: plugin.name, fn: proc });
    }
  }

  /**
   * Run all preprocessors sequentially on the markdown string.
   * Each preprocessor receives the output of the previous one.
   */
  preprocess(markdown: string, config: GeekSlidesConfig): string {
    return this.#preprocessors.reduce(
      (md, { fn }) => fn(md, config),
      markdown,
    );
  }

  /**
   * Run all processors on a slide element.
   */
  process(slideElement: HTMLElement, context: ProcessorContext): void {
    for (const { fn } of this.#processors) {
      fn(slideElement, context);
    }
  }

  /**
   * List registered plugin names (for debugging).
   */
  list(): { preprocessors: string[]; processors: string[] } {
    return {
      preprocessors: this.#preprocessors.map(p => p.name),
      processors: this.#processors.map(p => p.name),
    };
  }
}
```

## Built-in Plugins

### header-preprocessor

Converts `##` headers into slide separators with auto-generated anchors (same logic as v1's `headerPreprocessor`):

```typescript
// packages/engine/src/plugins/builtins/header-preprocessor.ts

export const headerPreprocessor: Plugin = {
  name: 'header-preprocessor',
  preprocessors: [
    (markdown: string): string => {
      return markdown.replace(
        /^## (.+)$/gm,
        (_, title) => {
          const anchor = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          return `\n[](.slide#${anchor})\n\n## ${title}`;
        },
      );
    },
  ],
};
```

### chart-processor

Converts `<table>` elements inside slides marked with `.chart` class into Chart.js canvases
(replacing v1's `ChartSlideController`):

```typescript
// packages/engine/src/plugins/builtins/chart-processor.ts

export const chartProcessor: Plugin = {
  name: 'chart-processor',
  processors: [
    (slideElement: HTMLElement, ctx: ProcessorContext): void => {
      if (!slideElement.classList.contains('chart')) return;

      const tables = slideElement.querySelectorAll('table');
      for (const table of tables) {
        const chartEl = document.createElement('geek-chart');
        chartEl.setAttribute('type', getChartType(slideElement));
        
        // Move table data into the chart component
        chartEl.innerHTML = table.outerHTML;
        table.replaceWith(chartEl);
      }
    },
  ],
};

function getChartType(el: HTMLElement): string {
  const classes = el.classList;
  if (classes.contains('bar')) return 'bar';
  if (classes.contains('line')) return 'line';
  if (classes.contains('pie')) return 'pie';
  if (classes.contains('doughnut')) return 'doughnut';
  if (classes.contains('radar')) return 'radar';
  return 'bar'; // default
}
```

### video-processor

Handles `<video>` elements with timestamp-based partials (replacing v1's `VideoSlideController`):

```typescript
// packages/engine/src/plugins/builtins/video-processor.ts

export const videoProcessor: Plugin = {
  name: 'video-processor',
  processors: [
    (slideElement: HTMLElement): void => {
      const video = slideElement.querySelector('video');
      if (!video) return;

      const videoEl = document.createElement('geek-video');
      video.replaceWith(videoEl);
      videoEl.appendChild(video);
    },
  ],
};
```

### iframe-processor

Lazy-loads iframes (converts `data-src` to `src` only when slide becomes active):

```typescript
// packages/engine/src/plugins/builtins/iframe-processor.ts

export const iframeProcessor: Plugin = {
  name: 'iframe-processor',
  processors: [
    (slideElement: HTMLElement): void => {
      const iframes = slideElement.querySelectorAll('iframe[data-src]');
      if (iframes.length === 0) return;

      // Observe slide activation to load iframes
      const observer = new MutationObserver(() => {
        if (slideElement.hasAttribute('active')) {
          for (const iframe of iframes) {
            if (!iframe.getAttribute('src')) {
              iframe.setAttribute('src', iframe.getAttribute('data-src')!);
            }
          }
        }
      });

      observer.observe(slideElement, { attributes: true, attributeFilter: ['active'] });
    },
  ],
};
```

## Plugin Registration via Config

Plugins are registered in `config.json` or programmatically:

### Via config.json

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

All built-in plugins are available by short name. The engine resolves them:

```typescript
const BUILTIN_PLUGINS: Record<string, Plugin> = {
  'header': headerPreprocessor,
  'chart': chartProcessor,
  'video': videoProcessor,
  'iframe': iframeProcessor,
};
```

### Programmatic (custom plugins)

```typescript
import { createSlideshow, PluginManager } from '@geekslides/engine';

const plugins = new PluginManager();

// Register built-ins
plugins.register(headerPreprocessor);
plugins.register(chartProcessor);

// Register custom plugin
plugins.register({
  name: 'my-custom-plugin',
  preprocessors: [
    (md) => md.replace(/TODO/g, '⚠️ TODO'),
  ],
  processors: [
    (el) => {
      // Add click handlers to all images
      el.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => img.classList.toggle('zoomed'));
      });
    },
  ],
});
```

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
