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
│  │  ├─ whiteboardStrokes  │      │  │  ├─ whiteboardStrokes  │
│  │  │   (Y.Array)         │      │  │  │   (Y.Array)         │
│  │  └─ liveStrokes        │      │  │  └─ liveStrokes        │
│  │      (Y.Map)           │      │  │      (Y.Map)           │
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

Syncs the presentation state across all connected clients. The map contains the following keys:

- **`slide`** (number) — current slide index, 0-based.
- **`partial`** (number) — current partial index within the slide.
- **`mode`** (string) — presentation mode: `'present'`, `'speaker'`, or `'overview'`.
- **`presenterActive`** (boolean) — whether the presenter is actively controlling.
- **`presenterId`** (string | null) — the Yjs client ID of the presenter (for authority).
- **`contentProxy`** (object) — published by the presenter when a deck is uploaded to the server proxy. Shape: `{ room, baseUrl, loadedAt }`. Audience clients receive this and reload from the proxy URL. The `room` field is critical: observers check `proxy.room === sync.currentRoom` before acting to guard against CRDT contamination (see below). See [content-proxy.md](content-proxy.md).
- **`roomTransfer`** (object) — published by the presenter when switching rooms via the `room` command. Shape: `{ toRoom, at }` where `at` is a UTC timestamp. The speaker view observes this key and follows the presenter to the new room, reconnecting its WebSocket and loading the new room's deck via HTTP. Set approximately 300 ms before the presenter disconnects so the observer fires while the connection is still alive.

### `whiteboardStrokes` (Y.Array)

Syncs completed whiteboard strokes. Each element in the array is a stroke object with:

- **`id`** (string) — unique stroke identifier.
- **`slideIndex`** (number) — which slide the stroke belongs to.
- **`points`** (array of `[x, y]` pairs) — normalized coordinates in the 0–1 range.
- **`color`** (string) — CSS color value.
- **`width`** (number) — line width in pixels.
- **`clientId`** (string) — the client that drew the stroke.
- **`compositeOp`** (string, optional) — canvas `globalCompositeOperation` (e.g. `'source-over'`, `'destination-out'` for eraser). Defaults to `'source-over'`.
- **`alpha`** (number, optional) — canvas `globalAlpha` (e.g. `0.3` for highlighter). Defaults to `1.0`.

### `liveStrokes` (Y.Map)

Syncs in-progress strokes for real-time progressive rendering. Keys are SyncManager
client IDs; values are stroke objects (same shape as above) containing the cumulative
points drawn so far. Updated every 100 ms during drawing. Cleared when the stroke
is finalized and moved to `whiteboardStrokes`.

## SyncManager Implementation

`SyncManager` is the bridge between the local slideshow and the Yjs shared document.

**Constructor**: Creates a new `Y.Doc` and obtains references to the `sessionState` Y.Map (`doc.getMap('sessionState')`), `whiteboardStrokes` Y.Array (`doc.getArray('whiteboardStrokes')`), and `liveStrokes` Y.Map (`doc.getMap('liveStrokes')`). Stores a reference to the `GeekSlideshow` element. A private `#isRemoteUpdate` flag prevents echo loops.

**`connect(serverUrl, room)`**: Creates a `WebsocketProvider` connecting to the given server URL and room name. Listens for `status` events and dispatches `geek:sync:state` CustomEvents when connection status changes.

- **Session state observer**: Watches the Y.Map for changes. When a remote transaction arrives (ignoring local ones), reads `slide`, `partial`, and `mode` from the map and applies them to the slideshow via `goTo()` and `mode` setter. Sets `#isRemoteUpdate` to `true` during application to prevent the local change from being re-published. Also monitors the `whiteboardVisible` key independently of follow-presenter mode: when changed remotely it dispatches `geek:whiteboard:remote-visibility` (`{ visible: boolean }`) so all sessions mirror the presenter's canvas show/hide state.

- **Whiteboard observer**: Watches the Y.Array for added items from remote transactions. For each new stroke, dispatches a `geek:whiteboard:remote-stroke` CustomEvent with the stroke data. The `<geek-whiteboard>` component listens for this event and renders each remote stroke via `drawRemoteStroke()`. `WhiteboardSync` is activated in `main.js` alongside sync setup, completing the bidirectional pipeline: local draw → event → `addStroke()` → Y.Array → remote observer → event → `drawRemoteStroke()`. When strokes are **deleted** remotely (via `clearStrokes()`), the observer collects the affected slide indices from `event.changes.deleted`, then dispatches `geek:whiteboard:remote-clear` (`{ slideIndex, remaining }`) so all clients wipe and redraw only the remaining strokes for that slide.

- **Live stroke observer**: Watches the `liveStrokes` Y.Map for remote updates. When a key is added or updated, dispatches a `geek:whiteboard:remote-stroke-progress` CustomEvent. The whiteboard renders only the new points since the last update via `drawLiveStroke()`, providing real-time progressive rendering. On finalization, `WhiteboardSync` clears the live entry and pushes the completed stroke to the Y.Array; `drawRemoteStroke()` skips re-drawing points already rendered by the live path.

**`publishState(slide, partial, mode)`**: Called by local navigation handlers. If `#isRemoteUpdate` is true, returns immediately (preventing echo). Otherwise wraps updates in a `doc.transact()` call, setting the `slide`, `partial`, `mode`, `presenterId` (current client ID), and `presenterActive` keys on the Y.Map.

**`addStroke(stroke)`**: Pushes a whiteboard stroke object to the shared Y.Array.

**`getStrokes()`**: Returns all existing strokes from the Y.Array as a plain array. Used by late-joining clients to replay whiteboard state that was drawn before they connected.

**`clearStrokes(slideIndex)`**: Within a transaction, iterates the Y.Array in reverse and deletes all strokes matching the given slide index. Remote observers receive a `geek:whiteboard:remote-clear` event so all other sessions immediately clear and redraw the affected slide.

**`publishWhiteboardVisible(visible)`**: Sets `whiteboardVisible` on the shared `sessionState` Y.Map. Remote observers dispatch `geek:whiteboard:remote-visibility` so all sessions mirror the canvas show/hide state.

**`updateConnectionToken(token)`**: Stores the token in the live WebSocket provider's URL params so that any future reconnection by y-websocket uses it automatically. No disconnect/reconnect is performed — the existing connection stays open.

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

## CRDT Contamination on Room Change

### Problem

Yjs `Y.Doc` instances are **reused** across room changes (the same in-memory document is reconnected to a new y-websocket room). When the presenter switches from room A to room B, the Y.Doc still carries all values set while in room A — including room A's `contentProxy`. Because CRDT logical clocks are cumulative, room A's `contentProxy` value may carry a **higher Yjs clock** than room B's existing value. When the Y.Doc reconnects to room B's y-websocket server, CRDT merge can overwrite room B's `contentProxy` with room A's stale value — causing all clients in room B (including the presenter and any speaker view) to reload the wrong deck.

### Fixes Applied

**1. `proxy.room` guard** — Both `checkContentProxy()` (interactive view) and `checkSpeakerContentProxy()` (speaker view) check:

```js
if (proxy.room && sync.currentRoom && proxy.room !== sync.currentRoom) {
  // IGNORED — stale proxy from another room
  return;
}
```

This blocks any `contentProxy` whose `room` field does not match the client's current room.

**2. Re-assert correct proxy after room adoption** — When `changeRoom()` adopts an existing room's deck (`roomHasDeck = true`), it writes the correct room-scoped `contentProxy` back to Yjs after loading:

```js
const correctProxyJson = JSON.stringify({ room: roomName, baseUrl: roomProxyBase, loadedAt: Date.now() });
lastProxyRaw = correctProxyJson;  // prevent self-trigger
await reloadDeckFromProxy(roomProxyBase);
sync.doc.transact(() => {
  sync.doc.getMap('sessionState').set('contentProxy', correctProxyJson);
});
```

This heals server-side CRDT contamination: the correct value's new timestamp wins future merges, so subsequent joiners receive the right proxy.

**3. Initial-upload CRDT skip fix** — The 600 ms initial-upload IIFE checks whether the existing `contentProxy` room matches the current room before skipping the upload:

```js
if (existingProxy.room === room) {
  // Room already has a deck — skip upload
  return;
}
// existingProxy is from a different room (contamination) — proceed with upload
```

Without this, a contaminated proxy from a previous session in a different room would suppress the upload, leaving the room permanently empty of the correct deck.

## Read-Only Rooms

### Overview

Protected rooms enforce a presenter/viewer split. The presenter can navigate and draw; viewers are passive mirrors.

### URL Patterns

| URL | Role | Behavior |
|-----|------|----------|
| `?room=name` (unprotected room) | peer | Full read+write — backward compatible |
| `?room=name&token=secret` (protected room) | presenter | Full read+write with valid token |
| `?room=name&readonly` | viewer | Read-only — no terminal, nav, or whiteboard |
| `?room=name` (protected room, no token) | rejected | Server returns 403 |

### Server Components

**`RoomStore`** — In-memory `Map<room, { presenterToken, createdAt }>`. Tokens are 32 random bytes encoded as 64 hex characters. Validation uses `crypto.timingSafeEqual` to prevent timing attacks.

**`RateLimiter`** — Sliding-window counter per IP. Default: 10 failed attempts per 60 seconds. Applied before auth processing. Returns HTTP 429 when exceeded.

**`RoomApi`** — HTTP endpoints:
- `POST /api/rooms/:room/share` → Creates a protected room, returns `{ presenterToken }`
- `POST /api/rooms/:room/auth` → Validates a token, returns `{ role }`
- `GET /api/rooms/:room/role` → Reports whether a room is protected

**Write filtering** — After `setupWSConnection` registers its message handler on a viewer connection, the server replaces the `message` listeners with filtered versions that silently drop Yjs update messages (message type 0, sync sub-type 2). Sync step 1/2 and awareness messages pass through, so viewers still receive state.

### Engine Changes

**`SyncManager`** — Accepts an optional `{ readonly: true }` constructor option. When readonly:
- `publishState()`, `addStroke()`, `updateLiveStroke()`, `clearLiveStroke()`, `clearStrokes()` are all no-ops
- `connect()` passes `readonly` as a WebSocket query param
- `isReadonly` getter exposes the flag

**Client lockdown** — When `?readonly` is in the URL:
- No `<geek-terminal>` element is created
- No `CommandSystem`, `KeyBindings`, or `TouchInput` are activated
- No whiteboard drawing (element is created with `readonly` attribute for replay only)
- A `VIEW ONLY` badge and green sync dot are shown
- Content proxy observer still works (viewer can load remote deck assets)

### `share` Terminal Command

1. `POST /api/rooms/:room/share` to create a protected room
2. Copies the viewer URL to the clipboard via `navigator.clipboard.writeText` (best-effort; silent fallback on non-HTTPS contexts)
3. Renders the viewer URL as a clickable link via `terminal.setOutputLink()` with `persist: true`
4. Stores the presenter token on the live connection via `sync.updateConnectionToken(token)` (avoids tearing down the WebSocket)
5. Updates the browser URL with `&token=` parameter

**Security:** removing `&readonly` from the viewer URL does not grant write access. The server enforces role at WebSocket upgrade time — connections to a protected room without a valid `presenterToken` are rejected with HTTP 403. Viewer connections with `?readonly` have Yjs update messages silently dropped by `applyReadOnlyFilter` server-side.

## Server Binding and Private Network Access

The sync server (`@geekslides/server`) binds to `127.0.0.1` (loopback) by default. This means:

- The server is **not** reachable from the local network or other machines
- VS Code devcontainer will not auto-forward port 1234 to the host
- The browser cannot directly connect to port 1234, even if port forwarding is active
- Clients always connect through the reverse proxy (Caddy in production, Vite dev proxy in development)

To override and bind to all interfaces (e.g. for a standalone server without a proxy), set the `HOST` environment variable:

```bash
HOST=0.0.0.0 node server/dist/index.cjs
```

### Private Network Access (PNA) header

The server also adds `Access-Control-Allow-Private-Network: true` to all HTTP responses and WebSocket 101 upgrade responses. This prevents Chrome from showing the "Allow this page to access resources on your local network?" dialog in scenarios where a page on a private or public origin tries to connect to a server on a local address (e.g. when accessing the dev server via a LAN IP while the sync server is on localhost).
