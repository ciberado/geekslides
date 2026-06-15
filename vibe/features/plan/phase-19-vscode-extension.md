# Phase 19 — VS Code Extension (`@geekslides/vscode`)

**Status**: ✅ Complete  
**Depends on**: Phase 9 (CLI), Phase 10 (HMR), Phase 5 (Sync)

## Goal

Provide a VS Code extension that integrates the GeekSlides authoring workflow directly
into the editor. The MVP delivers:

1. **Dev server management** — start/stop the local dev server from VS Code
2. **Deck creation** — scaffold a new deck in a chosen directory
3. **Browser integration** — open the current deck in the default browser
4. **Cursor ↔ slide sync** — bidirectional synchronization between the editor cursor
   position and the active slide in the browser, using Yjs room state

The cursor↔slide sync is the key differentiator. Combined with the existing HMR
(Phase 10), it enables a workflow where editing a slide in the editor immediately
updates the browser content *and* navigates to the edited slide.

## Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Server-side slide map API** — browser computes line→slide mapping, pushes to Vite dev server; extension queries via HTTP | Always 100% accurate (uses real preprocessor/processor pipeline); avoids running DOM-dependent engine code in Node.js |
| 2 | **Yjs client in the extension** — connects to same y-websocket room as browsers | Reuses existing sync infrastructure; extension is just another room participant |
| 3 | **Bidirectional sync** with cooldown-based conflict avoidance | Full integration: cursor movement navigates browser, browser navigation moves cursor; 500ms cooldown prevents ping-pong |
| 4 | **Engine modification** — `sourceLineStart`/`sourceLineEnd` added to `SlideData` | Accurate line tracking through the preprocessor pipeline; reusable for future tooling |
| 5 | **Vite plugin hosts slide-map API** — `/api/slide-map` endpoints on the dev server | Co-located with HMR; no changes needed to `@geekslides/server` |
| 6 | **esbuild** for extension bundling | Purpose-built for Node.js targets; officially recommended by VS Code; simpler than Vite for non-browser code |
| 7 | **Subprocess CLI** for deck creation | Reuses `geekslides create`; extension stays thin; benefits from CLI improvements |

## Sub-Phases

### 19-A — Package Scaffolding & Foundation

Create `packages/vscode/` as a new npm workspace package with the standard VS Code
extension structure.

#### Tasks

- [ ] Create `packages/vscode/package.json` with extension manifest:
  - `contributes.commands`: `geekslides.startServer`, `geekslides.stopServer`,
    `geekslides.createDeck`, `geekslides.openInBrowser`
  - `activationEvents`: explicit `onCommand:...` entries for each command +
    `workspaceContains:config.json`
  - Dependencies: `yjs`, `y-websocket`
  - Dev dependencies: `@types/vscode`, `esbuild`
- [ ] Create `packages/vscode/tsconfig.json` targeting ES2022. Bundle to a VS Code-host
  compatible runtime entrypoint (`dist/extension.cjs` or equivalent explicit exception to
  the repo's ESM-first convention).
- [ ] Create `packages/vscode/esbuild.js` build script
- [ ] Create `packages/vscode/src/extension.ts` with `activate()`/`deactivate()`
- [ ] Create `packages/vscode/.vscodeignore` for VSIX packaging
- [ ] Add `packages/vscode` to root `package.json` workspaces
- [ ] Create `packages/vscode/README.md` with usage documentation
- [ ] Create `vibe/features/vscode-extension.md` architecture doc

#### Files

```
packages/vscode/
├── package.json
├── tsconfig.json
├── esbuild.js
├── .vscodeignore
├── README.md
└── src/
    └── extension.ts

vibe/features/vscode-extension.md
```

---

### 19-B — Dev Server Management

Start and stop the `geekslides dev` server from the command palette, with status bar
feedback and log output.

#### Tasks

- [ ] Create `src/server-manager.ts`:
  - `startServer(configPath)` — spawns the local CLI binary first
    (`packages/cli/bin/geekslides.cjs` or workspace-resolved `node_modules/.bin/geekslides`)
    and falls back to a global `geekslides dev --config <path>` only if needed
  - `stopServer()` — sends SIGTERM to the child process
  - Parses stdout for port number and server-ready indicator
  - Emits events: `started(port)`, `stopped`, `error(message)`
- [ ] Create `src/status-bar.ts`:
  - Status bar item showing `$(server) GeekSlides: Stopped` / `$(server) GeekSlides: :3000`
  - Click action toggles start/stop
- [ ] Register `geekslides.startServer` and `geekslides.stopServer` commands
- [ ] Create VS Code output channel `GeekSlides` for server logs
- [ ] Auto-detect `config.json` in workspace root for default config path
- [ ] Clean up child process on extension deactivation

#### Files

```
packages/vscode/src/
├── server-manager.ts
└── status-bar.ts
```

---

### 19-C — Deck Creation

Create a new deck from VS Code using the CLI's `create` command.

#### Tasks

- [ ] Create `src/deck-creator.ts`:
  - `GeekSlides: Create Deck` command
  - Prompts user for target directory (via `vscode.window.showOpenDialog`)
  - Spawns the same resolved CLI binary used by the server manager and runs `create`
  - Opens the created `README.md` in the editor
- [ ] Register `geekslides.createDeck` command

#### Files

```
packages/vscode/src/
└── deck-creator.ts
```

---

### 19-D — Browser Integration

Open the deck in the default browser pointing at the running dev server.

#### Tasks

- [ ] Create `src/browser-opener.ts`:
  - `GeekSlides: Open in Browser` command
  - Derives URL from running server port + config path query parameter
  - Uses `vscode.env.openExternal()` to open in default browser
  - Shows error if server is not running
- [ ] Register `geekslides.openInBrowser` command

#### Files

```
packages/vscode/src/
└── browser-opener.ts
```

---

### 19-E — Slide Map Infrastructure (Engine + Vite Plugin Changes)

Add line-number tracking to the engine and expose a slide-map API on the dev server.
These are the support mechanisms added to existing packages.

#### Tasks

##### Engine: line tracking in `SlideData`

- [ ] Add `sourceLineStart` and `sourceLineEnd` to `SlideData` interface
  (`packages/engine/src/core/SlideParser.ts`)
- [ ] During `splitOnSeparators()`, use `markdown-it` token `.map` fields to compute
  original line ranges per slide section
- [ ] Extend preprocessor pipeline to support line-offset mapping:
  - Preprocessor return type becomes `string | { content: string; lineMapping: number[] }`
  - `lineMapping[outputLine]` = corresponding input line
  - Existing preprocessors returning plain strings get identity mapping (backward-compatible)
- [ ] Update `header-preprocessor.ts` to return line mapping (it inserts separator lines)
- [ ] Export `computeSlideMap()` utility from `@geekslides/engine`:
  ```typescript
  interface SlideMapEntry {
    slideIndex: number;
    sourceLineStart: number;
    sourceLineEnd: number;
    id: string;
  }
  function computeSlideMap(slides: SlideData[]): SlideMapEntry[];
  ```
- [ ] Unit tests for line tracking through the parser and preprocessor pipeline

##### HMR client: push slide map

- [ ] In `hot-client.ts`, after each content reload (`geekslides:content-update` handler),
  compute the slide map from the parsed `SlideData[]` and POST to `/api/slide-map`
- [ ] Also compute and push on initial load

##### Vite plugin: slide-map API

- [ ] In `vite-plugin-geekslides-hmr.ts`, add middleware:
  - `POST /api/slide-map` — receives and caches the slide map JSON
  - `GET /api/slide-map` — returns the cached slide map JSON
- [ ] Return `404` with helpful message if map hasn't been pushed yet (browser not loaded)

#### Files

```
packages/engine/src/core/SlideParser.ts         (modified)
packages/engine/src/plugins/types.ts             (modified — preprocessor return type)
packages/engine/src/plugins/PluginManager.ts     (modified — handle new return type)
packages/engine/src/plugins/builtins/header-preprocessor.ts  (modified)
packages/engine/src/hmr/hot-client.ts            (modified)
packages/engine/src/hmr/vite-plugin-geekslides-hmr.ts  (modified)
packages/engine/tests/unit/slide-map.test.ts     (new)
```

---

### 19-F — Cursor ↔ Slide Synchronization

The key feature: bidirectional sync between editor cursor and browser active slide.

#### Tasks

##### Yjs client

- [ ] Create `src/sync/yjs-client.ts`:
  - Connects to `ws://localhost:<ws-port>/<room>` using `y-websocket` `WebsocketProvider`
  - Creates a `Y.Doc` with `sessionState` Y.Map
  - Exposes `setSlide(index)` — writes `sessionState.slide`
  - Exposes `onSlideChange(callback)` — observes `sessionState.slide` changes from remote
  - Reads room name from the resolved deck config (`config.sync.room`, defaulting to
    `default` exactly as the engine does)
  - Handles connection lifecycle, reconnection, cleanup

##### Slide map client

- [ ] Create `src/sync/slide-map-client.ts`:
  - Polls or fetches `GET /api/slide-map` from the dev server
  - Caches the result, refreshes on HMR (can poll periodically or listen for change)
  - `getSlideForLine(line: number): number | undefined`
  - `getLineForSlide(slideIndex: number): number | undefined`

##### Cursor sync controller

- [ ] Create `src/sync/cursor-sync.ts`:
  - **Editor → Browser**: Listens to `vscode.window.onDidChangeTextEditorSelection`,
    debounced 300ms. Maps cursor line to slide index via slide-map client. If index
    changed, calls `yjsClient.setSlide(index)`.
  - **Browser → Editor**: Listens to `yjsClient.onSlideChange()`. Maps slide index to
    source line via slide-map client. Moves cursor to that line using
    `editor.revealRange()`.
  - **Conflict avoidance**: After writing a slide change, sets a 500ms cooldown flag.
    During cooldown, incoming Yjs changes are ignored to prevent ping-pong.
  - Only active for the markdown file matching the current deck's content file.

- [ ] Integrate into `extension.ts` activation lifecycle
- [ ] Add `GeekSlides: Toggle Cursor Sync` command to enable/disable

#### Files

```
packages/vscode/src/sync/
├── yjs-client.ts
├── slide-map-client.ts
└── cursor-sync.ts
```

---

### 19-G — Polish & Documentation

#### Tasks

- [ ] Error handling: user-friendly notifications for common failures (server not running,
  slide map unavailable, Yjs connection lost)
- [ ] VS Code settings:
  - `geekslides.debounceMs` (default: 300)
  - `geekslides.autoStartServer` (default: false)
  - `geekslides.defaultPort` (default: 3000)
  - `geekslides.wsPort` (default: 1234)
- [ ] Create how-to guide: `how-to/NN-vscode-extension.md`
- [ ] Update `vibe/features/plan/README.md` — add Phase 19 to dependency graph and summary
- [ ] Unit tests for:
  - Slide map line-range lookup
  - Cursor sync debounce and cooldown logic
  - Server manager process lifecycle
- [ ] Comprehensive `packages/vscode/README.md` with:
  - Installation from VSIX
  - Available commands
  - Configuration options
  - Architecture overview
  - Development guide (building, testing, debugging)

#### Files

```
how-to/NN-vscode-extension.md
packages/vscode/README.md                    (updated)
packages/vscode/src/extension.ts             (updated — settings)
packages/vscode/tests/                       (new)
vibe/features/plan/README.md                 (updated)
```

## Acceptance Criteria

- [ ] Extension installs from VSIX in VS Code
- [ ] `GeekSlides: Start Dev Server` starts the local dev server
- [ ] `GeekSlides: Stop Dev Server` stops the server
- [ ] Status bar shows server state and port
- [ ] `GeekSlides: Create Deck` scaffolds a new deck
- [ ] `GeekSlides: Open in Browser` opens the deck URL
- [ ] Moving cursor in the editor navigates the browser to the corresponding slide
- [ ] Navigating slides in the browser moves the editor cursor to the slide's source
- [ ] Slide map is accurate through preprocessor transformations (e.g., header preprocessor)
- [ ] No disruption to existing features — all existing tests pass
- [ ] `npm run lint` passes
- [ ] `npm test` passes (80% coverage on new code)
- [ ] Architecture documented in `vibe/features/vscode-extension.md`

## Non-Goals (MVP)

- VS Code Marketplace publishing
- Web/Codespaces support
- Markdown preview pane inside VS Code
- Slide outline/tree view
- Snippet completion for slide markers
- Deck deployment commands
- Multi-workspace/multi-deck support

## Reference Docs

- [architecture-v2.md](../architecture-v2.md) — system diagrams, package structure
- [sync.md](../sync.md) — Yjs CRDT synchronization, sessionState Y.Map
- [plugin-system.md](../plugin-system.md) — preprocessor/processor pipeline
- [command-system.md](../command-system.md) — navigation commands
- [vscode-extension.md](../vscode-extension.md) — extension architecture (created in 19-A)
- [phase-10-hmr.md](phase-10-hmr.md) — HMR plugin (extended in 19-E)
