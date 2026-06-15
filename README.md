# GeekSlides

**Markdown-first presentation software for technical talks.**

Write your slides in plain Markdown, present live with real-time audience sync, and export to PDF — all from a single tool.

---

## Why GeekSlides?

| What you get | How it helps |
|---|---|
| **Write in Markdown** | Your slides live as plain text in git. No binary files, no vendor lock-in. |
| **Audience sync** | Viewers open the same URL on any device and follow the presenter automatically. |
| **Speaker view** | See your notes, a live timer, and the next slide — in a dedicated tab. |
| **Live PDF export** | Generate slides, speaker-notes handouts, detail sheets, and book layouts with one command. |
| **Interactive plugins** | Mermaid diagrams, Chart.js charts, live audience polls, drawing whiteboard, CSS-doodle backgrounds. |
| **Mobile-friendly** | Audience members can follow on their phone with swipe navigation. |
| **Hub** | A team sharing platform to publish, search, and launch decks via a browser dashboard. |
| **VS Code extension** | Author slides in VS Code and watch the browser follow your cursor in real time. |

---

## Quick Start

**Requirements:** Node.js 22+, npm 10+, Git

```bash
git clone https://github.com/ciberado/geekslides.git
cd geekslides
npm ci
npm run dev
```

Open **http://localhost:5173** — you'll see the welcome deck.

- Press `Escape` to open the command terminal.
- Type `help` and press `Enter` to explore available commands.
- Open a second tab at **http://localhost:5173/?view=speaker** for the speaker view.

> Prefer Docker? See [Use the Docker CLI](how-to/10-use-the-docker-cli.md).

---

## Creating Your First Deck

Scaffold a new presentation:

```bash
npx geekslides create my-talk
cd my-talk
npx geekslides dev --config config.json
```

Your deck is a folder with two files:

- **`README.md`** — slides written in Markdown
- **`config.json`** — title, styles, and optional plugins

Slides are separated by empty anchor links. Add speaker notes with `::: Notes` blocks:

```markdown
[](#intro)

# Introduction

Welcome to my talk!

::: Notes
Remind the audience who you are.
:::

[](#agenda)

## Agenda

- Topic one
- Topic two
- Topic three
```

---

## Presenting

### Navigation

| Key | Action |
|---|---|
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| `Home` / `End` | First / last slide |
| `Escape` | Open / close the command terminal |
| `?` | Keyboard shortcuts overlay |

### Command Terminal

Press `Escape` to open the terminal, type a command and press `Enter`:

| Command | What it does |
|---|---|
| `help` | Show all available commands |
| `go <n>` | Jump to slide N |
| `room <name>` | Join a named sync room |
| `load <url>` | Load a different deck by URL |
| `speaker` | Open the speaker view |
| `overview` | Slide grid overview |
| `fullscreen` | Toggle fullscreen |
| `whiteboard` | Toggle drawing overlay |
| `share-qr` | Display a QR code for your audience to scan |

### Speaker View

Open `?view=speaker` in a second tab for the presenter panel:

- Speaker notes with independent scrolling
- Current and next slide previews
- Live timer
- Resizable panes

### Mobile

Audience members on phones can follow along:

- **Swipe left/right** — navigate slides
- **Tap right/left edge** — next/previous
- Auto-sync with presenter when in a room

---

## Real-Time Sync

Everyone in the same **room** follows the presenter:

```
# Presenter opens:
http://localhost:5173/?room=my-talk

# Audience opens the same URL and follows automatically
```

Or switch rooms at any time from the terminal:

```
room my-talk
```

Share a protected link where viewers cannot control the deck:

```
share <room-name>
```

---

## PDF Export

Export your deck in multiple formats:

```bash
npx geekslides pdf --config config.json --format slides
```

| Format | Description |
|---|---|
| `slides` | One slide per page |
| `slides-notes` | Slides with speaker notes below |
| `slides-details` | Slides with detail blocks |
| `book` | Compact document layout |
| `--all` | All formats in one pass |

Install the headless browser once if you haven't:

```bash
npx playwright install chromium
```

---

## Plugins

Enable plugins in `config.json`:

```json
{
  "plugins": ["media", "mermaid", "chart", "whiteboard", "poll"]
}
```

| Plugin | What it adds |
|---|---|
| `core` | Heading separators, iframe embeds |
| `media` | YouTube, audio, video with playback sync |
| `mermaid` | Flowcharts and sequence diagrams |
| `chart` | Chart.js data visualizations |
| `whiteboard` | Live drawing overlay |
| `css-doodle` | Generative animated backgrounds |
| `poll` | Real-time audience polling |

See [plugins/README.md](plugins/README.md) for full details and [how-to guides](how-to/README.md) for step-by-step examples.

---

## Partial Reveals

Reveal list items or table rows one at a time:

```markdown
[](.mod-partial#agenda)

## Agenda

- First point  ← appears first
- Second point
- Third point
```

---

## Deployment

Run everything with Docker — Caddy, the sync server, and the app in a single container:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Set `CONTENT_DIR` to the path of your deck, or use the Hub to manage multiple decks.

See [Deploy the Server](how-to/05-deploy-the-server.md) for the full guide.

---

## The Hub

The Hub is a team platform for managing and sharing presentations:

- Upload decks via browser or import from GitHub
- Share with teammates and control access
- Launch any deck into a live room in one click
- Full-text search across your presentation library

```bash
npm run dev --workspace=@geekslides/hub
```

Open **http://localhost:3001/hub/** — three built-in personas let you explore without OAuth.

See [Use the Hub](how-to/15-use-the-hub.md) for the full guide.

---

## VS Code Extension

The `@geekslides/vscode` extension connects your editor to the browser:

- Start/stop the dev server from the Command Palette
- Create new decks without leaving VS Code
- **Cursor sync** — move your cursor in the editor and the browser jumps to the same slide

See [Use the VS Code Extension](how-to/18-use-the-vscode-extension.md).

---

## Documentation

### How-To Guides

Step-by-step tutorials for every feature → **[how-to/README.md](how-to/README.md)**

| Guide | Topic |
|---|---|
| [01 — Install the CLI](how-to/01-install-the-cli.md) | Get up and running |
| [02 — Create Your First Deck](how-to/02-create-your-first-deck.md) | Scaffold and author |
| [04 — Present Like a Pro](how-to/04-present-like-a-pro.md) | Navigation, sync, speaker view |
| [05 — Deploy the Server](how-to/05-deploy-the-server.md) | Docker and production |
| [06 — Export to PDF](how-to/06-export-to-pdf.md) | Slides, notes, book |
| [15 — Use the Hub](how-to/15-use-the-hub.md) | Team sharing platform |
| [18 — VS Code Extension](how-to/18-use-the-vscode-extension.md) | Authoring in VS Code |

### Technical Docs

Architecture and design decisions → **[vibe/features/](vibe/features/)**

| Doc | Topic |
|---|---|
| [architecture-v2.md](vibe/features/architecture-v2.md) | System overview |
| [decisions.md](vibe/features/decisions.md) | Architectural decision record |
| [plugin-system.md](vibe/features/plugin-system.md) | Plugin API |
| [sync.md](vibe/features/sync.md) | Yjs real-time sync |
| [plan/README.md](vibe/features/plan/README.md) | Implementation phases |

---

## Acknowledgements

PPTX import is powered by an internal fork of [pptx2html](https://github.com/meshesha/pptx2html) (MIT licence), located at `packages/hub/src/server/services/pptx/`. The fork adds D3-based server-side chart rendering, jQuery-free operation, background-colour bug fixes, and Node.js compatibility patches.

## License

See [LICENCE.txt](LICENCE.txt).

