# Logging

## Overview

Structured logging across all three packages using [pino](https://getpino.io/),
the fastest JSON logger for Node.js — with a lightweight browser build for the
engine.

Goals:
1. **Observability** — trace request flows, sync events, plugin execution, and
   component lifecycle with structured fields.
2. **Per-namespace granularity** — each module gets its own child logger whose
   level can be overridden independently.
3. **Dual output format** — human-readable by default in development; switch to
   structured JSON in production via an environment variable.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  @geekslides/engine  (browser)                           │
│  ┌─────────────┐                                         │
│  │ pino/browser │──► console.debug / warn / error / …    │
│  └─────────────┘                                         │
│  Configured via: localStorage.geekslides_log             │
│                  ?log=debug URL param                     │
│  Namespaces: parser, config, slideshow, sync, plugins,   │
│              commands, whiteboard, hmr, print, upload     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  @geekslides/server  (Node.js)                           │
│  ┌──────────────┐                                        │
│  │ pino          │──► stdout (JSON or pretty)            │
│  └──────────────┘                                        │
│  Configured via: GEEKSLIDES_LOG env var                   │
│                  GEEKSLIDES_LOG_FORMAT env var            │
│  Namespaces: ws, http, content, rooms, ratelimit,        │
│              plugins                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  @geekslides/cli  (Node.js)                              │
│  ┌──────────────┐                                        │
│  │ pino          │──► stderr (JSON or pretty)            │
│  └──────────────┘                                        │
│  User-facing output stays on console.log (stdout)        │
│  Configured via: GEEKSLIDES_LOG env var                   │
│                  GEEKSLIDES_LOG_FORMAT env var            │
│  Namespaces: dev, build, pdf, create, imageopt           │
└──────────────────────────────────────────────────────────┘
```

## Log Levels

pino levels, from most to least verbose:

| Level   | Value | Usage                                                     |
|---------|-------|-----------------------------------------------------------|
| `trace` | 10    | Very granular: individual strokes, parse tokens, bytes    |
| `debug` | 20    | Flow milestones: "connected to room X", "plugin Y loaded" |
| `info`  | 30    | High-level events: server start, PDF export complete      |
| `warn`  | 40    | Recoverable issues: duplicate slide ID, fetch retry       |
| `error` | 50    | Failures: connection refused, missing config              |
| `fatal` | 60    | Unrecoverable: process about to crash                     |
| `silent`| ∞     | All logging suppressed                                    |

Default level: **`info`** for server and CLI, **`warn`** for browser engine.

## Configuration

### Environment Variables (Node.js — server & CLI)

```bash
# Global level
GEEKSLIDES_LOG=debug

# Per-namespace (comma-separated, global level first)
GEEKSLIDES_LOG=info,ws:debug,content:trace

# Output format: 'pretty' (default) or 'json'
GEEKSLIDES_LOG_FORMAT=json
```

### Browser (engine)

```js
// Set global level via localStorage
localStorage.setItem('geekslides_log', 'debug');

// Per-namespace overrides
localStorage.setItem('geekslides_log_ns', 'sync:debug,parser:trace');

// Or via URL search parameter (takes precedence)
// https://localhost:5173/?log=debug
```

### Per-namespace Override Syntax

```
<global-level>[,<namespace>:<level>]*
```

Examples:
- `info` — everything at info or above
- `info,ws:debug` — info globally, debug for the `ws` namespace
- `warn,sync:trace,parser:debug` — warn globally, with overrides

## Module Logger Pattern

Each source file creates a child logger for its namespace:

```ts
// packages/engine/src/core/SlideParser.ts
import { createLogger } from '../logging.ts';
const log = createLogger('parser');

log.debug({ slideCount: slides.length }, 'parsed slides');
log.warn({ id: slide.id }, 'duplicate slide ID');
```

```ts
// packages/server/src/index.ts
import { createLogger } from './logging.ts';
const log = createLogger('ws');

log.info({ room, role, clientIp }, 'ws connection accepted');
log.warn({ clientIp }, 'rate limited');
```

## Logger Factory

Each package has a `logging.ts` module exporting `createLogger(namespace)`.

- **Engine**: uses `pino({ browser: { ... } })`. Reads level from
  `localStorage` / URL params. Child loggers add `{ ns: '<namespace>' }`.
- **Server / CLI**: uses `pino()` with optional `pino-pretty` transport.
  Reads level from `GEEKSLIDES_LOG`. Writes to stdout (server) / stderr (CLI).

## Docker / Production

```dockerfile
ENV GEEKSLIDES_LOG=info
ENV GEEKSLIDES_LOG_FORMAT=json
```

JSON output is CloudWatch / Datadog / ELK compatible out of the box.

## What Is NOT Logged

- CLI user-facing messages (`console.log`) — these are UX, not diagnostics
- Sensitive data: tokens, passwords, file contents
- High-frequency browser rendering (requestAnimationFrame loops)
