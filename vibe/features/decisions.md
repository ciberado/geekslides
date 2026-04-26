# v2 Architecture Decisions Record

Summary of all architectural decisions for the geekslides v2 rewrite.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Build tool | **Vite** | Fast HMR, native ESM, minimal config, dominant ecosystem choice for vanilla TS |
| D2 | UI framework | **None (vanilla TS)** | Feature parity with v1, no framework overhead, full control |
| D3 | DOM component model | **Web Components (Custom Elements + Shadow DOM)** | Native encapsulation, standard API, no build-time compilation |
| D4 | Shadow DOM + print | **Dual rendering** | Shadow DOM in browser; flattened light DOM template for browser-backed print/PDF export |
| D5 | Realtime sync | **Yjs (CRDT)** | Proven conflict-free sync, auto-merge, works for slides + whiteboard |
| D6 | Yjs transport | **y-websocket** | Built-in provider, lightweight dedicated WS server |
| D7 | Yjs shared data | **Y.Map for session state** | Sync slide position, partial, mode. Not collaborative editing |
| D8 | Broker | **Drop Aedes, use y-websocket server** | Yjs server replaces custom MQTT broker entirely |
| D9 | PDF generation | **Playwright Chromium `page.pdf()`** | Browser-faithful PDF export from print HTML/CSS templates, including slides-details companion output. *Note: current implementation diverges — uses `page.screenshot()` + `sharp` assembly, producing image-based (non-searchable) PDFs. Needs revisiting.* |
| D10 | Command system | **Direct keys for navigation, `Escape` opens terminal prompt for everything else** | Navigation must be zero-friction (arrows/space during a live talk); all other commands typed into a terminal-like prompt opened by pressing `Escape` — discoverable via `help`, with tab-completion and history |
| D11 | Plugin architecture | **Simple function-based callbacks** | Preprocessors: `(md) => md`. Processors: `(el) => void`. Three resolution modes: built-in short names, local `.js` files via relative paths (`./`), and remote `.js` files via full URLs (`https://...`) fetched through a server-side plugin proxy |
| D12 | Slide-scoped styles | **Compile-time selector scoping** | Extract `<style>` blocks, rewrite selectors to slide container scope |
| D13 | Testing | **Vitest + Playwright** | Vitest for unit/integration (Vite-native), Playwright for E2E |
| D14 | Monorepo | **npm workspaces** | `packages/` dir with `@geekslides/*` scoped packages |
| D15 | Package naming | **@geekslides/*** | `@geekslides/engine`, `@geekslides/server`, `@geekslides/cli` |
| D16 | Live preview | **Vite HMR + custom hot reload handler** | File watcher built-in, stays on current slide during reload |
| D17 | Presentation format | **Same as v1** | `README.md` + `config.json`, GitHub-readable, backward compatible |
| D18 | Docker topology | **Single image** | SPA + yjs-server + Caddy in one container. 3-stage Dockerfile: app-builder (Vite), server-builder (esbuild CJS), runtime (node:22-alpine + caddy via apk). entrypoint.sh starts Node in background then exec-replaces with Caddy (PID 1). Caddy serves `/deck/*` from mounted content volume, proxies `/ws*` to localhost:1234, serves SPA with index.html fallback. One `docker compose up -d` deploys everything. |
| D19 | Speaker notes | **Separate browser tab/window (not CSS overlay)** | v1's CSS trick (absolute positioning at left:100%) caused scaling conflicts, no timer, no next-slide preview. Separate view via Yjs sync gives full speaker UI |
| D20 | Mobile/smartphone | **Touch gestures + responsive toolbar** | Audience follows on phone: swipe/tap nav, always-visible toolbar on small screens, auto-sync with presenter |
| D21 | Slide scaling | **`transform: scale()` + CSS custom property** | Proven technique (reveal.js, Impress.js), author at fixed resolution. v2 improves over v1 by using `--gs-scale-factor` + ResizeObserver instead of CSSOM mutation |
| D22 | Content proxy | **Always-proxy with HTTP upload to temp filesystem, room-scoped** | Presenter uploads deck assets to server via HTTP; all clients load from server proxy. Scoped per sync room, stored in temp dir, cleaned up on disconnect. Enables remote viewers to access locally-sourced presentations |
| D23 | Read-only rooms | **Token-based presenter auth with server-side write filtering** | Presenter runs `share` to create a protected room with a 64-char hex token (32 random bytes, `timingSafeEqual` validation). Server drops Yjs update messages (type 0, sub-type 2) from viewer connections. Client lockdown removes terminal, key bindings, and touch input for `?readonly` URLs. Per-IP rate limiting (10 failures/60s) prevents brute-force. Unprotected rooms remain fully open for backward compat. |

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
- [Content Proxy](content-proxy.md)
