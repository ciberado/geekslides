# Phase 5: Synchronization

**Status**: Implemented
**Depends on**: Phase 2 (slideshow state to sync)
**Unlocks**: Phase 6 (whiteboard sync), Phase 7 (speaker view sync), Phase 9 (CLI dev command starts server)

## Goal

Implement the Yjs-based real-time sync: `SyncManager` bridging slideshow state to a
shared `Y.Doc`, `WhiteboardSync` for stroke data, and the `@geekslides/server` package
wrapping y-websocket with room auth. This replaces v1's custom MQTT broker entirely.

At the end of this phase, two browser tabs connected to the same room stay in sync:
navigating in one advances the other. The follow/unfollow toggle lets audience members
break sync and browse independently.

## Deliverables

### 1. SyncManager (`packages/engine/src/sync/SyncManager.ts`)

Bridge between the local slideshow and the Yjs shared document.

**Constructor**: Creates a `Y.Doc`, obtains `sessionState` (`Y.Map`) and
`whiteboardStrokes` (`Y.Array`). Stores a reference to the slideshow element.
Initializes `#isRemoteUpdate = false` and `#followPresenter = true`.

**`connect(serverUrl: string, room: string)`**: Creates a `WebsocketProvider`
connecting to the y-websocket server. Subscribes to provider `status` events and
dispatches `geek:sync:state` on the document. Sets up two observers:

- **Session state observer**: On Y.Map changes from remote transactions, reads
  `slide`, `partial`, `mode` and applies them to the slideshow via `goTo()` and
  `mode` setter. Guards with `#isRemoteUpdate` flag to prevent echo loops.
  Respects `#followPresenter` — if false, ignores remote state.

- **Whiteboard observer**: On Y.Array additions from remote transactions, dispatches
  `geek:whiteboard:remote-stroke` events for each new stroke.

**`publishState(slide, partial, mode)`**: If `#isRemoteUpdate`, returns immediately.
Otherwise wraps updates in `doc.transact()`, setting `slide`, `partial`, `mode`,
`presenterId`, and `presenterActive` on the Y.Map.

**`addStroke(stroke)`**: Pushes to the shared Y.Array.

**`clearStrokes(slideIndex)`**: Iterates Y.Array in reverse, deletes matching strokes.

**`toggleFollow()`**: Flips `#followPresenter`, dispatches `geek:sync:state` with
current following state. When re-enabling, snaps to presenter's current position.

**`disconnect()`**: Destroys the WebSocket provider, cleans up observers.

### 2. Sync types (`packages/engine/src/sync/types.ts`)

- `SessionState`: `{ slide: number, partial: number, mode: string, presenterActive: boolean, presenterId: string | null }`.
- `WhiteboardStroke`: `{ id: string, slideIndex: number, points: [number, number][], color: string, width: number, clientId: string }`.

### 3. WhiteboardSync (`packages/engine/src/sync/WhiteboardSync.ts`)

Thin layer specifically for whiteboard stroke syncing. Listens for local
`geek:whiteboard:stroke` events and calls `syncManager.addStroke()`. Receives
remote strokes via `geek:whiteboard:remote-stroke` events from `SyncManager`.

### 4. @geekslides/server (`packages/server/src/`)

**`index.ts`**: Creates a `WebSocketServer` on the configured port/host. On each
connection, parses URL query params for `room` and optional `token`. If no room,
closes with code 4001. If auth is enabled and token fails, closes with code 4003.
Otherwise delegates to y-websocket's `setupWSConnection`.

**`rooms.ts`**: Room lifecycle management. Rooms are auto-created on first connection.
Y.Doc stays in memory while clients exist. Optional LevelDB persistence for recovery.

### 5. Command wiring

Wire the sync-related commands registered as placeholders in Phase 4:
- `toggle-sync` → `syncManager.connect()` / `syncManager.disconnect()`.
- `toggle-follow` → `syncManager.toggleFollow()`.

### 6. Entry-point wiring

If `config.sync.enabled` is true, create a `SyncManager`, call `connect()` with
the server URL and room name from config. Wire slideshow navigation events to
`publishState()`. Wire whiteboard events to `WhiteboardSync`.

### 7. Tests

**`packages/engine/tests/unit/SyncManager.test.ts`**:
- `publishState()` updates Y.Map values.
- Remote Y.Map changes trigger `goTo()` on the slideshow mock.
- `#isRemoteUpdate` prevents echo loops.
- `toggleFollow()` ignores remote updates when following is disabled.
- `toggleFollow()` snaps to presenter position when re-enabled.

**`packages/engine/tests/integration/SyncManager.test.ts`** (Vitest browser mode):
- Two Y.Docs synced together, navigation in one triggers state change in the other.

**`packages/server/tests/rooms.test.ts`**:
- Valid room connection is accepted.
- Missing room is rejected with code 4001.
- Invalid token is rejected with code 4003.

## File List

```
packages/engine/src/sync/
├── SyncManager.ts
├── WhiteboardSync.ts
└── types.ts

packages/server/src/
├── index.ts
├── rooms.ts
└── persistence.ts

packages/engine/tests/unit/
└── SyncManager.test.ts

packages/engine/tests/integration/
└── SyncManager.test.ts

packages/server/tests/
└── rooms.test.ts
```

## Acceptance Criteria

- [ ] Two browser tabs on the same room sync slide position in real-time.
- [ ] Navigation in one tab advances the other within ~100 ms.
- [ ] `toggleFollow()` breaks sync — audience can browse independently.
- [ ] Re-enabling follow snaps to presenter's current slide.
- [ ] y-websocket server starts and accepts connections.
- [ ] Invalid room or token connections are rejected with correct close codes.
- [ ] Whiteboard strokes sync between tabs (visual test deferred to Phase 6).
- [ ] All unit and integration tests pass.

## Reference Docs

- [sync.md](../sync.md) — Yjs architecture, shared types, SyncManager, migration from v1
- [architecture-v2.md](../architecture-v2.md) — runtime topology with y-websocket
- [decisions.md](../decisions.md) — D5, D6, D7, D8 (Yjs choices)
