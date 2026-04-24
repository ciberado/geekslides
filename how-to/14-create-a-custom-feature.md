# Create a Custom Feature

Features are interactive, stateful extensions that run for the lifetime of a presentation. This guide walks you through building one from scratch — a simple countdown timer that the presenter starts via a terminal command and all viewers see in real time.

## Prerequisites

- A working deck ([Create Your First Deck](02-create-your-first-deck.md))
- Familiarity with `config.json` features array ([Add a Feature](13-add-a-feature.md))

## The Feature interface

Every feature is a JavaScript module with a default export containing three properties:

```javascript
export default {
  id: 'my-feature',       // unique, URL-safe identifier
  label: 'My Feature',    // human-readable label for the help system
  activate(ctx) {          // called when the feature is loaded
    // Set up UI, register commands, subscribe to events...
    return () => {
      // Cleanup: remove DOM, deregister listeners
    };
  },
};
```

The `activate` function receives a **FeatureContext** — your full API surface.

## FeatureContext reference

| Property | Type | Description |
|---|---|---|
| `ctx.featureId` | `string` | The feature's `id` |
| `ctx.config` | `object` | The full deck config |
| `ctx.role` | `'presenter'` or `'viewer'` | Who is running this client |
| `ctx.slideshow` | object | Navigation: `currentSlide`, `slideCount`, `goTo()`, `next()`, `prev()` |
| `ctx.commands` | object | `register({ name, label, execute, category })` |
| `ctx.sync` | object or `null` | Scoped Yjs shared state (null if sync is disabled) |
| `ctx.syncManager` | object or `null` | Raw SyncManager for advanced Yjs access |
| `ctx.container` | `HTMLElement` | Your DOM mount point inside the slideshow shadow root |
| `ctx.on(event, handler)` | function | Subscribe to lifecycle events; returns unsubscribe function |
| `ctx.output` | object | `show(message)` — display a transient terminal message |

## Step 1 — Create the file

Create `features/countdown.js` in your deck directory:

```
my-deck/
├── config.json
├── README.md
└── features/
    └── countdown.js
```

## Step 2 — Write the feature

```javascript
export default {
  id: 'countdown',
  label: 'Countdown timer overlay',

  activate(ctx) {
    // --- Create the UI ---
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 60px; z-index: 200;
      font: bold 48px/1 system-ui, sans-serif;
      color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.6);
      pointer-events: none; display: none;
    `;
    ctx.container.appendChild(overlay);

    let timer = null;
    let seconds = 0;

    function tick() {
      if (seconds <= 0) {
        overlay.textContent = '⏰ Time!';
        clearInterval(timer);
        timer = null;
        // Auto-hide after 3 seconds
        setTimeout(() => { overlay.style.display = 'none'; }, 3000);
        return;
      }
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      overlay.textContent = `${m}:${String(s).padStart(2, '0')}`;
      seconds--;
    }

    function startCountdown(totalSeconds) {
      if (timer) clearInterval(timer);
      seconds = totalSeconds;
      overlay.style.display = 'block';
      tick();
      timer = setInterval(tick, 1000);

      // Sync to viewers
      if (ctx.sync) {
        ctx.sync.getSharedMap().set('endTime', Date.now() + totalSeconds * 1000);
      }
    }

    // --- Register commands (presenter only) ---
    if (ctx.role === 'presenter') {
      ctx.commands.register({
        name: 'countdown',
        label: 'Start countdown (usage: countdown 90)',
        execute: (args) => {
          const secs = parseInt(args?.[0], 10);
          if (!secs || secs <= 0) {
            ctx.output.show('Usage: countdown <seconds>');
            return;
          }
          startCountdown(secs);
          ctx.output.show(`⏱ Countdown: ${secs}s`);
        },
        category: 'countdown',
      });

      ctx.commands.register({
        name: 'countdown-stop',
        label: 'Stop the countdown',
        execute: () => {
          if (timer) clearInterval(timer);
          timer = null;
          overlay.style.display = 'none';
          if (ctx.sync) ctx.sync.getSharedMap().set('endTime', 0);
        },
        category: 'countdown',
      });
    }

    // --- Sync: viewers follow the presenter's timer ---
    if (ctx.sync) {
      ctx.sync.getSharedMap().observe((event) => {
        if (!event.keysChanged.has('endTime')) return;
        const endTime = ctx.sync.getSharedMap().get('endTime');
        if (!endTime || endTime === 0) {
          if (timer) clearInterval(timer);
          overlay.style.display = 'none';
          return;
        }
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        if (remaining > 0) startCountdown(remaining);
      });
    }

    // --- Cleanup ---
    return () => {
      if (timer) clearInterval(timer);
      overlay.remove();
    };
  },
};
```

## Step 3 — Register in config.json

```json
{
  "features": ["whiteboard", "./features/countdown.js"]
}
```

## Step 4 — Try it out

```bash
geekslides dev
```

Press `t` to open the terminal, then type:

```
countdown 90
```

A "1:30" overlay appears in the top-right corner and counts down. Open a viewer link — the timer appears there too, synced via Yjs.

Type `countdown-stop` to cancel.

## Lifecycle events

Features can react to deck-level events via `ctx.on()`:

```javascript
const unsub = ctx.on('slide:enter', ({ slideIndex, previousIndex }) => {
  console.log(`Entered slide ${slideIndex} from ${previousIndex}`);
});
```

| Event | Payload | When |
|---|---|---|
| `presentation:ready` | `{ slideCount }` | Slides are loaded and visible |
| `slide:enter` | `{ slideIndex, previousIndex }` | After navigating to a new slide |
| `slide:leave` | `{ slideIndex, nextIndex }` | Before leaving the current slide |
| `partial:reveal` | `{ slideIndex, partialIndex, partialCount }` | A partial element was revealed |
| `sync:state` | `{ connected, following, readonly }` | Sync connection changed |
| `mode:change` | `{ mode, previousMode }` | Switched between present/overview/speaker |

Always call the returned unsubscribe function in your cleanup:

```javascript
activate(ctx) {
  const unsub = ctx.on('slide:enter', handler);
  return () => unsub();
}
```

## Using synced state

Every feature gets its own isolated namespace in the Yjs document:

```javascript
// Key-value state (Y.Map)
const map = ctx.sync.getSharedMap();
map.set('question', 'Do you like this feature?');

// Ordered collections (Y.Array)
const arr = ctx.sync.getSharedArray();
arr.push([{ text: 'Yes', votes: 0 }]);

// Observe changes from remote clients
map.observe((event) => {
  for (const key of event.keysChanged) {
    console.log(`${key} changed to`, map.get(key));
  }
});
```

State is scoped under `features.<featureId>` in the Yjs doc, so features can't accidentally overwrite each other.

> **Tip:** `ctx.sync` is `null` when sync is disabled (`geekslides dev --no-sync`). Always check before using it.

## Presenter vs viewer patterns

Use `ctx.role` to show different UI:

```javascript
if (ctx.role === 'presenter') {
  // Register commands, show controls
  ctx.commands.register({ ... });
} else {
  // Viewer: read-only display, observe sync state
}
```

The whiteboard feature uses this pattern — presenters get drawing tools and terminal commands; viewers see strokes but can't draw.

## Tips

- Keep features focused — one responsibility per feature
- Always return a cleanup function from `activate()`
- Use `ctx.container` for DOM (it's inside the slideshow shadow root)
- Test with two browser windows: one presenter, one `?readonly` viewer
- Check the browser console for `[features]` log messages during development

---

← Previous: [Add a Feature](13-add-a-feature.md) | Next: [Use the Hub →](15-use-the-hub.md)
