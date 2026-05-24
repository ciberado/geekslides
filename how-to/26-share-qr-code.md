# Share a QR Code

Display a full-screen QR code on all connected screens so your audience can scan and join your presentation instantly. The QR encodes a shortened viewer URL that grants read-only access — no typing long URLs or fumbling with link-sharing apps.

## Prerequisites

- GeekSlides CLI installed ([Install the CLI](01-install-the-cli.md))
- A deck with sync enabled in a room ([Sync Your Presentation](12-sync-your-presentation.md))
- At least one viewer screen connected to the same room (the QR shows on all clients)

## Show the QR code

1. Open the terminal (`Esc`)
2. Type `share-qr`

A full-screen QR code appears on **every screen** connected to the room — your presenter display, the projector, speaker view, all viewer tabs. The audience scans the code with their phone camera and lands on the read-only viewer URL.

```
share-qr
✓ QR code displayed on all screens
  Short URL: https://slides.example.com/s/a1b2c3
```

## Dismiss the QR code

The QR overlay disappears when **any** connected client:

- Presses `Esc`
- Clicks anywhere on the overlay

Dismissal is synced — all screens close the overlay simultaneously.

> **Tip:** You don't need to dismiss it yourself. If a viewer in the audience presses Esc or clicks, the QR disappears everywhere. This is intentional — once people have scanned, anyone can clear the screen.

## How it works

The `share-qr` command performs these steps automatically:

1. **Creates a viewer token** — protects the room so only you can control navigation
2. **Builds the viewer URL** — includes the room, deck config, and read-only token
3. **Shortens the URL** — sends the long URL to the server's `/api/short` endpoint and gets back a compact 6-character link (e.g. `/s/a1b2c3`)
4. **Broadcasts the QR** — sets the short URL in the room's shared Yjs state
5. **All clients render** — the QR overlay feature observes the state change and shows the overlay

The short URL makes the QR code less dense and easier to scan from a distance or on a projector.

## Short URLs

The server provides a URL shortener at:

- `POST /api/short` — creates a mapping: `{ "url": "..." }` → `{ "id": "a1b2c3", "short": "/s/a1b2c3" }`
- `GET /s/:id` — 302 redirects to the original URL

Short URLs are:
- **6 characters**, base36 (letters + digits)
- **Session-scoped** — stored in server memory, cleared on restart
- **Capped at 10,000 entries** — oldest entries are evicted when full

This is by design: short URLs are meant for live presentations, not permanent links.

## Difference from `share`

| Feature | `share` | `share-qr` |
|---------|---------|-------------|
| Output | Prints URL to terminal | Shows QR overlay on all screens |
| URL format | Full viewer URL | Shortened URL (easier to scan) |
| Audience action | Copy-paste the link | Scan with phone camera |
| Best for | Remote audiences (chat, email) | In-person audiences (conference, meeting) |

Both commands create the same viewer token and grant the same read-only access.

## Use with a production server

When running on a production server with a domain:

```json
{
  "sync": {
    "server": "wss://slides.example.com/ws",
    "room": "keynote-2026"
  }
}
```

The QR code will encode: `https://slides.example.com/s/a1b2c3`

The audience scans, gets redirected to the full viewer URL, and joins automatically.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| QR doesn't appear | Verify sync is connected (green dot) and you're in a room |
| QR is too small to scan | Move closer to the projector or increase display resolution |
| Short URL gives 404 | Server may have restarted — run `share-qr` again to create a fresh short URL |
| QR won't dismiss | Click directly on the overlay or press `Esc` — one of the connected clients must interact |
| Audience gets "room not found" | Ensure the viewer URL matches the server they can reach (check DNS/firewall) |

---

← Previous: [Use Plugin Registries](25-use-plugin-registries.md) | [Back to index](README.md)
