# Use Plugin Registries

Manage plugins dynamically at runtime without editing `config.json`. Plugin registries are HTTPS-accessible directories that list available plugins. You add registries and load/unload plugins through terminal commands — changes are synced to all clients in the room and persist across deck changes within the same session.

## Prerequisites

- GeekSlides CLI installed ([Install the CLI](01-install-the-cli.md))
- A deck with sync enabled ([Sync Your Presentation](12-sync-your-presentation.md))
- A running sync room (registries are room-scoped)

## What is a plugin registry?

A plugin registry is a static directory served over HTTPS that contains an `index.json` manifest listing available plugins. Think of it like a package registry — it tells GeekSlides what plugins exist and where to find them.

```
https://plugins.example.com/
├── index.json          ← manifest
├── emoji/
│   └── plugin.json     ← plugin manifest
├── highlight/
│   └── plugin.json
└── image-zoom/
    └── plugin.json
```

You can host a registry on any static server: GitHub Pages, S3, Netlify, or any web server that serves files over HTTPS.

## Registry manifest format

The `index.json` at the registry root lists all available plugins:

```json
{
  "name": "My Team Plugins",
  "version": 1,
  "plugins": [
    {
      "name": "emoji",
      "version": "1.0.0",
      "description": "Emoji shortcodes in markdown",
      "entry": "emoji/plugin.json"
    },
    {
      "name": "highlight",
      "version": "2.0.0",
      "description": "Syntax highlighting with custom themes",
      "entry": "highlight/plugin.json"
    }
  ]
}
```

Each `entry` is a relative path to the plugin's `plugin.json` manifest — the same format used by built-in bundles (see [Write a Custom Plugin](08-write-a-custom-plugin.md)).

## Add a registry

Open the terminal (`Esc`) and type:

```
plugin-registry-add https://plugins.example.com/
```

GeekSlides fetches and validates the registry's `index.json`. If successful, the registry is added to the room's shared state and all connected clients can use its plugins.

> **Tip:** The registry URL goes through the server's plugin proxy, so CORS restrictions don't apply.

## List registries

See all registries configured for the current room:

```
plugin-registry-ls
```

Output:

```
Registries:
  1. My Team Plugins (https://plugins.example.com/)
  2. Community Plugins (https://community.geekslides.dev/)
```

## Browse available plugins

List all plugins from all configured registries:

```
plugin-available
```

Output:

```
Available plugins:
  emoji v1.0.0 — Emoji shortcodes in markdown [My Team Plugins]
  highlight v2.0.0 — Syntax highlighting with custom themes [My Team Plugins]
  countdown v1.2.0 — Slide countdown timer [Community Plugins]
```

## Load a plugin

Activate a plugin by name:

```
plugin-load emoji
```

The plugin is fetched, added to the processing pipeline, and the deck re-renders with the new plugin applied. All clients in the room see the change immediately.

> **Tip:** Room plugins are appended after deck-configured plugins. They don't replace your `config.json` setup — they extend it.

## Check active plugins

See which room plugins are currently loaded:

```
plugin-active
```

Output:

```
Active room plugins:
  emoji v1.0.0 (from My Team Plugins)
```

## Unload a plugin

Remove a plugin from the active pipeline:

```
plugin-unload emoji
```

The deck re-renders without the plugin. Other clients see the change immediately.

## Remove a registry

Remove a registry and all plugins loaded from it:

```
plugin-registry-remove https://plugins.example.com/
```

You can also remove by name:

```
plugin-registry-remove "My Team Plugins"
```

## How it works with deck changes

Room plugins survive deck changes. If the presenter loads a different deck with the `load` command or switches rooms, the room's plugin state is preserved:

- When a new deck loads, both the deck's `config.json` plugins AND room-loaded plugins are applied
- If a room plugin conflicts with a deck plugin (same name), the deck plugin takes priority
- Room plugins are deduped by their resolved manifest URL

## Host a registry on GitHub Pages

A simple way to share plugins with your team:

1. Create a GitHub repository (e.g. `my-org/geekslides-plugins`)
2. Add your plugins as directories with `plugin.json` manifests
3. Create `index.json` at the root listing all plugins
4. Enable GitHub Pages (Settings → Pages → Deploy from branch `main`)
5. Your registry URL is: `https://my-org.github.io/geekslides-plugins/`

Example directory structure:

```
my-org/geekslides-plugins/
├── index.json
├── emoji/
│   ├── plugin.json
│   └── emoji-preprocessor.js
└── footnotes/
    ├── plugin.json
    └── footnotes-preprocessor.js
```

## Scope and persistence

| Aspect | Behaviour |
|--------|-----------|
| **Scope** | Room-level — all clients in the same room share the plugin state |
| **Persistence** | Session-scoped — state is lost when all clients disconnect and the server drops the Y.Doc |
| **Sync** | Real-time — adding/removing registries and plugins is reflected on all clients immediately |
| **Deck changes** | Preserved — room plugins remain active across deck switches |
| **Security** | Plugins are fetched through the server proxy; only `.js` files are allowed |

## Terminal command reference

| Command | Description |
|---------|-------------|
| `plugin-registry-add <url>` | Add a registry URL (fetches and validates) |
| `plugin-registry-ls` | List configured registries |
| `plugin-registry-remove <url\|name>` | Remove a registry |
| `plugin-available` | List all plugins from all registries |
| `plugin-active` | List currently loaded room plugins |
| `plugin-load <name>` | Load a plugin from registries |
| `plugin-unload <name>` | Unload a room plugin |

---

Next: [Share a QR Code →](26-share-qr-code.md)
