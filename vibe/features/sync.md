# Yjs Synchronization

## Overview

v2 replaces the custom MQTT protocol (Aedes broker in v1) with **Yjs**, a proven CRDT
library. Yjs provides automatic conflict resolution — if two users navigate simultaneously,
the state converges without custom conflict handling.

## Why Yjs over MQTT

| Aspect | v1 (MQTT / Aedes) | v2 (Yjs / y-websocket) |
|--------|-------------------|----------------------|
| Conflict resolution | Last-write-wins (manual) | CRDT auto-merge |
| Protocol | Custom topic conventions | Standard Yjs sync protocol |
| Server | Custom Aedes broker (400 LOC) | y-websocket server (off-the-shelf) |
| Auth | Username/password per room | Room-based via y-websocket auth callback |
| State | Ephemeral (lost on disconnect) | Y.Doc persistence (optional LevelDB) |
| Whiteboard sync | Custom MQTT messages | Y.Array of strokes |
| Reconnection | Manual resubscribe | Automatic Yjs sync on reconnect |
| Offline | None | Yjs merges offline changes on reconnect |

## Architecture

```
┌───────────────────────────┐      ┌───────────────────────────┐
│     Presenter Browser     │      │     Audience Browser      │
│                           │      │                           │
│  SyncManager              │      │  SyncManager              │
│  ├─ Y.Doc                 │      │  ├─ Y.Doc                 │
│  │  ├─ sessionState       │      │  │  ├─ sessionState       │
│  │  │   (Y.Map)           │◄────►│  │  │   (Y.Map)           │
│  │  └─ whiteboardStrokes  │      │  │  └─ whiteboardStrokes  │
│  │      (Y.Array)         │      │  │      (Y.Array)         │
│  │                        │      │  │                        │
│  └─ WebsocketProvider ────┼──┐   │  └─ WebsocketProvider ────┤
│                           │  │   │                           │
└───────────────────────────┘  │   └───────────────────────────┘
                               │
                          ┌────┴───────────────┐
                          │  y-websocket server │
                          │  (Node.js)          │
                          │                     │
                          │  ├─ Room: "my-talk" │
                          │  │   └─ Y.Doc       │
                          │  │      (merged)    │
                          │  │                  │
                          │  └─ Optional:       │
                          │     LevelDB persist │
                          └─────────────────────┘
```

## Shared Types

### `sessionState` (Y.Map)

Syncs the presentation state across all connected clients. The map contains five keys:

- **`slide`** (number) — current slide index, 0-based.
- **`partial`** (number) — current partial index within the slide.
- **`mode`** (string) — presentation mode: `'present'`, `'speaker'`, or `'overview'`.
- **`presenterActive`** (boolean) — whether the presenter is actively controlling.
- **`presenterId`** (string | null) — the Yjs client ID of the presenter (for authority).

### `whiteboardStrokes` (Y.Array)

Syncs whiteboard drawing data. Each element in the array is a stroke object with:

- **`id`** (string) — unique stroke identifier.
- **`slideIndex`** (number) — which slide the stroke belongs to.
- **`points`** (array of `[x, y]` pairs) — normalized coordinates in the 0–1 range.
- **`color`** (string) — CSS color value.
- **`width`** (number) — line width in pixels.
- **`clientId`** (string) — the client that drew the stroke.

## SyncManager Implementation

`SyncManager` is the bridge between the local slideshow and the Yjs shared document.

**Constructor**: Creates a new `Y.Doc` and obtains references to the `sessionState` Y.Map (`doc.getMap('sessionState')`) and `whiteboardStrokes` Y.Array (`doc.getArray('whiteboardStrokes')`). Stores a reference to the `GeekSlideshow` element. A private `#isRemoteUpdate` flag prevents echo loops.

**`connect(serverUrl, room)`**: Creates a `WebsocketProvider` connecting to the given server URL and room name. Listens for `status` events and dispatches `geek:sync:state` CustomEvents when connection status changes.

- **Session state observer**: Watches the Y.Map for changes. When a remote transaction arrives (ignoring local ones), reads `slide`, `partial`, and `mode` from the map and applies them to the slideshow via `goTo()` and `mode` setter. Sets `#isRemoteUpdate` to `true` during application to prevent the local change from being re-published.

- **Whiteboard observer**: Watches the Y.Array for added items from remote transactions. For each new stroke, dispatches a `geek:whiteboard:remote-stroke` CustomEvent with the stroke data. The `<geek-whiteboard>` component listens for this event and renders each remote stroke via `drawRemoteStroke()`. `WhiteboardSync` is activated in `main.js` alongside sync setup, completing the bidirectional pipeline: local draw → event → `addStroke()` → Y.Array → remote observer → event → `drawRemoteStroke()`.

**`publishState(slide, partial, mode)`**: Called by local navigation handlers. If `#isRemoteUpdate` is true, returns immediately (preventing echo). Otherwise wraps updates in a `doc.transact()` call, setting the `slide`, `partial`, `mode`, `presenterId` (current client ID), and `presenterActive` keys on the Y.Map.

**`addStroke(stroke)`**: Pushes a whiteboard stroke object to the shared Y.Array.

**`getStrokes()`**: Returns all existing strokes from the Y.Array as a plain array. Used by late-joining clients to replay whiteboard state that was drawn before they connected.

**`clearStrokes(slideIndex)`**: Within a transaction, iterates the Y.Array in reverse and deletes all strokes matching the given slide index.

**`disconnect()`**: Destroys the WebSocket provider and cleans up.

## y-websocket Server

### @geekslides/server

Thin wrapper around the y-websocket server with room auth.

The server entry point (`packages/server/src/index.ts`) creates a `WebSocketServer` on the configured port and host. On each connection, it parses the URL query parameters to extract the `room` name and optional `token`. If no room is provided, the connection is closed with code 4001. If an `authCallback` is configured and the token fails validation, the connection is closed with code 4003. Otherwise, it delegates to y-websocket's `setupWSConnection` with the room name as the document name.

### Room Lifecycle

| Event | Behavior |
|-------|----------|
| First client connects to room | Y.Doc created in memory |
| Client disconnects | Y.Doc stays in memory while other clients exist |
| Last client disconnects | Y.Doc garbage collected (or persisted if LevelDB enabled) |
| New client connects to existing room | Full Y.Doc state synced automatically |
| Network interruption | Yjs buffers changes, syncs on reconnect |

## Sync Modes

The audience can optionally break sync to navigate independently:

`SyncManager` maintains a private `#followPresenter` boolean (default `true`). The `toggleFollow()` method flips it and dispatches a `geek:sync:state` event with the current following state. Inside the Y.Map observer, if `#followPresenter` is `false`, remote state changes are silently ignored — the audience member can browse freely. Re-enabling follow snaps back to the presenter's current position.

## Migration from v1

| v1 Concept | v2 Equivalent |
|------------|---------------|
| `MqttHub.publish('rooms/X/state/location', ...)` | `syncManager.publishState(slide, partial, mode)` |
| `MqttHub.subscribe('rooms/X/state/+')` | `sessionState.observe(...)` (automatic) |
| `LocalHub` (no-sync mode) | `SyncManager` without calling `connect()` |
| `SyncController.desiredLocation` | Not needed — Yjs CRDT handles conflict |
| Aedes broker auth (username/password) | y-websocket `authCallback(room, token)` |
| MQTT topic `rooms/<room>/state/<key>` | Y.Map keys: `slide`, `partial`, `mode` |
| MQTT QoS / retain | Yjs automatic state sync on connect |
