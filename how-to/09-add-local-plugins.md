# Add Local Plugins

You can ship plain JavaScript plugins alongside your deck files — no need to touch the engine source. Drop a `.js` file in your deck directory, reference it in `config.json` with a relative path, and it loads automatically. You can also load plugins from **remote URLs** to share plugins across decks.

## How it works

GeekSlides recognises three plugin formats in `config.json`:

| Format | Example | How it loads |
|---|---|---|
| Built-in name | `"header"` | Looked up in the engine's registry |
| Relative path | `"./plugins/emoji.js"` | Dynamically imported from the deck directory |
| Remote URL | `"https://cdn.example.com/plugins/emoji.js"` | Fetched through the server proxy, then imported |

```
my-deck/
├── config.json
├── README.md
├── local.css
└── plugins/
    ├── emoji-preprocessor.js
    └── image-zoom-processor.js
```

```json
{
  "plugins": {
    "preprocessors": ["header", "./plugins/emoji-preprocessor.js"],
    "processors": ["iframe", "./plugins/image-zoom-processor.js"]
  }
}
```

Built-in names (`header`, `iframe`) and local paths (`./plugins/...`) can be mixed freely. Order matters — plugins run in the listed sequence.

## Write a local preprocessor

A preprocessor receives the full markdown string and the deck config, and returns the transformed markdown.

Create `plugins/emoji-preprocessor.js` in your deck directory:

```javascript
const EMOJI_MAP = {
  ':warning:': '⚠️',
  ':check:': '✅',
  ':cross:': '❌',
  ':rocket:': '🚀',
  ':fire:': '🔥',
  ':star:': '⭐',
  ':info:': 'ℹ️',
  ':bulb:': '💡',
};

export default function emojiPreprocessor(markdown, config) {
  let result = markdown;
  for (const [code, emoji] of Object.entries(EMOJI_MAP)) {
    result = result.replaceAll(code, emoji);
  }
  return result;
}
```

Activate it in `config.json`:

```json
{
  "plugins": {
    "preprocessors": ["header", "./plugins/emoji-preprocessor.js"]
  }
}
```

Use it in your markdown:

```markdown
## Status Update

- :check: Authentication module
- :warning: Load testing — in progress
- :cross: Mobile optimization — not started
```

## Write a local processor

A processor receives a slide's content DOM element and can mutate it in place. The second argument is a context object with `slideIndex`, `slideCount`, `config`, and `slideshow`.

Create `plugins/image-zoom-processor.js`:

```javascript
export default function imageZoomProcessor(slideElement, context) {
  const images = slideElement.querySelectorAll('img');
  if (images.length === 0) return;

  images.forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.style.transition = 'transform 0.3s ease';

    img.addEventListener('click', () => {
      const isZoomed = img.getAttribute('data-zoomed') === 'true';

      if (isZoomed) {
        img.style.transform = '';
        img.style.cursor = 'zoom-in';
        img.setAttribute('data-zoomed', 'false');
      } else {
        const rect = img.getBoundingClientRect();
        const containerRect = slideElement.getBoundingClientRect();
        const scaleX = containerRect.width / rect.width;
        const scaleY = containerRect.height / rect.height;
        const scale = Math.min(scaleX, scaleY) * 0.9;

        img.style.transform = `scale(${scale})`;
        img.style.cursor = 'zoom-out';
        img.setAttribute('data-zoomed', 'true');
      }
    });
  });
}
```

Activate it:

```json
{
  "plugins": {
    "processors": ["iframe", "./plugins/image-zoom-processor.js"]
  }
}
```

Every image in your slides is now zoomable — no markdown changes needed.

## The function signatures

| Type | Signature |
|---|---|
| Preprocessor | `(markdown: string, config: object) => string` |
| Processor | `(slideElement: HTMLElement, context: object) => void` |

The `context` object passed to processors contains:

| Field | Type | Description |
|---|---|---|
| `slideIndex` | `number` | Zero-based index of the current slide |
| `slideCount` | `number` | Total number of slides |
| `config` | `object` | The deck's parsed `config.json` |
| `slideshow` | `HTMLElement` | The `<geek-slideshow>` element |

## Rules for local and remote plugins

| Rule | Why |
|---|---|
| File must use `export default function` | GeekSlides reads the default export |
| Use plain JavaScript (`.js` files) | The browser loads them directly — no build step |
| Preprocessors must be pure | Same input, same output — keeps HMR predictable |
| Processors must only touch their `slideElement` | Shadow DOM isolates slides; don't reach into siblings |
| Keep plugins stateless | They re-run on every HMR reload |
| Local paths must start with `./` or `../` | Absolute paths without scheme are not supported |
| Remote URLs must end in `.js` | The proxy only accepts JavaScript files |
| Remote URLs use `https:` in production | `http:` is allowed in dev mode only |

> **Tip:** Start by copying a working example from this guide, then modify it. The `plugins/` directory name is a convention — you can use any relative path.

## Use remote plugins

To share plugins across multiple decks, host them on any HTTPS server and reference them by full URL:

```json
{
  "plugins": {
    "preprocessors": ["header", "https://plugins.example.com/emoji-preprocessor.js"],
    "processors": ["iframe", "https://plugins.example.com/image-zoom-processor.js"]
  }
}
```

Remote plugins are fetched through the server's `/api/plugin-proxy` endpoint, which avoids CORS restrictions. The proxy:

- Only fetches `.js` files
- Enforces a 1 MB size limit
- Caches responses for 5 minutes
- Requires `https:` in production (`http:` allowed in dev mode)

This means you can publish plugins to any static hosting (GitHub Pages, npm CDN, S3) and reference them from any deck without copying files.

> **Tip:** For a team plugin repository, create a Git repo with your shared plugins and serve them via GitHub Pages or a CDN.

---

← Previous: [Write a Custom Plugin](08-write-a-custom-plugin.md) | Next: [Use the Docker CLI →](10-use-the-docker-cli.md)
