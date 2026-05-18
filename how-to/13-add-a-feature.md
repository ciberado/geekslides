# Add a Feature to Your Deck

Features are interactive extensions that run throughout your presentation — things like the whiteboard overlay, live surveys, or audience reactions. Unlike plugins (which transform content at parse time), features have ongoing access to navigation, sync, commands, and the DOM. This guide shows you how to enable built-in features and load external ones.

## Built-in features

GeekSlides ships with three built-in features:

| Name | What it does |
|---|---|
| `whiteboard` | Drawing overlay with pen, highlighter, eraser, and real-time sync |
| `media-sync` | Syncs YouTube/audio/video play, pause, and seek across all clients |
| `poll` | Live audience polling with real-time vote aggregation |

> **Tip:** The `media` plugin bundle enables `media-sync` automatically. The `whiteboard` bundle enables the whiteboard. You can also enable them via `plugins: ["media"]` or `plugins: ["whiteboard"]` instead of the `features` array.

## Enable a feature via plugin bundle

The cleanest way to enable the whiteboard or media sync is through the `plugins` array:

```json
{
  "title": "My Talk",
  "content": "README.md",
  "plugins": ["whiteboard"]
}
```

Or combine both:

```json
{
  "plugins": ["whiteboard", "media"]
}
```

## Enable a feature explicitly

Add a `features` array to your `config.json`:

```json
{
  "title": "My Talk",
  "content": "README.md",
  "styles": ["css/local.css"],
  "features": ["whiteboard"],
  "aspectRatio": "16/9"
}
```

Features listed here are loaded and activated when the presentation starts.

## Disable all features

Omit the `features` key (and don't list any feature bundles under `plugins`). No features are active by default.

## Load a local feature

You can ship a feature as a `.js` file alongside your deck, just like local plugins:

```
my-deck/
├── config.json
├── README.md
└── features/
    └── countdown.js
```

Reference it with a relative path:

```json
{
  "features": ["whiteboard", "./features/countdown.js"]
}
```

The file must export a default object with `id`, `label`, and `activate` — see [Create a Custom Feature](14-create-a-custom-feature.md) for the full format.

## Load a remote feature

Features hosted on any HTTPS server work too:

```json
{
  "features": [
    "whiteboard",
    "https://cdn.example.com/features/survey.js"
  ]
}
```

Remote features are fetched through the server's plugin proxy to avoid CORS restrictions. The same security rules apply: `.js` files only, HTTPS required in production, 1 MB max.

## Feature resolution order

GeekSlides resolves each feature name in this order:

1. **Remote URL** — starts with `http://` or `https://`
2. **Local path** — starts with `./` or `../`
3. **Built-in name** — looked up in the engine's built-in registry

All three types can be mixed in the same array.

## Presenter vs viewer

Features are role-aware. The whiteboard, for example, only shows drawing tools and registers terminal commands for presenters. Viewers see strokes in real time but can't draw.

If you open a viewer link (`?vtoken=...` or `?readonly`), features activate in `viewer` role. Otherwise they activate as `presenter`.

## Verify it works

Start your deck:

```bash
geekslides dev
```

For the whiteboard: draw on a slide by clicking and dragging, or type `whiteboard` in the terminal (press `Escape`). Try `wb-pen`, `wb-highlighter`, `wb-eraser` for tools.

## Troubleshooting

| Problem | Fix |
|---|---|
| Feature commands not in terminal | Check that the feature name is spelled correctly in `config.json` |
| Feature not loading | Open browser console — look for `[features] Failed to load feature` messages |
| Local feature 404 | Verify the relative path starts with `./` and the file exists in your deck directory |
| Remote feature blocked | Ensure the URL uses HTTPS and the server's plugin proxy is running |

---

Next: [Create a Custom Feature →](14-create-a-custom-feature.md)
