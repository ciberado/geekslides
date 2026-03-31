# GeekSlides

A markdown-driven presentation engine built with TypeScript, Web Components, and Yjs real-time sync. Designed for technical presentations with support for charts, video slides, whiteboards, speaker notes, and mobile audiences.

## Quick Start

```bash
git clone https://github.com/ciberado/geekslides
cd geekslides
npm ci
npm run dev
```

Open `http://localhost:5173` in your browser.

## Creating a Presentation

```bash
npx geekslides create --title "My Talk"
cd my-talk
npx geekslides dev
```

This scaffolds a presentation repo with:
- `README.md` — your slides in markdown
- `config.json` — presentation settings
- `css/local.css` — custom styles
- `images/` — assets

Slides are separated by `---`. Use the empty-link syntax for slide attributes:

```markdown
[](#title,bgcolor(#1a1a2e))

## My Talk

---

[](#agenda)

## Agenda

- Topic 1
- Topic 2

::: Notes
Speaker notes go here.
:::
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `geekslides dev` | Start Vite dev server + sync server |
| `geekslides build` | Production static build |
| `geekslides pdf --format slides` | Generate PDF (requires WeasyPrint) |
| `geekslides create --title "..."` | Scaffold new presentation |

## Keyboard Controls

**Navigation** (direct keystrokes):
- Arrow keys, Space, PageUp/Down, Home/End

**Commands** (tmux-style `Ctrl+B` prefix):
- `Ctrl+B, w` — toggle whiteboard
- `Ctrl+B, s` — open speaker view
- `Ctrl+B, u` — unfollow sync
- `Ctrl+B, :` — open command palette

## Docker Deployment

```bash
cd docker
DOMAIN=slides.example.com ACME_EMAIL=you@example.com docker compose up -d
```

## Architecture

See [vibe/features/](vibe/features/) for detailed architecture documentation:
- [Architecture Overview](vibe/features/architecture-v2.md)
- [Web Components](vibe/features/components.md)
- [Plugin System](vibe/features/plugin-system.md)
- [Sync (Yjs)](vibe/features/sync.md)
- [Command System](vibe/features/command-system.md)

## v1 (Legacy)

The original v1 implementation is in `slides/`, `broker/`, and `demo/`. See [vibe/v1/](vibe/v1/) for v1 documentation.

```bash
npm run v1:install
npm run v1:start
```

## License

See [LICENCE.txt](LICENCE.txt).

