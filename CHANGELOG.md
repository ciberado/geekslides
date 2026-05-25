# Changelog

All notable changes to GeekSlides are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

<!-- Add new entries above this line -->

## [2.6.4] - 2026-05-25

### Fixed

- QR overlay now reliably appears on **all** connected sessions. The previous
  implementation observed a feature-scoped `Y.Map` that each client created
  on activation; Yjs conflict resolution kept only one winner, so clients
  watching the losing map never saw the update. The feature now uses
  `observeDeep` on `doc.getMap('features')` — a singleton that always refers
  to the same Y.Map — eliminating the conflict race entirely and removing the
  500 ms polling workaround.

## [2.6.3] - 2026-05-24

### Fixed

- QR overlay (`share-qr`) now correctly appears on viewer/read-only sessions.
  The `qr-overlay` feature was only registered in the presenter code path; it
  is now also registered in the read-only path so all room participants see
  the overlay when a presenter runs `share-qr`.

## [2.6.2] - 2026-05-24

### Fixed

- QR overlay (`share-qr`) now appears on all sessions including read-only
  viewers. Read-only clients can no longer accidentally dismiss the overlay;
  only presenter sessions can dismiss it (Esc or click), which closes it on
  all clients simultaneously. Hint text on viewer screens changed to
  "Scan to join".

## [2.6.1] - 2026-05-24

### Fixed

- `wb-canvas` (blank whiteboard canvas) command now appears and works after
  `plugin-load whiteboard`. `reprocessDeckForPlugins` previously ignored
  `exports.features` from room plugins — it now activates them via
  `FeatureManager`, tracking room-plugin-owned features in a Set so they are
  cleanly deactivated on `plugin-unload`.
- New decks scaffolded with `geekslides create` now include both
  `whiteboard` and `whiteboard-canvas` in `config.features`, so the blank
  canvas overlay is available out of the box.

## [2.5.2] - 2026-05-24

### Fixed

- Short URL redirects (`/s/:id`) now work correctly in production — Caddy was
  serving the SPA instead of proxying to the server. Added `/s/*` route to all
  Caddyfiles (`docker/Caddyfile`, `docker/Caddyfile.internal`, `Caddyfile.dev`).

## [2.6.0] - 2026-05-24

### Added

- Configurable slide transitions: `slide` (default), `fade`, and `none`.
- `transition` field in `config.json` to set the default transition for a deck.
- Per-slide transition override via slide marker classes (e.g., `.transition-fade`).
- `transition` terminal command to change the transition effect at runtime.

### Fixed

- Resolved 144 ESLint errors across the codebase (type safety, unused vars,
  unnecessary assertions, unsafe access patterns).
- Added plugin SDK types for Yjs sync API used by media-sync and poll features.

## [2.5.1] - 2026-05-24

### Added

- Default plugin registry (`github.com/ciberado/geekslides/tree/main/plugins`) is now
  automatically registered in every room on creation.
- `plugins/index.json` registry manifest listing all 7 built-in plugins.
- `npm run release` / `npm run release:dry` scripts for streamlined releases.

### Fixed

- `plugin-available` and `plugin-load` gracefully skip unreachable registries instead
  of failing entirely.

## [2.5.0] - 2026-05-24

### Added

- **Plugin registry system** — Dynamic plugin management via terminal commands:
  `plugin-registry-add`, `plugin-registry-ls`, `plugin-registry-remove`,
  `plugin-available`, `plugin-active`, `plugin-load`, `plugin-unload`.
  Registries are HTTPS directories serving an `index.json` manifest.
  Room-scoped plugin state is synced via Yjs across all clients.
- **GitHub URL support for registries** — Use `github.com/user/repo/tree/branch/path`
  URLs directly; they are automatically normalized to `raw.githubusercontent.com`.
- **`share-qr` command** — Displays a full-screen QR code overlay on all room
  clients with a shortened viewer link. Dismiss with Escape or click from any client.
- **Short URL API** — `POST /api/short` creates compact 6-character URLs;
  `GET /s/:id` redirects to the original. Used by share-qr for denser QR codes.
- **16 new e2e tests** covering plugin registry commands, short URL API,
  QR overlay multi-page sync, and GitHub URL normalization.

## [2.4.5] - 2026-05-24

### Fixed

- **Plugin bundles missing from Docker image** — `plugins/dist/` is excluded from
  both `.gitignore` and `.dockerignore` (matched by the `dist/` pattern), so it was
  never copied into the build context. The app-builder Docker stage now runs
  `npm run build:plugins` to compile all plugin bundles, and the runtime stage
  copies `plugins/dist` to `/srv/slides/plugins/dist` so requests to
  `/plugins/dist/{name}/index.js` are served correctly.

## [2.4.4] - 2026-05-24

### Fixed

- **Hub Docker: `Cannot find module 'jsdom'`** — jsdom v29.1.1 (hub runtime dep)
  conflicted with the root devDep v29.0.1, so npm placed hub's copy in
  `packages/hub/node_modules/jsdom` instead of the root `node_modules/`. The
  Dockerfile runtime stage only copied root node_modules, leaving jsdom absent
  from `/app/node_modules/` where the bundle expects it.
  - `Dockerfile.hub` now merges `packages/hub/node_modules` on top of root
    node_modules in the runtime stage.
  - Root `package.json` devDependency for jsdom bumped from `^29.0.1` to
    `^29.1.1` to allow npm to hoist a single copy in future installs.

## [2.4.3] - 2026-05-24

### Fixed

- **Hub Docker crash on PPTX import** — `jsdom` was being bundled by esbuild, causing
  `ENOENT /browser/default-stylesheet.css` at runtime because esbuild incorrectly
  rewrote `__dirname` inside jsdom's `computed-style.js`.  Fixed by adding
  `--external:jsdom` to the esbuild command so jsdom is loaded from `node_modules` at
  runtime (already present in the Docker image).

### Added

- **`/healthz` endpoint** on the Hub Fastify server for health checks and smoke testing.
- **Bundle smoke test** (`packages/hub/scripts/bundle-smoke.mjs` / `npm run build:smoke
  --workspace=@geekslides/hub`) — starts the compiled CJS bundle with dev-mode auth,
  uploads a real PPTX, and asserts a 201 response.  Catches runtime failures that only
  appear in the bundle (e.g. dependencies that load disk assets via `__dirname`).
- **Pre-commit checklist step 2a** — run `build:server` + `build:smoke` for any hub
  server changes before committing.
- **AGENTS.md** — documents the esbuild externals rule and the `build:smoke` command.

## [2.4.2] - 2026-05-24

### Changed

- **Docker build/push script** — replaced 10 individual `docker:*` npm scripts with
  `scripts/docker-build-push.sh`; images are now tagged `:x.y.z` always; `:latest`
  is only updated when HEAD sits on a git tag (a release); untagged commits get a
  `<version>-<sha>` tag only

## [2.4.1] - 2026-05-24

### Added

- **PPTX import limitation warning** — the PPTX upload tab now shows a prominent
  amber warning box reminding users that this feature is designed for simple,
  AI-generated presentations and may fail or produce low-fidelity output on complex decks

### Fixed

- **PPTX import: JSZip 3.x `.asArrayBuffer()` removed** — pre-load all `ppt/media/*`
  images as base64 before slide processing so inner sync helpers can look them up
  without the removed API; fixes import of any PPTX with embedded images
- **PPTX import: `tableStyles` null crash** — guard both `tableStyles['a:tblStyleLst']`
  accesses when `tableStyles.xml` is absent; normalise `a:tblStyle` to array
- **PPTX import: `thisTblStyle` undefined crash** — add null guard when no matching
  table style is found in `tableStyles.xml`
- **PPTX import: missing transform on images** — use optional chaining when reading
  rotation from `a:xfrm.attrs.rot` (transform may be absent)

## [2.4.0] - 2026-05-24

### Added

- **Deck export** — Hub dashboard now has an **Export** button on every deck card and
  list row; clicking it downloads a `.zip` archive of all deck files via
  `GET /hub/api/presentations/:id/export`
- **PPTX source preservation** — when a deck is created or updated from a `.pptx`
  upload, the original file is stored as `source.pptx` in the git repo and is
  included in the exported zip
- **Apache-2.0 license** — `LICENSE` file added; all workspace `package.json` files
  now declare `"license": "Apache-2.0"`
- **PPTX speaker notes import** — speaker notes from `.pptx` files are now extracted
  and shown in the GeekSlides speaker view (`S` key); notes are extracted from
  `ppt/notesSlides/notesSlideN.xml`, converted to HTML (bold/italic preserved), and
  embedded as `<aside class="gs-notes">` in each slide's `<section>`; engine's
  `HtmlSlideParser` extracts them into `SlideData.notesHtml` at parse time

### Fixed

- **Hub Vite HMR in dev mode** — `Caddyfile.dev` now routes `/hub/api/*` to Fastify
  and all other `/hub/*` paths to the Vite dev server, enabling hot module replacement
  without a manual `npm run build:client`
- **Hub dashboard card overflow** — card action buttons now wrap (`flex-wrap: wrap`)
  so long button rows don't overflow the card boundary

## [2.3.0] - 2026-05-23

### Added

- **PPTX import via Hub** — upload a `.pptx` file in the Hub dashboard to create a
  fully presentable deck; slides are converted to HTML at upload time and stored as
  `config.json` + `slides.html` + `pptx.css`; charts rendered server-side as inline SVG;
  numeric bullets resolved; intended for clean, AI-generated presentations
- **Internal fork of `pptx2html/process_pptx.js`** — replaces `@jvmr/pptx-to-html`;
  higher fidelity: theme colors, PPTX chart data, numeric bullet types, correct background
  cascade (slide → layout → master); zero jQuery dependency at runtime
- **Server-side chart rendering** — D3 v7 + jsdom renders bar/line/area/pie charts as
  inline SVG before storage (`packages/hub/.../chart-renderer.ts`)
- **Numeric bullet resolution** — TypeScript port of `setNumericBullets` resolves ordered
  list counters server-side (`packages/hub/.../bullet-numbering.ts`)
- **`slideWidth` / `slideHeight` in config.json** — Hub now includes exact pixel dimensions
  in the generated config so the engine scales slides correctly to fill the viewport
- **`Slideshow.setDesignDimensions(w, h)`** — engine method to override the default
  1920×1080 design space with exact PPTX canvas dimensions; `SpeakerView` exposes the
  same method; `main.js` calls both after `setAspectRatio()` when config supplies the fields
- **`backgroundCss` in `SlideData`** — engine supports gradient/image backgrounds from
  PPTX slides (`background:` shorthand is forwarded to the slide shadow DOM)
- **`npm run start` with tmux panels** — `scripts/start-dev.sh` starts viewer+yjs, hub,
  and Caddy in a tmux window with three panes; falls back to background processes when
  tmux is unavailable; `Caddyfile.dev` added for local reverse proxy on port 8080

### Fixed

- **PPTX background colors wrong for theme-colored slides** — `getSchemeColorFromTheme()`
  cached `slideLayoutClrOvride` as `{}` when first called from text/border processing
  (where `sldMasterNode` is `undefined`); subsequent calls to resolve theme backgrounds
  (`bg1`, `tx1`) returned `undefined`, producing `rgba(0,0,0,1)` (black); fix: refresh
  the cache whenever a valid master node is supplied, preserve it otherwise
- **Hub `Secure` cookie flag on Tailscale HTTP** — `*.ts.net` hostnames are now treated
  like `localhost` for the `Secure` cookie flag, fixing "cookie rejected" login failures
  when accessing the Hub via Tailscale direct HTTP

### Changed

- **`HtmlSlideParser` background extraction** — now returns the full `background:`
  shorthand (not just `background-color`) to support gradient and image backgrounds

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
