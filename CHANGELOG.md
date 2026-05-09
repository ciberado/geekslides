# Changelog

All notable changes to GeekSlides are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-05-09

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

<!-- Add new entries above this line in the format: ## [X.Y.Z] - YYYY-MM-DD -->
