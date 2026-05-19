# Changelog

All notable changes to GeekSlides are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Speaker notes for all demo decks** — every slide in all `decks/` now has `::: Notes` explaining the feature being demonstrated, useful for learning
- **`source-notes` preprocessor enabled for layouts-showcase** — the speaker view automatically shows each slide's markdown source alongside the explanatory notes, keeping them in sync

<!-- Add new entries above this line -->

## [2.2.0] - 2026-05-19

### Added

- **Whiteboard demo deck** (`decks/whiteboard-demo/`) — showcases the whiteboard plugin with drawing, colour picker, clear, and Yjs sync across presenter and viewers
- **Default room isolation** — the `default` room no longer syncs navigation between users, preventing slide-control conflicts; the `load` command is disabled in the default room with a message directing users to switch rooms first
- **Welcome deck updated** — instructions now guide users to switch rooms before loading decks

### Fixed

- **Hub launch endpoint** — `POST /hub/api/presentations/:id/launch` now returns HTTP 500 (not 400) when the launch backend (yjs-server) is unreachable, with a descriptive error message including the target URL and underlying cause
- **Hub server-client** — network-level `fetch()` failures (e.g. connection refused) now continue to the next `SERVER_BASE_URL` candidate instead of aborting immediately
- **Docker: yjs-server fails to start** — `Dockerfile` runtime stage was missing `COPY node_modules` so `pino` was not found at startup; added the copy step
- **Whiteboard strokes lost on reload** — localStorage proxy cache "skip first reload" optimization prevented features from re-activating after Yjs sync; replaced with a FAST PATH that skips deck fetch but re-activates features so strokes are replayed
- **localStorage proxy cache for instant reload** — cache the last-known content proxy URL per room in `localStorage`; on reload, load from cache immediately (no flash of wrong deck); graceful fallback to default deck if cached URL returns 404
- **Inline media overflow** — YouTube embeds, inline videos, and iframe wrappers were overflowing the slide bottom when heading/text consumed vertical space; added flex-column layout rules so media elements shrink to fit remaining space
- **Iframe wrapper aspect-ratio** — replaced `padding-bottom: 56.25%` hack with native `aspect-ratio: 16/9` for proper flex shrink
- **Nav arrows visible in readonly mode** — the ‹ › media navigation buttons are now hidden for viewers in readonly mode (they can't navigate independently)
- **Yjs features map not cleared on deck reload** — loading a new deck now clears stale Yjs feature data
- **Play button overlay UX** — replaced native media controls with a centred play button overlay for video and audio; control bar only appears on hover
- **Inline iframe overflow** — constrained embedded pages to available slide space
- **Video cover layout** — fixed `<geek-video>` cover mode: video fills slide, content floats above with proper z-index

## [2.1.0] - 2026-05-18

### Added

- **Rich media embeds** — YouTube, audio, video, and iframe embeds via image-link markdown syntax (`![alt](url)`)
  - `youtube-url` plugin: detects YouTube / youtu.be URLs → `<geek-youtube>` web component with IFrame API
  - `audio-url` plugin: detects audio extensions (`.mp3 .wav .ogg .flac .aac .m4a .opus .weba`) → `<geek-audio>` with waveform visualiser (Web Audio API or CSS-bars fallback)
  - `video-url` plugin: detects video extensions (`.mp4 .webm .ogv .mov`) → `<geek-video>`
  - `iframe-url` plugin: detects `.html`/`.htm` URLs → lazy-loaded `<iframe data-src>` with click-to-activate overlay
- **`mod-media-cover` modifier** — add to a slide marker to fill the slide with any media element; implemented via CSS injection (no JS class detection needed)
- **Media sync feature** (`media-sync`) — presenter play/pause/seek is propagated to viewers via Yjs `mediaState` map; drift-corrected via wall-clock timestamp
- **Autoplay banner** — when viewer's browser blocks autoplay, a full-overlay modal with pulsing play icon, title, and white CTA button appears; click to enable playback and resync to the presenter's current timestamp
- **Nav arrow buttons** — clearly visible ‹ › buttons (36×80px with drop-shadow) injected by `media-sync` feature allow slide navigation when iframes or YouTube embeds have keyboard focus; shown only on slides with media, only while the mouse is moving
- **Keyboard-captured banner** — when an iframe steals keyboard focus (window `blur`), a notification banner appears reminding users to use ‹ › buttons or click the banner to dismiss it
- **Iframe restore button** — small ⌨ badge appears in the top-right of an iframe wrapper after the overlay is dismissed; clicking it restores the click-to-activate overlay and returns keyboard navigation
- **Symmetric audio waveform** — `<geek-audio>` draws 64 bars radiating up AND down from a vertical centre line on a transparent canvas; colour configurable via `data-color` attribute; gradient fades at bar tips; CSS fallback also uses symmetric bars
- **Terminal commands** — `media-play`, `media-pause`, `media-seek <seconds>` control media on the current slide from the terminal
- **`decks/media-demo/`** — demo deck exercising all media types (YouTube, audio, video, iframes, video cover background) with local Firefox-compatible assets
- **Video cover background** — combine `layout-cover` + `mod-media-cover` on a slide: video fills the background, gradient overlay darkens the bottom, title and paragraph float above the gradient in white text

### Fixed

- **`layouts.css` media section** — missing `*/` comment terminator caused all media CSS rules to be treated as a comment and never applied
- **Missing deck CSS directory** — `decks/media-demo/css/` was absent so `layouts.css` and `theme-default.css` were not loaded; deck now includes both files
- **Nav arrow visibility** — buttons were too small (28×56px) and too faint (opacity 0.45, no shadow); now 36×80px with `box-shadow` for contrast on any background
- **Iframe keyboard trap** — after clicking the overlay, keyboard stayed locked in the iframe; fixed with restore button and keyboard-captured banner
- **Media sync viewer** — fixed orphan Y.Map bug where viewer created a local Yjs map that the server dropped on readonly connections; viewer now observes the root `features` map for the presenter's `media-sync` entry before attaching its observer
- **Sync-on-unblock** — when the viewer clicks the autoplay banner, media on the current slide is re-synced to the latest Yjs state (compensates for time elapsed while playback was blocked by browser policy)
- **YouTube autoplay detection** — `<geek-youtube>` now detects browser autoplay blocks via an 800ms timeout; if the player has not transitioned to PLAYING/BUFFERING, dispatches `geek:autoplay:blocked`; on banner dismiss retries with time-compensated seek target
- **Firefox audio canvas gradient** — `canvas.addColorStop()` in Firefox rejects `oklch()` colours; `colorWithAlpha()` helper converts hex/rgb to hex+alpha before use


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
