# Share QR Feature

## Overview

The `share-qr` terminal command displays a full-screen QR code on all clients in a room, enabling audience members to scan and join the presentation easily. The QR code encodes a shortened URL to reduce density and improve scannability.

## Architecture

### Short URL API

Server endpoint for creating compact URLs:

- `POST /api/short` — Creates a short URL mapping: `{ url } → { id, short }`
- `GET /s/:id` — 302 redirects to the original URL

Short URLs use 6-character base36 IDs, stored in-memory on the server. They are session-scoped (cleared on server restart), which is acceptable for live presentation use.

Implementation: `packages/server/src/ShortUrlApi.ts`

### QR Overlay Feature

The QR overlay is implemented as a Feature (`qr-overlay`) that:

1. Observes the feature-scoped Yjs shared map key `qrUrl`
2. When set, renders a full-viewport overlay with:
   - Large QR code on canvas
   - The URL in readable text
   - Dismiss hint
3. Any client can dismiss (Esc key or click) by clearing the shared state
4. All clients in the room see/dismiss synchronously

Implementation: `packages/engine/src/features/qr-overlay-feature.ts`

### QR Code Generation

Uses a minimal inline QR encoder (no external dependencies):
- Supports byte mode, EC level L, versions 1-10
- Handles URLs up to ~270 characters (ample for short URLs)
- Renders to `<canvas>` element with automatic scaling

### Flow

```
User types: share-qr
    │
    ▼
┌─────────────────────────────┐
│ 1. POST /api/rooms/:room/share │ → Get viewer token
│ 2. Build viewer URL            │
│ 3. POST /api/short             │ → Get short URL
│ 4. Set Yjs shared state        │ → qrUrl = short URL
└─────────────────────────────┘
    │
    ▼
All clients observe state change
    │
    ▼
┌─────────────────────────────┐
│ QR Overlay appears          │
│ (full-screen, scannable)    │
└─────────────────────────────┘
    │
    ▼
Any client presses Esc or clicks
    │
    ▼
Shared state cleared → overlay dismissed on all clients
```

## Terminal Commands

| Command | Description |
|---------|-------------|
| `share` | Create viewer link (text output + clipboard) |
| `share-qr` | Create viewer link AND show QR code on all room screens |

## Configuration

The QR overlay feature is automatically activated when sync is enabled (it's registered as a built-in feature alongside the deck's configured features). No config.json changes are needed.

## Security Notes

- Short URLs are ephemeral (in-memory, lost on restart)
- The QR encodes a viewer token — it grants read-only access
- Presenter token is never exposed in the QR code

## Related

- [How-To: Share a QR Code](../../how-to/26-share-qr-code.md) — Step-by-step usage guide
- [How-To: Sync Your Presentation](../../how-to/12-sync-your-presentation.md) — Room setup and viewer links
