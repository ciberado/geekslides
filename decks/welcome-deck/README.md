## 🎞️ Welcome to GeekSlides

> **A markdown-first, real-time presentation engine for technical talks.**

---

No deck is loaded yet. Here's how to get started:

| Step | What to do |
|---|---|
| **1** | Press **`Escape`** to open the command terminal |
| **2** | Type `room <name>` and press `Enter` to join your own room |
| **3** | Then use `load <config-url>` to load any deck by URL |

**Why?** The default room is shared by everyone — switch to your own room to present without conflicts.

**Tip:** type `help` in the terminal for the full command list.

::: Notes
This is the built-in welcome deck bundled with the GeekSlides Docker image.
It is displayed when no deck has been loaded into the current room.
The default room does not allow loading decks — users must switch to their own room first.
:::

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `Esc` | Open / close the command terminal |
| `?` | Show this shortcut reference |

::: Notes
GeekSlides uses standard presentation hotkeys. Arrow keys and Space advance slides.
The Escape key toggles the command terminal — a unique GeekSlides feature that gives
you CLI-style control over the presentation. The `?` key shows a quick-reference overlay.
:::

## Terminal Commands

Press **`Escape`** to open the terminal, type a command and press `Enter`.

| Command | Description |
|---|---|
| `help` | List all available commands |
| `go <n>` | Jump to slide number N |
| `room <name>` | Join a sync room (real-time co-navigation) |
| `sync-follow` | Follow the presenter in the room |
| `sync-disconnect` | Leave the sync room |
| `speaker` | Open speaker view |
| `overview` | Toggle slide grid overview |
| `whiteboard` | Toggle the whiteboard overlay |
| `fullscreen` | Toggle fullscreen |

::: Notes
The command terminal is GeekSlides' power-user interface. Press Escape to open it,
then type commands and press Enter. Commands cover navigation (`go`), real-time sync
(`room`, `sync-follow`), viewing modes (`speaker`, `overview`, `fullscreen`), and
the whiteboard overlay. Type `help` to see all available commands.
:::

## Load a Deck

Use the `load` command in the terminal to present any deck by URL:

```
load https://raw.githubusercontent.com/you/my-talk/main/config.json
```

Or pass it directly in the URL:

```
https://gs.aprender.cloud/?config=https://raw.githubusercontent.com/you/my-talk/main/config.json
```

::: Notes
Decks are loaded dynamically via their `config.json` URL. You can load a deck either
through the terminal `load` command or by passing a `?config=` query parameter in the
browser URL. This means any deck hosted on GitHub, a CDN, or your own server can be
presented instantly — no build step required.
:::

## Deploy Your Own Deck

Mount your deck directory at startup by setting `CONTENT_DIR` in `.env`:

```bash
CONTENT_DIR=/path/to/your/deck
```

Then restart the stack:

```bash
docker compose -f docker-compose.tailscale.yml up -d
```

See the [GeekSlides how-to guides](https://github.com/ciberado/geekslides/tree/main/how-to) for step-by-step instructions on creating and deploying decks.

::: Notes
For self-hosted deployments, set the CONTENT_DIR environment variable to point at
your deck directory. The Docker Compose stack bundles a Caddy reverse proxy, the
Yjs sync server, and the GeekSlides app in a single container. This is the simplest
way to run GeekSlides on your own infrastructure.
:::
