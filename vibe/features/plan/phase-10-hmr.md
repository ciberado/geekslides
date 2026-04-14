# Phase 10: HMR & Live Preview

**Status**: Implemented
**Depends on**: Phase 9 (Vite dev server in CLI)
**Unlocks**: Phase 12 (E2E tests may verify HMR behavior)

## Goal

Implement the custom Vite HMR plugin that watches `.md`, `.json`, and `.css` files
and sends targeted hot-reload events to the browser, preserving the current slide
position. This is the foundation for live-preview workflows and a future VSCode extension.

At the end of this phase, editing `README.md` or `config.json` in a presentation
repo hot-reloads the content in the browser without losing the current slide.

## Deliverables

### 1. Vite HMR plugin (`packages/engine/src/hmr/vite-plugin-geekslides-hmr.ts`)

A Vite plugin object with:

**`name`**: `'geekslides-hmr'`.

**`handleHotUpdate({ file, server })`**: Intercepts file change events. If the changed
file matches `.md`, `.json`, or `.css` (relative to the content directory):
- Sends a custom WebSocket message via `server.ws.send()` with type
  `'custom'` and event `'geekslides:content-update'`, including the relative file
  path and a timestamp.
- Returns an empty array to prevent Vite's default full-page reload for these files.
- Non-matching files pass through to Vite's default HMR.

### 2. Client-side hot handler (`packages/engine/src/hmr/hot-client.ts`)

Runs in the browser, registers with Vite's HMR API:

**`import.meta.hot.on('geekslides:content-update', handler)`**: When a content file
changes:
- If `.md` file: Re-fetch the markdown, re-run the preprocessor pipeline, re-parse,
  and call `slideshow.loadSlides()` while preserving `currentSlide` and `currentPartial`.
- If `.json` (config): Re-fetch config, re-merge defaults, apply changes that don't
  require a full reload (title, styles). For structural changes (plugins, content URL),
  trigger a full reload.
- If `.css`: Re-fetch the author CSS bundle for the current deck and hot-apply it to
  the slideshow without a full page reload.

**Slide position preservation**: Before reloading content, save `currentSlide` and
`currentPartial`. After `loadSlides()`, call `goTo(savedSlide, savedPartial)`. If the
saved position exceeds the new slide count (e.g. slides were removed), clamp to the
last slide.

### 3. Integration into dev command

Update the `dev` command (Phase 9) to include the HMR plugin in the Vite config.
The plugin is registered in the `plugins` array of the Vite config passed to
`createServer()`.

### 4. Tests

**`packages/engine/tests/unit/hot-client.test.ts`**:
- Content update re-fetches and re-parses markdown.
- Slide position is preserved after content reload.
- Position is clamped if slides were removed.

**`e2e/hmr.spec.ts`**:
- Editing `README.md` hot-reloads content in the browser and preserves slide position.
- Editing `config.json` applies title changes without full reload.
- Editing `local.css` hot-applies author styles without full reload.

## File List

```
packages/engine/src/hmr/
├── vite-plugin-geekslides-hmr.ts
└── hot-client.ts

packages/engine/tests/unit/
└── hot-client.test.ts

e2e/
└── hmr.spec.ts
```

## Acceptance Criteria

- [x] Editing `README.md` hot-reloads content in the browser.
- [x] Current slide position is preserved after content reload.
- [x] Editing `local.css` hot-swaps styles without page reload.
- [x] Editing `config.json` applies non-structural changes without full reload.
- [x] Non-content files (TypeScript, etc.) use Vite's default HMR.
- [x] Position is clamped gracefully when slides are removed.
- [x] Unit tests pass.

## Reference Docs

- [toolchain.md](../toolchain.md) — custom HMR plugin spec
- [architecture-v2.md](../architecture-v2.md) — HMR in the data flow
