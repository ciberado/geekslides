# Write a Custom Plugin

GeekSlides has a plugin system with two hooks: **preprocessors** that transform markdown before parsing, and **processors** that manipulate the DOM after rendering. This guide covers building built-in plugins that ship with the engine and registering them as a named bundle. If you just want to add a quick plugin to a single deck without touching the engine source, see [Add Local Plugins](09-add-local-plugins.md).

## How the plugin pipeline works

```
README.md (raw markdown)
   │
   ▼  Preprocessors — chained, each receives previous output
   │
   ▼  SlideParser.parse() — markdown-it → HTML → slides
   │
   ▼  <geek-slideshow>.loadSlides() — mount into Shadow DOM
   │
   ▼  Processors — run on each slide's DOM, sequentially
```

Preprocessors are **string → string** functions. Processors are **DOM → void** functions. Both are activated by name in `config.json`, or via a named plugin bundle (`plugins: ["my-bundle"]`).

## Plugin bundles

Built-in plugins are grouped into named bundles under `plugins/` at the repo root. Each bundle directory contains the source files, a `plugin.json` manifest, and a `README.md`:

```
plugins/
  core/           header-preprocessor.ts, iframe-processor.ts
  media/          youtube-url-plugin.ts, audio-url-plugin.ts, …, media-sync-feature.ts
  whiteboard/     whiteboard-feature.ts
  chart/          chart-processor.ts
  mermaid/        mermaid-processor.ts
  css-doodle/     css-doodle-preprocessor.ts, css-doodle-processor.ts, patterns/
  poll/           poll-feature.ts
```

Decks activate a bundle with a single string:

```json
{ "plugins": ["media"] }
```

The bundle system resolves `dependsOn` chains automatically — `media` pulls in `core`, so `header` and `iframe` are always included.

## The type signatures

Both types live in `packages/engine/src/plugins/types.ts`:

```typescript
// Receives the full markdown and returns transformed markdown
type Preprocessor = (markdown: string, config: GeekSlidesConfig) => string;

// Receives a slide's content element and mutates it in place
type Processor = (slideElement: HTMLElement, context: ProcessorContext) => void;

interface ProcessorContext {
  readonly slideIndex: number;
  readonly slideCount: number;
  readonly config: GeekSlidesConfig;
  readonly slideshow: HTMLElement;
}
```

A plugin bundles one or more of these under a name:

```typescript
interface Plugin {
  readonly name: string;
  readonly preprocessors?: readonly Preprocessor[];
  readonly processors?: readonly Processor[];
}
```

## Example: emoji preprocessor

Let's build a preprocessor that replaces shortcodes like `:warning:` and `:check:` with emoji. This lets you write readable markdown that renders with visual indicators.

### 1. Create a new bundle directory

```
plugins/utils/
```

### 2. Write the preprocessor

Create `plugins/utils/emoji-preprocessor.ts`:

```typescript
import type { Preprocessor } from '@engine/plugins/types.ts';

const EMOJI_MAP: Record<string, string> = {
  ':warning:': '⚠️',
  ':check:': '✅',
  ':cross:': '❌',
  ':rocket:': '🚀',
  ':fire:': '🔥',
  ':star:': '⭐',
  ':info:': 'ℹ️',
  ':bulb:': '💡',
};

export const emojiPreprocessor: Preprocessor = (markdown: string): string => {
  let result = markdown;

  for (const [code, emoji] of Object.entries(EMOJI_MAP)) {
    result = result.replaceAll(code, emoji);
  }

  return result;
};
```

### 3. Create the bundle manifest

Create `plugins/utils/plugin.json`:

```json
{
  "name": "utils",
  "description": "Utility plugins: emoji shortcodes and more",
  "version": "1.0.0",
  "dependsOn": ["core"],
  "preprocessors": ["emoji"],
  "processors": [],
  "features": []
}
```

### 4. Register it in the bundle registry

Add a `utils` entry to `BUILTIN_BUNDLES` in `packages/engine/src/plugins/plugin-bundles.ts`:

```typescript
utils: {
  name: 'utils',
  description: 'Utility plugins: emoji shortcodes and more',
  dependsOn: ['core'],
  preprocessors: ['emoji'],
  processors: [],
  features: [],
},
```

### 5. Register it in the CLI

In `packages/cli/app/main.js`, import and add it to the preprocessors map:

```javascript
import { emojiPreprocessor } from '@geekslides/engine';

const PREPROCESSORS = {
  header: headerPreprocessor,
  emoji: emojiPreprocessor,        // ← add this line
};
```

Also export it from `packages/engine/src/plugins/index.ts`:

```typescript
export { emojiPreprocessor } from '../../../../plugins/utils/emoji-preprocessor.ts';
```

### 6. Activate it in your deck

Use the bundle name:

```json
{
  "plugins": ["utils"]
}
```

Or list the individual plugin name explicitly:

```json
{
  "plugins": {
    "preprocessors": ["header", "emoji"],
    "processors": ["iframe"]
  }
}
```
```

### 6. Use it in your markdown

```markdown
## Status Update

- :check: Authentication module
- :check: Database migration
- :warning: Load testing — in progress
- :cross: Mobile optimization — not started

> :bulb: Use shortcodes for consistent visuals across all your decks.
```

This renders as a clean checklist with emoji, while your source markdown stays readable.

## Example: image-zoom processor

Now let's build a processor that adds click-to-zoom behaviour to images. When the presenter clicks an image, it expands to fill the slide — click again to shrink it back.

### 1. Create the file

Add `image-zoom-processor.ts` to your bundle's directory. If you're adding it to the `utils` bundle from above:

```
plugins/utils/image-zoom-processor.ts
```

### 2. Write the processor

```typescript
import type { Processor } from '@engine/plugins/types.ts';

export const imageZoomProcessor: Processor = (slideElement: HTMLElement): void => {
  const images = slideElement.querySelectorAll('img');
  if (images.length === 0) return;

  images.forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.style.transition = 'transform 0.3s ease, z-index 0s';

    img.addEventListener('click', () => {
      const isZoomed = img.getAttribute('data-zoomed') === 'true';

      if (isZoomed) {
        img.style.transform = '';
        img.style.zIndex = '';
        img.style.cursor = 'zoom-in';
        img.setAttribute('data-zoomed', 'false');
      } else {
        const rect = img.getBoundingClientRect();
        const containerRect = slideElement.getBoundingClientRect();
        const scaleX = containerRect.width / rect.width;
        const scaleY = containerRect.height / rect.height;
        const scale = Math.min(scaleX, scaleY) * 0.9;

        img.style.transform = `scale(${scale})`;
        img.style.zIndex = '50';
        img.style.cursor = 'zoom-out';
        img.setAttribute('data-zoomed', 'true');
      }
    });
  });
};
```

### 3. Export and register it

Add to `packages/engine/src/plugins/index.ts`:

```typescript
export { imageZoomProcessor } from '../../../../plugins/utils/image-zoom-processor.ts';
```

Update `plugin.json` in your bundle to include the new processor name, and register it in the CLI's `PROCESSORS` map:

```javascript
import { imageZoomProcessor } from '@geekslides/engine';

const PROCESSORS = {
  chart: chartProcessor,
  iframe: iframeProcessor,
  video: videoProcessor,
  'image-zoom': imageZoomProcessor,  // ← add this line
};
```

### 4. Activate and use

```json
{
  "plugins": {
    "preprocessors": ["header"],
    "processors": ["iframe", "image-zoom"]
  }
}
```

Every `<img>` in your slides is now zoomable — no markdown changes needed.

## Key design rules

| Rule | Why |
|---|---|
| Preprocessors must be **pure** — same input, same output | Ensures HMR and re-renders are predictable |
| Processors must only mutate the `slideElement` they receive | Shadow DOM isolates slides; don't reach into siblings |
| **Order matters** in `config.json` arrays | Preprocessors chain sequentially; processors run in listed order |
| Guard early with `if (!condition) return` | Skip slides that don't need your processor |
| Keep plugins **stateless** | They run again on every HMR reload — no long-lived state |

> **Tip:** Look at the built-in plugins for reference patterns: `plugins/core/header-preprocessor.ts` shows markdown line scanning, `plugins/core/iframe-processor.ts` shows `MutationObserver` usage, and `plugins/chart/chart-processor.ts` shows element replacement.

## Testing your plugin

Add a test file at `packages/engine/tests/unit/YourPlugin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emojiPreprocessor } from '../../../../plugins/utils/emoji-preprocessor.ts';

describe('emojiPreprocessor', () => {
  it('replaces shortcodes with emoji', () => {
    const input = '- :check: Done\n- :warning: Pending';
    const result = emojiPreprocessor(input, {} as never);
    expect(result).toBe('- ✅ Done\n- ⚠️ Pending');
  });

  it('leaves unknown shortcodes untouched', () => {
    const input = ':unknown: stays as is';
    const result = emojiPreprocessor(input, {} as never);
    expect(result).toBe(':unknown: stays as is');
  });
});
```

Run tests with:

```bash
npm test
```

---

Next: [Add Local Plugins →](09-add-local-plugins.md)
