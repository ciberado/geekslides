# Phase 18 — Enhanced Error Management & Diagnostics

**Status**: ✅ Complete  
**Depends on**: Phase 17 (Structured Logging)

## Goal

Provide clear, actionable error messages and diagnostic context across the platform.
Users encountering errors should understand:
1. **What went wrong** — specific error description
2. **Why it happened** — root cause or context
3. **How to fix it** — actionable remediation steps or debugging guidance

Replace cryptic HTTP status codes and minimal error objects with helpful, logged diagnostics.

## Motivating Example

Current error:
```
Failed to load config from /api/deck-proxy?url=...: 400
```

Better error:
```
[deck-proxy] 400 Blocked: localhost:8080 is not allowed by proxy security policy.
To load from localhost during development, set DEV_PROXY=true and restart the server.
```

## Tasks

### 18.1 — Error Response Format

Define a standard error response structure across all APIs:

```typescript
interface ErrorResponse {
  code: string;           // e.g., "BLOCKED_HOST", "INVALID_CONFIG"
  message: string;        // Human-readable explanation
  details?: Record<string, unknown>; // Context (URL, file path, etc.)
  hint?: string;          // Actionable fix or debugging step
  timestamp: number;      // ISO 8601 for correlation with logs
}
```

### 18.2 — Server Error Handling (`@geekslides/server`)

#### 18.2.1 — DeckProxy errors
- [ ] Replace bare 400 responses in [packages/server/src/DeckProxy.ts](packages/server/src/DeckProxy.ts) with detailed error codes:
  - `MISSING_URL` → "Missing required url parameter"
  - `INVALID_URL` → "URL format invalid; expected http(s)://..."
  - `BLOCKED_HOST` → "Host blocked for security. To enable localhost, set DEV_PROXY=true"
  - `BLOCKED_PROTOCOL` → "Protocol not allowed; expected http: or https:"
  - `OVERSIZED_RESPONSE` → "Response too large (>50MB)"
  - `UPSTREAM_ERROR` → "Upstream server error (with status code and URL)"

- [ ] Log each error with namespace `deck-proxy` at appropriate level:
  - `info`: successful proxies
  - `warn`: blocked hosts, oversized responses
  - `error`: upstream errors

#### 18.2.2 — Config loading errors
- [ ] [packages/server/src/index.ts](packages/server/src/index.ts) — config parse failures
  - Include file path, line number (if JSON parse error)
  - Suggest valid config format with example

#### 18.2.3 — WebSocket errors
- [ ] Connection failures in [packages/server/src/index.ts](packages/server/src/index.ts)
  - Log auth rejection reasons with context
  - Log room-not-found with suggestion to check room URL

### 18.3 — Engine Error Handling (`@geekslides/engine`)

#### 18.3.1 — Config loading
- [ ] [packages/engine/src/core/Config.ts](packages/engine/src/core/Config.ts)
  - Missing `config.json` → suggest running `geekslides create`
  - Invalid JSON → show parse error line/column
  - Missing required fields → list what's required

#### 18.3.2 — Plugin loading
- [ ] [packages/engine/src/plugins/PluginManager.ts](packages/engine/src/plugins/PluginManager.ts)
  - Plugin not found in registry → list available plugins
  - Preprocessor error → show which line of markdown caused it
  - Processor error → show which slide element caused it

#### 18.3.3 — Sync errors
- [ ] [packages/engine/src/sync/SyncManager.ts](packages/engine/src/sync/SyncManager.ts)
  - Connection failed → check network, try manual reconnect
  - Auth rejected → check token/credentials
  - Room URL malformed → example of valid URL

#### 18.3.4 — Rendering errors
- [ ] [packages/engine/src/rendering/Slideshow.ts](packages/engine/src/rendering/Slideshow.ts)
  - Slide not found → list available slide IDs
  - Navigation failed → log which key/gesture caused it

### 18.4 — CLI Error Handling (`@geekslides/cli`)

#### 18.4.1 — Create command
- [ ] Insufficient permissions → suggest using `sudo` or changing directory
- [ ] Invalid deck name → show naming rules
- [ ] Port already in use → suggest killing process or using different port

#### 18.4.2 — Dev command
- [ ] Config loading fails → show file not found, or parse error
- [ ] Vite build error → show TypeScript/ESLint issues with line numbers
- [ ] Chromium launch fails → suggest installing Chromium or checking PATH

#### 18.4.3 — Build & Export commands
- [ ] Missing output directory permissions → suggest creating or changing permissions
- [ ] PDF export timeout → suggest splitting deck or increasing timeout
- [ ] Image optimization failure → log which file, skip gracefully

### 18.5 — Error Logging Instrumentation

For each module instrumented in Phase 17, add error-level logs with context:

| Module | Error Scenarios |
|--------|-----------------|
| `SlideParser` | Syntax error in fence block, invalid heading syntax |
| `Config` | Missing field, type mismatch, circular includes |
| `PluginManager` | Plugin not registered, preprocessor crashed, processor crashed |
| `SyncManager` | Connection timeout, auth failed, protocol mismatch |
| `CommandSystem` | Unknown command, command execution threw |
| `DeckUploader` | File too large, permission denied, upload interrupted |

### 18.6 — User-Facing Diagnostics

#### 18.6.1 — Browser error overlay
- [ ] Create error banner component (dismissible toast)
- [ ] Show error code, message, hint
- [ ] Include "Open DevTools" and "View Logs" buttons

#### 18.6.2 — CLI error formatting
- [ ] Use color/formatting for error output (red for error, yellow for hint)
- [ ] Show command that failed (for debugging)
- [ ] Append `—verbose` flag usage suggestion

#### 18.6.3 — Docs: Troubleshooting Guide
- [ ] Create `how-to/17-troubleshooting.md`
- [ ] Link common errors to solutions
- [ ] Show how to enable debug logging

### 18.7 — Testing

- [ ] Unit tests for error response formatting
- [ ] E2E tests triggering each major error path
- [ ] Manual: reproduce each error, verify message is clear and actionable
- [ ] Manual: enable `GEEKSLIDES_LOG=debug` during error, verify logs contain context

### 18.8 — Validation

- [ ] `npm run lint` passes (error handling code follows style guide)
- [ ] `npm test` passes (80% coverage on error paths)
- [ ] `npm run test:e2e` passes (error scenarios covered)
- [ ] Documentation updated: troubleshooting guide in `how-to/`

## Non-Goals

- Log aggregation / centralized error tracking
- Sentry or similar third-party error reporting
- Automatic error recovery (passive reporting only)
