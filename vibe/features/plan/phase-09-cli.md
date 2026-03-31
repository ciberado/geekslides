# Phase 9: CLI Tooling

**Status**: Not started
**Depends on**: Phase 5 (server for `dev` command), Phase 8 (PrintRenderer for `pdf` command)
**Unlocks**: Phase 10 (HMR plugin), Phase 11 (Docker uses build output)

## Goal

Implement the `@geekslides/cli` package with four commands: `dev` (start Vite +
yjs-server), `build` (production bundle), `pdf` (invoke WeasyPrint), and `create`
(scaffold a new presentation repo). Also port the image optimizer from v1's tool.

At the end of this phase, `npx geekslides dev` starts a full development environment,
`npx geekslides build` produces a deployable static bundle, and
`npx geekslides pdf --format slides-notes` generates a PDF.

## Deliverables

### 1. CLI entry point (`packages/cli/src/index.ts`)

Uses `commander` to define the CLI program `geekslides` with four sub-commands.
Sets up global options: `--config <path>` (default `config.json`),
`--content <path>` (override content URL).

### 2. `dev` command (`packages/cli/src/commands/dev.ts`)

Starts the full local development environment:
1. Starts the Vite dev server (using Vite's Node API `createServer()`) on port 5173.
2. Starts the y-websocket server (from `@geekslides/server`) on port 1234.
3. Configures Vite to proxy `/ws` to the yjs server.
4. Loads and validates `config.json` using the engine's `Config` module.
5. Prints URLs for presentation view and speaker view.

Options: `--port <n>` (Vite port), `--ws-port <n>` (yjs port), `--no-sync` (skip
yjs server), `--open` (open browser automatically).

### 3. `build` command (`packages/cli/src/commands/build.ts`)

Produces a production static bundle:
1. Runs Vite build (via Node API `build()`).
2. Copies `config.json`, content markdown, images, and CSS from the presentation
   directory into the `dist/` output.
3. Generates an `index.html` that loads the built engine bundle and the presentation.

Options: `--outDir <path>` (default `dist/`), `--base <url>` (Vite base path).

### 4. `pdf` command (`packages/cli/src/commands/pdf.ts`)

Generates PDF via WeasyPrint:
1. Loads config and markdown.
2. Runs the engine's preprocessing pipeline (PluginManager).
3. Parses markdown into `SlideData[]`.
4. Calls `PrintRenderer.render()` with the specified template.
5. Writes the HTML to a temp file.
6. Invokes WeasyPrint as a child process: `weasyprint <input.html> <output.pdf>`.
7. Cleans up the temp file.

Options: `--format <slides|slides-notes|book>` (default `slides`),
`--output <path>` (default based on format name), `--no-cleanup` (keep temp HTML).

Error handling: If `weasyprint` is not found on PATH, prints a helpful message
with install instructions for the user's platform.

### 5. `create` command (`packages/cli/src/commands/create.ts`)

Scaffolds a new presentation repository:
1. Creates the target directory.
2. Generates a `config.json` with defaults and the provided title.
3. Creates a starter `README.md` with a title slide and two content slides.
4. Creates a `local.css` with the CSS custom property overrides template.
5. Creates an `images/` directory with a `.gitkeep`.
6. Optionally runs `git init`.

Options: `--title <string>` (required), `--dir <path>` (default: slugified title),
`--git` (init git repo, default true).

### 6. Image optimizer (`packages/cli/src/imageoptimizer.ts`)

Port of v1's `tools/imageoptimizer/index.js` to TypeScript. Uses `sharp` to resize
and optimize images based on a JSON manifest. Consumed by the `build` command for
production image optimization.

### 7. Package configuration

`packages/cli/package.json`:
- `"bin": { "geekslides": "./dist/index.js" }`.
- Dependencies: `commander`, `vite`, `sharp`, `@geekslides/engine`, `@geekslides/server`.
- Build script compiles TypeScript to `dist/`.

### 8. Tests

**`packages/cli/tests/cli.test.ts`**:
- `create` command generates correct file structure.
- `build` command produces `dist/` with expected files.
- `pdf` command with `--format slides` invokes PrintRenderer with correct template.
- `dev` command starts servers on specified ports (integration test, short-lived).

## File List

```
packages/cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── dev.ts
│   │   ├── build.ts
│   │   ├── pdf.ts
│   │   └── create.ts
│   └── imageoptimizer.ts
└── tests/
    └── cli.test.ts
```

## Acceptance Criteria

- [ ] `npx geekslides dev` starts Vite + yjs-server and serves a presentation.
- [ ] `npx geekslides build` produces a self-contained `dist/` directory.
- [ ] `npx geekslides pdf --format slides-notes` generates a PDF (with WeasyPrint installed).
- [ ] `npx geekslides create --title "My Talk"` scaffolds a valid presentation repo.
- [ ] Image optimizer processes images from a JSON manifest.
- [ ] `--help` on all commands shows usage information.
- [ ] All CLI tests pass.

## Reference Docs

- [toolchain.md](../toolchain.md) — npm workspace scripts, package dependency graph
- [print.md](../print.md) — WeasyPrint invocation for PDF command
- [deployment-v2.md](../deployment-v2.md) — build output used by Docker
