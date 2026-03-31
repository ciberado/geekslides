# v2 Architecture Overview

## System Context

geekslides v2 is a complete TypeScript rewrite of the markdown-based presentation engine.
Presentations are authored as standalone repos (`README.md` + `config.json`), rendered in the
browser as interactive slide decks with real-time synchronization, and exported to PDF via WeasyPrint.

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
│  └─────────┘                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PDF Export                                │
│                                                             │
│  @geekslides/engine          WeasyPrint                     │
│  ├── render to flat HTML ──> ├── slides.pdf                 │
│  │   (no Shadow DOM!)        ├── slides-notes.pdf           │
│  └── print templates         └── book.pdf                   │
└─────────────────────────────────────────────────────────────┘
```

## Package Structure (npm workspaces)

```
geekslides/
├── package.json                  # root workspace config
├── vite.config.ts                # dev server config
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
│   │   │   │   ├── Toolbar.ts            # <geek-toolbar>
│   │   │   │   ├── CommandPalette.ts     # <geek-command-palette>
│   │   │   │   ├── Whiteboard.ts         # <geek-whiteboard>
│   │   │   │   ├── ChartSlide.ts         # <geek-chart> (table → Chart.js)
│   │   │   │   └── VideoSlide.ts         # <geek-video> (timestamp partials)
│   │   │   ├── input/
│   │   │   │   ├── CommandSystem.ts      # prefix key + command palette logic
│   │   │   │   ├── KeyBindings.ts        # key → command mapping
│   │   │   │   └── TouchInput.ts         # swipe/tap handlers
│   │   │   ├── plugins/
│   │   │   │   ├── PluginManager.ts      # register/execute pipeline
│   │   │   │   ├── types.ts              # Preprocessor, Processor interfaces
│   │   │   │   ├── builtins/
│   │   │   │   │   ├── header-preprocessor.ts
│   │   │   │   │   ├── chart-processor.ts
│   │   │   │   │   ├── video-processor.ts
│   │   │   │   │   └── iframe-processor.ts
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
│   │   │   ├── index.ts          # y-websocket server entry
│   │   │   ├── rooms.ts          # room management + auth
│   │   │   └── persistence.ts    # optional LevelDB persistence
│   │   └── tests/
│   │       └── rooms.test.ts
│   │
│   └── cli/                      # @geekslides/cli
│       ├── package.json
│       ├── src/
│       │   ├── index.ts          # CLI entry (create, dev, build, pdf)
│       │   ├── commands/
│       │   │   ├── dev.ts        # vite dev server wrapper
│       │   │   ├── build.ts      # production build
│       │   │   ├── pdf.ts        # weasyprint invocation
│       │   │   └── create.ts     # scaffold new presentation
│       │   └── imageoptimizer.ts # sharp-based optimizer (from v1 tool)
│       └── tests/
│           └── cli.test.ts
│
├── e2e/                          # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── navigation.spec.ts
│   ├── sync.spec.ts
│   ├── whiteboard.spec.ts
│   └── commands.spec.ts
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
PluginManager.preprocess(md)
    │  ┌─ header-preprocessor: ## Title → [](.title#anchor)
    │  └─ ...custom preprocessors
    ▼
SlideParser.parse(md)
    │  ├─ markdown-it render → HTML
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
Ready (first slide visible)
```

### 2. Navigation & Commands

```
User Input
    │
    ├─ Key press → KeyBindings.ts
    │  ├─ Direct keys (arrows, space, etc.) → navigation
    │  ├─ Ctrl+B (prefix) → await next key → command
    │  └─ : (colon) → CommandPalette.open()
    │
    ├─ Touch → TouchInput.ts
    │  ├─ Swipe left/right → prev/next
    │  └─ Tap zones → partial advance
    │
    └─ CommandPalette
       ├─ Fuzzy search over registered commands
       └─ Enter → execute command
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
| `geek:sync:state` | `{ connected, room }` | SyncManager | Toolbar |
| `geek:command:execute` | `{ name, args }` | CommandPalette | CommandSystem |
| `geek:slides:loaded` | `{ count }` | Slideshow | Toolbar, SyncManager |
| `geek:config:loaded` | `{ config }` | CLI/dev server | Slideshow |
| `geek:hmr:update` | `{ contentUrl }` | Vite HMR handler | Slideshow (re-render) |

## Key Architectural Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| Language | JavaScript (ES modules) | TypeScript (strict) |
| Bundler | Parcel | Vite |
| Components | Vanilla DOM classes | Web Components (Custom Elements + Shadow DOM) |
| Sync | Custom MQTT protocol (Aedes broker) | Yjs CRDT (y-websocket) |
| Broker | Aedes (TCP + WS + WSS) | y-websocket server (single WS) |
| Input | Scattered hotkeys | Prefix key + command palette |
| Plugins | Hardcoded preprocessor array | Function-based plugin registry |
| Per-slide CSS | Not supported | `<style>` blocks with compile-time scoping |
| PDF export | Playwright screenshots → PDFKit | WeasyPrint HTML → PDF (3 formats) |
| Testing | Jest (unit only, limited) | Vitest (unit/integration) + Playwright (E2E) |
| Monorepo | Loose dirs | npm workspaces (`@geekslides/*`) |
| Live reload | Manual `location.reload()` on MQTT | Vite HMR preserving slide position |
