# v2 Architecture Decisions Record

Summary of all architectural decisions for the geekslides v2 rewrite.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Build tool | **Vite** | Fast HMR, native ESM, minimal config, dominant ecosystem choice for vanilla TS |
| D2 | UI framework | **None (vanilla TS)** | Feature parity with v1, no framework overhead, full control |
| D3 | DOM component model | **Web Components (Custom Elements + Shadow DOM)** | Native encapsulation, standard API, no build-time compilation |
| D4 | Shadow DOM + print | **Dual rendering** | Shadow DOM in browser; flattened light DOM template for WeasyPrint |
| D5 | Realtime sync | **Yjs (CRDT)** | Proven conflict-free sync, auto-merge, works for slides + whiteboard |
| D6 | Yjs transport | **y-websocket** | Built-in provider, lightweight dedicated WS server |
| D7 | Yjs shared data | **Y.Map for session state** | Sync slide position, partial, mode. Not collaborative editing |
| D8 | Broker | **Drop Aedes, use y-websocket server** | Yjs server replaces custom MQTT broker entirely |
| D9 | PDF generation | **WeasyPrint (3 outputs)** | Slides PDF, slides+notes PDF, book PDF from HTML/CSS templates |
| D10 | Command system | **Direct keys for navigation, Ctrl+B prefix for everything else** | Navigation must be zero-friction (no modifier key during a live talk); all other commands use tmux-style prefix for discoverability |
| D11 | Plugin architecture | **Simple function-based callbacks** | Preprocessors: `(md) => md`. Processors: `(el) => void`. Registered via config |
| D12 | Slide-scoped styles | **Compile-time selector scoping** | Extract `<style>` blocks, rewrite selectors to slide container scope |
| D13 | Testing | **Vitest + Playwright** | Vitest for unit/integration (Vite-native), Playwright for E2E |
| D14 | Monorepo | **npm workspaces** | `packages/` dir with `@geekslides/*` scoped packages |
| D15 | Package naming | **@geekslides/*** | `@geekslides/engine`, `@geekslides/server`, `@geekslides/cli` |
| D16 | Live preview | **Vite HMR + custom hot reload handler** | File watcher built-in, stays on current slide during reload |
| D17 | Presentation format | **Same as v1** | `README.md` + `config.json`, GitHub-readable, backward compatible |
| D18 | Docker topology | **2 services** | slides (Vite dev / Caddy prod) + yjs-server, Caddy reverse proxies both |
| D19 | Speaker notes | **Separate browser tab/window (not CSS overlay)** | v1's CSS trick (absolute positioning at left:100%) caused scaling conflicts, no timer, no next-slide preview. Separate view via Yjs sync gives full speaker UI |
| D20 | Mobile/smartphone | **Touch gestures + responsive toolbar** | Audience follows on phone: swipe/tap nav, always-visible toolbar on small screens, auto-sync with presenter |
| D21 | Slide scaling | **`transform: scale()` + CSS custom property** | Proven technique (reveal.js, Impress.js), author at fixed resolution. v2 improves over v1 by using `--gs-scale-factor` + ResizeObserver instead of CSSOM mutation |

## Detailed Documents

- [Architecture Overview](architecture-v2.md)
- [Toolchain & Monorepo](toolchain.md)
- [Web Components](components.md)
- [Yjs Synchronization](sync.md)
- [Plugin System](plugin-system.md)
- [Command System](command-system.md)
- [Speaker Notes Architecture](speaker-notes.md)
- [CSS Slide Scaling](css-scaling.md)
- [Testing Strategy](testing.md)
- [Print & PDF Generation](print.md)
- [Deployment](deployment-v2.md)
