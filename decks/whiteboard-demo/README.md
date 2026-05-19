[](#whiteboard-intro,.layout-title)
# Whiteboard Plugin
## Draw, annotate, and explain — live on any slide

::: Notes
The whiteboard plugin adds a freehand drawing overlay to any GeekSlides presentation.
It works on all slides simultaneously, supports multiple tools, and syncs drawings
in real-time to all connected viewers via Yjs CRDTs.
:::

---

[](#how-to-draw)
## Drawing on Slides

Just **drag** anywhere on the slide to start drawing.

The whiteboard activates automatically and follows your pointer. No setup needed — the overlay appears on first stroke and disappears when you toggle it off.

> Works with mouse, trackpad, or touch/stylus on tablets.

::: Notes
Drawing activates with a simple drag gesture — no mode switch or button press needed.
The overlay appears on first stroke and captures pointer events. It works with all
input methods: mouse, trackpad, and pressure-sensitive stylus on tablets.
:::

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

::: Notes
Three drawing tools are available: Pen for solid strokes (diagrams, writing),
Highlighter for semi-transparent emphasis marks, and Eraser for removing individual
strokes by touching them. Tools can be switched via the floating toolbar or terminal commands.
:::

---

[](#colors)
## Colour Palette

Pick a colour from the toolbar palette or set any hex colour via the terminal:

```
wb-color #ff0000
```

The toolbar shows a selection of preset colours. Your chosen colour applies to both pen and highlighter strokes.

::: Notes
Colours can be selected from the toolbar palette or set to any hex value via the
terminal command `wb-color #rrggbb`. The chosen colour applies to both pen and
highlighter strokes. The toolbar remembers your last selection.
:::

---

[](#per-slide)
## Per-Slide Strokes

Each slide has its own independent canvas:

- Draw on slide 1 → only visible on slide 1
- Navigate to slide 2 → clean canvas
- Return to slide 1 → your strokes are still there

Use `whiteboard-clear` to erase all strokes on the current slide.

::: Notes
Strokes are stored per-slide in the Yjs document. Each slide maintains its own
independent canvas — navigating away and back preserves all drawings. The
`whiteboard-clear` command erases only the current slide's strokes.
:::

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

::: Notes
All whiteboard functions are accessible as terminal commands, enabling keyboard-only
control. This is especially useful when presenting with a stylus in one hand —
you can switch tools, change colours, or clear strokes without reaching for the toolbar.
:::

---

[](#sync)
## Real-time Sync

When connected to a sync server, **strokes are broadcast** to all viewers via Yjs CRDTs:

- Presenter draws → viewers see strokes appear in real time
- Late-joining viewers receive all existing strokes immediately
- Viewers are **read-only** — they can see but not draw

This makes the whiteboard perfect for live explanations and remote teaching.

::: Notes
When connected to a sync server, whiteboard strokes are broadcast to all viewers
via Yjs CRDTs. The presenter draws, viewers see strokes appear in real-time.
Late-joining viewers receive the full stroke history immediately. Viewers are
read-only — they cannot draw, only observe.
:::

---

[](#try-it,.layout-title)
# Try It Now!
## Drag anywhere on this slide to start drawing

::: Notes
This is an interactive slide — try drawing on it! The whiteboard activates
immediately on first drag. Use this to practice with the pen, highlighter,
and eraser tools before using them in a real presentation.
:::

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

::: Notes
Enabling the whiteboard requires only adding `"whiteboard"` to the plugins array
in config.json. No preprocessors or processors are needed — the feature registers
automatically and works on every slide in the deck.
:::
