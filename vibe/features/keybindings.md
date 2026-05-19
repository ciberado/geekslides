# Custom Keybindings Architecture

## Overview

The custom keybindings system allows users to bind keyboard keys or combinations to any registered command. Bindings are per-user (stored in `localStorage`), portable across decks, and support cycling multiple commands on one key.

## Components

### UserKeyBindings (`packages/engine/src/input/UserKeyBindings.ts`)

Core manager for user-configured key bindings.

**Responsibilities:**
- Load/save configuration from `localStorage` (`geekslides:keybindings`)
- Normalize keyboard events into canonical key descriptors (`Ctrl+Alt+Shift+Meta+Key`)
- Execute bound commands with cycling support
- Filter bindings to only currently-registered commands (inactive plugin protection)
- Export/import configuration as JSON

**Cycling Logic:**
- Per-key cursor tracked in a Map
- Each press advances the cursor mod available commands (wraps automatically)
- No timeout — commands fire instantly, cycling proceeds on every press

### KeybindingNotification (`packages/engine/src/input/KeybindingNotification.ts`)

Subtle top-right toast notification shown for 2.5 seconds when a keybinding fires.

### ShortcutsPanel (`packages/engine/src/input/ShortcutsPanel.ts`)

Interactive overlay panel (replaces the old static help overlay).

**Sections:**
1. **Navigation** — Read-only display of hardcoded arrow/space/escape bindings
2. **Custom Bindings** — Editable list of all bindable commands with key-capture UI
3. **Actions** — Export/Import buttons

**Key Capture Flow:**
1. User clicks a key slot → enters capture mode (pulsing animation)
2. Next keydown is captured and normalized
3. Previous binding for that command is removed
4. New binding is created and saved
5. Panel re-renders

### KeyBindings Integration (`packages/engine/src/input/KeyBindings.ts`)

The existing `KeyBindings` class was extended with:
- `setUserBindings()` — connects the `UserKeyBindings` manager
- `setNotification()` — connects the notification component
- After checking direct (reserved) navigation bindings, user bindings are checked
- On successful user binding execution, the notification is triggered

## Key Design Decisions

### Reserved Keys
Arrow keys, Space, Home, End, Escape, and `?` cannot be rebound. They always perform their built-in navigation functions.

### Plugin Awareness
- Bindings for commands from unloaded plugins are **stored but inactive**
- At execution time, `UserKeyBindings` checks `CommandSystem.has()` before firing
- The shortcuts panel only shows currently-registered commands
- This makes the configuration portable across decks with different plugin sets

### Command Filtering
Commands with `hasArgs: true` (like `load`, `room`, `go`, `theme`) are excluded from the binding UI since they require parameters that can't be provided via a keypress.

### Modifier Order
Key descriptors always use normalized modifier order: `Ctrl > Alt > Shift > Meta`. This prevents "Ctrl+Shift+K" and "Shift+Ctrl+K" from being treated as different keys.

## localStorage Schema

```json
{
  "geekslides:keybindings": {
    "Ctrl+S": ["sync-toggle"],
    "W": ["whiteboard"],
    "F": ["fullscreen", "overview"]
  }
}
```

## Terminal Commands

| Command | Description |
|---|---|
| `bind <key> <cmd> [cmd2...]` | Add commands to a key's cycle list |
| `unbind <key> [cmd]` | Remove one or all commands from a key |
| `export-bindings` | Print bindings as JSON |
| `import-bindings <json>` | Replace bindings from JSON |

## Event Flow

```
KeyboardEvent
  → KeyBindings.#handleKeydown
    → Check reserved (Escape, ?, arrows...)
    → UserKeyBindings.execute(event)
      → normalizeKeyDescriptor(event) → "Ctrl+W"
      → Look up config["Ctrl+W"] → ["whiteboard"]
      → Filter to registered commands
      → Advance cycle cursor
      → CommandSystem.execute("whiteboard")
      → Return "whiteboard"
    → KeybindingNotification.show("Toggle whiteboard", "Ctrl+W")
```
