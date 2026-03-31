# Command System

## Overview

v2 replaces v1's scattered hotkeys with a structured command system inspired by vim and tmux:

- **Prefix key** (`Ctrl+B`): press, then a single key for quick actions
- **Command palette** (`:`): opens a searchable command list
- **Direct keys**: arrows, space, etc. for basic navigation (no prefix needed)

This eliminates key conflicts, makes the system discoverable, and supports extensibility.

## Command Architecture

```
Key Press
    │
    ▼
┌──────────────────────────────┐
│       KeyBindings.ts         │
│                              │
│  State Machine:              │
│  ┌──────────┐                │
│  │  NORMAL  │──Ctrl+B──►┌──────────┐
│  │          │            │ PREFIX   │
│  │          │◄──timeout──│ (1.5s)   │
│  │          │◄──action───│          │
│  │          │            └──────────┘
│  │          │                │
│  │          │──:──────────►┌──────────┐
│  │          │              │ PALETTE  │
│  │          │◄──Esc/Enter──│          │
│  └──────────┘              └──────────┘
│                              │
│  Direct keys (NORMAL mode):  │
│  → / ← / Space / etc.       │
│  Always handled, no prefix   │
└──────────────────────────────┘
    │
    ▼
CommandSystem.execute(commandName)
    │
    ▼
CustomEvent dispatched
```

## Key Bindings

### Direct Keys (no prefix, NORMAL mode)

| Key | Action | Event |
|-----|--------|-------|
| `→` / `Space` / `PageDown` | Next partial or slide | `geek:navigate` |
| `←` / `PageUp` | Previous partial or slide | `geek:navigate` |
| `Home` | Go to first slide | `geek:navigate` |
| `End` | Go to last slide | `geek:navigate` |
| `Escape` | Exit current mode / close palette | context-dependent |
| `:` | Open command palette | (internal) |

### Prefix Keys (Ctrl+B, then key)

| Sequence | Action | Event |
|----------|--------|-------|
| `Ctrl+B` → `s` | Toggle speaker mode | `geek:mode` |
| `Ctrl+B` → `o` | Toggle overview mode | `geek:mode` |
| `Ctrl+B` → `w` | Toggle whiteboard | `geek:whiteboard:toggle` |
| `Ctrl+B` → `c` | Clear whiteboard | `geek:whiteboard:clear` |
| `Ctrl+B` → `f` | Toggle fullscreen | (native) |
| `Ctrl+B` → `y` | Toggle Yjs sync | `geek:sync:toggle` |
| `Ctrl+B` → `p` | Toggle follow presenter | `geek:sync:follow` |
| `Ctrl+B` → `t` | Toggle toolbar | `geek:toolbar:toggle` |
| `Ctrl+B` → `g` | Go to slide (prompts number) | `geek:navigate` |
| `Ctrl+B` → `?` | Show key bindings help | `geek:help:show` |

### Command Palette Commands

The palette shows all registered commands. Fuzzy search filters as you type:

```
: toggle speaker mode
: toggle whiteboard
: go to slide 15
: clear whiteboard
: toggle sync
: export pdf
: toggle overview
: ...
```

## Implementation

### CommandSystem

```typescript
// packages/engine/src/input/CommandSystem.ts

export interface Command {
  name: string;          // unique identifier: 'toggle-speaker'
  label: string;         // display label: 'Toggle Speaker Mode'
  execute: () => void;   // action
  category?: string;     // for grouping in palette: 'mode', 'navigation', etc.
}

export class CommandSystem {
  #commands = new Map<string, Command>();

  register(command: Command): void {
    this.#commands.set(command.name, command);
  }

  execute(name: string): void {
    const cmd = this.#commands.get(name);
    if (!cmd) {
      console.warn(`Unknown command: ${name}`);
      return;
    }
    cmd.execute();
  }

  search(query: string): Command[] {
    const lower = query.toLowerCase();
    return [...this.#commands.values()].filter(
      cmd => cmd.label.toLowerCase().includes(lower)
        || cmd.name.toLowerCase().includes(lower),
    );
  }

  all(): Command[] {
    return [...this.#commands.values()];
  }
}
```

### KeyBindings (State Machine)

```typescript
// packages/engine/src/input/KeyBindings.ts

type InputMode = 'normal' | 'prefix' | 'palette';

export class KeyBindings {
  #mode: InputMode = 'normal';
  #commandSystem: CommandSystem;
  #palette: GeekCommandPalette;
  #prefixTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Direct key → command name
  #directBindings = new Map<string, string>([
    ['ArrowRight', 'next'],
    ['ArrowLeft', 'prev'],
    [' ', 'next'],
    ['PageDown', 'next'],
    ['PageUp', 'prev'],
    ['Home', 'go-first'],
    ['End', 'go-last'],
  ]);

  // Prefix key → command name (pressed after Ctrl+B)
  #prefixBindings = new Map<string, string>([
    ['s', 'toggle-speaker'],
    ['o', 'toggle-overview'],
    ['w', 'toggle-whiteboard'],
    ['c', 'clear-whiteboard'],
    ['f', 'toggle-fullscreen'],
    ['y', 'toggle-sync'],
    ['p', 'toggle-follow'],
    ['t', 'toggle-toolbar'],
    ['g', 'go-to-slide'],
    ['?', 'show-help'],
  ]);

  constructor(commandSystem: CommandSystem, palette: GeekCommandPalette) {
    this.#commandSystem = commandSystem;
    this.#palette = palette;
    document.addEventListener('keydown', this.#handleKey.bind(this));
  }

  #handleKey(event: KeyboardEvent): void {
    // Don't intercept when typing in inputs
    if (event.target instanceof HTMLInputElement
      || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (this.#mode) {
      case 'normal':
        this.#handleNormal(event);
        break;
      case 'prefix':
        this.#handlePrefix(event);
        break;
      case 'palette':
        // Palette handles its own keys (up/down/enter/escape)
        if (event.key === 'Escape') {
          this.#palette.close();
          this.#mode = 'normal';
        }
        break;
    }
  }

  #handleNormal(event: KeyboardEvent): void {
    // Ctrl+B → enter prefix mode
    if (event.ctrlKey && event.key === 'b') {
      event.preventDefault();
      this.#mode = 'prefix';
      this.#showPrefixIndicator();
      // Auto-timeout back to normal after 1.5s
      this.#prefixTimeout = setTimeout(() => {
        this.#mode = 'normal';
        this.#hidePrefixIndicator();
      }, 1500);
      return;
    }

    // Colon → open command palette
    if (event.key === ':') {
      event.preventDefault();
      this.#mode = 'palette';
      this.#palette.open();
      return;
    }

    // Direct key bindings
    const cmd = this.#directBindings.get(event.key);
    if (cmd) {
      event.preventDefault();
      this.#commandSystem.execute(cmd);
    }
  }

  #handlePrefix(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.#prefixTimeout) clearTimeout(this.#prefixTimeout);
    this.#hidePrefixIndicator();
    this.#mode = 'normal';

    const cmd = this.#prefixBindings.get(event.key);
    if (cmd) {
      this.#commandSystem.execute(cmd);
    }
  }

  #showPrefixIndicator(): void {
    document.dispatchEvent(new CustomEvent('geek:prefix:active'));
  }

  #hidePrefixIndicator(): void {
    document.dispatchEvent(new CustomEvent('geek:prefix:inactive'));
  }
}
```

### TouchInput

```typescript
// packages/engine/src/input/TouchInput.ts

export class TouchInput {
  #commandSystem: CommandSystem;
  #startX = 0;
  #startY = 0;
  #threshold = 50; // px

  constructor(commandSystem: CommandSystem, element: HTMLElement) {
    this.#commandSystem = commandSystem;
    
    element.addEventListener('touchstart', this.#onStart.bind(this), { passive: true });
    element.addEventListener('touchend', this.#onEnd.bind(this), { passive: true });
  }

  #onStart(e: TouchEvent): void {
    this.#startX = e.touches[0].clientX;
    this.#startY = e.touches[0].clientY;
  }

  #onEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.#startX;
    const dy = e.changedTouches[0].clientY - this.#startY;

    // Horizontal swipe
    if (Math.abs(dx) > this.#threshold && Math.abs(dx) > Math.abs(dy)) {
      this.#commandSystem.execute(dx > 0 ? 'prev' : 'next');
    }
  }
}
```

## Default Command Registry

```typescript
// packages/engine/src/input/default-commands.ts

export function registerDefaultCommands(
  commands: CommandSystem,
  slideshow: GeekSlideshow,
  syncManager: SyncManager,
): void {
  commands.register({
    name: 'next',
    label: 'Next Slide / Partial',
    category: 'navigation',
    execute: () => slideshow.next(),
  });

  commands.register({
    name: 'prev',
    label: 'Previous Slide / Partial',
    category: 'navigation',
    execute: () => slideshow.prev(),
  });

  commands.register({
    name: 'go-first',
    label: 'Go to First Slide',
    category: 'navigation',
    execute: () => slideshow.goTo(0),
  });

  commands.register({
    name: 'go-last',
    label: 'Go to Last Slide',
    category: 'navigation',
    execute: () => slideshow.goTo(slideshow.slideCount - 1),
  });

  commands.register({
    name: 'go-to-slide',
    label: 'Go to Slide Number...',
    category: 'navigation',
    execute: () => {
      const n = prompt('Slide number:');
      if (n) slideshow.goTo(parseInt(n, 10) - 1);
    },
  });

  commands.register({
    name: 'toggle-speaker',
    label: 'Toggle Speaker Mode',
    category: 'mode',
    execute: () => {
      slideshow.mode = slideshow.mode === 'speaker' ? 'present' : 'speaker';
    },
  });

  commands.register({
    name: 'toggle-overview',
    label: 'Toggle Overview Mode',
    category: 'mode',
    execute: () => {
      slideshow.mode = slideshow.mode === 'overview' ? 'present' : 'overview';
    },
  });

  commands.register({
    name: 'toggle-whiteboard',
    label: 'Toggle Whiteboard',
    category: 'whiteboard',
    execute: () => {
      document.dispatchEvent(new CustomEvent('geek:whiteboard:toggle'));
    },
  });

  commands.register({
    name: 'clear-whiteboard',
    label: 'Clear Whiteboard',
    category: 'whiteboard',
    execute: () => {
      document.dispatchEvent(new CustomEvent('geek:whiteboard:clear'));
    },
  });

  commands.register({
    name: 'toggle-fullscreen',
    label: 'Toggle Fullscreen',
    category: 'view',
    execute: () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    },
  });

  commands.register({
    name: 'toggle-sync',
    label: 'Toggle Real-time Sync',
    category: 'sync',
    execute: () => syncManager.toggleFollow(),
  });

  commands.register({
    name: 'toggle-toolbar',
    label: 'Toggle Toolbar',
    category: 'view',
    execute: () => {
      document.dispatchEvent(new CustomEvent('geek:toolbar:toggle'));
    },
  });

  commands.register({
    name: 'show-help',
    label: 'Show Key Bindings Help',
    category: 'help',
    execute: () => {
      document.dispatchEvent(new CustomEvent('geek:help:show'));
    },
  });
}
```

## v1 → v2 Key Migration

| v1 Key | v1 Action | v2 Equivalent |
|--------|-----------|---------------|
| `ArrowRight` | Next slide | `→` (direct, same) |
| `ArrowLeft` | Previous slide | `←` (direct, same) |
| `s` | Speaker mode | `Ctrl+B` → `s` |
| `o` | Overview | `Ctrl+B` → `o` |
| `b` | Black screen | Removed (use `:` → "black screen") |
| `f` | Fullscreen | `Ctrl+B` → `f` |
| Various touch gestures | Inconsistent | Unified swipe left/right |
