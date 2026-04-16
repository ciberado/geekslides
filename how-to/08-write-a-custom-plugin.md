# Write a Custom Plugin

GeekSlides has a plugin system with two hooks: **preprocessors** that transform markdown before parsing, and **processors** that manipulate the DOM after rendering. This guide covers building built-in plugins that ship with the engine. If you just want to add a quick plugin to a single deck without touching the engine source, see [Add Local Plugins](09-add-local-plugins.md).

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

Preprocessors are **string → string** functions. Processors are **DOM → void** functions. Both are activated by name in `config.json`.

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

### 1. Create the file

```
packages/engine/src/plugins/builtins/emoji-preprocessor.ts
```

### 2. Write the preprocessor

```typescript
import type { Preprocessor } from '../types.ts';

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

### 3. Export it

Add the export to `packages/engine/src/plugins/index.ts`:

```typescript
export { emojiPreprocessor } from './builtins/emoji-preprocessor.ts';
```

### 4. Register it

In `packages/cli/app/main.js`, import and add it to the registry:

```javascript
import { emojiPreprocessor } from '@geekslides/engine';

const PREPROCESSORS = {
  header: headerPreprocessor,
  emoji: emojiPreprocessor,        // ← add this line
};
```

### 5. Activate it in your deck

```json
{
  "plugins": {
    "preprocessors": ["header", "emoji"],
    "processors": ["iframe"]
  }
}
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

```
packages/engine/src/plugins/builtins/image-zoom-processor.ts
```

### 2. Write the processor

```typescript
import type { Processor } from '../types.ts';

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

### 3. Export it

Add to `packages/engine/src/plugins/index.ts`:

```typescript
export { imageZoomProcessor } from './builtins/image-zoom-processor.ts';
```

### 4. Register it

In `packages/cli/app/main.js`:

```javascript
import { imageZoomProcessor } from '@geekslides/engine';

const PROCESSORS = {
  chart: chartProcessor,
  iframe: iframeProcessor,
  video: videoProcessor,
  'image-zoom': imageZoomProcessor,  // ← add this line
};
```

### 5. Activate and use

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

> **Tip:** Look at the built-in plugins for reference patterns: `header-preprocessor.ts` shows markdown line scanning, `iframe-processor.ts` shows `MutationObserver` usage, and `chart-processor.ts` shows element replacement.

## Testing your plugin

Add a test file at `packages/engine/tests/unit/YourPlugin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emojiPreprocessor } from '../../src/plugins/builtins/emoji-preprocessor.ts';

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
