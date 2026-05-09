# Command System

## Overview

v2 keeps v1's **direct-keystroke navigation** (arrows, space, page up/down) exactly as-is —
presenters should never need a modifier key to advance slides. All other commands are
accessed through a **terminal-like command prompt** toggled by pressing **`Escape`**:

- **Direct keys** (no prefix): `→` `←` `Space` `PageDown` `PageUp` `Home` `End`
  — muscle-memory slide navigation, always active in NORMAL mode.
- **Terminal** (`Escape`): toggles a minimal command-line prompt at the bottom of the screen,
  regardless of what is currently in focus. The presenter types a command name (e.g. `emit`,
  `sync`, `speaker`) and presses Enter. Tab-completion and the `help` command list all
  available commands. Press `Escape` again to dismiss. The terminal height is drag-resizable.
- **Touch**: swipe left/right for navigation, long-press to open the terminal.

This separation keeps the most critical operation (next slide) zero-friction while
organizing everything else under a discoverable, searchable terminal prompt —
similar to how tmux's `:` opens a command line for advanced actions.

## Command Architecture

```
Key Press
    │
    ▼
┌──────────────────────────────┐
│       KeyBindings.ts         │
│                              │
│  State Machine:              │
│  ┌──────────┐                │
│  │  NORMAL  │◄──Esc───►┌──────────┐
│  │          │           │ TERMINAL │
│  │          │◄──Esc─────│ (prompt) │
│  └──────────┘           └──────────┘
│                              │
│  Direct keys (NORMAL mode):  │
│  → / ← / Space / etc.       │
│  Always handled, no prefix   │
└──────────────────────────────┘
    │
    ▼
CommandSystem.execute(commandName)
```

The system has exactly **two modes**:

- **NORMAL**: arrows/space navigate directly, `Escape` toggles terminal
- **TERMINAL**: command input active, `Escape` toggles back to NORMAL; all other keys are captured by the prompt

## Components

### CommandSystem

Central registry. All input paths (keyboard, touch, terminal) route through `CommandSystem.execute()`.

Each command has a name, label, and execute function. Commands can belong to a category
for grouping in help output.

### KeyBindings

Two-mode state machine (NORMAL / TERMINAL) that listens for `keydown` events.

In NORMAL mode, direct keys are mapped to navigation commands. `Escape` toggles the
terminal — it transitions to TERMINAL mode and calls the registered `onTerminalToggle`
callback regardless of which element has focus.

In TERMINAL mode, `Escape` toggles back to NORMAL. All other keystrokes are deferred to
the terminal prompt input.

### Terminal (`<geek-terminal>`)

A `<geek-terminal>` Web Component rendered as a translucent bar anchored at the bottom
of the viewport. It provides:

- **Input prompt**: a text input with `>` prefix, monospace font
- **Tab completion**: pressing Tab auto-completes from matching registered commands
- **Command execution**: Enter executes the typed command via `CommandSystem.execute()`
- **Output line**: shows the result or error message briefly (e.g. "sync: enabled",
  "Unknown command: foo")
- **Help**: the `help` command lists all registered commands grouped by category
- **History**: up/down arrows navigate through previously executed commands (session only)
- **Drag-to-resize**: a drag handle at the top edge lets the presenter resize the terminal
  height by dragging up or down (pointer capture, touch-friendly)
- **No auto-dismiss on Escape**: the terminal is toggled exclusively via `Escape` through
  `KeyBindings`. The `help` command keeps the panel open so the user can read the listing.

The terminal dispatches `geek:terminal:close` when `close()` is called. `KeyBindings`
listens for `Escape` and calls `terminal.toggle()` to open or close the panel.

### TouchInput

Handles swipe gestures and tap zones for mobile navigation. Long-press opens the terminal.

- **Swipe left/right**: next/prev slide
- **Swipe up**: toggle overview
- **Tap right 2/3**: next slide
- **Tap left 1/3**: previous slide
- **Long press (500ms)**: open terminal

## Direct Key Bindings (NORMAL mode)

| Key | Command | Description |
|-----|---------|-------------|
| `→` / `↓` | `next` | Next partial or slide |
| `←` / `↑` | `prev` | Previous partial or slide |
| `Space` | `next` | Next partial or slide |
| `PageDown` | `next` | Next partial or slide |
| `PageUp` | `prev` | Previous partial or slide |
| `Home` | `go-first` | Jump to first slide |
| `End` | `go-last` | Jump to last slide |
| `Escape` | *(toggle terminal)* | Opens or closes the command terminal (global) |
| `?` | *(toggle shortcuts)* | Shows/hides keyboard shortcuts overlay |

## Terminal Commands

| Command | Description |
|---------|-------------|
| `help` | List all available commands |
| `go <n>` | Jump to slide number n |
| `goto <n>` | Alias for `go` |
| `go-first` | Jump to the first slide |
| `go-last` | Jump to the last slide |
| `load <url>` | Load a different deck by config URL |
| `room <name>` | Switch sync room |
| `speaker` | Open speaker view in new tab |
| `overview` | Toggle overview mode |
| `fullscreen` | Toggle fullscreen mode |
| `whiteboard` | Toggle whiteboard overlay |
| `whiteboard-clear` | Clear whiteboard strokes on current slide |
| `wb-toolbar` | Toggle whiteboard toolbar visibility (`toggleVisibility`) |
| `wb-hide` | Hide whiteboard toolbar |
| `wb-show` | Show whiteboard toolbar |
| `wb-pen` | Switch to pen tool |
| `wb-highlighter` | Switch to highlighter tool (semi-transparent, wider) |
| `wb-eraser` | Switch to eraser tool |
| `wb-color <hex>` | Set drawing color (e.g. `wb-color #ff0000`) |
| `sync-follow` | Toggle follow/lead mode |
| `sync-disconnect` | Disconnect from sync |
| `share` | Create a read-only viewer link for the current room |
| `toggle-toolbar` | Toggle the presentation toolbar |

Plugin-provided commands are automatically registered and appear in `help` output.

## Mobile — Terminal on smartphones

On touch devices, the terminal is opened via long-press gesture. The terminal prompt
uses a larger font size and touch-friendly hit targets. The `help` command output is
scrollable. Auto-dismiss behavior is the same as desktop.

Touch tap zones use a 25/50/25 split: the left 25% of the screen is "previous",
the right 25% is "next", and the centre 50% is a dead zone that ignores taps
to prevent accidental navigation. The ratio is configurable via the `tapZoneRatio`
constructor option on `TouchInput`.

Long-press (500 ms) toggles the toolbar — a floating translucent bar with buttons
for prev, next, overview, fullscreen, whiteboard, and speaker view. The toolbar is
hidden by default and auto-hides in overview mode.
