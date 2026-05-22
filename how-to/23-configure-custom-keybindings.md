# How to Configure Custom Keybindings

Bind keyboard keys or combinations to any command for instant access during presentations.

## Using the Shortcuts Panel

1. Press **`?`** to open the keyboard shortcuts panel.
2. The panel shows all available commands that can be bound (commands requiring parameters like `load` or `room` are excluded).
3. Click the **key slot** (the button showing `—` or the current key) next to a command.
4. The slot enters capture mode — press your desired key or key combination (e.g., `F`, `Ctrl+S`, `Shift+W`).
5. The binding is saved immediately to `localStorage`.

### Removing a Binding

Click the **✕** button next to a bound key to remove it.

### Cycling Multiple Commands on One Key

You can bind multiple commands to the same key. Each press will cycle through them in order. This is perfect for:

- **Toggle sync**: Bind `sync-toggle` to a key to pause/resume following the presenter. When you resume, your current slide position is published to sync — other windows jump to your position.
- **Whiteboard tools**: Cycle through whiteboard modes with one key
- **Show/hide**: Toggle features on and off

To add multiple commands to one key via the terminal:

```
bind S sync-toggle
```

## Using Terminal Commands

Press **`Escape`** to open the terminal, then:

| Command | Description |
|---|---|
| `bind <key> <command> [command2 ...]` | Bind a key to one or more commands |
| `unbind <key> [command]` | Remove all bindings for a key, or a specific command |
| `export-bindings` | Print current bindings as JSON |
| `import-bindings <json>` | Replace bindings from a JSON string |

### Examples

```bash
# Bind Ctrl+W to toggle whiteboard
bind Ctrl+W whiteboard

# Bind F to cycle fullscreen and overview
bind F fullscreen overview

# Remove a binding
unbind Ctrl+W
```

## Export and Import

### From the Panel

Use the **⬇ Export** and **⬆ Import** buttons at the bottom of the shortcuts panel.

- **Export** downloads a `geekslides-keybindings.json` file
- **Import** opens a file picker to load a previously exported JSON file

### From the Terminal

```bash
# View current bindings
export-bindings

# Import from JSON
import-bindings {"Ctrl+W":["whiteboard"],"S":["sync-toggle"]}
```

## How It Works

- Bindings are stored in `localStorage` under `geekslides:keybindings`
- Only commands from **currently loaded plugins** are active — bindings for unloaded plugins are preserved but dormant
- A subtle **notification** appears in the top-right corner for 2.5 seconds when a keybinding fires
- **Reserved keys** cannot be rebound: arrows, Space, Home, End, Escape, `?`
- Key combinations use normalized modifier order: `Ctrl+Alt+Shift+Meta+<key>`

## Configuration Format

The JSON format for export/import:

```json
{
  "Ctrl+W": ["whiteboard"],
  "S": ["sync-toggle"],
  "F": ["fullscreen"]
}
```

Keys are the key descriptors; values are arrays of command names (multiple = cycling).

---

Next: [Import a PowerPoint Presentation →](24-import-powerpoint.md)
