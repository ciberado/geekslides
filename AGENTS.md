# Project Guidelines

## Overview

GeekSlides v2 is a markdown-first presentation system built with TypeScript, Web Components, and real-time Yjs sync. Three npm workspace packages: `@geekslides/engine` (browser), `@geekslides/server` (Node.js), `@geekslides/cli` (Node.js). See `vibe/features/` for detailed architecture docs.

## Code Style

- **TypeScript 5.7**, strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- **ESLint 9** flat config with `typescript-eslint` strictTypeChecked preset
- `@typescript-eslint/explicit-module-boundary-types`: error — all exported functions need explicit return types
- `@typescript-eslint/no-explicit-any`: error — no `any`, use `unknown` and narrow
- **ESM-only** (`"type": "module"` in package.json)
- Target: ES2022, module resolution: bundler

## Architecture

```
packages/
  engine/   → Browser: markdown parsing, Web Components, plugins, sync client
  server/   → Node.js: y-websocket server, content proxy API
  cli/      → Node.js: `geekslides` binary (dev server, PDF export, image optimization)
```

- Web Components use Shadow DOM (`<geek-slideshow>`, `<geek-slide>`, `<geek-terminal>`, `<geek-whiteboard>`, `<geek-speaker-view>`)
- Plugin system: preprocessors (string → string) and processors (HTMLElement → void)
- Sync via Yjs CRDTs over y-websocket (room-based)
- Print renders flat HTML (no Shadow DOM) for Playwright PDF export

Key design docs: [architecture-v2.md](vibe/features/architecture-v2.md), [plugin-system.md](vibe/features/plugin-system.md), [sync.md](vibe/features/sync.md)

## Build and Test

```bash
npm ci                  # Install all workspace dependencies
npm run typecheck       # tsc --build (all packages)
npm run lint            # ESLint check
npm test                # Vitest unit + integration tests (80% coverage threshold)
npm run test:e2e        # Playwright e2e — always use this, not bare `npx playwright test`
                        # The npm script passes --config=e2e/playwright.config.ts which is
                        # required: bare `npx playwright test` won't find the config and all
                        # tests fail with ERR_CONNECTION_REFUSED (no dev server started).
                        # To run a single spec: npx playwright test --config e2e/playwright.config.ts e2e/layouts.spec.ts
npm run dev             # Vite + yjs-server on 0.0.0.0
npm run dev --workspace=@geekslides/hub  # Hub Fastify + Lit SPA (dev-mode login, no OAuth needed)
npm run build           # Build all packages
npm run build:smoke --workspace=@geekslides/hub  # Bundle smoke test: starts the built hub server and
                        # exercises PPTX import end-to-end. Run this after any hub server build to
                        # catch runtime failures that only appear in the bundle (e.g. dependencies
                        # that load assets from disk via __dirname — these MUST be --external in esbuild).
                        # Current hub esbuild externals: better-sqlite3, pino, pino-pretty,
                        # thread-stream, jsdom.  Add any new dependency that uses readFileSync with
                        # relative paths at runtime.
npm run docker:build    # Build all Docker images (main, server, cli, cli:chromium)
npm run docker:push     # Push all Docker images to Docker Hub
```

## Testing Conventions

- **Unit tests**: Vitest, pure logic — `packages/engine/tests/unit/`, `packages/server/tests/`, `packages/hub/tests/unit/`
- **Integration tests**: Vitest browser mode — `packages/engine/tests/integration/`
- **E2E tests**: Playwright with Chromium/Firefox/WebKit — `e2e/`, `packages/hub/e2e/`
- New logic needs corresponding tests. Coverage thresholds: 80% branches/functions/lines/statements
- E2E fixtures live in `e2e/fixtures/`

## Conventions

- **Slide markers** in README.md: empty links `[](#id)` or `[](.class#id,bgurl(img.jpg),bgcolor(#fff))`
- **Speaker notes**: `::: Notes` container blocks in markdown
- **Deck config**: `config.json` at deck root with `title`, `content`, `styles`, `aspectRatio`, `plugins`
- **Commands**: registered via `commands.register({ name, label, execute, category })`, two input modes: NORMAL (hotkeys) and TERMINAL (prompt)
- **Docker**: single-container with Caddy reverse proxy; 3-stage build (app-builder, server-builder, runtime)
- **How-to guides**: numbered `how-to/NN-slug.md` files — use the `how-to-guide` skill when creating or updating
- **Version bumps**: when bumping any package version, update **all** `packages/*/package.json` files to the same version AND add a new entry to `CHANGELOG.md` following the Keep a Changelog format (`## [X.Y.Z] - YYYY-MM-DD`)

## Documentation

- `how-to/` — User-facing guides (install, create, present, deploy, export, style, plugins)
- `vibe/features/` — Architecture decisions and feature design docs
- Use the `pre-commit-checklist` skill before committing to ensure tests pass and docs stay current
