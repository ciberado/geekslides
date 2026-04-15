# Phase 9: CLI Tooling

**Status**: Complete — all gaps resolved (see design decisions below)
**Depends on**: Phase 5 (server for `dev` command), Phase 8 (PrintRenderer for `pdf` command)
**Unlocks**: Phase 10 (HMR plugin), Phase 11 (Docker uses build output)

## Goal

Implement the `@geekslides/cli` package with four commands: `dev` (start Vite +
yjs-server), `build` (production bundle), `pdf` (export through Playwright/Chromium), and `create`
(scaffold a new presentation repo). Also port the image optimizer from v1's tool.

At the end of this phase, `npx geekslides dev` starts a full development environment,
`npx geekslides build` produces a deployable static bundle, and
`npx geekslides pdf --format slides-notes` generates a PDF. The packaged `dev`
command can target a deck config outside the GeekSlides repo and still serve the
runtime UI from assets shipped with the CLI package.

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
yjs server), `--open` (open browser automatically). The command may target a deck
config outside the repo by resolving `--config` from the caller's working directory
and serving it through Vite's filesystem access (`/@fs/...`) support. The browser
app is served from `packages/cli/app/` so installed CLI usage does not depend on the
monorepo root layout.

### 3. `build` command (`packages/cli/src/commands/build.ts`)

Produces a production static bundle:
1. Runs Vite build (via Node API `build()`).
2. Copies `config.json`, content markdown, images, and CSS from the presentation
   directory into the `dist/` output.
3. Generates an `index.html` that loads the built engine bundle and the presentation.

Options: `--outDir <path>` (default `dist/`), `--base <url>` (Vite base path).

> ~~**Gap**: The current implementation only runs `vite build`. Steps 2 and 3 are
> not implemented — presentation content (`config.json`, markdown, images, CSS) is
> not copied into `dist/`, making the output non-deployable standalone.~~
> **Fixed**: Build now uses `resolveCliAppRoot()` as Vite root, copies `config.json`, content file, `images/`, and CSS files to `dist/`, and patches `dist/index.html` to default to `?config=config.json`.

### 4. `pdf` command (`packages/cli/src/commands/pdf.ts`)

Generates PDF via Playwright/Chromium:
1. Loads config and markdown.
2. Runs the engine's preprocessing pipeline (PluginManager).
3. Parses markdown into `SlideData[]`.
4. Calls `PrintRenderer.render()` with the specified template.
5. Writes the HTML to a temp file.
6. Launches Chromium through Playwright.
7. Opens the temp HTML with `page.goto(file://...)`.
8. Writes the primary PDF with `page.pdf()`.
9. Unless the selected format is already `slides-details`, also writes a companion `-details.pdf`.
10. Cleans up the temp file.

Options: `--format <slides|slides-notes|slides-details|book>` (default `slides`),
`--output <path>` (default based on format name), `--no-cleanup` (keep temp HTML).

Error handling: If Chromium cannot be launched, prints a helpful message with the
required Playwright browser install command.

> **Design decision — do not change**: The implementation intentionally diverges from
> this spec. Instead of `page.pdf()`, it starts an ephemeral Vite dev server, captures
> each slide (with all partials revealed) as a full-resolution PNG screenshot at 1920×1080,
> and assembles them with `page.pdf()` + assembled HTML to produce image-based PDFs.
>
> This approach was deliberately chosen and validated because:
> - The rendered slide output (fonts, shadows, gradients, background images, CSS transitions)
>   matches the live browser presentation exactly.
> - Chromium's print CSS path (`page.pdf()` via `renderPrint`) produces a completely
>   different visual result: author CSS written for a 1920px viewport does not translate
>   cleanly to print @page dimensions, layout breaks, and the output looks nothing like
>   the actual presentation slides.
>
> **Do not attempt to replace the screenshot pipeline with `renderPrint()` / `page.pdf()`
> directly.** The image-based output is the correct, intentional behaviour.

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

> ~~**Gap**: `packages/cli/src/imageoptimizer.ts` has not been implemented. The file
> does not exist. See `archived/v1/tools/imageoptimizer/index.js` for the reference
> implementation to port.~~
> **Fixed**: Implemented in `packages/cli/src/imageoptimizer.ts`. Exports `optimizeImage`, `optimizeImages`, `optimizeImagesFromManifest`, and `optimizeDirectory`. Uses `sharp` to resize JPEG images to at most 1920×1080 with progressive encoding; other formats are copied unchanged.

### 7. Package configuration

`packages/cli/package.json`:
- `"bin": { "geekslides": "./dist/index.cjs" }`.
- Bundles a runnable Node entrypoint into `dist/index.cjs` and ships `app/` runtime assets.
- Dependencies: `commander`, `vite`, `sharp`, `playwright`, `@geekslides/engine`, `@geekslides/server`.
- Build script cleans `dist/`, emits declarations, and writes a bundled executable bin.

### 8. Tests

**`packages/cli/tests/cli.test.ts`**:
- `create` command generates correct file structure.
- `build` command produces `dist/` with expected files.
- `pdf` command with `--format slides` invokes PrintRenderer with correct template.
- `dev` command starts servers on specified ports (integration test, short-lived).

## File List

```
packages/cli/
├── app/
│   ├── index.html
│   └── main.js
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

- [x] `npx geekslides dev` starts Vite + yjs-server and serves a presentation.
- [x] `npx geekslides build` produces a self-contained `dist/` directory.
- [x] `npx geekslides pdf --format slides-notes` generates image-based PDFs that faithfully match the live presentation. *(Screenshot pipeline — intentional, do not change)*
- [x] `npx geekslides create --title "My Talk"` scaffolds a valid presentation repo.
- [x] Image optimizer processes images from a JSON manifest.
- [x] `--help` on all commands shows usage information.
- [x] All CLI tests pass.

## Reference Docs

- [toolchain.md](../toolchain.md) — npm workspace scripts, package dependency graph
- [print.md](../print.md) — Chromium/Playwright export path for the PDF command
- [deployment-v2.md](../deployment-v2.md) — build output used by Docker
