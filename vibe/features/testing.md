# Testing Strategy

## Overview

v2 is fully testable with two complementary testing layers:

- **Vitest** — Unit and integration tests (fast, Vite-native, runs in Node or browser mode)
- **Playwright** — End-to-end browser tests (real browser, full interaction flows)

## Test Pyramid

```
          ┌─────────┐
          │   E2E   │   ~30 tests   Playwright
          │ (slow)  │   Full user flows in real browser
          ├─────────┤
          │ Integr. │   ~30 tests   Vitest (browser mode)
          │         │   Component interactions, DOM rendering
          ├─────────┤
          │  Unit   │   ~220+ tests Vitest (Node)
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

### Room Protection

Tests in `packages/server/tests/room-store.test.ts`:

- Token generation produces 64 hex characters from 32 random bytes.
- Validation uses `crypto.timingSafeEqual` (constant-time comparison).
- Protected rooms reject invalid tokens; unprotected rooms remain open.
- Room deletion clears protection.

Tests in `packages/server/tests/rate-limiter.test.ts`:

- Sliding-window counter tracks failures per IP.
- Exceeding threshold (10 attempts / 60 seconds) triggers rate limiting.
- Window expiry resets the counter.
- Cleanup timer removes stale entries.

Tests in `packages/server/tests/room-auth.test.ts`:

- REST API: `POST /share` creates protected room, `POST /auth` validates token, `GET /role` reports status.
- WebSocket auth: presenter with valid token connects, viewer with `?readonly` connects, invalid token rejected.
- Write filtering: Yjs update messages (type 0, sub-type 2) are silently dropped for viewers; presenters write normally.
- Rate limiting integration: repeated failed auth attempts return 429.

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

### Read-Only Viewer E2E

Tests in `e2e/readonly.spec.ts`:

- **Viewer lockdown** — readonly viewer has no terminal, no keyboard navigation, no touch input; VIEW ONLY badge visible.
- **Viewer follows presenter** — presenter navigates to slide 2; readonly viewer in the same room syncs automatically.
- **Share command** — running `share` in the terminal creates a protected room; API confirms `{ protected: true }`.
- **Sync dot** — readonly viewer shows green sync dot when connected.

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
- **Toolbar presence** — verifies `<geek-whiteboard-toolbar>` has 3 tool buttons, 16 color swatches, and a collapse button.
- **wb-toolbar command** — completely hides/shows the toolbar via `toggleVisibility()` (not collapse). The `≡` collapse button is still available for shrinking the toolbar in place.
- **wb-hide / wb-show commands** — hides and restores toolbar visibility.
- **Tool switching commands** — `wb-pen`, `wb-highlighter`, `wb-eraser` change the active tool.
- **Color swatch click** — clicking a swatch in the palette changes the drawing color.
- **Clear confirmation** — clear button requires double-click (first click enters confirmation, second confirms).

### Whiteboard Unit Tests

Tests in `packages/engine/tests/unit/Whiteboard.test.ts`:

- **Per-slide save/restore** — calls `saveSlide()`/`restoreSlide()`, verifies `ImageData` is cached and re-drawn.
- **slideIndex setter** — asserts dispatched stroke events carry the correct slide index.
- **Auto-show on setActive(true)** — confirms canvas display changes from `none` to `block`.
- **Remote stroke rendering** — calls `drawRemoteStroke()`, verifies context draw calls.
- **setCompositeOp** — verifies `globalCompositeOperation` is applied when drawing strokes.
- **setAlpha** — verifies `globalAlpha` is applied when drawing strokes.
- **Progress events include compositeOp/alpha** — confirms stroke progress events carry the current composite operation and alpha values.

### WhiteboardToolbar Unit Tests

Tests in `packages/engine/tests/unit/WhiteboardToolbar.test.ts`:

- **Rendering** — verifies toolbar renders tool buttons, color swatches, collapse toggle, and action buttons in Shadow DOM.
- **Tool buttons** — confirms clicking pen/highlighter/eraser buttons dispatches `geek:whiteboard:tool-change` events with correct tool names.
- **Color swatches** — confirms clicking a color swatch dispatches `geek:whiteboard:color-change` with the hex color value.
- **setTool / setColor** — programmatic API updates the active tool and color selection.
- **Collapse toggle** — clicking the collapse button hides the toolbar body, clicking again restores it.
- **Hide/show** — `hide()` and `show()` methods toggle the entire toolbar visibility.
- **Clear confirmation** — first click enters confirmation state (button changes to "Sure?"), second click dispatches `geek:whiteboard:clear-request`, auto-cancels after 3 seconds.
- **TOOL_SETTINGS** — verifies pen, highlighter, and eraser tool settings have correct width, compositeOp, and alpha values.
- **PALETTE_COLORS** — confirms 16 colors are defined.

Tests in `packages/engine/tests/unit/SyncManager.test.ts` (whiteboard-related):

- **addStroke pushes to Y.Array** — verifies stroke is stored in the shared array.
- **getStrokes returns all existing strokes** — adds two strokes, confirms both are returned.
- **getStrokes returns strokes from remote doc sync** — simulates a late-join by applying a remote Y.Doc update, confirms strokes are readable.

## Unit Tests (@geekslides/hub)

Hub tests live in `packages/hub/tests/unit/` and run under the root Vitest config (Node environment). Each test file uses an in-memory SQLite database via `createTestDatabase()` from `helpers.ts`.

### fuzzy.test.ts

Tests for `utils/fuzzy.ts` `fuzzyMatch` function:

- Exact match returns true; case-insensitive matching works in both directions.
- Sparse character sequences match in order (`kdd` → "Kubernetes Deep Dive").
- Returns false when a character is absent or out of order.
- Empty query matches everything; query longer than text returns false.
- Repeated characters handled correctly (two `o`s needed for `oo`).
- Unicode characters handled correctly.

### upload.test.ts

Tests for `services/upload.ts`:

- **`validateDeckFiles`**: accepts valid decks; rejects missing `config.json`, missing `content` field, missing content file; skips path traversal attempts; skips dotfiles; enforces file size and path length limits.
- **`extractZip`**: extracts files, strips common directory prefix, skips directory entries and invalid paths.
- **`importFromGitHub`**: resolves ref to SHA via GitHub API, fetches tree + blobs, strips subpath prefix, skips dotfiles; throws on invalid URL or API error; falls back to commits API when ref lookup fails.
- **`fetchGitHubLatestSha`**: returns SHA from ref API; falls back to commits API; returns null for invalid URL or failed API; detects update (returned SHA ≠ stored SHA) and no-update (returned SHA = stored SHA).

### presentation.test.ts

Tests for `services/presentation.ts`:

- **`generateSlug`**: converts title to lowercase-kebab-case, strips special characters, trims hyphens.
- **`ensureUniqueSlug`**: appends numeric suffix when slug already exists.
- **`createPresentation`**: stores `githubUrl`/`githubSha` when provided; stores null when omitted.
- **`updatePresentationMetadata`**: updates title, description, visibility; returns updated row.
- **`listPresentations`**: returns only the owner's presentations.
- **`getPresentationById`**: returns matching presentation or undefined.
- **`refreshFromGitHub`**: updates files and `githubSha`; throws when presentation has no `githubUrl`; throws when called by wrong owner.

### Other unit test files

| File | Coverage |
|------|---------|
| `git.test.ts` | `commitFiles`, `checkoutFiles`, `repoSize`, bare repo init |
| `user.test.ts` | `upsertUser`, `approveUser`, `updateQuota`, `listUsers` |
| `share.test.ts` | `createShare`, `listShares`, `respondToShare`, `listSharedWithMe`, `checkAccess` |
| `admin.test.ts` | Invite code generation/validation/revocation, admin stats |
| `analytics.test.ts` | `recordLaunch`, `getPresentationAnalytics`, `getUserAnalytics` |

## E2E Tests (@geekslides/hub)

Hub E2E tests run under Playwright (Chromium only, `packages/hub/e2e/playwright.config.ts`). A real Fastify server is started per suite via `startHubServer()`, using a temp SQLite file. Auth is bypassed by signing JWT tokens directly with `ctx.signToken()`. The config registers `global-setup.ts` which runs `npm run build:client` once before all tests so Fastify can serve the built SPA.

### hub-api.spec.ts

Exercises the full REST API surface (~38 tests). Seeds users and presentations directly via service imports. Covers:

- **Auth**: `/auth/me` (authenticated/unauthenticated), token refresh, logout.
- **Presentations CRUD**: create (files, zip, GitHub URL), list, get, PATCH metadata, PUT replace files (200 own, 500 wrong owner), DELETE.
- **GitHub routes**: `GET /:id/github-check` (400 non-GitHub, 404 wrong owner, 200/502 for real GitHub); `POST /:id/github-refresh` (400 non-GitHub).
- **Shares**: create, list, respond (accept/reject), shared-with-me, revoke.
- **Search**: full-text search on public presentations.
- **Admin**: list/approve/reject users, quota, invite codes, stats; 403 for non-admin.
- **Analytics**: personal stats endpoint.

### hub-ui.spec.ts

Exercises the Lit SPA rendered in a real Chromium browser (~8 UI tests + ~8 API-via-browser tests). The `beforeAll` seeds three presentations with distinct titles ("AWS Cloud Architecture", "Kubernetes Deep Dive", "Docker Compose Tips"). Each test navigates to `/hub/`, waits for the `.toolbar` to appear, then interacts:

- **Filter**: typing `aws` hides 2 of 3 cards; fuzzy `kdd` matches "Kubernetes Deep Dive"; `zzznomatch` shows `.no-results`; clearing restores all 3 cards.
- **Layout toggle**: clicking ☰ switches from `.card` grid to `.list-row` list; filter still works in list view; clicking ⊞ restores cards.
- **API from browser context**: `auth/me`, `presentations`, `admin/stats` all return correct JSON via `page.request`.
- **Security**: expired JWT returns 401; non-API hub routes return < 500.

## CI Integration

The GitHub Actions workflow (`.github/workflows/test.yml`) triggers on push and pull request with two jobs:

**`unit` job**: Checks out the repo, sets up Node 22, runs `npm ci`, then `npm run typecheck` and `npm test -- --coverage`.

**`e2e` job**: Checks out the repo, sets up Node 22, runs `npm ci`, installs Playwright's Chromium browser, runs `npm run test:e2e`. On failure, uploads the Playwright HTML report as an artifact using `actions/upload-artifact@v4`.

### Content Proxy E2E

Tests in `e2e/content-proxy.spec.ts`:

- **Presenter uploads deck, audience loads from proxy** — presenter loads a deck with sync enabled,
  the deck assets are uploaded to the server. An audience tab joins the same room, syncs via Yjs,
  and follows the presenter's navigation. Verifies API endpoints return correct JSON/CSS/markdown
  and the audience's slideshow tracks the presenter's current slide.
- **Uploaded images accessible from proxy** — verifies that images referenced in deck markdown are
  uploaded and retrievable via the content proxy API.
- **Path traversal blocked via API** — confirms `..%2F` traversal attempts return 404.
- **Missing room returns 404** — confirms requests to non-existent rooms return 404.
- **Stale contentProxy guard** — verifies a presenter keeps its own deck when a stale `contentProxy`
  from a previous room change exists in the Yjs map.
- **ContentProxy broadcast** — presenter loads a deck, audience syncs via proxy, presenter switches
  deck via the `load` terminal command. Audience receives the new deck through the updated
  `contentProxy` field and reloads from the proxy.
- **Rapid load commands** — rapid successive `load` commands don't cause deduplication/revert issues.
- **Features reloaded during proxy reload** — verifies features (e.g. polls) are re-activated when
  the audience receives a contentProxy update.
- **Yjs features map cleared on deck switch** — confirms features from the old deck are cleaned up
  when the presenter loads a different deck.
- **localStorage proxy cache** — verifies a page reload uses cached proxy data for instant recovery;
  falls back to the default deck when the proxy is unavailable.

### Multi-Tab Sync Test Pattern

E2E tests that involve multiple browser tabs in the same Yjs room (content-proxy,
plugin-registry, sync, share-qr) must wait for the sync connection to establish before
checking shared state. Use this pattern:

```typescript
// 1. Register sync detection before navigation (addInitScript)
async function setupSyncDetection(page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('geek:sync:state', (e: CustomEvent) => {
      if (e.detail?.connected) {
        (window as unknown as { __syncConnected: boolean }).__syncConnected = true;
      }
    });
  });
}

// 2. Wait for sync to connect
async function waitForSyncConnected(page): Promise<void> {
  await page.waitForFunction(() => {
    return (window as unknown as { __syncConnected?: boolean }).__syncConnected === true;
  }, { timeout: 10000 });
}

// 3. Apply to both presenter and audience pages
await setupSyncDetection(presenter);
await presenter.goto(decksUrl);
await waitForSyncConnected(presenter);

await setupSyncDetection(audience);
await audience.goto(audienceUrl);
await waitForSyncConnected(audience);
```

Key details:
- `setupSyncDetection` must be called **before** `page.goto()` — `addInitScript` registers a
  script that runs on every new document, so it only applies to navigations after registration.
- Only call `setupSyncDetection` on the **first** `goto` after creating the page. Calling it on a
  fresh page before its first navigation can cause a race in headless Chromium (the `goto()`
  promise rejects with "Cannot navigate to invalid URL" despite the page loading successfully).
  For pages that don't need sync detection, skip `setupSyncDetection` entirely.
- When creating contexts manually via `browser.newContext()`, always pass `{ baseURL }` —
  relative URLs like `/?config=...` won't resolve without it:
  ```typescript
  const context = await browser.newContext({ baseURL: baseURL ?? 'http://localhost:5173' });
  ```
- Tests using the `page` fixture (not `browser`) inherit `baseURL` automatically from the
  Playwright config's `use.baseURL` setting.

## Environment Setup

### Ubuntu 26.04+ / Platform Override

Playwright's browser download servers don't support `ubuntu26.04-x64`. When running E2E tests
on Ubuntu 26.04 or later, set the platform override environment variable:

```bash
export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64
npx playwright install chromium
```

This tells Playwright to download browsers built for Ubuntu 24.04, which work fine on 26.04.
Without this override, `npx playwright install` fails with "Playwright does not support chromium
on ubuntu26.04-x64".

### Dev Server for E2E

The E2E tests require **both** the Vite dev server and the backend server running concurrently.
The `npm run dev` script handles this:

```bash
npm run dev   # Runs both concurrently: "tsx packages/server/src/index.ts" + "vite"
```

The Playwright config (`e2e/playwright.config.ts`) has `reuseExistingServer: true` by default,
so a manually started `npm run dev` is reused across test runs. To force a fresh start:

```bash
E2E_REUSE_EXISTING_SERVER=false npm run test:e2e
```

> **Important:** Always run E2E tests via `npm run test:e2e`, not bare `npx playwright test`.
> The npm script passes `--config=e2e/playwright.config.ts` which is required. Without it,
> Playwright doesn't find the project configuration and all tests fail with
> ERR_CONNECTION_REFUSED or "Cannot navigate to invalid URL".

## npm Scripts Summary

| Script | Description |
|--------|-------------|
| `test` | Run all unit + integration tests (`vitest run`) |
| `test:watch` | Watch mode (`vitest`) |
| `test:coverage` | With coverage report (`vitest run --coverage`) |
| `test:browser` | Integration tests in browser mode (`vitest run -c vitest.config.browser.ts`) |
| `test:e2e` | Playwright E2E tests (`playwright test --config=e2e/playwright.config.ts`) |
| `test:e2e:ui` | E2E with interactive UI (`playwright test --ui`) |
| `test:all` | Everything: unit + integration + E2E |
