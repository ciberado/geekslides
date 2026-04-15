# Phase 4: Navigation & Input

**Status**: Implemented — known bug (mobile long-press)
**Depends on**: Phase 2 (slideshow to navigate)
**Unlocks**: Phase 6 (rich components use commands), Phase 7 (speaker view navigation)

## Goal

Implement the full input system: `CommandSystem` (command registry and execution),
`KeyBindings` (two-mode state machine: normal / terminal), `TouchInput`
(swipe/tap for mobile), and `<geek-terminal>` (command prompt).

At the end of this phase, navigation works via keyboard (direct keys for arrows/space,
`t` opens a terminal prompt for everything else), touch gestures on mobile, and the
terminal command line. All input paths go through `CommandSystem.execute()`.

## Deliverables

### 1. CommandSystem (`packages/engine/src/input/CommandSystem.ts`)

Central command registry. Unchanged from original design.

### 2. KeyBindings (`packages/engine/src/input/KeyBindings.ts`)

**Two-mode** state machine (replaces the three-mode prefix/palette system).

**State**: `#mode: 'normal' | 'terminal'`.

**Direct bindings** (NORMAL mode, immediate):
`ArrowRight`/`Space`/`PageDown` → `next`, `ArrowLeft`/`PageUp` → `prev`,
`Home` → `go-first`, `End` → `go-last`.

**Terminal activation** (NORMAL mode): pressing `t` → TERMINAL.
In TERMINAL mode, all keystrokes are captured by the `<geek-terminal>` prompt.
`Escape` or command execution → back to NORMAL.

**Ignores** events when the target is an `<input>` or `<textarea>`.

### 3. `<geek-terminal>` (replaces `<geek-command-palette>`)

A minimal command-line prompt anchored at the bottom of the viewport.

- `>` prompt prefix, monospace font, translucent dark background
- Tab-completion from registered commands
- Enter executes via `CommandSystem.execute()`
- Output line shows result/error (auto-dismiss after 1s)
- `help` built-in lists all commands by category
- Up/down arrows navigate command history (session only)
- Escape closes immediately

### 4. TouchInput (`packages/engine/src/input/TouchInput.ts`)

Same as before, except long-press (500ms) now opens the terminal instead of toggling toolbar.

> **Bug**: The implementation calls `commandSystem.execute('toggle-toolbar')` on long-press, but `toggle-toolbar` is never registered as a command in `index.html`. Mobile long-press silently does nothing. Fix: either register a `toggle-toolbar` command or change the long-press handler to call `toggle-terminal` to open `<geek-terminal>`.

### 5. Tests

- `CommandSystem.test.ts` — register, execute, search
- `KeyBindings.test.ts` — direct keys, `t` opens terminal, events on inputs ignored
- `TouchInput.test.ts` — swipe/tap gestures
- `Terminal.test.ts` — open/close, command execution, help, tab-complete, history

## Acceptance Criteria

- [ ] Arrow keys, Space, PageDown/Up navigate slides (no prefix needed).
- [ ] `t` opens the terminal prompt at the bottom of the screen.
- [ ] Typing a command name + Enter executes it.
- [ ] Tab auto-completes from available commands.
- [ ] `help` lists all registered commands.
- [ ] Escape closes the terminal.
- [ ] Touch swipes and tap zones work on mobile viewport.
- [ ] Long-press opens the terminal on mobile.
- [ ] All input paths go through `CommandSystem.execute()`.
- [ ] All unit tests pass.

## Reference Docs

- [command-system.md](../command-system.md) — terminal architecture, key bindings, touch gestures
