# Phase 17 — Structured Logging

**Status**: Implemented (logger factories and core instrumentation shipped; a few original example hooks were folded into adjacent modules)
**Feature doc**: [logging.md](../logging.md)

## Goal

Add structured, leveled logging with pino to all three packages, replacing
ad-hoc `console.*` calls with namespace-scoped loggers that can be configured
per-namespace via environment variables (Node.js) or localStorage (browser).

## Tasks

### 17.1 — Dependencies

- [x] Add `pino` to `@geekslides/engine`, `@geekslides/server`, `@geekslides/cli`
- [x] Add `pino-pretty` to `@geekslides/server` and `@geekslides/cli`

### 17.2 — Logger Factory Modules

- [x] `packages/engine/src/logging.ts` — browser logger (pino/browser)
  - Reads global level from `?log=` URL param or `localStorage.geekslides_log`
  - Reads per-namespace from `localStorage.geekslides_log_ns`
  - Default level: `warn`
  - Exports `createLogger(namespace: string): pino.Logger`

- [x] `packages/server/src/logging.ts` — Node.js logger (pino)
  - Reads from `GEEKSLIDES_LOG` env var (format: `level[,ns:level]*`)
  - Reads format from `GEEKSLIDES_LOG_FORMAT` (`pretty` | `json`, default `pretty`)
  - Default level: `info`
  - Exports `createLogger(namespace: string): pino.Logger`

- [x] `packages/cli/src/logging.ts` — Node.js logger (pino)
  - Same env-var convention as server
  - Writes to **stderr** so stdout is reserved for user-facing CLI output
  - Default level: `info`
  - Exports `createLogger(namespace: string): pino.Logger`

### 17.3 — Instrument Engine (browser)

| File | Namespace | Notes |
|------|-----------|-------|
| `SlideParser.ts` | `parser` | Parser diagnostics are logged here |
| `Config.ts` | `config` | Config loading and deck resolution diagnostics |
| `CommandSystem.ts` | `commands` | Command execution and invalid input logging |
| `PluginManager.ts` | `plugins` | Plugin registration and execution logging |
| `SyncManager.ts` | `sync` | Sync lifecycle and state-publish logging |
| `DeckUploader.ts` | `upload` | Upload progress and failure logging |
| `hot-client.ts` | `hmr` | HMR event logging |
| `mermaid-processor.ts` | `mermaid` | Mermaid render warnings |
| `feature-loader.ts` | `feature-loader` | Dynamic feature loading diagnostics |
| `FeatureManager.ts` | `features` | Feature activation and lifecycle logging |

### 17.4 — Instrument Server (Node.js)

| File | Namespace | Notes |
|------|-----------|-------|
| `index.ts` | `ws`, `http` | Server startup, WebSocket, and request logging |
| `ContentApi.ts` | `content` | Upload, serve, and cleanup diagnostics |
| `RoomApi.ts` | `rooms` | Room creation and auth diagnostics |
| `PluginProxy.ts` | `plugins` | Plugin proxy fetch and blocking diagnostics |
| `DeckProxy.ts` | `deck-proxy` | Deck proxy success, block, and fetch-failure logging |

### 17.5 — Instrument CLI (Node.js)

CLI user-facing output (`console.log`) stays as-is. Only add structured
debug/trace logging for internal diagnostics.

| File | Namespace | Notes |
|------|-----------|-------|
| `dev.ts` | `dev` | Dev server and watcher diagnostics |
| `build.ts` | `build` | Build pipeline diagnostics |
| `pdf.ts` | `pdf` | PDF export diagnostics |
| `create.ts` | `create` | Scaffold generation diagnostics |
| `pdf-capture.ts` | `pdf` | Headless capture diagnostics |

### 17.6 — Validation

- [x] Logger configuration parsing is covered by unit tests in engine, server, and CLI packages
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (80 % coverage maintained)
- [ ] Manual: set `GEEKSLIDES_LOG=debug` and verify server output
- [ ] Manual: set `localStorage.geekslides_log = 'debug'` and verify browser console
- [ ] Manual: set `GEEKSLIDES_LOG_FORMAT=json` and verify JSON output

## Review Notes

- The logger factory modules are implemented in all three packages and use the phase's planned configuration surface.
- Instrumentation coverage is real, but it does not match the original checklist one-for-one. Some planned hooks were consolidated into `FeatureManager`, `feature-loader`, `DeckProxy`, and `http` request logging instead of the originally listed modules.
- `WhiteboardSync.ts`, `RoomStore.ts`, and `RateLimiter.ts` are not individually instrumented today, so this document now reflects shipped coverage rather than the earlier aspirational table.

## Non-Goals

- Remote log aggregation / shipping (use Docker log drivers)
- Request-id correlation (add later when needed)
- Log rotation (handled by container runtime)
