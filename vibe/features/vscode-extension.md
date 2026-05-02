# VS Code Extension Architecture

## Overview

The `@geekslides/vscode` package is a VS Code extension that integrates GeekSlides deck
authoring into the editor. Its primary feature is **bidirectional cursor↔slide
synchronization**: moving the cursor in the editor navigates the browser to the
corresponding slide, and navigating slides in the browser moves the editor cursor.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VS Code                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  @geekslides/vscode extension                                │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ ServerManager │  │ DeckCreator  │  │ BrowserOpener    │   │   │
│  │  │              │  │              │  │                  │   │   │
│  │  │ spawns CLI   │  │ runs CLI     │  │ opens URL via    │   │   │
│  │  │ dev process  │  │ create cmd   │  │ vscode.env       │   │   │
│  │  └──────┬───────┘  └──────────────┘  └──────────────────┘   │   │
│  │         │                                                    │   │
│  │  ┌──────┴──────────────────────────────────────────────┐     │   │
│  │  │  CursorSync                                         │     │   │
│  │  │                                                     │     │   │
│  │  │  ┌────────────────┐      ┌────────────────────┐     │     │   │
│  │  │  │ SlideMapClient │      │ YjsClient          │     │     │   │
│  │  │  │                │      │                    │     │     │   │
│  │  │  │ GET /api/      │      │ Y.Doc              │     │     │   │
│  │  │  │   slide-map    │      │ └─ sessionState    │     │     │   │
│  │  │  └───────┬────────┘      │    (Y.Map)         │     │     │   │
│  │  │          │               └─────────┬──────────┘     │     │   │
│  │  └──────────┼─────────────────────────┼────────────────┘     │   │
│  │             │                         │                      │   │
│  └─────────────┼─────────────────────────┼──────────────────────┘   │
│                │                         │                          │
└────────────────┼─────────────────────────┼──────────────────────────┘
                 │ HTTP                    │ WebSocket
                 │                         │
┌────────────────┼─────────────────────────┼──────────────────────────┐
│  Dev Server    │                         │                          │
│                │                         │                          │
│  ┌─────────────┴──────┐    ┌─────────────┴──────┐                  │
│  │  Vite Dev Server   │    │  y-websocket server │                  │
│  │                    │    │                     │                  │
│  │  /api/slide-map    │    │  Room: "deck-name"  │                  │
│  │  (GET/POST)        │    │  └─ sessionState    │                  │
│  │                    │    │     .slide           │                  │
│  │  HMR websocket ────┼──►│     .partial         │                  │
│  │                    │    │     .mode            │                  │
│  └────────────────────┘    └─────────────────────┘                  │
│                                       ▲                             │
└───────────────────────────────────────┼─────────────────────────────┘
                                        │ WebSocket
┌───────────────────────────────────────┼─────────────────────────────┐
│  Browser(s)                           │                             │
│                                       │                             │
│  ┌────────────────────────────────────┴──────────────────────────┐  │
│  │  @geekslides/engine                                           │  │
│  │                                                               │  │
│  │  Preprocessors → SlideParser → Processors → Slideshow         │  │
│  │       │                                         │             │  │
│  │       └──── slide map (line ranges) ──► POST /api/slide-map   │  │
│  │                                         │                     │  │
│  │  SyncManager ◄───── Yjs sessionState ───┘                    │  │
│  │       │                                                       │  │
│  │       └──── goTo(slide, partial)                              │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flows

### Editor → Browser (cursor-driven navigation)

```
1. User moves cursor in README.md (VS Code editor)
       │
       ▼
2. onDidChangeTextEditorSelection fires (debounced 300ms)
       │
       ▼
3. CursorSync looks up cursor line in cached slide map
       │
       ▼
4. If slide index changed → YjsClient.setSlide(newIndex)
       │
       ▼
5. Yjs propagates sessionState.slide to all room participants
       │
       ▼
6. Browser SyncManager observes change → calls goTo(newIndex)
       │
       ▼
7. Browser navigates to the slide
```

### Browser → Editor (navigation-driven cursor)

```
1. User navigates slides in browser (arrow keys, terminal, etc.)
       │
       ▼
2. SyncManager publishes sessionState.slide via Yjs
       │
       ▼
3. Extension's YjsClient observes sessionState.slide change
       │
       ▼
4. CursorSync checks cooldown (ignore if recently wrote)
       │
       ▼
5. Looks up slide index in slide map → sourceLineStart
       │
       ▼
6. editor.revealRange() moves cursor to that line
```

### Slide Map Lifecycle

```
1. Browser loads/reloads content (initial load or HMR)
       │
       ▼
2. Engine runs: preprocessors → SlideParser.parse() → processors
       │
       ▼
3. SlideParser now tracks sourceLineStart/End per SlideData
       │
       ▼
4. hot-client.ts computes slide map from SlideData[]
       │
       ▼
5. POST /api/slide-map → Vite plugin caches the JSON
       │
       ▼
6. Extension polls or fetches GET /api/slide-map
       │
       ▼
7. CursorSync uses cached map for line↔slide lookups
```

## Conflict Avoidance

Bidirectional sync can cause ping-pong: the extension writes a slide change, the browser
navigates, the browser writes the same slide back, the extension receives it and moves
the cursor, which triggers another write...

**Solution**: cooldown timer.

```
Extension writes sessionState.slide
    │
    ├─→ Set cooldownActive = true
    │
    ├─→ Start 500ms timer
    │
    └─→ During cooldown: ignore incoming Yjs sessionState.slide changes
         │
         └─→ After 500ms: cooldownActive = false, resume observing
```

This is simple and effective for the common case. Edge cases (rapid navigation from
multiple sources) are acceptable for the MVP — the state converges within 500ms.

## Slide Map Format

The slide map is a JSON array pushed by the browser and consumed by the extension:

```typescript
interface SlideMapEntry {
  slideIndex: number;      // 0-based slide index
  sourceLineStart: number; // 1-based line in original markdown
  sourceLineEnd: number;   // 1-based line (exclusive)
  id: string;              // slide ID from the separator href
}
```

Example for a deck with header preprocessor:

```json
[
  { "slideIndex": 0, "sourceLineStart": 1, "sourceLineEnd": 15, "id": "intro" },
  { "slideIndex": 1, "sourceLineStart": 15, "sourceLineEnd": 42, "id": "overview" },
  { "slideIndex": 2, "sourceLineStart": 42, "sourceLineEnd": 78, "id": "demo" }
]
```

## Line Tracking Through Preprocessors

Preprocessors transform the raw markdown before parsing. The `header` preprocessor
inserts slide separator lines (`[](.slide#slug)`), which shifts line numbers. To
maintain accurate source-line mapping, preprocessors can optionally return a line
mapping alongside their output:

```typescript
// Existing (still supported — identity mapping assumed):
type Preprocessor = (markdown: string) => string;

// Extended (backward-compatible):
type PreprocessorResult = string | {
  content: string;
  lineMapping: number[];  // lineMapping[outputLine] = inputLine
};
type Preprocessor = (markdown: string) => PreprocessorResult;
```

The `PluginManager` composes line mappings when multiple preprocessors run in sequence.
Preprocessors that return plain strings are treated as identity-mapped (each output
line corresponds to the same input line, valid when the preprocessor only modifies
content within lines, not adding/removing lines).

The `header` preprocessor inserts new lines (separators), so it returns the extended
format. The final composed mapping is used by `SlideParser` to set `sourceLineStart`
and `sourceLineEnd` on each `SlideData`.

## Engine Changes (Non-Breaking)

All engine changes are backward-compatible:

| Change | Impact |
|--------|--------|
| `SlideData.sourceLineStart/End` added | Optional fields; existing consumers unaffected |
| Preprocessor return type extended | Union type; plain string still works |
| `hot-client.ts` POSTs slide map | No-op if Vite plugin doesn't have the endpoint (non-dev builds) |
| Vite plugin gets `/api/slide-map` middleware | Only active in dev mode |

No existing tests, APIs, or behaviors are modified.

## Extension Package Structure

```
packages/vscode/
├── package.json          # Extension manifest + npm workspace package
├── tsconfig.json         # ES2022; bundle target chosen for VS Code host compatibility
├── esbuild.js            # Build script
├── .vscodeignore         # VSIX packaging excludes
├── README.md             # User documentation
├── src/
│   ├── extension.ts      # activate() / deactivate() entry point
│   ├── server-manager.ts # Dev server lifecycle (child process)
│   ├── status-bar.ts     # Status bar UI
│   ├── deck-creator.ts   # Create Deck command
│   ├── browser-opener.ts # Open in Browser command
│   └── sync/
│       ├── yjs-client.ts       # Yjs room connection
│       ├── slide-map-client.ts # HTTP client for /api/slide-map
│       └── cursor-sync.ts      # Bidirectional sync controller
└── tests/
    ├── slide-map-client.test.ts
    └── cursor-sync.test.ts
```

## Dependencies

| Package | Purpose | Already in workspace? |
|---------|---------|----------------------|
| `yjs` | CRDT document for room state | Yes (`@geekslides/server`) |
| `y-websocket` | WebSocket provider for Yjs | Yes (`@geekslides/server`) |
| `@types/vscode` | VS Code API typings | No (dev dependency) |
| `esbuild` | Extension bundler | No (dev dependency) |

## Room Name Resolution

The extension must connect to the same Yjs room as the browser. That room comes from
the resolved deck configuration, specifically `config.sync.room`, with the same default
as the engine (`default` when omitted). The extension should therefore either:

1. read and parse the same `config.json` used to launch the deck, or
2. reuse the already resolved config metadata held by the server manager.

It should **not** invent a room from the config path or workspace folder name.

## CLI Resolution Strategy

The extension should not assume `geekslides` is installed globally. Commands that launch
the CLI (`dev`, `create`) should resolve the executable in this order:

1. workspace-local binary (`node_modules/.bin/geekslides`)
2. monorepo binary during local development (`packages/cli/bin/geekslides.cjs`)
3. global `geekslides` on `PATH`

This keeps the extension usable both inside the GeekSlides monorepo and in normal deck
repositories.

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `geekslides.debounceMs` | number | 300 | Cursor movement debounce delay |
| `geekslides.autoStartServer` | boolean | false | Start dev server on workspace open |
| `geekslides.defaultPort` | number | 3000 | Default Vite dev server port |
| `geekslides.wsPort` | number | 1234 | Default y-websocket server port |

## Future Enhancements (Post-MVP)

- **Markdown preview pane** — side-by-side slide preview inside VS Code
- **Slide outline view** — tree view showing slide hierarchy with navigation
- **Snippet completion** — IntelliSense for slide markers, plugin names, config fields
- **Deck deployment** — deploy to Docker/cloud from VS Code
- **Multi-deck support** — manage multiple decks in a workspace
- **Codespaces support** — port forwarding, remote dev server
- **Marketplace publishing** — package and publish to VS Code Marketplace

## Reference

- [sync.md](sync.md) — Yjs room state, `sessionState` Y.Map
- [plugin-system.md](plugin-system.md) — preprocessor/processor pipeline
- [architecture-v2.md](architecture-v2.md) — system architecture
- [command-system.md](command-system.md) — navigation commands
- [plan/phase-10-hmr.md](plan/phase-10-hmr.md) — HMR plugin
- [plan/phase-19-vscode-extension.md](plan/phase-19-vscode-extension.md) — implementation plan
