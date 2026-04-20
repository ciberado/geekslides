# Phase 17 — Structured Logging

**Status**: 🔴 Not started
**Feature doc**: [logging.md](../logging.md)

## Goal

Add structured, leveled logging with pino to all three packages, replacing
ad-hoc `console.*` calls with namespace-scoped loggers that can be configured
per-namespace via environment variables (Node.js) or localStorage (browser).

## Tasks

### 17.1 — Dependencies

- [ ] Add `pino` to `@geekslides/engine`, `@geekslides/server`, `@geekslides/cli`
- [ ] Add `pino-pretty` to `@geekslides/server` and `@geekslides/cli`

### 17.2 — Logger Factory Modules

- [ ] `packages/engine/src/logging.ts` — browser logger (pino/browser)
  - Reads global level from `?log=` URL param or `localStorage.geekslides_log`
  - Reads per-namespace from `localStorage.geekslides_log_ns`
  - Default level: `warn`
  - Exports `createLogger(namespace: string): pino.Logger`

- [ ] `packages/server/src/logging.ts` — Node.js logger (pino)
  - Reads from `GEEKSLIDES_LOG` env var (format: `level[,ns:level]*`)
  - Reads format from `GEEKSLIDES_LOG_FORMAT` (`pretty` | `json`, default `pretty`)
  - Default level: `info`
  - Exports `createLogger(namespace: string): pino.Logger`

- [ ] `packages/cli/src/logging.ts` — Node.js logger (pino)
  - Same env-var convention as server
  - Writes to **stderr** so stdout is reserved for user-facing CLI output
  - Default level: `info`
  - Exports `createLogger(namespace: string): pino.Logger`

### 17.3 — Instrument Engine (browser)

| File | Namespace | Traces |
|------|-----------|--------|
| `SlideParser.ts` | `parser` | debug: parsed N slides; warn: duplicate ID |
| `Config.ts` | `config` | debug: loaded config |
| `Slideshow.ts` | `slideshow` | debug: navigation, mode change |
| `CommandSystem.ts` | `commands` | debug: command executed; warn: unknown command |
| `PluginManager.ts` | `plugins` | debug: registered plugin, preprocessor/processor run |
| `SyncManager.ts` | `sync` | info: connected/disconnected; debug: state published; trace: remote update |
| `WhiteboardSync.ts` | `sync` | debug: stroke synced |
| `DeckUploader.ts` | `upload` | info: upload complete; warn: file skipped/failed |
| `hot-client.ts` | `hmr` | debug: HMR update received |
| `mermaid-processor.ts` | `mermaid` | warn: render failed |
| `local-plugin.ts` | `plugins` | debug: plugin loaded from URL |

### 17.4 — Instrument Server (Node.js)

| File | Namespace | Traces |
|------|-----------|--------|
| `index.ts` | `ws` | info: server start, connection accepted; warn: rate limited, rejected |
| `ContentApi.ts` | `content` | info: upload received; debug: file served; warn: 404 |
| `RoomApi.ts` | `rooms` | info: room created; debug: auth check |
| `RoomStore.ts` | `rooms` | debug: token generated/validated |
| `RateLimiter.ts` | `ratelimit` | warn: client rate-limited; debug: failure recorded |
| `PluginProxy.ts` | `plugins` | info: proxy fetch; warn: blocked protocol, oversized |

### 17.5 — Instrument CLI (Node.js)

CLI user-facing output (`console.log`) stays as-is. Only add structured
debug/trace logging for internal diagnostics.

| File | Namespace | Traces |
|------|-----------|--------|
| `dev.ts` | `dev` | debug: Vite config resolved, ws server started |
| `build.ts` | `build` | debug: files copied, config patched |
| `pdf.ts` | `pdf` | debug: Chromium launched, pages rendered |
| `create.ts` | `create` | debug: scaffold written |
| `pdf-capture.ts` | `pdf` | debug: slide captured |

### 17.6 — Validation

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (80 % coverage maintained)
- [ ] Manual: set `GEEKSLIDES_LOG=debug` and verify server output
- [ ] Manual: set `localStorage.geekslides_log = 'debug'` and verify browser console
- [ ] Manual: set `GEEKSLIDES_LOG_FORMAT=json` and verify JSON output

## Non-Goals

- Remote log aggregation / shipping (use Docker log drivers)
- Request-id correlation (add later when needed)
- Log rotation (handled by container runtime)
