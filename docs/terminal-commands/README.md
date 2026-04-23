# Terminal Commands Reference

GeekSlides has a built-in command terminal inspired by terminal multiplexers like tmux. Press **`Esc`** anywhere in the presentation to open it. Press **`Esc`** again (or run a command) to close it.

The terminal supports **tab completion**, **command history** (↑ / ↓), and the `help` command.

---

## How the Terminal Works

The presenter view has two keyboard modes:

| Mode | Description |
|---|---|
| **NORMAL** | Default. Arrow keys and Space navigate slides. `Esc` opens the terminal. `?` opens the keyboard shortcuts overlay. |
| **TERMINAL** | Command prompt active. All keystrokes go to the input. `Esc` closes the terminal. |

When the terminal is open, type a command name and press **Enter**. Arguments are separated by spaces.

**Tab completion** — Press `Tab` while typing to auto-complete to the first matching command name.

**History** — Use `↑` / `↓` to cycle through previously executed commands (session only).

**Resize** — Drag the handle at the top edge of the terminal panel to adjust its height.

---

## Keyboard Shortcuts (NORMAL Mode)

These keys work at all times without opening the terminal:

| Key | Command | Action |
|---|---|---|
| `→` or `Space` | `next` | Next slide or reveal next partial |
| `↓` | `next` | Next slide or reveal next partial |
| `Page Down` | `next` | Next slide or reveal next partial |
| `←` | `prev` | Previous slide or hide last partial |
| `↑` | `prev` | Previous slide or hide last partial |
| `Page Up` | `prev` | Previous slide or hide last partial |
| `Home` | `go-first` | Jump to first slide |
| `End` | `go-last` | Jump to last slide |
| `Esc` | *(toggle terminal)* | Open / close terminal |
| `?` | *(toggle shortcuts)* | Show keyboard shortcuts overlay |

---

## All Terminal Commands

Commands are grouped by category.

### terminal

Built-in commands provided by the terminal component itself.

#### `help`

List all registered commands grouped by category.

```
> help
```

Output example:

```
navigation: next, prev, go-first, go-last, go
view: fullscreen, overview, speaker, toggle-toolbar
sync: room, sync-follow, sync-disconnect, share
config: load
whiteboard: whiteboard, whiteboard-clear, wb-toolbar, wb-hide, wb-show, wb-pen, wb-highlighter, wb-eraser, wb-color
terminal: help
```

---

### navigation

Commands for moving between slides.

#### `next`

Advance to the next slide or reveal the next partial element.

```
> next
```

Equivalent to pressing `→` or `Space`.

---

#### `prev`

Go back to the previous slide or hide the last revealed partial.

```
> prev
```

Equivalent to pressing `←`.

---

#### `go-first`

Jump to the first slide.

```
> go-first
```

---

#### `go-last`

Jump to the last slide.

```
> go-last
```

---

#### `go <n>`

Jump to slide number `n` (1-based).

```
> go 1
> go 5
> go 12
```

If `n` is out of range or not a number, the command does nothing.

---

### view

Commands that change the presentation display state.

#### `fullscreen`

Toggle fullscreen mode. Enters fullscreen if not already in it; exits if it is.

```
> fullscreen
```

> **Tip:** Fullscreen requires a user gesture. Running this command from the terminal counts as one.

---

#### `overview`

Toggle overview mode — a zoomable grid of all slides. Navigate to a slide by clicking its thumbnail. Press `Esc` or run `overview` again to return to present mode.

```
> overview
```

---

#### `speaker`

Open the speaker view in a new browser tab. The speaker view shows your notes, the current slide, the next slide, an elapsed timer, and a clock.

```
> speaker
```

You can also open it directly via URL:

```
http://localhost:5173/?config=my-talk/config.json&view=speaker
```

---

#### `toggle-toolbar`

Show or hide the slide toolbar (the icon row shown on hover at the bottom of the slide).

```
> toggle-toolbar
```

---

### config

Commands for loading deck configuration at runtime.

#### `load <config-url>`

Load a different deck by providing the URL of a `config.json` file. The current deck is replaced and the slideshow reloads from the new configuration.

```
> load /my-other-talk/config.json
> load https://example.com/talks/keynote/config.json
```

If no URL is provided, an error message is displayed:

```
✗ Usage: load <config-url>
```

---

### sync

Commands for real-time collaborative sync (requires a running y-websocket server).

#### `room <name>`

Disconnect from the current sync room and connect to the room named `name`. Broadcasts the current slide position to the new room.

```
> room my-keynote
> room demo-2026
```

If no name is provided:

```
✗ Usage: room <room-name>
```

On success:

```
✓ Room changed: my-keynote
```

---

#### `sync-follow`

Toggle the follow-presenter mode. When enabled, your view automatically tracks the presenter's current slide position.

```
> sync-follow
```

---

#### `sync-disconnect`

Disconnect from the current sync room. You remain on the current slide but stop receiving or broadcasting state.

```
> sync-disconnect
```

On success:

```
✓ Sync disconnected
```

---

#### `share`

Generate a viewer share link for the current sync room. The link is copied to the clipboard (requires HTTPS or localhost) and displayed in the terminal.

```
> share
```

On success:

```
✓ Share link (copied to clipboard): https://your-server/...?room=my-keynote&vtoken=...
```

Viewers who open the link can watch the presentation in real time but cannot control it. The presenter's browser URL is also updated with a `token` query parameter for future reconnections.

If not connected to a room:

```
✗ Not connected to a room
```

---

### whiteboard

> **Requires the whiteboard feature.** These commands are only available when `"whiteboard"` is listed in the `features` array of your deck's `config.json`. New decks include it by default. If the commands are missing from `help` output, add the feature:
>
> ```json
> {
>   "features": ["whiteboard"]
> }
> ```
>
> See [Add a Feature to Your Deck](../../how-to/13-add-a-feature.md) for details.

#### `whiteboard`

Toggle the whiteboard drawing canvas on the current slide. When active, a transparent canvas appears on top of the slide content.

```
> whiteboard
```

If sync is active, the visibility state is broadcast to connected viewers.

---

#### `whiteboard-clear`

Clear all strokes on the current slide's canvas.

```
> whiteboard-clear
```

If sync is active, the clear is broadcast to connected viewers.

---

#### `wb-toolbar`

Toggle the whiteboard tool toolbar (collapse / expand).

```
> wb-toolbar
```

---

#### `wb-hide`

Hide the whiteboard toolbar without clearing strokes.

```
> wb-hide
```

---

#### `wb-show`

Show the whiteboard toolbar.

```
> wb-show
```

---

#### `wb-pen`

Switch the active drawing tool to the **pen** (thin, opaque strokes).

```
> wb-pen
```

---

#### `wb-highlighter`

Switch the active drawing tool to the **highlighter** (thick, semi-transparent strokes).

```
> wb-highlighter
```

---

#### `wb-eraser`

Switch the active drawing tool to the **eraser**.

```
> wb-eraser
```

---

#### `wb-color <hex>`

Set the drawing color for the pen and highlighter. Accepts any CSS hex color.

```
> wb-color #ff0000
> wb-color #00bfff
> wb-color #fff
```

If no color is provided:

```
✗ Usage: wb-color <hex-color>
```

---

## Quick Reference

| Command | Arguments | Category | Description |
|---|---|---|---|
| `help` | — | terminal | List all commands |
| `next` | — | navigation | Next slide / partial |
| `prev` | — | navigation | Previous slide / partial |
| `go-first` | — | navigation | First slide |
| `go-last` | — | navigation | Last slide |
| `go` | `<n>` | navigation | Jump to slide n |
| `fullscreen` | — | view | Toggle fullscreen |
| `overview` | — | view | Toggle overview grid |
| `speaker` | — | view | Open speaker view tab |
| `toggle-toolbar` | — | view | Show / hide slide toolbar |
| `load` | `<url>` | config | Load a deck from URL |
| `room` | `<name>` | sync | Join a sync room |
| `sync-follow` | — | sync | Toggle follow-presenter |
| `sync-disconnect` | — | sync | Leave sync room |
| `share` | — | sync | Create viewer share link |
| `whiteboard` † | — | whiteboard | Toggle drawing canvas |
| `whiteboard-clear` † | — | whiteboard | Clear current slide strokes |
| `wb-toolbar` † | — | whiteboard | Toggle toolbar visibility |
| `wb-hide` † | — | whiteboard | Hide toolbar |
| `wb-show` † | — | whiteboard | Show toolbar |
| `wb-pen` † | — | whiteboard | Switch to pen tool |
| `wb-highlighter` † | — | whiteboard | Switch to highlighter tool |
| `wb-eraser` † | — | whiteboard | Switch to eraser tool |
| `wb-color` † | `<hex>` | whiteboard | Set drawing color |

† Requires the `whiteboard` feature to be enabled in `config.json`.

---

See also: [HTML Reference](../html-reference/slides.md) · [Add a Feature to Your Deck](../../how-to/13-add-a-feature.md)
