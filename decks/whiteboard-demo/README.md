[](#whiteboard-intro,.layout-title)
# Whiteboard Plugin
## Draw, annotate, and explain — live on any slide

---

[](#how-to-draw)
## Drawing on Slides

Just **drag** anywhere on the slide to start drawing.

The whiteboard activates automatically and follows your pointer. No setup needed — the overlay appears on first stroke and disappears when you toggle it off.

> Works with mouse, trackpad, or touch/stylus on tablets.

---

[](#tools)
## Tools

The floating toolbar provides three drawing modes:

| Tool | Behaviour |
|------|-----------|
| ✏️ **Pen** | Solid strokes, ideal for writing and diagrams |
| 🖍️ **Highlighter** | Semi-transparent wide strokes for emphasis |
| 🧽 **Eraser** | Remove individual strokes by touching them |

Switch tools via the toolbar or with terminal commands: `wb-pen`, `wb-highlighter`, `wb-eraser`.

---

[](#colors)
## Colour Palette

Pick a colour from the toolbar palette or set any hex colour via the terminal:

```
wb-color #ff0000
```

The toolbar shows a selection of preset colours. Your chosen colour applies to both pen and highlighter strokes.

---

[](#per-slide)
## Per-Slide Strokes

Each slide has its own independent canvas:

- Draw on slide 1 → only visible on slide 1
- Navigate to slide 2 → clean canvas
- Return to slide 1 → your strokes are still there

Use `whiteboard-clear` to erase all strokes on the current slide.

---

[](#terminal-commands)
## Terminal Commands

Press **Escape** to open the terminal, then type:

| Command | Description |
|---------|-------------|
| `whiteboard` | Toggle the whiteboard on/off |
| `whiteboard-clear` | Erase all strokes on current slide |
| `wb-toolbar` | Show/hide the floating toolbar |
| `wb-pen` | Switch to pen tool |
| `wb-highlighter` | Switch to highlighter tool |
| `wb-eraser` | Switch to eraser tool |
| `wb-color <hex>` | Set drawing colour |
| `wb-show` / `wb-hide` | Show/hide toolbar |

---

[](#sync)
## Real-time Sync

When connected to a sync server, **strokes are broadcast** to all viewers via Yjs CRDTs:

- Presenter draws → viewers see strokes appear in real time
- Late-joining viewers receive all existing strokes immediately
- Viewers are **read-only** — they can see but not draw

This makes the whiteboard perfect for live explanations and remote teaching.

---

[](#try-it,.layout-title)
# Try It Now!
## Drag anywhere on this slide to start drawing

---

[](#config)
## Configuration

Add the whiteboard plugin to your deck's `config.json`:

```json
{ "plugins": ["whiteboard"] }
```

Or combine with other plugins:

```json
{ "plugins": ["media", "whiteboard"] }
```

That's it — no additional preprocessors or processors required. The whiteboard feature registers automatically.
