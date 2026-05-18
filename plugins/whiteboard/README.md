# whiteboard

Drawing overlay for live annotation during presentations. Lets presenters sketch over slides with a pen, highlighter, or eraser tool, with real-time sync to all viewers via Yjs.

## What it provides

| Part | Name | Role |
|------|------|------|
| Feature | `whiteboard` | Activates the `<geek-whiteboard>` overlay, toolbar, pointer-drag activation, and Yjs stroke sync |

## Usage

```json
{ "plugins": ["whiteboard"] }
```

Or combined with other plugins:

```json
{ "plugins": ["media", "whiteboard"] }
```

## Activating the whiteboard

**Drag on a slide** — start dragging anywhere on the slide to open the whiteboard and begin drawing immediately.

**Terminal command** — press Escape to open the terminal, then type a command:

| Command | Description |
|---------|-------------|
| `whiteboard` | Toggle the whiteboard overlay on/off |
| `whiteboard-clear` | Erase all strokes on the current slide |
| `wb-toolbar` | Show/hide the floating toolbar |
| `wb-pen` | Switch to the pen tool |
| `wb-highlighter` | Switch to the highlighter tool |
| `wb-eraser` | Switch to the eraser tool |
| `wb-color <hex>` | Set the drawing colour (e.g. `wb-color #ff0000`) |
| `wb-show` / `wb-hide` | Show or hide the toolbar |

## Sync behaviour

When the presentation is connected to a sync server, strokes are broadcast to all viewer sessions via Yjs CRDTs. Late-joining viewers receive all existing strokes immediately on connect.

Viewers receive strokes in read-only mode — they can see drawings but cannot add their own.

## Notes

- The whiteboard is **per-slide**: strokes drawn on slide 3 appear only on slide 3.
- Strokes are cleared with `whiteboard-clear` or the toolbar's clear button; they are **not** persisted between page reloads.
