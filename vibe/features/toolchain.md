# Toolchain & Monorepo Structure

## Build Tool: Vite

### Why Vite over Parcel (v1)

| Aspect | Parcel (v1) | Vite (v2) |
|--------|-------------|-----------|
| Dev server startup | Bundles everything first | Native ESM, near-instant |
| HMR speed | Full page reload on many changes | Granular module replacement |
| Config | Zero-config (but limited control) | Minimal config with full escape hatches |
| TypeScript | Via plugin, slow type-stripping | Native esbuild transform (fast, no type-check) |
| CSS handling | Built-in but limited | PostCSS, CSS modules, preprocessors |
| Build output | Custom bundler | Rollup under the hood (proven, tree-shaking) |
| Ecosystem | Declining adoption | Dominant, active maintenance |

### Vite Configuration

The root `vite.config.ts` sets the engine package as the build entry, outputs a single ES module library named `GeekSlides`, and externalizes `yjs`, `y-websocket`, and `chart.js` so they are not bundled into the library output. The dev server proxies `/ws` requests to the local yjs-server at `ws://localhost:1234` and loads the custom HMR plugin.

### Custom HMR Plugin

A Vite plugin (`vite-plugin-geekslides-hmr.ts`) intercepts hot-update events for `.md` and `.json` files. Instead of triggering a full page reload, it sends a custom WebSocket event (`geekslides:content-update`) to the browser with the changed file path. On the client side, the engine subscribes to this custom event via `import.meta.hot` and dispatches a `geek:hmr:update` CustomEvent on the document, which the slideshow controller listens for to re-fetch and re-render content while preserving the current slide position.

## TypeScript Configuration

### Strict Mode

The root `tsconfig.json` targets ES2022 with ESNext modules and bundler module resolution. It enables full strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` for maximum type safety. The DOM and DOM.Iterable libs are included. Source maps and declaration maps are generated for debugging.

### Per-package tsconfig

Each package extends the root config. The engine package includes its `src/` directory with DOM libs. The server package also extends root but omits DOM libs (only `ES2022`) since it runs in Node.js. The CLI package references both engine and server as TypeScript project references.

## npm Workspaces

### Root package.json

The root `package.json` is a private workspace configuration with `"workspaces": ["packages/*"]`. The top-level scripts delegate to workspaces: `dev` runs the engine dev server, `build` and `test` run across all workspaces, `test:e2e` invokes Playwright, `lint` runs ESLint on all package sources, and `typecheck` runs `tsc --build`. Dev dependencies include TypeScript 5.x, Vite 6.x, Vitest 3.x, Playwright, and ESLint 9.x.

### Package Dependencies

- **@geekslides/engine** (browser): depends on `markdown-it` (markdown→HTML), `yjs` (CRDT shared types), `y-websocket` (WebSocket provider client), and `chart.js` (table→chart rendering).
- **@geekslides/server** (Node.js): depends on `yjs`, `y-websocket` (server), and `ws` (WebSocket implementation).
- **@geekslides/cli** (Node.js): depends on `@geekslides/engine` (for build/render), `vite` (dev server API), `sharp` (image optimization), and `commander` (CLI argument parsing).

### Inter-package References

- `@geekslides/cli` depends on `@geekslides/engine` (for SSR/print rendering) and `@geekslides/server` (for the dev command).
- `@geekslides/engine` and `@geekslides/server` are independent of each other.

## Development Workflow

### Local Development

- `npm install` — installs all workspace dependencies.
- `npm run dev` — starts the Vite dev server on `http://localhost:5173` and the yjs-server on `ws://localhost:1234`. HMR watches `.md`, `.css`, and `.json` files.
- `npm test` — runs all unit tests via Vitest.
- `npm run test:e2e` — runs Playwright E2E tests.
- `npm run typecheck` — type-checks all packages with `tsc --build`.
- `npm run build` — creates the production bundle.

### Package Development

Individual packages can be targeted using npm workspace flags:

- `npm run dev -w @geekslides/engine` — work on the engine only.
- `npm test -w @geekslides/server` — test the server only.
- `npm install chart.js -w @geekslides/engine` — add a dependency to a specific package.

## Linting & Formatting

The project uses ESLint 9 flat config (`eslint.config.js`) with `typescript-eslint`'s `strictTypeChecked` preset. Project-aware type information is enabled via `parserOptions.projectService`. Two additional rules are enforced: `@typescript-eslint/explicit-module-boundary-types` (error — all public API functions must have explicit return types) and `@typescript-eslint/no-explicit-any` (error — no `any` types anywhere).
