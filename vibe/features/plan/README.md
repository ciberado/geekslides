# v2 Implementation Plan

Complete rewrite of geekslides from JavaScript/Parcel to TypeScript/Vite with Web Components,
Yjs sync, browser-backed PDF export, and a terminal-style command workflow (`t`).

## Phase Dependency Graph

```
Phase 0: Foundation
    │
    ▼
Phase 1: Parser & Config ──────────────────────────┐
    │                                               │
    ▼                                               │
Phase 2: Slide Rendering (Web Components) ──┐       │
    │                                       │       │
    ├──────────────┬──────────────┐         │       │
    ▼              ▼              ▼         │       │
Phase 3:       Phase 4:       Phase 5:      │       │
Plugin Sys.    Navigation     Sync          │       │
    │              │              │         │       │
    ├──────────────┼──────────────┤         │       │
    ▼              ▼              ▼         │       │
Phase 6: Rich Components (chart, video, whiteboard)
                   │              │         │       │
                   ▼              │         │       │
            Phase 7: Speaker View│         │       │
                                 │         │       │
                   ┌─────────────┘         │       │
                   ▼                       ▼       ▼
            Phase 8: Print & PDF ◄─────────┘───────┘
                   │
                   ▼
            Phase 9: CLI Tooling
                   │
                   ├───────────────┐
                   ▼               ▼
            Phase 10:        Phase 11:
            HMR / Live       Deployment
            Preview          (Docker)
                   │               │
                   └───────┬───────┘
                           ▼
                    Phase 12: E2E Tests & Polish
                           │
                           ▼
                    Phase 13: Terminal Config
                           │
                           ▼
                    Phase 14: CLI Docker Image
                           │
                           ▼
                    Phase 15: UX Enhancements
                           │
                           ▼
                    Phase 16: Toolbar, Mermaid
                             & Touch Tuning
                           │
                           ▼
                    Phase 17: Structured Logging
                           │
                           ▼
                    Phase 18: Enhanced Error
                          Management & Diagnostics
```

## Phase Summary

| Phase | Name | Depends On | Key Deliverables | Est. Files |
|-------|------|------------|------------------|------------|
| [0](phase-00-foundation.md) | Project Foundation | — | Monorepo, TS, Vite, ESLint, Vitest skeleton | ~12 |
| [1](phase-01-parser.md) | Parser & Config | 0 | SlideParser, Config, StyleScoper + unit tests | ~8 |
| [2](phase-02-rendering.md) | Slide Rendering | 1 | `<geek-slideshow>`, `<geek-slide>`, CSS scaling | ~8 |
| [3](phase-03-plugins.md) | Plugin System | 1, 2 | PluginManager, header + iframe built-ins | ~7 |
| [4](phase-04-navigation.md) | Navigation & Input | 2 | CommandSystem, KeyBindings, TouchInput, Terminal | ~10 |
| [5](phase-05-sync.md) | Synchronization | 2 | SyncManager, WhiteboardSync, y-websocket server | ~8 |
| [6](phase-06-rich-components.md) | Rich Components | 3, 5 | Chart, Video, Whiteboard components + plugins | ~8 |
| [7](phase-07-speaker-view.md) | Speaker View | 2, 5 | `<geek-speaker-view>`, SpeakerTimer, two-tab model | ~5 |
| [8](phase-08-print.md) | Print & PDF | 1, 3 | PrintRenderer, 3 templates, print.css | ~6 |
| [9](phase-09-cli.md) | CLI Tooling | 8, 5 | @geekslides/cli: dev, build, pdf, create commands | ~7 |
| [10](phase-10-hmr.md) | HMR & Live Preview | 9 | Vite HMR plugin, slide-preserving reload | ~3 |
| [11](phase-11-deployment.md) | Deployment | 9 | Docker, Compose, Caddyfile, env config | ~5 |
| [12](phase-12-e2e.md) | E2E Tests & Polish | all | Playwright suites, CI, demo migration | ~8 |
| [13](phase-13-terminal-config.md) | Terminal Config | 2, 5, 9 | `load <url>`, `room <name>` terminal commands | ~4 |
| [14](phase-14-cli-docker.md) | CLI Docker Image | 9, 11 | Dockerfile.cli, wrapper script, how-to guide | ~5 |
| [15](phase-15-ux-enhancements.md) | UX Enhancements | 14 | Progress bar, shortcuts overlay, ARIA, sync indicator, overview grid | ~10 |
| [16](phase-16-toolbar-mermaid-touch.md) | Toolbar, Mermaid & Touch | 15 | Toolbar component, mermaid processor, touch zone tuning, lint fixes | ~7 |
| [17](phase-17-logging.md) | Structured Logging | all | pino loggers in engine/server/cli, namespace-scoped debug control | ~4 |
| [18](phase-18-error-management.md) | Error Management & Diagnostics | 17 | Error response format, detailed error codes, user-facing hints, troubleshooting guide | ~6 |

## Principles

- **Each phase produces a working, testable increment.** Phase 2 renders slides from
  markdown. Phase 4 adds keyboard/touch navigation. Phase 5 adds sync. No dead code waiting
  for later phases.
- **Tests are written alongside code, not deferred.** Every phase includes its unit and
  integration tests. E2E tests (Phase 12) are the only tests that span the full system.
- **Phases can overlap where dependencies allow.** Phases 3, 4, and 5 are independent of
  each other (all depend on 2) and can be developed in parallel. Same for 10 and 11.
- **v1 feature parity is complete at Phase 7.** Phases 8–12 add capabilities that exceed v1.

## Architecture Reference

All decisions and specifications are in the sibling docs:

- [decisions.md](../decisions.md) — 21 architectural decisions
- [architecture-v2.md](../architecture-v2.md) — system diagrams, package structure
- [toolchain.md](../toolchain.md) — Vite, TypeScript, npm workspaces
- [components.md](../components.md) — Web Components, Shadow DOM, mobile
- [sync.md](../sync.md) — Yjs CRDT synchronization
- [plugin-system.md](../plugin-system.md) — preprocessor/processor pipeline
- [command-system.md](../command-system.md) — direct keys + terminal prompt (`t`)
- [speaker-notes.md](../speaker-notes.md) — separate speaker view
- [css-scaling.md](../css-scaling.md) — transform:scale() technique
- [testing.md](../testing.md) — Vitest + Playwright strategy
- [print.md](../print.md) — browser-backed PDF export, print templates, CLI integration
- [deployment-v2.md](../deployment-v2.md) — Docker, Caddy

## Current Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0–10 | Implemented | Core engine, parser, rendering, plugins, navigation, sync, rich components, speaker view, print, CLI, HMR |
| 11 | In progress | Deployment stack is implemented with a combined Caddy + server runtime image; remaining work is operational smoke testing and quick-start polish |
| 12 | Implemented | Playwright E2E suite is in place and passing in local dev |
| 13 | Implemented | `load` and `room` runtime commands are implemented, documented, and explicitly covered by Playwright |
| 14 | In progress | CLI Docker image builds (slim + chromium); wrapper/create/build/pdf are validated, but `dev` currently fails in-container with `EADDRINUSE` on `127.0.0.1:1234` |
| 15 | Implemented | Progress bar, shortcuts overlay, ARIA, sync indicator, overview grid |
| 16 | Implemented | Toolbar, mermaid processor, touch zone tuning |
| 17 | Implemented | Pino-based logging shipped in engine, server, and CLI with configurable namespace levels and unit coverage |
| 18 | 🔴 Not started | Enhanced error messages and diagnostics |

## Future Improvements

- **Upgrade `y-websocket` to v3.x** — v3 drops the deprecated Level ecosystem (`y-leveldb`, `levelup`, `level-js`, etc.), eliminating ~9 `npm ci` deprecation warnings. However, v3 removes the server-side `setupWSConnection` API that `@geekslides/server` relies on (`y-websocket/bin/utils`). Migration requires rewriting the server's WebSocket handler to use the Yjs primitives directly (or adopting a separate server package like `@hocuspocus/server`).
