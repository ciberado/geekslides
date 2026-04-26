## 🎞️ Welcome to GeekSlides

> **A markdown-first, real-time presentation engine for technical talks.**

---

No deck is loaded yet. Here's how to get started:

| Step | What to do |
|---|---|
| **1** | Press **`Escape`** to open the command terminal |
| **2** | Type `load <config-url>` and press `Enter` to load any deck by URL |
| **3** | Or mount your deck directory via `CONTENT_DIR` in `.env` |

**Tip:** type `help` in the terminal for the full command list.

::: Notes
This is the built-in welcome deck bundled with the GeekSlides Docker image.
It is displayed when no CONTENT_DIR is mounted at /srv/content.
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

## Load a Deck

Use the `load` command in the terminal to present any deck by URL:

```
load https://raw.githubusercontent.com/you/my-talk/main/config.json
```

Or pass it directly in the URL:

```
https://gs.aprender.cloud/?config=https://raw.githubusercontent.com/you/my-talk/main/config.json
```

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
