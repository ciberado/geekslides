# Phase 0: Project Foundation

**Status**: Not started
**Depends on**: —
**Unlocks**: All subsequent phases

## Goal

Scaffold the npm workspaces monorepo with TypeScript strict mode, Vite build config,
ESLint 9 flat config, and Vitest + Playwright test infrastructure. At the end of this
phase, `npm install`, `npm run typecheck`, `npm test`, and `npm run lint` all work
on an empty project that compiles and passes zero tests.

## Deliverables

### 1. Root workspace scaffolding

Create the top-level `package.json` with `"private": true` and
`"workspaces": ["packages/*"]`. Define root scripts: `dev`, `build`, `test`,
`test:e2e`, `lint`, `typecheck`. Install all shared dev dependencies at the root:
TypeScript 5.x, Vite 6.x, Vitest 3.x, `@playwright/test`, ESLint 9.x,
`typescript-eslint`, `@vitest/coverage-v8`.

### 2. Package skeletons

Create three packages with their own `package.json`:

- **`packages/engine/`** — `@geekslides/engine`. Browser library. Dependencies:
  `markdown-it`, `yjs`, `y-websocket`, `chart.js`. Entry point: `src/index.ts`
  (empty barrel export). Includes `tsconfig.json` extending root.

- **`packages/server/`** — `@geekslides/server`. Node.js process. Dependencies:
  `yjs`, `y-websocket`, `ws`. Entry point: `src/index.ts` (placeholder). Own
  `tsconfig.json` without DOM libs.

- **`packages/cli/`** — `@geekslides/cli`. Node.js CLI. Dependencies: `commander`,
  `vite`, `sharp`. References engine and server as workspace dependencies. Own
  `tsconfig.json` with project references to engine and server.

### 3. TypeScript configuration

Root `tsconfig.json`: target ES2022, module ESNext, moduleResolution bundler,
strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, DOM +
DOM.Iterable libs, composite mode, source maps and declaration maps.

Per-package configs extend root and narrow `include` paths.

### 4. Vite configuration

Root `vite.config.ts`:
- Library mode building `@geekslides/engine` from `packages/engine/src/index.ts`.
- Output: ES module, global name `GeekSlides`.
- Externalize `yjs`, `y-websocket`, `chart.js`.
- Dev server on port 5173 proxying `/ws` to `ws://localhost:1234`.
- Resolve alias `@geekslides/engine` to the source for dev (no pre-build needed).

### 5. ESLint configuration

`eslint.config.js` (flat config format):
- `typescript-eslint` `strictTypeChecked` preset.
- `parserOptions.projectService` for type-aware linting.
- `@typescript-eslint/explicit-module-boundary-types`: error.
- `@typescript-eslint/no-explicit-any`: error.

### 6. Vitest configuration

`vitest.config.ts`:
- Default environment: Node (for unit tests).
- Include: `packages/*/tests/**/*.test.ts`.
- Coverage: v8 provider, 80% threshold for branches/functions/lines/statements.
- Exclude `node_modules`, `dist`, `e2e`.

`vitest.config.browser.ts` (for future integration tests):
- Browser mode with Playwright Chromium.
- Include: `packages/engine/tests/integration/**/*.test.ts`.

### 7. Playwright skeleton

`e2e/playwright.config.ts`:
- Projects: Desktop Chrome, Desktop Firefox, Desktop Safari, iPhone 14.
- `webServer`: start `npm run dev`, port 5173, reuse in non-CI.
- Empty test files as placeholders for future E2E suites.

### 8. Directory structure

```
geekslides/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── vitest.config.browser.ts
├── eslint.config.js
├── packages/
│   ├── engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── tests/
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   └── index.ts
│       └── tests/
├── e2e/
│   └── playwright.config.ts
└── docker/         (empty, for Phase 11)
```

## Acceptance Criteria

- [ ] `npm install` succeeds with all three packages linked.
- [ ] `npm run typecheck` passes (tsc --build, zero errors).
- [ ] `npm test` runs Vitest and reports 0 tests, 0 failures.
- [ ] `npm run lint` passes with no warnings.
- [ ] Each package's `index.ts` exports at least one placeholder type or const.
- [ ] `npx vite` starts the dev server on port 5173 without errors.
- [ ] Git: clean commit with `.gitignore` covering `node_modules/`, `dist/`, `coverage/`.

## Reference Docs

- [toolchain.md](../toolchain.md) — full Vite, TypeScript, ESLint, npm workspace specs
- [testing.md](../testing.md) — Vitest + Playwright config details
- [architecture-v2.md](../architecture-v2.md) — package structure diagram
