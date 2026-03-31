# Command System

## Overview

v2 keeps v1's **direct-keystroke navigation** (arrows, space, page up/down) exactly as-is —
presenters should never need a modifier key to advance slides. All other commands (mode
toggles, whiteboard, sync, etc.) move to a **tmux-style prefix key** system:

- **Direct keys** (no prefix): `→` `←` `Space` `PageDown` `PageUp` `Home` `End`
  — muscle-memory slide navigation, always active in NORMAL mode.
- **Prefix key** (`Ctrl+B` then a single key): for non-navigation actions.
  After pressing `Ctrl+B`, a 1.5 s window opens for the follow-up key.
  A visual indicator shows the system is waiting.
- **Command palette** (`:`): opens a searchable list of all registered commands.
  Useful for discoverable access to infrequent or plugin-provided actions.

This separation keeps the most critical operation (next slide) zero-friction while
organizing everything else under a consistent, discoverable prefix — exactly like
tmux uses `Ctrl+B` + key for window management while leaving normal terminal input
untouched.

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
│  │  NORMAL  │──Ctrl+B──►┌──────────┐
│  │          │            │ PREFIX   │
│  │          │◄──timeout──│ (1.5s)   │
│  │          │◄──action───│          │
│  │          │            └──────────┘
│  │          │                │
│  │          │──:──────────►┌──────────┐
│  │          │              │ PALETTE  │
│  │          │◄──Esc/Enter──│          │
│  └──────────┘              └──────────┘
│                              │
│  Direct keys (NORMAL mode):  │
│  → / ← / Space / etc.       │
│  Always handled, no prefix   │
└──────────────────────────────┘
    │
    ▼
CommandSystem.execute(commandName)
    │
    ▼
CustomEvent dispatched
```

## Key Bindings

### Direct Navigation Keys (no prefix, always active in NORMAL mode)

These work identically to v1 — no prefix, no modifier, instant response:

| Key | Action | Event |
|-----|--------|-------|
| `→` / `Space` / `PageDown` | Next partial or slide | `geek:navigate` |
| `←` / `PageUp` | Previous partial or slide | `geek:navigate` |
| `Home` | Go to first slide | `geek:navigate` |
| `End` | Go to last slide | `geek:navigate` |
| `Escape` | Exit current mode / close palette | context-dependent |
| `:` | Open command palette | (internal) |

> **Rationale**: Navigation is the most frequent presenter action. Requiring a prefix
> would add latency and cognitive load during a live talk. Direct keys give tactile confidence.

### Prefix Keys (Ctrl+B → key) — Non-Navigation Commands

Everything that is *not* slide navigation lives behind the prefix. This mirrors tmux:
`Ctrl+B` enters prefix mode, then the follow-up key selects the action.

| Sequence | Action | Event |
|----------|--------|-------|
| `Ctrl+B` → `s` | Toggle speaker mode | `geek:mode` |
| `Ctrl+B` → `o` | Toggle overview mode | `geek:mode` |
| `Ctrl+B` → `w` | Toggle whiteboard | `geek:whiteboard:toggle` |
| `Ctrl+B` → `c` | Clear whiteboard | `geek:whiteboard:clear` |
| `Ctrl+B` → `f` | Toggle fullscreen | (native) |
| `Ctrl+B` → `y` | Toggle Yjs sync | `geek:sync:toggle` |
| `Ctrl+B` → `p` | Toggle follow presenter | `geek:sync:follow` |
| `Ctrl+B` → `t` | Toggle toolbar | `geek:toolbar:toggle` |
| `Ctrl+B` → `g` | Go to slide (prompts number) | `geek:navigate` |
| `Ctrl+B` → `?` | Show key bindings help | `geek:help:show` |

### Command Palette Commands

The palette shows all registered commands. Fuzzy search filters as you type:

```
: toggle speaker mode
: toggle whiteboard
: go to slide 15
: clear whiteboard
: toggle sync
: export pdf
: toggle overview
: ...
```

## Implementation

### CommandSystem

`CommandSystem` (in `packages/engine/src/input/CommandSystem.ts`) maintains a private `Map<string, Command>` where each `Command` has a `name` (unique identifier like `'toggle-speaker'`), a `label` (display text like `'Toggle Speaker Mode'`), an `execute()` function, and an optional `category` for grouping in the palette.

- **`register(command)`**: Adds a command to the map, keyed by name.
- **`execute(name)`**: Looks up the command and calls its `execute()`. Logs a warning if the command doesn't exist.
- **`search(query)`**: Filters all commands where the label or name includes the query string (case-insensitive). Used by the command palette for fuzzy filtering.
- **`all()`**: Returns all registered commands as an array.

### KeyBindings (State Machine)

`KeyBindings` (in `packages/engine/src/input/KeyBindings.ts`) implements the three-mode state machine described above.

**State**: A private `#mode` field tracks the current input mode (`'normal'`, `'prefix'`, or `'palette'`). A `#prefixTimeout` handle manages the 1.5 s auto-cancel.

**Binding maps**: Two private `Map<string, string>` instances:
- `#directBindings` maps key names to command names: `ArrowRight` → `next`, `ArrowLeft` → `prev`, `Space` → `next`, `PageDown` → `next`, `PageUp` → `prev`, `Home` → `go-first`, `End` → `go-last`.
- `#prefixBindings` maps follow-up keys to command names: `s` → `toggle-speaker`, `o` → `toggle-overview`, `w` → `toggle-whiteboard`, `c` → `clear-whiteboard`, `f` → `toggle-fullscreen`, `y` → `toggle-sync`, `p` → `toggle-follow`, `t` → `toggle-toolbar`, `g` → `go-to-slide`, `?` → `show-help`.

**Key handling**: A single `keydown` listener on the document dispatches to mode-specific handlers. It ignores events when the target is an `<input>` or `<textarea>` (to avoid intercepting palette typing).

- **Normal mode**: `Ctrl+B` transitions to prefix mode (starts the 1.5 s timeout, shows a visual indicator via `geek:prefix:active` event). `:` transitions to palette mode (opens the command palette). Any key in the direct bindings map executes immediately via `CommandSystem`.

- **Prefix mode**: The follow-up key is looked up in `#prefixBindings`. If found, the command executes. Regardless, the timeout is cleared, the prefix indicator is hidden (via `geek:prefix:inactive` event), and mode returns to normal.

- **Palette mode**: The palette component handles its own keyboard navigation. Only `Escape` is intercepted to close the palette and return to normal mode.

### TouchInput (Smartphone/Tablet)

Audience members following on a smartphone need gesture-based navigation.
The `TouchInput` class maps touch gestures to commands, designed for one-handed phone use:

| Gesture | Action | Threshold |
|---------|--------|-----------|
| Swipe left | Next slide | > 50 px horizontal |
| Swipe right | Previous slide | > 50 px horizontal |
| Tap right 2/3 | Next slide | x > 33% viewport width |
| Tap left 1/3 | Previous slide | x < 33% viewport width |
| Long press (500 ms) | Open toolbar | any position |
| Swipe up | Toggle overview | > 80 px vertical |

Tap zones are critical for smartphone where swipes can conflict with browser
back/forward gestures. The right-2/3 → next / left-1/3 → prev split gives
the dominant action (next) a larger tap target.

`TouchInput` (in `packages/engine/src/input/TouchInput.ts`) receives a `CommandSystem` and an `HTMLElement` to attach listeners to. It tracks `touchstart`, `touchmove`, and `touchend` events (all passive).

**State**: Records the start position (`#startX`, `#startY`), start time, and manages a long-press timer.

**Touch start**: Records coordinates and timestamp. Starts a 500 ms long-press timer that executes `toggle-toolbar` if the finger stays still.

**Touch move**: If the finger moves more than 10 px from the start position, the long-press timer is cancelled.

**Touch end**: Calculates the horizontal (`dx`) and vertical (`dy`) deltas:
- **Horizontal swipe** (|dx| > 50 px and |dx| > |dy|): swipe right → `prev`, swipe left → `next`.
- **Vertical swipe up** (|dy| > 80 px, dy negative, |dy| > |dx|): executes `toggle-overview`.
- **Tap** (no significant movement, elapsed < 300 ms): divides the viewport into zones — tap in the left 1/3 → `prev`, tap in the right 2/3 → `next`.
    
## Default Command Registry

The `registerDefaultCommands` function (in `packages/engine/src/input/default-commands.ts`) takes a `CommandSystem`, `GeekSlideshow`, and `SyncManager` and registers all built-in commands:

**Navigation commands**: `next` (calls `slideshow.next()`), `prev` (calls `slideshow.prev()`), `go-first` (goes to slide 0), `go-last` (goes to last slide), `go-to-slide` (prompts for a number, then navigates).

**Mode commands**: `toggle-speaker` (toggles between `'speaker'` and `'present'` mode), `toggle-overview` (toggles between `'overview'` and `'present'` mode).

**Whiteboard commands**: `toggle-whiteboard` (dispatches `geek:whiteboard:toggle`), `clear-whiteboard` (dispatches `geek:whiteboard:clear`).

**View commands**: `toggle-fullscreen` (uses the Fullscreen API), `toggle-toolbar` (dispatches `geek:toolbar:toggle`).

**Sync commands**: `toggle-sync` (calls `syncManager.toggleFollow()`).

**Help**: `show-help` (dispatches `geek:help:show`).

## v1 → v2 Key Migration

| v1 Key | v1 Action | v2 Equivalent |
|--------|-----------|---------------|
| `ArrowRight` | Next slide | `→` (direct, same) |
| `ArrowLeft` | Previous slide | `←` (direct, same) |
| `s` | Speaker mode | `Ctrl+B` → `s` |
| `o` | Overview | `Ctrl+B` → `o` |
| `b` | Black screen | Removed (use `:` → "black screen") |
| `f` | Fullscreen | `Ctrl+B` → `f` |
| Various touch gestures | Inconsistent | Unified swipe left/right |
