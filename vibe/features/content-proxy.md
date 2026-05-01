# Content Proxy

## Problem

When the presenter loads a deck from their local filesystem or internal network, remote
viewers/presenters connected via the sync server cannot access the same content. Their
browsers try to fetch config.json, markdown, CSS, and images from the original URL — which
is unreachable outside the presenter's local environment.

## Solution

The presenter's browser uploads the deck assets (config, markdown, CSS, and referenced
images) to the server via HTTP. The server stores them in a temp directory scoped to the
sync room. All clients — including the presenter — always load deck content from the server
proxy endpoint instead of the original source.

## Design Decisions

### Conversation Record

| Question | Answer | Rationale |
|----------|--------|-----------|
| What content to proxy? | **Deck assets only** (config, markdown, CSS, images) | External resources (CDN, iframes) stay as-is; only local assets need relaying |
| Activation model? | **Always proxy** | Simplest — no runtime decisions, consistent behavior for all clients |
| How does content reach the server? | **Presenter uploads via HTTP** | Browser pushes content on connect; no Docker mount needed for ad-hoc sharing |
| HMR for remote viewers? | **No — snapshot only** | Remote viewers get content at upload time; presenter restarts to push updates |
| Security scoping? | **Room-scoped** | Deck content is tied to the sync room; requires valid room membership to fetch |
| Upload transport? | **HTTP REST** | `POST /api/rooms/:room/content` — simple multipart upload |
| Storage backend? | **Temp filesystem** | Write to a temp directory on the server; cleaned up when room is destroyed |
| Max deck size? | **200 MB** | Generous limit to accommodate image-heavy decks |
| Image handling? | **Only referenced files** | Client scans markdown + CSS for image references, uploads only those |

### Architecture Decision

**D22 — Content proxy: always-proxy with HTTP upload to temp filesystem, room-scoped**

The presenter's browser collects deck assets (config.json, markdown, stylesheets, and
referenced images), uploads them to `POST /api/rooms/:room/content`, and all clients
fetch deck content from `GET /api/rooms/:room/content/:path`. Content is stored in a
server-side temp directory per room and cleaned up when the room expires.

## Architecture

```
┌─────────────────────────┐
│   Presenter Browser     │
│                         │
│  1. Load deck locally   │
│  2. Scan for assets     │  POST /api/rooms/:room/content
│  3. Upload bundle ──────┼──────────────────────┐
│  4. Rewrite config URL  │                      │
│     to server proxy     │                      ▼
│                         │          ┌───────────────────────┐
│                         │          │   GeekSlides Server   │
│                         │          │                       │
│  5. Fetch from proxy  ◄─┼──────────┤  /api/rooms/:room/   │
│                         │          │    content/:path      │
└─────────────────────────┘          │                       │
                                     │  Temp dir per room:   │
┌─────────────────────────┐          │  /tmp/gs-rooms/       │
│   Audience Browser      │          │    <room>/            │
│                         │          │      config.json      │
│  6. Receive sync state  │          │      README.md        │
│  7. Fetch from proxy  ◄─┼──────────┤      local.css        │
│                         │          │      images/...       │
└─────────────────────────┘          └───────────────────────┘
```

## API Design

### Upload Deck Content

```
POST /api/rooms/:room/content
Content-Type: multipart/form-data

Fields:
  files[]: (multiple) — deck files with relative paths preserved
  manifest: JSON string — { files: ["config.json", "README.md", ...] }

Response: 201 Created
{
  "room": "my-talk",
  "files": ["config.json", "README.md", "local.css", "images/logo.png"],
  "totalSize": 2456789
}
```

### Fetch Deck Asset

```
GET /api/rooms/:room/content/:path
    
Response: 200 OK (file content with appropriate Content-Type)
Response: 404 Not Found (if room or file doesn't exist)
```

### Size Limits

- Max total upload: 200 MB
- Individual file: no separate limit (bounded by total)
- Enforced via `Content-Length` header check before reading body

## Deck Proxy (Mixed-Content Bypass)

When the slide engine is served over HTTPS and the deck URL is plain HTTP (e.g. a local
server on the LAN), browsers block all `fetch()` calls and `<img src>` to that HTTP origin
as **mixed content**. The deck proxy solves this server-side.

### Endpoint

```
GET /api/deck-proxy?url=<percent-encoded-url>
```

The server fetches the requested URL (must be `http://` or `https://`) and streams the
response body back to the browser. Max 50 MB per request.

### Security (SSRF protection)

- Only `http:` and `https:` schemes are allowed.
- `169.254.169.254` (cloud metadata) and `0.0.0.0` are always blocked.
- `localhost` / `127.0.0.1` / `::1` are blocked unless `DEV_PROXY=true` env var is set.
- IPv4 link-local (`169.254.x.x`) is blocked.
- Private LAN ranges (`10.x`, `172.16–31.x`, `192.168.x`) are intentionally **allowed** so
  decks served from a local server can be proxied.

### Client-Side Integration (`packages/cli/app/main.js`)

- `proxyUrlIfNeeded(url)` — returns `/api/deck-proxy?url=...` when the URL is `http://` and
  the page is on `https://`. Used for the initial `config.json` fetch (`fetchConfig`),
  individual CSS files (`fetchStyles`), and markdown content (`fetchMarkdown`).
- `rewriteMarkdownUrlsForProxy(markdown)` — after fetching markdown through the proxy,
  rewrites all relative `![alt](relative-path)` image references to absolute proxied URLs
  before the markdown is parsed. Prevents `<img src="http://...">` mixed-content blocks.
- `updateDocumentBase` skips setting a `<base href="http://...">` tag when the page is on
  HTTPS to avoid poisoning relative DOM resource resolution.
- During `uploadDeck`, asset fetches (CSS, images, etc.) are also wrapped with
  `proxyUrlIfNeeded` so the presenter's browser never fetches HTTP assets directly when on
  HTTPS. Without this, deck uploads from HTTP decks silently dropped all assets due to
  mixed-content blocks, causing audience viewers to get 404 for stylesheets and images.

## Client-Side Flow


### Presenter (Uploader)

1. Load config.json from the original local/network URL
2. Parse markdown content, scan for image references (`![](path)`, `bgurl(path)`)
3. Scan CSS for `url(...)` references  
4. Collect all referenced files into a manifest
5. Upload via multipart POST to `/api/rooms/:room/content`
6. Rewrite the `?config=` URL to point at `/api/rooms/:room/content/config.json`
7. All subsequent fetches go through the server proxy

### Audience (Consumer)

1. Connect to sync room via Yjs
2. Receive `contentProxy` field from shared Y.Map `sessionState`
   - Contains the room name for proxied content
3. Load deck from `/api/rooms/:room/content/config.json`
4. All relative asset URLs resolve against the proxy base

## Room Change and Deck Adoption

When the presenter runs `room <name>` to switch rooms, the following happens:

1. **Signal**: `sessionState.roomTransfer = { toRoom, at }` is set 300 ms before disconnect, so speaker views and other observers can react while the connection is still alive.
2. **Disconnect / reconnect**: `sync.disconnect()` then `sync.connect(wsUrl, newRoom)`.
3. **Room content check**: The presenter performs an HTTP `GET /api/rooms/<newRoom>/content/config.json`:
   - **200 OK** → room already has a deck. The presenter adopts it via `reloadDeckFromProxy()` and sets `lastProxyRaw` to the new room's proxy sentinel to prevent re-uploading.
   - **404** → room is empty. The presenter uploads its own deck to the new room via `uploadDeckToRoom(newRoom)`.

### Initial Upload Race Guard

When a new interactive client opens a room, it waits 600 ms for Yjs to sync. If `contentProxy` already exists in the shared state **and its `room` field matches the current room**, it skips uploading — another presenter has already populated the room. This prevents the second window from overwriting the first presenter's deck.

Important: the check compares `existingProxy.room === currentRoom`. A `contentProxy` from a different room is CRDT contamination (see below) and must be ignored — the client must proceed with uploading the correct deck.

### Stale `contentProxy` Guard (`lastUploadStartedAt`)

After a presenter starts an upload, the Yjs `contentProxy` from the *previous* room may still arrive via CRDT merge. `checkContentProxy()` skips any proxy whose `loadedAt` timestamp is earlier than `lastUploadStartedAt` to prevent briefly reloading the old deck.

### Self-Trigger Guard (`lastProxyRaw` Pre-Set)

When `uploadDeckToRoom()` sets `contentProxy` in the Yjs Y.Map, the same client's own `sessionState` observer fires immediately. Without a guard, `checkContentProxy()` would interpret this as a remote update and call `reloadDeckFromProxy()` — overwriting the freshly loaded deck with a proxy copy, causing a visible flicker and double-load.

The fix: **pre-set `lastProxyRaw` to `proxyJson` before calling `sync.doc.transact()`**. When the observer fires, `proxyRaw === lastProxyRaw` causes an early return. This pattern is applied in both `uploadDeckToRoom()` and the initial-upload IIFE.

```js
lastProxyRaw = proxyJson;  // pre-set before transact
sync.doc.transact(() => {
  sync.doc.getMap('sessionState').set('contentProxy', proxyJson);
});
```

### CRDT Contamination (Cross-Room)

The Yjs Y.Doc is reused across room changes. Room A's `contentProxy` (set with clock N) stays in the Y.Doc when reconnecting to room B. If room B's server has clock < N for `contentProxy`, CRDT merge pushes room A's value to room B's server, corrupting room B's state.

Three defences are in place — see [sync.md — CRDT Contamination on Room Change](sync.md#crdt-contamination-on-room-change) for full detail:

1. `proxy.room` guard in `checkContentProxy` and `checkSpeakerContentProxy`
2. Re-assert correct proxy in Yjs after adopting a room's existing deck
3. Initial-upload skips only when `existingProxy.room === currentRoom`

## Shared State Extension

The Yjs `sessionState` Y.Map gains a new field:

```
sessionState.set('contentProxy', {
  room: 'my-talk',
  baseUrl: '/api/rooms/my-talk/content/'
})
```

When a viewer sees `contentProxy` in the shared state, it loads the deck from that
base URL instead of needing a local `?config=` parameter.

## Implementation Plan

### Phase 1: Server — Content Store + HTTP API
- Add HTTP server alongside WebSocket server (share the same port via upgrade routing)
- `POST /api/rooms/:room/content` — accept multipart upload, write to temp dir
- `GET /api/rooms/:room/content/*` — serve files from temp dir
- Room cleanup: TTL-based eviction (24 h default) via `evictExpiredRooms()` + orphan
  scan on startup via `cleanOrphanedRoomDirs()`, run hourly via `startCleanup()`
- Size limit enforcement (200 MB)
- Path traversal protection (reject `..` in file paths)

### Phase 2: Client — Asset Scanner + Uploader  
- `DeckUploader` class in `@geekslides/engine`:
  - `scanAssets(config, markdown, css)` → list of relative paths
  - `uploadDeck(room, files)` → POST multipart to server
- Image reference scanner: parses markdown `![](path)` and `bgurl(path)` 
- CSS reference scanner: parses `url(...)` in stylesheets

### Phase 3: Client — Proxy-Aware Loading
- Extend `main.js` to detect sync + upload flow
- After upload, rewrite config URL to proxy endpoint
- Publish `contentProxy` to Yjs `sessionState`
- Audience clients read `contentProxy` and load from server
- `<base>` tag update for relative URL resolution

### Phase 4: Integration
- Wire up Caddy reverse proxy for `/api/*` to Node server
- Wire up Vite dev proxy for `/api/*`
- E2E test: presenter uploads, audience loads from proxy
