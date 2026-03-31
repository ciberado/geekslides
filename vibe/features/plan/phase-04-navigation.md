# Phase 4: Navigation & Input

**Status**: Not started
**Depends on**: Phase 2 (slideshow to navigate)
**Unlocks**: Phase 6 (rich components use commands), Phase 7 (speaker view navigation)

## Goal

Implement the full input system: `CommandSystem` (command registry and execution),
`KeyBindings` (three-mode state machine: normal → prefix → palette), `TouchInput`
(swipe/tap for mobile), `<geek-toolbar>` (visible controls), and
`<geek-command-palette>` (searchable command list). Replace the hardcoded arrow-key
listeners from Phase 2 with the proper command architecture.

At the end of this phase, navigation works via keyboard (direct keys for arrows/space,
`Ctrl+B` prefix for mode toggles), touch gestures on mobile, the toolbar, and the
command palette. All input paths go through `CommandSystem.execute()`.

## Deliverables

### 1. CommandSystem (`packages/engine/src/input/CommandSystem.ts`)

Central command registry.

- **`Command` type**: `{ name: string, label: string, execute: () => void, category?: string }`.
- **`register(command)`**: Adds to internal `Map<string, Command>`.
- **`execute(name)`**: Looks up and calls `execute()`. Logs warning if not found.
- **`search(query)`**: Filters commands where label or name includes query (case-insensitive).
- **`all()`**: Returns all commands as array.

### 2. KeyBindings (`packages/engine/src/input/KeyBindings.ts`)

Three-mode state machine with direct navigation keys and tmux-style prefix.

**State**: `#mode: 'normal' | 'prefix' | 'palette'`.

**Direct bindings** (NORMAL mode, no prefix, immediate):
`ArrowRight`/`Space`/`PageDown` → `next`, `ArrowLeft`/`PageUp` → `prev`,
`Home` → `go-first`, `End` → `go-last`.

**Prefix bindings** (`Ctrl+B` → key, 1.5 s window):
`s` → `toggle-speaker`, `o` → `toggle-overview`, `w` → `toggle-whiteboard`,
`c` → `clear-whiteboard`, `f` → `toggle-fullscreen`, `y` → `toggle-sync`,
`p` → `toggle-follow`, `t` → `toggle-toolbar`, `g` → `go-to-slide`,
`?` → `show-help`.

**Mode transitions**:
- NORMAL + `Ctrl+B` → PREFIX (start 1.5 s timeout, dispatch `geek:prefix:active`).
- PREFIX + any key → execute if bound, then → NORMAL (dispatch `geek:prefix:inactive`).
- PREFIX + timeout → NORMAL.
- NORMAL + `:` → PALETTE (open `<geek-command-palette>`).
- PALETTE + `Escape`/`Enter` → NORMAL.

**Ignores** events when the target is an `<input>` or `<textarea>`.

### 3. TouchInput (`packages/engine/src/input/TouchInput.ts`)

Touch gesture handler for smartphones and tablets.

| Gesture | Threshold | Command |
|---------|-----------|---------|
| Swipe left | > 50 px horizontal | `next` |
| Swipe right | > 50 px horizontal | `prev` |
| Tap right 2/3 | x > 33% viewport width | `next` |
| Tap left 1/3 | x < 33% viewport width | `prev` |
| Long press | 500 ms hold | `toggle-toolbar` |
| Swipe up | > 80 px vertical | `toggle-overview` |

Tracks `touchstart`/`touchmove`/`touchend` events. Distinguishes tap from swipe based
on movement distance. Calls `CommandSystem.execute()` for all actions.

### 4. `<geek-toolbar>` (`packages/engine/src/components/Toolbar.ts`)

Bottom toolbar with touch/presenter controls.

**Shadow DOM layout**: Fixed-position bar at the bottom, 48 px height, dark semi-transparent
background. Flexbox row with: prev button, slide counter (`5 / 28`), next button,
sync indicator, whiteboard toggle.

**Desktop behavior**: Hidden by default (`transform: translateY(100%)`), toggled via
`Ctrl+B → t` or mouse hover at bottom edge.

**Mobile behavior** (≤ 768 px): Always visible, larger tap targets (44 px minimum).

**Event wiring**: Buttons dispatch to `CommandSystem.execute()` via `data-cmd` attributes.

### 5. `<geek-command-palette>` (`packages/engine/src/components/CommandPalette.ts`)

Modal searchable command list, opened by `:`.

**Shadow DOM layout**: Full-viewport backdrop overlay, centered dialog with search input
and scrollable filtered command list.

**Behavior**: On open, focuses the input. Typing filters `CommandSystem.search(query)`.
Arrow keys navigate the list. Enter executes the selected command and closes.
Escape closes without executing. Click on a command executes and closes.

### 6. Default command registration

Wire up default commands in the entry point:
- `next`, `prev`, `go-first`, `go-last` → call slideshow navigation methods.
- `toggle-speaker`, `toggle-overview` → change slideshow mode.
- `toggle-fullscreen` → `document.fullscreenElement` toggle.
- `toggle-toolbar` → toolbar visibility.
- `toggle-sync`, `toggle-follow` → placeholders (wired in Phase 5).
- `toggle-whiteboard`, `clear-whiteboard` → placeholders (wired in Phase 6).
- `go-to-slide` → prompt for slide number, call `goTo()`.
- `show-help` → display key bindings reference.

### 7. Tests

**`packages/engine/tests/unit/CommandSystem.test.ts`**:
- Register and execute commands.
- Unknown command logs warning.
- `search()` filters by label and name.

**`packages/engine/tests/unit/KeyBindings.test.ts`**:
- Direct keys execute immediately in NORMAL mode.
- `Ctrl+B` transitions to PREFIX mode.
- Follow-up key in PREFIX mode executes the correct command and returns to NORMAL.
- Timeout in PREFIX mode returns to NORMAL without executing.
- `:` opens palette mode.
- Events on `<input>` are ignored.

**`packages/engine/tests/unit/TouchInput.test.ts`**:
- Horizontal swipe > 50 px triggers `next`/`prev`.
- Tap in right 2/3 triggers `next`.
- Tap in left 1/3 triggers `prev`.
- Short tap in center does nothing (dead zone).

## File List

```
packages/engine/src/input/
├── CommandSystem.ts
├── KeyBindings.ts
└── TouchInput.ts

packages/engine/src/components/
├── Toolbar.ts
└── CommandPalette.ts

packages/engine/tests/unit/
├── CommandSystem.test.ts
├── KeyBindings.test.ts
└── TouchInput.test.ts
```

## Acceptance Criteria

- [ ] Arrow keys, Space, PageDown/Up navigate slides (no prefix needed).
- [ ] `Ctrl+B` shows a visual prefix indicator, followed by `s`/`o`/`w`/etc. triggers commands.
- [ ] Prefix mode auto-cancels after 1.5 s.
- [ ] `:` opens the command palette with fuzzy search.
- [ ] Toolbar shows on mobile by default, hidden on desktop until toggled.
- [ ] Touch swipes and tap zones work on mobile viewport.
- [ ] All input paths go through `CommandSystem.execute()`.
- [ ] All unit tests pass.

## Reference Docs

- [command-system.md](../command-system.md) — full key bindings, state machine, touch gestures
- [components.md](../components.md) — Toolbar and CommandPalette component specs, mobile behavior
