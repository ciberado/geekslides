# Phase 13: Terminal Configuration Commands

## Objective

Allow presenters to change deck configuration and room at runtime via terminal commands,
eliminating the need to restart or use URL parameters after initial load.

## Status

**Not started** (new phase post-v2.0 planning)

## Key Features

- `load <config-url>` command: fetch and load a different deck's config/markdown
- `room <room-name>` command: switch sync room without reloading the page
- `theme <name>` command: runtime CSS theme switching (if multiple themes defined)
- All terminal commands exposed in `help` and support tab-completion

## Implementation Details

### load Command

User types: `load decks/slides-cuatro-cosas-aws/config.json`

- Fetch the new config JSON
- Resolve relative paths (images, CSS) against the config's base directory
- Fetch markdown content from the config
- Stop applying old preprocessors/processors
- Reload slides with new markdown
- Reload CSS styles from the config
- Apply new preprocessors/processors
- Sync state is preserved (same room) unless config specifies a different one
- Speaker view (if open in another tab) is NOT automatically reloaded
  (user can refresh manually or close/reopen)

### room Command

User types: `room my-talk`

- If sync is not enabled, warn "sync not enabled" and return
- If already in the room, no-op
- Disconnect from current Yjs room
- Reconnect to the new room name
- Publish current slide state to the new room
- Update the displayed room indicator (if any)

### Theme Command (Future)

User types: `theme dark`

- Switch CSS theme at runtime
- Requires config to list available themes
- Add/remove CSS class or stylesheet reference

## Testing Strategy

- Unit test: `load` command with mock fetch (Vitest)
- Unit test: `room` command with mock sync manager (Vitest)
- E2E test: `load` a different deck and verify slides change (Playwright)
- E2E test: `load` then `room` and verify sync state changes (Playwright)

## Files Affected

- [`index.html`](index.html "index.html"): register `load` and `room` commands, implement logic
- [`packages/engine/src/core/CommandSystem.ts`](packages/engine/src/core/CommandSystem.ts "packages/engine/src/core/CommandSystem.ts"): may add command arg parsing helpers
- [`packages/engine/src/components/Slideshow.ts`](packages/engine/src/components/Slideshow.ts "packages/engine/src/components/Slideshow.ts"): may add `loadStyles()` refresh or similar
- E2E tests: add `load` and `room` command tests

## Acceptance Criteria

- ✅ `load <url>` fetches and renders a new deck
- ✅ Images and styles in loaded deck resolve correctly relative to the config file
- ✅ `room <name>` disconnects from old room and connects to new one
- ✅ Sync state on the new room reflects the current slide
- ✅ Command help text appears in `help` output
- ✅ Tab-completion works for both commands
- ✅ Commands degrade gracefully (e.g. `load` with invalid URL shows error)
- ✅ Playwright E2E suite includes tests for both commands

## Notes

- This phase was not in the original v2 plan but arose from user feedback
  on preferring terminal configuration over URL params.
- Decks with custom preprocessors/processors should be tested with both
  `load` and URL initial load to ensure parity.
- The speaker view in another tab should detect when the presentation's
  config changes and offer a refresh button or auto-reload (future).
