# GeekSlides

Markdown-first presentation system for technical talks, rewritten in TypeScript with Web Components, Yjs synchronization, and Playwright-tested workflows.

## What Is Implemented

v2 currently includes:

- Web Components slideshow engine (`geek-slideshow`, `geek-slide`)
- Real-time sync by room using Yjs + y-websocket
- Speaker view in a separate tab (`?view=speaker`)
- Terminal-style command mode (press `t`)
- Rich slide components (chart, video, whiteboard)
- HMR flow for local authoring
- Print rendering pipeline for slides/slides+notes/book
- Unit/integration tests (Vitest) and E2E tests (Playwright)

## Quick Start

```bash
git clone https://github.com/ciberado/geekslides
cd geekslides
npm ci
npm run dev
```

Open:

- `http://localhost:5173/` presentation view
- `http://localhost:5173/?view=speaker` speaker view

`npm run dev` binds to `0.0.0.0`, starts Vite, and starts the sync server.

## Loading & Managing Decks

By default, root `config.json` is loaded.

### URL Parameters (for initial load)

- `?config=<path>` — Load a specific deck config: `?config=decks/slides-cuatro-cosas-aws/config.json`
- `?view=speaker` — Start in speaker notes view instead of presentation

### Terminal Commands (change at runtime)

Press `t` during the presentation to enter terminal mode. Commands include:

- `help` — List all available commands
- `load <config-url>` — Load a different deck, e.g. `load decks/slides-cuatro-cosas-aws/config.json`
- `room <room-name>` — Switch to a different sync room, e.g. `room my-talk`
- `speaker` — Open speaker notes in a new tab
- `goto <n>` — Jump to slide N

### Room Sync

Presentations in the same room sync in real-time. Open multiple browser tabs with the same `?room=` to see sync in action:

- URL: `http://localhost:5173/?config=decks/slides-cuatro-cosas-aws/config.json&room=my-talk`
- Terminal: press `t`, type `room my-talk`, press Enter

Decks can also specify a default room in their `config.json` via `"sync": { "room": "name" }`.

## Slide Authoring Format

Slides are authored in markdown and split with empty-link markers:

```markdown
[](#cover)

# Title

[](#agenda)

## Agenda

- Item 1
- Item 2

::: Notes
Speaker notes for this slide.
:::

::: Detail
Book-only detail content (hidden during presentation).
:::
```

## Controls

### Navigation (Direct Keys, Always Available)

No modifiers needed — direct keystrokes advance slides, even if you accidentally open the terminal:

- Arrow keys, Space, PageUp/PageDown, Home/End

### Advanced Features (Terminal Mode)

Press `t` to open the terminal command prompt:

- **Terminal input prompt**: appears at the bottom, monospace `> ` prefix
- **Type a command**: e.g. `load decks/slides-cuatro-cosas-aws/config.json`
- **Tab completion**: pressing Tab auto-completes the command
- **Up/Down arrows**: navigate command history
- **Help**: type `help` to list all commands
- **Escape**: close the terminal without executing

### Common Commands

- `speaker` — Open speaker notes in separate tab
- `goto 12` — Jump to slide 12
- `room my-talk` — Switch to a different presentation room
- `load decks/demo/config.json` — Load a different deck
- `whiteboard` — Toggle whiteboard overlay
- `sync-follow` — Toggle following presenter changes
- `fullscreen` — Toggle fullscreen mode

### Mobile

- **Swipe left/right** — navigate slides
- **Long press (500ms)** — open terminal
- **Tap right 2/3 of screen** — next slide
- **Tap left 1/3 of screen** — previous slide

## Development Commands

```bash
npm run dev         # vite + sync server
npm run dev:nosync  # vite only
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

## Deployment

v2 deployment files are under `docker/` and documented in:

- [vibe/features/deployment-v2.md](vibe/features/deployment-v2.md)

## Documentation

Detailed v2 architecture and implementation docs:

- [vibe/features/architecture-v2.md](vibe/features/architecture-v2.md)
- [vibe/features/decisions.md](vibe/features/decisions.md)
- [vibe/features/command-system.md](vibe/features/command-system.md)
- [vibe/features/sync.md](vibe/features/sync.md)
- [vibe/features/plan/README.md](vibe/features/plan/README.md)

## v1 (Legacy)

v1 docs live in [vibe/v1/](vibe/v1/).

Legacy runtime:

```bash
npm run v1:install
npm run v1:start
```

## License

See [LICENCE.txt](LICENCE.txt).

