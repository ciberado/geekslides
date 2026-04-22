# Sync Your Presentation

Share your slides in real time with any number of viewers. GeekSlides uses Yjs — a conflict-free replicated data type (CRDT) library — over WebSocket. No accounts, no plugins, no login. Everyone in the same room sees the same slide, the same partials, and the same whiteboard strokes.

## Prerequisites

- GeekSlides CLI installed ([Install the CLI](01-install-the-cli.md))
- A deck ready to present ([Create Your First Deck](02-create-your-first-deck.md))

## Start the sync server

The dev server starts the Yjs WebSocket server automatically:

```bash
geekslides dev
```

By default, the WebSocket server listens on port **1234**. Override it with `--ws-port`:

```bash
geekslides dev --ws-port 9000
```

To disable sync entirely (local-only mode):

```bash
geekslides dev --no-sync
```

## Connect to a room

Add a `room` query parameter to the URL:

```
http://localhost:5173/?config=my-talk/config.json&room=demo
```

Every browser that opens the same `room` value joins a shared session. The presenter navigates; viewers follow along.

> **Tip:** Choose descriptive room names like `team-standup` or `aws-talk-rehearsal` so you don't accidentally collide with other sessions on a shared server.

### Configure sync in config.json

Instead of relying on query parameters, declare sync settings in your deck's `config.json`:

```json
{
  "title": "My Presentation",
  "content": "README.md",
  "sync": {
    "enabled": true,
    "server": "ws://localhost:1234",
    "room": "my-talk"
  }
}
```

| Field | Type | Default | Purpose |
|---|---|---|---|
| `sync.enabled` | boolean | `true` | Enable or disable sync |
| `sync.server` | string | `ws://localhost:1234` | WebSocket server URL |
| `sync.room` | string | `"default"` | Default room name |

The `?room=` query parameter always overrides `sync.room`, so you can hardcode a default and switch rooms on the fly.

## The sync status indicator

A small dot in the top-right corner of the screen shows connection state at a glance:

| Colour | Meaning |
|---|---|
| 🟢 Green | Connected and following the presenter |
| 🟠 Orange | Connected but browsing independently |
| ⚫ Grey | Disconnected |

## What gets synced

Everything the audience needs to stay in lockstep with the presenter:

| Data | How it syncs |
|---|---|
| **Slide position** | Current slide index and partial reveal index |
| **Whiteboard strokes** | Completed strokes shared instantly; in-progress strokes streamed every 100 ms |
| **Presentation mode** | Present, speaker, or overview mode |
| **Deck content** | Images, CSS, and config uploaded via the content proxy |

## Read-only viewer mode

Share a **view-only** link so your audience can watch but not control the presentation. Viewers see slides and whiteboard strokes in real time, but cannot navigate, open the terminal, or draw.

### Create a share link

1. Open the terminal (`t`)
2. Type `share`

GeekSlides protects the room with a presenter token and prints a viewer URL:

```
✓ Share link: http://localhost:5173/?config=my-talk/config.json&room=demo&readonly=
```

Send this URL to your audience. Anyone who opens it gets a locked-down, receive-only view.

### What viewers see

- The current slide, following the presenter in real time
- Whiteboard strokes as the presenter draws
- A **VIEW ONLY** badge and a green sync dot
- No terminal, no keyboard shortcuts, no touch navigation

### Security

The `share` command does three things:

1. Generates a cryptographic presenter token (64 hex characters) stored in memory on the server
2. Reconnects your session with the token, so only you can write
3. Returns a viewer URL that connects without a token — the server tags it as read-only

The server enforces read-only mode at the WebSocket level: even if someone removes `&readonly` from the URL, they won't be able to write without a valid presenter token. Failed auth attempts are rate-limited (10 per minute per IP).

> **Tip:** The presenter token is logged to the browser console. Save it if you need to re-authenticate after a page reload — add `&token=<your-token>` to the URL, or leave it out and you'll get a fresh `share` on the next session.

## Follow and unfollow

By default, every viewer **follows the presenter** — when the presenter advances a slide, all viewers advance too.

A viewer can break away to browse independently:

1. Open the terminal (`t`)
2. Type `sync-disconnect`
3. Navigate freely — the presenter's movements are ignored

The status dot turns **orange** to remind you that you're off-leash.

To re-attach to the presenter's position:

1. Open the terminal (`t`)
2. Type `sync-follow`

The view snaps to wherever the presenter is and the dot turns **green** again.

## Switch rooms on the fly

Change rooms without reloading the page:

1. Open the terminal (`t`)
2. Type `room new-room-name`

The URL updates and you immediately join the new room. Useful when running multiple sessions from the same server.

## Speaker view with sync

The speaker view connects to the same room as the presentation. Open it in a second tab or on a second monitor:

```
http://localhost:5173/?view=speaker&config=my-talk/config.json&room=demo
```

Or type `speaker` in the terminal — it opens with the correct room automatically.

Navigate from either window. Both stay in sync:

- Advance in the **presenter tab** → speaker view follows
- Advance in the **speaker view** → presenter tab follows
- All connected viewers follow along

## Whiteboard sync

Every whiteboard stroke is shared with the room in real time:

1. Draw on a slide (drag your mouse or pen, or type `whiteboard` in the terminal)
2. In-progress strokes stream to viewers as you draw (updated every 100 ms)
3. When you lift the pen, the completed stroke is stored in the shared document
4. Late-joining viewers receive the full stroke history automatically

Clear strokes on the current slide with the `clear` terminal command. The clear propagates to all viewers.

> **Tip:** The whiteboard is per-slide. Navigate to a different slide and your annotations are preserved — come back and they're still there.

## Content proxy

When sync is active, GeekSlides automatically uploads your deck assets (markdown, images, CSS, config) to the server. Remote viewers fetch content from the server instead of needing direct access to your machine.

This means your audience only needs the server URL — they don't need to be on your local network or have your files. Share a single link and everything just works.

## Deploy a production sync server

For presentations beyond localhost, deploy the GeekSlides Docker image with sync built in:

```bash
DOMAIN=slides.example.com \
ACME_EMAIL=you@example.com \
docker compose -f docker/docker-compose.yml up -d
```

Caddy handles HTTPS automatically. The WebSocket server runs behind the reverse proxy on the `/ws*` path. Point your deck's `sync.server` to the production URL:

```json
{
  "sync": {
    "server": "wss://slides.example.com/ws",
    "room": "keynote-2026"
  }
}
```

> **Tip:** Use `wss://` (WebSocket Secure) when the server has HTTPS. GeekSlides auto-detects this when the page is loaded over HTTPS.

See [Deploy the Server](05-deploy-the-server.md) for the full Docker setup guide.

## Offline and reconnection

Yjs handles network interruptions gracefully:

- **Temporary disconnection** — changes buffer locally and sync when the connection is restored
- **Server restart** — clients reconnect automatically and re-sync state
- **Late join** — a new viewer receives the full document state (slide position + all whiteboard strokes) on connect

No manual intervention needed. The CRDT ensures all clients converge to the same state.

## Multi-device workflow

A practical setup for live presentations:

1. **Laptop** — run the dev server and present from the main browser tab
2. **Second monitor** — open speaker view (`?view=speaker&room=demo`)
3. **Phone** — open the audience URL to verify what viewers see
4. **Audience** — share the `?room=demo` link; they follow along automatically

All four devices stay in sync through the same room.

## Troubleshooting

| Problem | Solution |
|---|---|
| Status dot is grey | Check that the sync server is running and the `sync.server` URL is correct |
| Viewers don't see slide changes | Verify everyone is using the same `room` parameter |
| Whiteboard strokes don't appear remotely | Confirm sync is connected (green dot); check browser console for WebSocket errors |
| Orange dot after reconnect | Type `sync-follow` in the terminal to re-attach to the presenter |
| Content doesn't load for remote viewers | The content proxy may need a moment to upload; reload the viewer's page |

---

Next: [Add a Feature →](13-add-a-feature.md)
