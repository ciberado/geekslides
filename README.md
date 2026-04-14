# GeekSlides

GeekSlides is a markdown-first presentation system focused on technical talks and learning sessions.

The current v2 is a TypeScript rewrite with Web Components, real-time synchronization, speaker view, mobile support, and a terminal-style command workflow.

## Quick Experience (Recommended)

If you want to learn fast, start with the "cuatro cosicas" deck (folder name: slides-cuatro-cosas-aws).

1. Install and run:

```bash
npm ci
npm run dev
```

2. Open the presentation:

- http://localhost:5173/

3. Open speaker mode in another tab:

- http://localhost:5173/?view=speaker

4. Try synchronized viewing with a room:

- http://localhost:5173/?config=decks/slides-cuatro-cosas-aws/config.json&room=my-talk

`npm run dev` binds to `0.0.0.0`, starts Vite, and starts the sync server.

## Supported Features

- Markdown slide parsing with slide markers and slide attributes
- Web Components rendering (`geek-slideshow`, `geek-slide`)
- Partial reveals and slide navigation
- Room-based sync (Yjs + y-websocket)
- Speaker view in separate tab/window
- Resizable speaker panes and notes font controls
- Terminal command mode (press `t`)
- Touch and mobile gestures
- Rich processors/components: iframe, chart, video, whiteboard
- CSS/asset loading from deck config
- HMR live preview for markdown, deck config, and author CSS in dev workflow
- Print rendering primitives for slide export modes
- Automated testing with Vitest and Playwright

## Live Preview

When running `npm run dev`, GeekSlides now hot-reloads the active deck without a full page refresh for the common authoring loop.

- Editing a deck `README.md` updates slide content in place.
- Current slide position is preserved after markdown reloads.
- Editing `config.json` applies non-structural changes such as title and styles without a reload.
- Editing deck CSS files listed in `styles` hot-applies the updated author styles.

Structural config changes such as plugin, sync, or content-path changes still fall back to a full reload.

## How Deck Loading Works

By default the app loads `decks/slides-cuatro-cosas-aws/config.json`.

You can choose a deck in two ways.

### 1) URL Parameters (initial load)

- `config=<path>`: choose deck config file
- `view=speaker`: open speaker view
- `room=<name>`: join a sync room

Example:

- http://localhost:5173/?config=decks/slides-cuatro-cosas-aws/config.json&room=my-talk

### 2) Terminal Commands (runtime switch)

Press `t` during presentation and use commands like:

- `load decks/slides-cuatro-cosas-aws/config.json`
- `room my-talk`

This lets you switch deck and room without retyping URLs.

## Controls

### Direct Navigation Keys

No prefix required:

- ArrowRight, ArrowDown, Space, PageDown: next
- ArrowLeft, ArrowUp, PageUp: previous
- Home: first slide
- End: last slide

### Terminal Mode

Press `t` to open the terminal.

- Enter: execute command
- Tab: autocomplete command name
- ArrowUp/ArrowDown: command history
- Escape: close terminal
- `help`: list available commands

### Speaker View

Open `?view=speaker` in a second tab/window to get presenter controls and notes.

- Notes are shown in a left pane with independent scrolling.
- Current and next slides are stacked on the right.
- Drag the separators to resize the notes pane or rebalance current/next preview height.
- Use the `A-` and `A+` buttons in the notes header to decrease or increase notes font size.
- Current-slide partials stay visible in the preview: revealed items use normal slide styling, and unrevealed items stay visible but lighter.

## Terminal Commands

Built-in:

- `help`: show command list

Navigation:

- `next`
- `prev`
- `go-first`
- `go-last`
- `go <n>`

Config and sync:

- `load <config-url>`
- `room <room-name>`
- `sync-follow` (when sync is enabled)
- `sync-disconnect` (when sync is enabled)

View and tools:

- `speaker`
- `overview`
- `fullscreen`
- `whiteboard`

## Mobile Experience

- Swipe left/right: navigate
- Tap right side: next
- Tap left side: previous
- Long press: open terminal

## Authoring Basics

Slides are written in markdown and separated with empty-link markers.

```markdown
[](#cover)

# Title Slide

[](#agenda)

## Agenda

- Item 1
- Item 2

::: Notes
Speaker notes for this slide.
:::

::: Detail
Detail text for book mode; hidden in normal presentation view.
:::
```

### Partial Reveals

GeekSlides v2 supports two ways to author partials:

- Inline markers with `[partial]`
- Slide-level `.partial` class on the separator, which turns list items and table rows into progressive reveals

Example:

```markdown
[](.partial#agenda)

## Agenda

- First point
- Second point
- Third point
```

## Development Commands

```bash
npm run dev
npm run dev:nosync
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

## Documentation Map

- [vibe/features/architecture-v2.md](vibe/features/architecture-v2.md)
- [vibe/features/decisions.md](vibe/features/decisions.md)
- [vibe/features/command-system.md](vibe/features/command-system.md)
- [vibe/features/sync.md](vibe/features/sync.md)
- [vibe/features/plan/README.md](vibe/features/plan/README.md)

## Legacy v1

- Archived under [archived/v1/](archived/v1/)

## License

See [LICENCE.txt](LICENCE.txt).

