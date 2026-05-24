# Phase 21 — Plugin Registry & Share QR

## Goal

Formalize plugin registries as HTTPS-accessible directories, add terminal commands for dynamic plugin management at room scope (not tied to config.json), and extend the share system with a QR code overlay synchronized across all room clients.

## Prerequisites

- Phase 3 (Plugin System) — existing plugin architecture
- Phase 5 (Sync) — Yjs room state for plugin persistence
- Phase 13 (Terminal) — command system for management commands

## Deliverables

### Plugin Registry System

1. **PluginRegistryClient** (`packages/engine/src/plugins/PluginRegistry.ts`)
   - Fetches + caches registry `index.json` manifests via plugin-proxy
   - Resolves plugin entries to absolute manifest URLs

2. **RoomPluginManager** (`packages/engine/src/plugins/RoomPluginManager.ts`)
   - Yjs shared state (`doc.getMap('roomPlugins')`) for registries + active plugins
   - Syncs plugin state across all room clients
   - Fires change notifications for deck reprocessing

3. **Terminal Commands** (`packages/cli/app/plugin-commands.js`)
   - `plugin-registry-add`, `plugin-registry-ls`, `plugin-registry-remove`
   - `plugin-available`, `plugin-active`, `plugin-load`, `plugin-unload`

4. **Runtime Integration** (`packages/cli/app/main.js`)
   - Room plugins appended to deck pipeline (with deduplication)
   - Non-destructive reprocess on plugin load/unload (preserves navigation)

### Share QR

1. **Short URL API** (`packages/server/src/ShortUrlApi.ts`)
   - `POST /api/short` — create short URL (6-char base36 ID, in-memory)
   - `GET /s/:id` — 302 redirect to original

2. **QR Overlay Feature** (`packages/engine/src/features/qr-overlay-feature.ts`)
   - Full-screen QR overlay synchronized via Yjs shared state
   - Dismissed by any client (Esc/click clears shared state)
   - Inline QR encoder (no external deps, versions 1-10)

3. **`share-qr` Command** (in `main.js`)
   - Creates viewer link → shortens → broadcasts QR to all clients

## Key Decisions

- **Flat command names** (`plugin-load` not `plugin load`) — works with existing terminal parser without subcommand support
- **Pinned manifest URLs** — stored in Yjs instead of just names for deterministic cross-client loading
- **Session-scoped state** — plugin config and short URLs are ephemeral (acceptable for live presentations)
- **QR as a Feature** — proper lifecycle management with activate/deactivate and Yjs sync

## Files Created/Modified

### New Files
- `packages/engine/src/plugins/PluginRegistry.ts`
- `packages/engine/src/plugins/RoomPluginManager.ts`
- `packages/engine/src/features/qr-overlay-feature.ts`
- `packages/server/src/ShortUrlApi.ts`
- `packages/cli/app/plugin-commands.js`
- `packages/engine/tests/unit/PluginRegistry.test.ts`
- `packages/engine/tests/unit/RoomPluginManager.test.ts`
- `packages/server/tests/ShortUrlApi.test.ts`
- `vibe/features/share-qr.md`
- `vibe/features/plan/phase-21-plugin-registry-share-qr.md`

### Modified Files
- `packages/engine/src/index.ts` — new exports
- `packages/engine/src/features/index.ts` — QR feature export
- `packages/server/src/index.ts` — wire ShortUrlApi handler
- `packages/cli/app/main.js` — imports, plugin commands, QR feature, share-qr command
- `vibe/features/plugin-system.md` — registry documentation

## Status

✅ Complete
