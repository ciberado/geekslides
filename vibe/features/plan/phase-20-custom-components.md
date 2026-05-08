# Phase 20 — Custom Web Components

## Goal

Enable deck authors to embed custom web components in slides by loading ES module scripts
via `config.json`. Prove the concept with a `<doodle-controls>` component that interactively
updates css-doodle patterns.

## Prerequisites

- css-doodle plugin (Phase 3 + follow-ups)
- Feature system (Phase 13+) — not a dependency, but informs the design boundary

## Scope

| In scope | Out of scope |
|----------|--------------|
| `scripts` config field | Inline `<script>` in markdown |
| Local (relative path) and remote (HTTPS URL) scripts | NPM bare specifiers / import maps |
| Sequential loading before processors run | Parallel / lazy loading |
| `window.__geekslides` utility export | Full component SDK / lifecycle API |
| `<doodle-controls>` demo component | General-purpose component marketplace |
| css-doodle updatability via data attributes | Sync of component state via Yjs |

## Steps

### 20.1 — Config: `scripts` field

Add `scripts: readonly string[]` to `GeekSlidesConfig`. Default `[]`.

Files:
- `packages/engine/src/core/Config.ts` — Add field, stop deleting legacy `scripts`, parse/validate

### 20.2 — Script loader in main.js

Load scripts via dynamic `import()` after config load, before preprocessor pipeline.

Files:
- `packages/cli/app/main.js` — `loadScripts()`, call it in boot sequence, add to HMR watch

### 20.3 — Engine exports for component authors

Expose `patternRegistry` and generation utilities on `window.__geekslides` so deck-local
scripts can access them without import maps.

Files:
- `packages/cli/app/main.js` — Set `window.__geekslides`
- `packages/engine/src/plugins/index.ts` — Export css-doodle utilities

### 20.4 — css-doodle updatability

Store config metadata as data attributes on `<css-doodle>` elements.

Files:
- `packages/engine/src/plugins/builtins/css-doodle-processor.ts` — Add data attributes

### 20.5 — `<doodle-controls>` demo component

Interactive custom element with grid slider, color pickers, opacity slider, speed slider,
animate toggle, and pattern selector. Placed after each doodle in the demo deck.

Files:
- `decks/css-doodle-demo/components/doodle-controls.js` — Component definition
- `decks/css-doodle-demo/config.json` — Add `scripts`
- `decks/css-doodle-demo/README.md` — Embed `<doodle-controls>` in slides

### 20.6 — Tests

- Config parsing: unit test for `scripts` field
- E2E: custom component renders and interacts with css-doodle

Files:
- `packages/engine/tests/unit/Config.test.ts` — Test cases for scripts
- `e2e/custom-components.spec.ts` — E2E test

### 20.7 — Documentation

- Architecture doc update
- How-to guide for custom components

Files:
- `vibe/features/custom-components.md` — Already written
- `vibe/features/architecture-v2.md` — Add scripts loading stage
- `how-to/` — New guide

## Risks

- **Custom element name collisions**: Two scripts defining the same tag name will throw.
  Mitigation: warn in docs; consider a deck-scoped prefix convention.
- **Load order**: Script A might depend on Script B. Sequential loading handles this
  if authors order the array correctly.
- **HMR limitations**: Custom elements cannot be re-defined after initial registration.
  Dev-mode script changes require full page reload.

## Success Criteria

1. `decks/css-doodle-demo/` renders with `<doodle-controls>` showing interactive controls
2. Adjusting controls live-updates the css-doodle pattern on screen
3. Existing decks without `scripts` work identically (backward compatible)
4. All existing tests pass
5. E2E test confirms component interaction
