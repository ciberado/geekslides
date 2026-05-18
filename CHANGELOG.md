# Changelog

All notable changes to GeekSlides are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Rich media embeds** — YouTube, audio, video, and iframe embeds via image-link markdown syntax (`![alt](url)`)
  - `youtube-url` plugin: detects YouTube / youtu.be URLs → `<geek-youtube>` web component with IFrame API
  - `audio-url` plugin: detects audio extensions (`.mp3 .wav .ogg .flac .aac .m4a .opus .weba`) → `<geek-audio>` with waveform visualiser (Web Audio API or CSS-bars fallback)
  - `video-url` plugin: detects video extensions (`.mp4 .webm .ogv .mov`) → `<geek-video>`
  - `iframe-url` plugin: detects `.html`/`.htm` URLs → lazy-loaded `<iframe data-src>` with click-to-activate overlay
- **`mod-media-cover` modifier** — add to a slide marker to fill the slide with any media element; implemented via CSS injection (no JS class detection needed)
- **Media sync feature** (`media-sync`) — presenter play/pause/seek is propagated to viewers via Yjs `mediaState` map; drift-corrected via wall-clock timestamp
- **Autoplay banner** — when viewer's browser blocks autoplay, a clickable banner appears; resolves on user click and retries media playback
- **Nav arrow buttons** — subtle ‹ › buttons injected by `media-sync` feature allow slide navigation when iframes or YouTube embeds have keyboard focus
- **Terminal commands** — `media-play`, `media-pause`, `media-seek <seconds>` control media on the current slide from the terminal
- **`decks/media-demo/`** — demo deck exercising all media types with local Firefox-compatible assets

### Fixed

- **`layouts.css` media section** — missing `*/` comment terminator caused all media CSS rules to be treated as a comment and never applied
- **Missing deck CSS directory** — `decks/media-demo/css/` was absent so `layouts.css` and `theme-default.css` were not loaded; deck now includes both files

<!-- Add new entries above this line -->


Complete rewrite of GeekSlides as a modern TypeScript monorepo.

### Added

- **TypeScript 5.7 monorepo** — strict mode with ESM-only packages (`@geekslides/engine`, `@geekslides/server`, `@geekslides/cli`, `@geekslides/hub`, `@geekslides/vscode`)
- **Web Components** — Shadow DOM custom elements: `<geek-slideshow>`, `<geek-slide>`, `<geek-terminal>`, `<geek-whiteboard>`, `<geek-speaker-view>`
- **Real-time sync** — Yjs CRDT-based room sync over y-websocket; multiple viewers stay in lockstep
- **Speaker view** — Dual-screen presenter mode with notes, slide preview, and timer
- **Plugin system** — Preprocessors (string → string) and processors (HTMLElement → void) registered per deck
- **Command system** — NORMAL mode hotkeys and TERMINAL mode prompt; commands registered via `commands.register()`
- **PDF export** — Playwright-based print-to-PDF with flat HTML rendering (no Shadow DOM)
- **Image optimisation** — `sharp`-powered image processing in the CLI
- **CSS-doodle backgrounds** — 22+ generative art patterns, animated and configurable per slide
- **Whiteboard** — In-slide freehand drawing canvas
- **Hub package** — Multi-user authentication gateway with Fastify backend and Lit SPA
- **VSCode extension** — Slide class autocomplete, layout modifier nesting, CSS-driven documentation
- **Custom web components** — Load ES module scripts per deck via `config.scripts`; engine utilities exposed on `window.__geekslides`
- **Multiple themes** — Default, Aurora, Solarized, Ocean, Forest, Sunset, Nordic, Crimson, Monochrome, Candy, Volcano
- **Layout modifiers** — `mod-*` modifier classes (`mod-coverbg`, `mod-heading-center`, `mod-partial`, `mod-cols-2`, `mod-cols-4`) and `layout-*` classes
- **Content proxy API** — Server-side asset proxying for remote decks
- **Docker support** — Multi-stage Dockerfiles for main app, server, CLI (slim + Chromium), and Hub; Caddy reverse proxy
- **Mermaid diagrams** — First-class diagram rendering via plugin
- **Tailscale deployment** — Guide and support for private network deploys

### Changed

- Full rewrite from the original JavaScript/HTML prototype to TypeScript
- Markdown parsing upgraded to use remark/rehype pipeline
- Slide markers changed to empty link syntax: `[](#id)` and `[](.class#id,...)`
- Speaker notes use `::: Notes` container blocks

---

## [Unreleased]

### Added

- **Dev container Tailscale integration** — `postStartCommand` starts `tailscaled`, calls `tailscale up` with `--ssh`, `tag:vscode`, and `hostname=vs-${PROJECT_NAME}`; auth key and project name injected from host env via `remoteEnv`
- `.devcontainer/README.md` — documents devcontainer CLI usage, Tailscale key setup, and SSH connection instructions
- `decks/welcome-deck/` — default deck shown by the Docker container when no `CONTENT_DIR` is mounted (moved from `docker/welcome-deck/`)

### Changed

- Welcome deck moved from `docker/welcome-deck/` to `decks/welcome-deck/` — all decks now live under `decks/`

### Removed

- `decks/slides-cuatro-cosas-aws` — external project deck, no longer tracked in this repository

---

<!-- Add new entries above this line in the format: ## [X.Y.Z] - YYYY-MM-DD -->
