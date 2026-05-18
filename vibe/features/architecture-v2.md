# v2 Architecture Overview

## System Context

geekslides v2 is a complete TypeScript rewrite of the markdown-based presentation engine.
Presentations are authored as standalone repos (`README.md` + `config.json`), rendered in the
browser as interactive slide decks with real-time synchronization, and exported to PDF via headless Chromium through Playwright.

```
┌─────────────────────────────────────────────────────────────┐
│                     Author Workflow                          │
│                                                             │
│  presentation-repo/          geekslides v2                  │
│  ├── README.md  ──────────>  Vite Dev Server                │
│  ├── config.json             ├── HMR hot reload             │
│  ├── images/                 ├── @geekslides/engine          │
│  └── local.css               │   (Web Components)           │
│                              └── Browser                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Runtime (Production)                      │
│                                                             │
│  ┌──────────┐     ┌──────────────────────────────┐          │
│  │  Browser  │────>│         Caddy (HTTPS)        │          │
│  │          │<────│                              │          │
│  └──────────┘     │  /          → static slides  │          │
│       │           │  /ws        → yjs-server     │          │
│       │           └──────────────────────────────┘          │
│       │                        │                            │
│       │    Yjs CRDT sync       │                            │
│       │◄──────────────────────►│                            │
│       │    (y-websocket)       │                            │
│       │                  ┌─────┴──────┐                     │
│       │                  │ yjs-server │                     │
│       │                  │ (Node.js)  │                     │
│       │                  └────────────┘                     │
│       │                                                     │
│  ┌────┴────┐                                                │
│  │ Browser │   (audience, synced via Yjs Y.Map)             │
│  │ Desktop │   (swipes + tap zones on mobile)               │
│  │ Mobile  │                                                │
│  └─────────┘                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Speaker View                              │
│                                                             │
│  Separate browser tab/window (same Yjs room)                │
│  ├── Current slide thumbnail                                │
│  ├── Next slide preview                                     │
│  ├── Speaker notes (scrollable, full markdown)              │
│  └── Timer + navigation controls                            │
│  See: speaker-notes.md                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PDF Export                                │
│                                                             │
│  @geekslides/engine          Playwright / Chromium          │
│  ├── render to flat HTML ──> ├── slides.pdf                 │
│  │   (no Shadow DOM!)        ├── slides-notes.pdf           │
│  └── print templates         ├── slides-details.pdf         │
│                               └── book.pdf                  │
└─────────────────────────────────────────────────────────────┘
```

## Package Structure (npm workspaces)

```
geekslides/
├── package.json                  # root workspace config
├── vite.config.ts                # dev server config
├── plugins/                      # built-in plugin bundles (source + manifest + docs)
│   ├── core/                     # header, iframe, source-notes
│   ├── media/                    # youtube, audio, video, iframe-url, media-sync
│   ├── whiteboard/               # whiteboard feature
│   ├── chart/                    # Chart.js processor
│   ├── mermaid/                  # Mermaid diagram processor
│   ├── css-doodle/               # generative background patterns
│   └── poll/                     # live audience polling
├── packages/
│   ├── engine/                   # @geekslides/engine
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts          # public API
│   │   │   ├── core/
│   │   │   │   ├── Slideshow.ts          # <geek-slideshow> web component
│   │   │   │   ├── Slide.ts              # <geek-slide> web component
│   │   │   │   ├── SlideParser.ts        # markdown → slides (markdown-it)
│   │   │   │   ├── StyleScoper.ts        # per-slide <style> scoping
│   │   │   │   └── Config.ts             # typed config (config.json schema)
│   │   │   ├── components/
│   │   │   │   ├── Terminal.ts           # <geek-terminal>
│   │   │   │   ├── Whiteboard.ts         # <geek-whiteboard>
│   │   │   │   ├── ChartSlide.ts         # <geek-chart> (table → Chart.js)
│   │   │   │   ├── VideoSlide.ts         # <geek-video> (timestamp partials)
│   │   │   │   ├── SpeakerView.ts        # <geek-speaker-view> (separate tab)
│   │   │   │   └── SpeakerTimer.ts       # presentation timer
│   │   │   ├── input/
│   │   │   │   ├── CommandSystem.ts      # command registry + execution
│   │   │   │   ├── KeyBindings.ts        # key → command mapping
│   │   │   │   └── TouchInput.ts         # swipe/tap handlers
│   │   │   ├── plugins/
│   │   │   │   ├── PluginManager.ts      # register/execute pipeline
│   │   │   │   ├── types.ts              # Preprocessor, Processor interfaces
│   │   │   │   ├── local-plugin.ts       # local/remote plugin loader utilities
│   │   │   │   ├── plugin-bundles.ts     # BUILTIN_BUNDLES registry + expandBundles()
│   │   │   │   └── index.ts
│   │   │   ├── features/
│   │   │   │   ├── types.ts              # Feature, FeatureContext interfaces
│   │   │   │   ├── FeatureManager.ts     # registration, lifecycle, events
│   │   │   │   ├── feature-loader.ts     # built-in / local / remote loader
│   │   │   │   └── index.ts
│   │   │   ├── sync/
│   │   │   │   ├── SyncManager.ts        # Yjs Y.Map ↔ slideshow state
│   │   │   │   ├── WhiteboardSync.ts     # Yjs Y.Array for strokes
│   │   │   │   └── types.ts
│   │   │   └── print/
│   │   │       ├── PrintRenderer.ts      # flat HTML output (no Shadow DOM)
│   │   │       ├── templates/
│   │   │       │   ├── slides.html       # slide-only layout
│   │   │       │   ├── slides-notes.html # slides + speaker notes
│   │   │       │   └── book.html         # full book layout
│   │   │       └── print.css             # @page rules, page breaks
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── SlideParser.test.ts
│   │       │   ├── StyleScoper.test.ts
│   │       │   ├── CommandSystem.test.ts
│   │       │   └── PluginManager.test.ts
│   │       └── integration/
│   │           ├── Slideshow.test.ts
│   │           └── SyncManager.test.ts
│   │
│   ├── server/                   # @geekslides/server
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts          # y-websocket server entry + WS auth/write filtering
│   │   │   ├── ContentApi.ts     # content proxy HTTP API
│   │   │   ├── ContentStore.ts   # room-scoped file storage
│   │   │   ├── DeckProxy.ts      # server-side deck proxy (mixed-content bypass)
│   │   │   ├── PluginProxy.ts    # remote plugin proxy endpoint
│   │   │   ├── RoomStore.ts      # in-memory protected room + token storage
│   │   │   ├── RoomApi.ts        # room share/auth/role HTTP endpoints
│   │   │   ├── RateLimiter.ts    # per-IP sliding-window auth rate limiter
│   │   │   └── types/
│   │   └── tests/
│   │       ├── server.test.ts
│   │       ├── room-store.test.ts
│   │       ├── room-auth.test.ts
│   │       └── rate-limiter.test.ts
│   │
│   └── cli/                      # @geekslides/cli
│       ├── package.json
│       ├── src/
│       │   ├── index.ts          # CLI entry (create, dev, build, pdf)
│       │   ├── commands/
│       │   │   ├── dev.ts        # vite dev server wrapper
│       │   │   ├── build.ts      # production build
│       │   │   ├── pdf.ts        # Playwright/Chromium PDF export
│       │   │   └── create.ts     # scaffold new presentation
       │   ├── templates/
       │   │   ├── layouts.css          # canonical layout CSS (structure)
       │   │   ├── theme-default.css    # canonical default theme (colours/fonts)
       │   │   ├── layouts-css.ts       # generated TS export (sync-templates)
       │   │   └── theme-default-css.ts # generated TS export (sync-templates)
       │   └── imageoptimizer.ts # sharp-based optimizer (from v1 tool)
       └── tests/
           ├── cli.test.ts
           └── template-sync.test.ts  # verifies TS exports match canonical CSS
│
├── e2e/                          # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── navigation.spec.ts
│   ├── sync.spec.ts
│   ├── whiteboard.spec.ts
│   ├── commands.spec.ts
│   ├── local-plugins.spec.ts
│   └── remote-plugins.spec.ts
│
├── docker/
│   ├── Dockerfile                # multi-stage: build + Caddy
│   ├── Dockerfile.server         # yjs-server
│   ├── docker-compose.yml
│   └── Caddyfile
│
└── vibe/                         # architecture docs (this dir)
```

## Data Flow

### 1. Presentation Loading

```
config.json
    │
    ▼
Config.ts (validate + defaults)
    │
    ▼
fetch(contentUrl)  →  README.md (raw markdown)
    │
    ▼
loadScripts(config.scripts)
    │  ├─ dynamic import() each script
    │  ├─ scripts may call customElements.define()
    │  └─ optional init(config) callback
    ▼
PluginManager.preprocess(md)
    │  ┌─ header-preprocessor: ## Title → [](.title#anchor)
    │  └─ ...custom preprocessors
    ▼
SlideParser.parse(md)
    │  ├─ markdown-it render → HTML (html: true → custom tags pass through)
    │  ├─ split on empty <a> links → sections
    │  ├─ extract per-section attributes (classes, bg, id)
    │  └─ extract <style> blocks → StyleScoper
    ▼
<geek-slideshow>.loadSlides(sections[])
    │  ├─ create <geek-slide> per section
    │  ├─ inject scoped styles
    │  └─ apply backgrounds, classes
    ▼
PluginManager.process(slides[])
    │  ├─ chart-processor: <table> → <canvas> (Chart.js)
    │  ├─ video-processor: <video> with timestamp partials
    │  ├─ iframe-processor: data-src lazy loading
    │  └─ ...custom processors
    ▼
Ready (first slide visible, custom elements upgraded)
```

### 2. Navigation & Commands

```
User Input
    │
    ├─ Key press → KeyBindings.ts
    │  ├─ Direct keys (arrows, space, etc.) → navigation (no prefix, like v1)
    │  ├─ t → open terminal command prompt
    │  └─ Enter in terminal → execute command via CommandSystem
    │
    ├─ Touch → TouchInput.ts  (smartphone/tablet)
    │  ├─ Swipe left/right → prev/next
    │  ├─ Tap right-2/3 → next, tap left-1/3 → prev
    │  ├─ Long press → toggle toolbar
    │  └─ Swipe up → toggle overview
    │
     └─ geek-terminal
         ├─ help output + command history
         └─ Tab completion + Enter execution
    │
    ▼
CommandSystem.execute(command)
    │
    ▼
CustomEvent dispatch → <geek-slideshow>
    ├─ 'navigate' (slide/partial change)
    ├─ 'toggle-mode' (speaker, overview, whiteboard)
    ├─ 'sync-toggle' (enable/disable Yjs sync)
    └─ ...
```

### 3. Real-time Sync (Yjs)

```
Presenter Browser                      Audience Browser
┌──────────────┐                      ┌──────────────┐
│ <geek-slideshow>                    │ <geek-slideshow>
│     │                               │     ▲
│     ▼                               │     │
│ SyncManager                         │ SyncManager
│     │                               │     ▲
│     ▼                               │     │
│  Y.Map {                            │  Y.Map (observed)
│    slide: 3,                        │     ▲
│    partial: 1,                      │     │
│    mode: 'present'                  │     │
│  }                                  │     │
│     │                               │     │
│     ▼                               │     │
│ y-websocket ◄────────────────────── │ y-websocket
│  provider        y-websocket        │  provider
└──────┬───────┘     server           └──────┘
       │          ┌──────────┐
       └─────────►│ yjs-ws   │
                  │ (Node)   │
                  └──────────┘
```

## Event Catalog (CustomEvent on document)

| Event | Detail | Emitted by | Consumed by |
|-------|--------|------------|-------------|
| `geek:navigate` | `{ slide, partial }` | CommandSystem, SyncManager | Slideshow |
| `geek:mode` | `{ mode: 'present'\|'speaker'\|'overview' }` | CommandSystem | Slideshow |
| `geek:whiteboard:toggle` | `{}` | CommandSystem | Whiteboard |
| `geek:whiteboard:stroke` | `{ points, color, width }` | Whiteboard | WhiteboardSync |
| `geek:whiteboard:clear` | `{}` | CommandSystem | Whiteboard |
| `geek:sync:state` | `{ connected, room }` | SyncManager | Terminal, SyncManager listeners |
| `geek:command:execute` | `{ name, args }` | Terminal | CommandSystem |
| `geek:slides:loaded` | `{ count }` | Slideshow | SyncManager, SpeakerView |
| `geek:config:loaded` | `{ config }` | CLI/dev server | Slideshow |
| `geek:hmr:update` | `{ contentUrl }` | Vite HMR handler | Slideshow (re-render) |

## Extension Model: Plugins vs Features vs Scripts

geekslides v2 has three extension mechanisms:

- **Plugins** (preprocessors + processors) — stateless, fire-once content transformations at parse time. See [plugin-system.md](plugin-system.md).
- **Features** — stateful, long-lived interactive extensions with access to navigation, sync, commands, and DOM. See [feature-system.md](feature-system.md).
- **Scripts** — deck-local ES modules that register custom web components for embedding in markdown. See [custom-components.md](custom-components.md).

All three are complementary. A deck can use any combination.

| Aspect | Plugin | Feature | Script |
|--------|--------|---------|--------|
| Scope | Content transformation | Interactive runtime behavior | Custom element registration |
| Lifecycle | Fire-once (parse time) | Long-lived (presentation session) | Load-once (before render) |
| State | Stateless | Stateful (local + synced via Yjs) | Component-managed |
| API access | Markdown string or DOM element | Full FeatureContext (slideshow, sync, commands, DOM) | DOM + `window.__geekslides` utilities |
| Config key | `plugins.preprocessors` / `plugins.processors` | `features` | `scripts` |
| Examples | header, chart, mermaid | whiteboard, survey, Q&A | doodle-controls, live-chart |

## Key Architectural Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| Language | JavaScript (ES modules) | TypeScript (strict) |
| Bundler | Parcel | Vite |
| Components | Vanilla DOM classes | Web Components (Custom Elements + Shadow DOM) |
| Sync | Custom MQTT protocol (Aedes broker) | Yjs CRDT (y-websocket) |
| Broker | Aedes (TCP + WS + WSS) | y-websocket server (single WS) |
| Input | Scattered hotkeys | Direct navigation + terminal prompt (`t`) |
| Plugins | Hardcoded preprocessor array | Function-based plugin registry |
| Per-slide CSS | Not supported | `<style>` blocks with compile-time scoping |
| PDF export | Playwright screenshots → PDFKit | Playwright Chromium `page.pdf()` from print HTML (4 formats / companion details PDF) |
| Testing | Jest (unit only, limited) | Vitest (unit/integration) + Playwright (E2E) |
| Monorepo | Loose dirs | npm workspaces (`@geekslides/*`) |
| Live reload | Manual `location.reload()` on MQTT | Vite HMR preserving slide position |
