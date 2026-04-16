# Testing Strategy

## Overview

v2 is fully testable with two complementary testing layers:

- **Vitest** — Unit and integration tests (fast, Vite-native, runs in Node or browser mode)
- **Playwright** — End-to-end browser tests (real browser, full interaction flows)

## Test Pyramid

```
          ┌─────────┐
          │   E2E   │   ~15 tests   Playwright
          │ (slow)  │   Full user flows in real browser
          ├─────────┤
          │ Integr. │   ~30 tests   Vitest (browser mode)
          │         │   Component interactions, DOM rendering
          ├─────────┤
          │  Unit   │   ~80+ tests  Vitest (Node)
          │ (fast)  │   Pure logic: parsing, commands, plugins
          └─────────┘
```

## Vitest Configuration

The root `vitest.config.ts` uses the Node environment by default for unit tests and includes all test files matching `packages/*/tests/**/*.test.ts`. Coverage uses the v8 provider with text, HTML, and lcov reporters, targeting all source files in `packages/*/src/**/*.ts` (excluding test files and barrel index files). Coverage thresholds are set to 80% for branches, functions, lines, and statements.

### Browser Mode for Integration Tests

Integration tests that need real DOM (Web Components, Shadow DOM) use a separate config (`vitest.config.browser.ts`) with Vitest's browser mode enabled, using Playwright's Chromium as the provider. These target only `packages/engine/tests/integration/**/*.test.ts`.

## Unit Tests (@geekslides/engine)

### SlideParser

Tests for `SlideParser` (`packages/engine/tests/unit/SlideParser.test.ts`) verify:

- **Slide splitting**: Given markdown with content separated by empty links (`[](.topic#id)`), the parser produces the correct number of `SlideData` objects with the expected HTML content in each.
- **Attribute extraction**: Empty links with class, id, background URL, and background color attributes (e.g. `[](.highlight#intro,bgurl(hero.jpg),bgcolor(#333))`) are correctly parsed into `classes`, `id`, `backgroundImage`, and `backgroundColor` fields.
- **Speaker notes extraction**: `::: Notes` container blocks are extracted into the `notes` field and excluded from the main `html` content.
- **Style block extraction**: `<style>` blocks inside slides are extracted into `rawCss` and removed from the rendered HTML.
- **Partial counting**: Elements with the `[partial]` attribute are counted and stored in `partialCount`.

### StyleScoper

Tests for `StyleScoper` (`packages/engine/tests/unit/StyleScoper.test.ts`) verify:

- Simple selectors like `h2` are prefixed with the slide container selector (`geek-slide[data-id="slide-1"] h2`).
- Compound selectors like `.box > .title` are correctly prefixed.
- Already-scoped selectors are not double-prefixed.
- At-rules like `@keyframes` and `@media` are preserved without modification.

### CommandSystem

Tests for `CommandSystem` (`packages/engine/tests/unit/CommandSystem.test.ts`) verify:

- Commands can be registered and executed by name, with the execute function being called exactly once.
- Executing an unknown command logs a warning via `console.warn`.
- The `search()` method filters commands by both label and name, returning the correct matches for queries like `'toggle'`, `'speaker'`, or `'next'`.

### PluginManager

Tests for `PluginManager` (`packages/engine/tests/unit/PluginManager.test.ts`) verify:

- Preprocessors run in sequence: registering an "upper" plugin (uppercases) then a "prefix" plugin (prepends text) produces the combined output in correct order.
- Processors modify slide elements: a processor that sets `dataset.processed = 'true'` correctly modifies the passed element.

### Local & Remote Plugin Utilities

Tests for plugin loader utilities (`packages/engine/tests/unit/local-plugin.test.ts`) verify:

- **`isLocalPluginPath`**: returns `true` for `./` and `../` paths, `false` for built-in names, absolute paths, and URLs.
- **`isRemotePluginUrl`**: returns `true` for `http://` and `https://` URLs, `false` for relative paths, built-in names, and absolute paths.
- **`extractPreprocessor`**: extracts a default function export, throws with a descriptive error when the default export is missing or not a function, includes the file path in the error message.
- **`extractProcessor`**: same validation behaviour as `extractPreprocessor` for processor functions.

## Unit Tests (@geekslides/server)

Tests for the server (`packages/server/tests/server.test.ts`) verify:

- A connection with a valid room name is accepted.
- A connection without a room name is rejected with WebSocket close code 4001.
- A connection with an invalid token (when auth is enabled) is rejected with close code 4003.
- Content store files can be uploaded and retrieved, path traversal returns null.
- Content is servable via HTTP API (upload/fetch round-trip).

### Plugin Proxy

- Requests without a `url` parameter return 400.
- Non-`.js` URLs are rejected with 400.
- Invalid URLs return 400.
- A valid `.js` URL is proxied and returned with `application/javascript` content type.
- Unreachable remote servers return 502.
- POST requests are rejected with 405.

## Integration Tests (Vitest Browser Mode)

### GeekSlideshow

Integration tests (`packages/engine/tests/integration/Slideshow.test.ts`) run in a real browser via Vitest's browser mode. Each test creates a `<geek-slideshow>` element on the page and verifies:

- Slides from parsed markdown are rendered as `<geek-slide>` child elements with the first slide active.
- Navigation via `next()` reveals partials before advancing to the next slide.
- Per-slide scoped styles are applied to the correct slide and do not leak to others.
- Custom events (`geek:navigate`) are dispatched and trigger navigation.

### SyncManager

Integration tests (`packages/engine/tests/integration/SyncManager.test.ts`) verify:

- Calling `publishState()` correctly updates the Y.Map values.
- When two Y.Docs are synced and one is modified, the observer on the other fires and calls `slideshow.goTo()` with the correct values.

## E2E Tests (Playwright)

### Configuration

The Playwright config (`e2e/playwright.config.ts`) starts the dev server via `npm run dev` on port 5173 (reuses an existing server outside CI). It runs tests across four projects: Desktop Chrome, Desktop Firefox, Desktop Safari, and iPhone 14 (mobile).

### Navigation E2E

Tests in `e2e/navigation.spec.ts`:

- **Arrow right** advances to next slide — presses ArrowRight, asserts the `active` slide changes.
- **Swipe on mobile** — performs a swipe gesture on the slideshow element to advance.
- **Partial navigation** — presses right arrow multiple times, verifying partials are revealed before the slide changes.

### Command System E2E

Tests in `e2e/commands.spec.ts`:

- **Open terminal with `t`** — asserts terminal prompt becomes visible.
- **`help` lists available commands** — types `help`, presses Enter, verifies output panel is populated.
- **Terminal command execution** — runs `speaker` or `goto <n>`, presses Enter, verifies expected mode/state change.

### Sync E2E

Tests in `e2e/sync.spec.ts`:

- **Two browsers sync** — opens two pages in the same browser, both connecting to a test room. The presenter navigates, and the audience page's active slide updates to match.

### Local Plugins E2E

Tests in `e2e/local-plugins.spec.ts`:

- **Loads a deck with local plugins** — uses the `load` terminal command to switch to a fixture deck that references `./plugins/shout-preprocessor.js` and `./plugins/highlight-processor.js`. Verifies the preprocessor transforms markdown content ("hello" → "HELLO") and the processor adds a `data-highlighted` attribute to slide elements.
- **Preprocessor transforms content** — confirms "hello world" becomes "HELLO world" in rendered slide text.
- **Processor mutates DOM** — confirms `data-highlighted="true"` is set on the slide content element.

### Remote Plugins E2E

Tests in `e2e/remote-plugins.spec.ts`:

- **Loads a remote plugin through the proxy** — starts a tiny HTTP server serving a JS plugin, verifies the proxy endpoint fetches it, then dynamically imports and executes the plugin function via blob URL.
- **Proxy rejects non-.js URLs** — confirms a `.css` URL returns 400 with "Only .js files" error.
- **Proxy rejects missing url parameter** — confirms a bare `/api/plugin-proxy` request returns 400.

### Whiteboard E2E

Tests in `e2e/whiteboard.spec.ts`:

- **Toggle whiteboard** — opens terminal (`t`), runs `whiteboard`, asserts `<geek-whiteboard>` becomes visible.
- **Auto-activate on draw** — performs mouse drag directly on a slide, verifies the whiteboard canvas becomes visible automatically.
- **Draw strokes** — performs mouse drag on the canvas, verifies the stroke was drawn (canvas pixel check).
- **Per-slide persistence** — draws on slide 1, navigates to slide 2, navigates back, verifies slide 1 drawings remain.
- **Stroke dispatches correct slideIndex** — draws on slide 2, inspects the dispatched event detail to confirm `slideIndex` matches.

### Whiteboard Unit Tests

Tests in `packages/engine/tests/unit/Whiteboard.test.ts`:

- **Per-slide save/restore** — calls `saveSlide()`/`restoreSlide()`, verifies `ImageData` is cached and re-drawn.
- **slideIndex setter** — asserts dispatched stroke events carry the correct slide index.
- **Auto-show on setActive(true)** — confirms canvas display changes from `none` to `block`.
- **Remote stroke rendering** — calls `drawRemoteStroke()`, verifies context draw calls.

Tests in `packages/engine/tests/unit/SyncManager.test.ts` (whiteboard-related):

- **addStroke pushes to Y.Array** — verifies stroke is stored in the shared array.
- **getStrokes returns all existing strokes** — adds two strokes, confirms both are returned.
- **getStrokes returns strokes from remote doc sync** — simulates a late-join by applying a remote Y.Doc update, confirms strokes are readable.

## CI Integration

The GitHub Actions workflow (`.github/workflows/test.yml`) triggers on push and pull request with two jobs:

**`unit` job**: Checks out the repo, sets up Node 22, runs `npm ci`, then `npm run typecheck` and `npm test -- --coverage`.

**`e2e` job**: Checks out the repo, sets up Node 22, runs `npm ci`, installs Playwright's Chromium browser, runs `npm run test:e2e`. On failure, uploads the Playwright HTML report as an artifact using `actions/upload-artifact@v4`.

## npm Scripts Summary

| Script | Description |
|--------|-------------|
| `test` | Run all unit + integration tests (`vitest run`) |
| `test:watch` | Watch mode (`vitest`) |
| `test:coverage` | With coverage report (`vitest run --coverage`) |
| `test:browser` | Integration tests in browser mode (`vitest run -c vitest.config.browser.ts`) |
| `test:e2e` | Playwright E2E tests (`playwright test`) |
| `test:e2e:ui` | E2E with interactive UI (`playwright test --ui`) |
| `test:all` | Everything: unit + integration + E2E |
