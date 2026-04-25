## Welcome to GeekSlides

A markdown-first, real-time presentation system.

No deck is configured yet.  
Load one with the terminal command below, or mount your deck directory.

Press **`t`** to open the terminal, then type `help` for a full command list.

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
| `t` | Open / close the terminal |
| `Esc` | Close the terminal |
| `f` | Toggle fullscreen |
| `s` | Open speaker view in new tab |
| `o` | Overview (slide grid) |

## Terminal Commands

Open the terminal with **`t`**, then type a command and press `Enter`.

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

See [how-to/02-create-your-first-deck.md](https://github.com/ciberado/geekslides/blob/main/how-to/02-create-your-first-deck.md) for how to create a deck.
