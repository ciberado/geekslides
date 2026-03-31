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

Syncs the presentation state across all connected clients:

```typescript
interface SessionState {
  /** Current slide index (0-based) */
  slide: number;
  /** Current partial index within the slide */
  partial: number;
  /** Presentation mode */
  mode: 'present' | 'speaker' | 'overview';
  /** Whether the presenter is actively controlling */
  presenterActive: boolean;
  /** Presenter's client ID (for authority) */
  presenterId: string | null;
}
```

### `whiteboardStrokes` (Y.Array)

Syncs whiteboard drawing data:

```typescript
interface WhiteboardStroke {
  /** Unique stroke ID */
  id: string;
  /** Which slide the stroke belongs to */
  slideIndex: number;
  /** Array of [x, y] normalized coordinates (0-1 range) */
  points: [number, number][];
  /** CSS color */
  color: string;
  /** Line width in pixels */
  width: number;
  /** Client ID that drew this stroke */
  clientId: string;
}
```

## SyncManager Implementation

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export class SyncManager {
  #doc: Y.Doc;
  #provider: WebsocketProvider | null = null;
  #sessionState: Y.Map<unknown>;
  #whiteboardStrokes: Y.Array<WhiteboardStroke>;
  #slideshow: GeekSlideshow;
  #isRemoteUpdate = false;

  constructor(slideshow: GeekSlideshow) {
    this.#doc = new Y.Doc();
    this.#sessionState = this.#doc.getMap('sessionState');
    this.#whiteboardStrokes = this.#doc.getArray('whiteboardStrokes');
    this.#slideshow = slideshow;
  }

  /**
   * Connect to a sync room.
   */
  connect(serverUrl: string, room: string): void {
    this.#provider = new WebsocketProvider(serverUrl, room, this.#doc);

    this.#provider.on('status', (event: { status: string }) => {
      document.dispatchEvent(new CustomEvent('geek:sync:state', {
        detail: { connected: event.status === 'connected', room },
      }));
    });

    // Observe remote state changes → update local slideshow
    this.#sessionState.observe((event) => {
      if (event.transaction.local) return; // ignore own changes
      
      this.#isRemoteUpdate = true;
      const slide = this.#sessionState.get('slide') as number;
      const partial = this.#sessionState.get('partial') as number;
      const mode = this.#sessionState.get('mode') as string;

      this.#slideshow.goTo(slide, partial);
      this.#slideshow.mode = mode;
      this.#isRemoteUpdate = false;
    });

    // Observe remote whiteboard strokes
    this.#whiteboardStrokes.observe((event) => {
      if (event.transaction.local) return;
      for (const item of event.changes.added) {
        for (const stroke of item.content.getContent()) {
          document.dispatchEvent(new CustomEvent('geek:whiteboard:remote-stroke', {
            detail: stroke,
          }));
        }
      }
    });
  }

  /**
   * Called when local navigation happens.
   * Updates Y.Map so it propagates to other clients.
   */
  publishState(slide: number, partial: number, mode: string): void {
    if (this.#isRemoteUpdate) return; // prevent echo loops
    
    this.#doc.transact(() => {
      this.#sessionState.set('slide', slide);
      this.#sessionState.set('partial', partial);
      this.#sessionState.set('mode', mode);
      this.#sessionState.set('presenterId', this.#doc.clientID.toString());
      this.#sessionState.set('presenterActive', true);
    });
  }

  /**
   * Add a whiteboard stroke to the shared array.
   */
  addStroke(stroke: WhiteboardStroke): void {
    this.#whiteboardStrokes.push([stroke]);
  }

  /**
   * Clear all whiteboard strokes for a specific slide.
   */
  clearStrokes(slideIndex: number): void {
    this.#doc.transact(() => {
      // Find and remove strokes for this slide (iterate in reverse)
      for (let i = this.#whiteboardStrokes.length - 1; i >= 0; i--) {
        const stroke = this.#whiteboardStrokes.get(i);
        if (stroke.slideIndex === slideIndex) {
          this.#whiteboardStrokes.delete(i, 1);
        }
      }
    });
  }

  disconnect(): void {
    this.#provider?.destroy();
    this.#provider = null;
  }
}
```

## y-websocket Server

### @geekslides/server

Thin wrapper around the y-websocket server with room auth:

```typescript
// packages/server/src/index.ts
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

interface ServerOptions {
  port: number;
  host?: string;
  persistence?: boolean;   // enable LevelDB persistence
  authCallback?: (room: string, token: string) => boolean;
}

export function createServer(options: ServerOptions): WebSocketServer {
  const wss = new WebSocketServer({ port: options.port, host: options.host });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `ws://${req.headers.host}`);
    const room = url.searchParams.get('room');
    const token = url.searchParams.get('token');

    if (!room) {
      ws.close(4001, 'Room name required');
      return;
    }

    // Optional auth
    if (options.authCallback && !options.authCallback(room, token ?? '')) {
      ws.close(4003, 'Unauthorized');
      return;
    }

    setupWSConnection(ws, req, { docName: room });
  });

  console.log(`yjs-server listening on ws://${options.host ?? '0.0.0.0'}:${options.port}`);
  return wss;
}
```

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

```typescript
// In SyncManager
#followPresenter = true;

toggleFollow(): void {
  this.#followPresenter = !this.#followPresenter;
  document.dispatchEvent(new CustomEvent('geek:sync:state', {
    detail: { following: this.#followPresenter },
  }));
}

// In the Y.Map observer:
this.#sessionState.observe((event) => {
  if (event.transaction.local) return;
  if (!this.#followPresenter) return; // ignore remote if not following
  // ... apply remote state
});
```

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
