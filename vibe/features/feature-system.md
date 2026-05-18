# Feature System

## Status

**Implemented** — The feature platform is live. Whiteboard, media-sync, and poll are all built-in features activated per-deck via `config.json`.

Reference tag: `pre-feature-system` (before the feature platform was added)

## Problem

The current plugin system (preprocessors and processors) is excellent for transforming content at parse time, but it cannot support **interactive, stateful extensions** that need ongoing access to navigation, sync, commands, and the DOM at runtime.

Examples of what you can't build with plugins today:

- A **live survey/poll** system where the presenter poses questions and viewers vote in real-time
- A **Q&A overlay** where audience members submit questions visible to the presenter
- An **audience reaction** system (emoji reactions floating on screen)
- A **code playground** that lets viewers run code snippets embedded in slides
- A **timer/countdown** widget the presenter controls and the audience sees

The **whiteboard** is already such a system — it has its own component, sync bridge, commands, and DOM management — but it's hardwired into `main.js` with ~120 lines of imperative glue code. It cannot be disabled, configured per-deck, or replaced.

## Solution: Features

A **Feature** is a self-contained, interactive extension with a well-defined lifecycle. Features are more powerful than plugins: they receive a typed API context that gives them access to the slideshow, sync, commands, and DOM — but through a clean contract rather than ad-hoc wiring.

### Design Principles

1. **Convention over configuration** — Features follow a standard interface; the platform handles lifecycle
2. **Deck events drive activation** — Features respond to lifecycle events (slide enter, presentation start, etc.)
3. **Full typed API, not sandboxed** — Security comes from well-designed TypeScript interfaces and code review, not runtime sandboxing
4. **Role-aware** — The feature context carries presenter/viewer role info so features can render different UI per role
5. **Browser-only** — Features run entirely in the browser; Yjs shared docs handle state propagation to all clients
6. **Independent of core** — Features don't modify engine internals; they compose on top of existing APIs

### Relationship to Plugins

| Aspect | Plugin | Feature |
|--------|--------|---------|
| **Scope** | Content transformation | Interactive runtime behavior |
| **Lifecycle** | Fire-once (parse time) | Long-lived (presentation session) |
| **State** | Stateless | Stateful (local + synced via Yjs) |
| **API access** | Markdown string or DOM element | Full FeatureContext (slideshow, sync, commands, DOM) |
| **Activation** | Automatic during parse pipeline | Config declares availability; lifecycle events trigger behavior |
| **Examples** | header, chart, mermaid, video | whiteboard, survey, Q&A, reactions |

Plugins and features are **complementary**. A deck can use both.

## Feature Interface

```typescript
/**
 * Lifecycle events emitted by the platform.
 */
export interface FeatureLifecycleEvents {
  /** Presentation has been initialized, slides are loaded. */
  'presentation:ready': { slideCount: number };

  /** Navigated to a new slide. */
  'slide:enter': { slideIndex: number; previousIndex: number };

  /** About to leave the current slide. */
  'slide:leave': { slideIndex: number; nextIndex: number };

  /** Partial reveal advanced on the current slide. */
  'partial:reveal': { slideIndex: number; partialIndex: number; partialCount: number };

  /** Sync connection state changed. */
  'sync:state': { connected: boolean; following: boolean; readonly: boolean };

  /** Presentation mode changed (present/overview/speaker). */
  'mode:change': { mode: string; previousMode: string };

  /** Feature-specific sync data received from a remote client. */
  'sync:data': { featureId: string; data: unknown };
}

/**
 * The API surface available to features.
 */
export interface FeatureContext {
  /** Unique feature identifier (from config or feature definition). */
  readonly featureId: string;

  /** The deck configuration. */
  readonly config: GeekSlidesConfig;

  /** Current role: 'presenter' or 'viewer'. */
  readonly role: 'presenter' | 'viewer';

  /** Navigation API. */
  readonly slideshow: {
    readonly currentSlide: number;
    readonly currentPartial: number;
    readonly slideCount: number;
    readonly mode: string;
    goTo(slide: number, partial?: number): void;
    next(): void;
    prev(): void;
  };

  /** Command registration API. */
  readonly commands: {
    register(command: {
      name: string;
      label: string;
      execute: (args?: string[]) => void;
      category?: string;
    }): void;
  };

  /** Sync data API — scoped to this feature's namespace in the Yjs doc. */
  readonly sync: {
    /** Whether sync is connected. */
    readonly connected: boolean;

    /**
     * Get the feature's shared Y.Map for arbitrary state.
     * Scoped to `features.<featureId>` in the Yjs doc.
     */
    getSharedMap(): Y.Map<unknown>;

    /**
     * Get the feature's shared Y.Array for ordered collections.
     * Scoped to `features.<featureId>.items` in the Yjs doc.
     */
    getSharedArray(): Y.Array<unknown>;

    /** Publish a state snapshot that triggers 'sync:data' on remote clients. */
    publishData(data: unknown): void;
  };

  /** DOM mounting point inside the slideshow shadow root. */
  readonly container: HTMLElement;

  /** Subscribe to lifecycle events. Returns an unsubscribe function. */
  on<K extends keyof FeatureLifecycleEvents>(
    event: K,
    handler: (payload: FeatureLifecycleEvents[K]) => void,
  ): () => void;

  /** Terminal output (if available). */
  readonly output: {
    show(message: string): void;
  };
}

/**
 * A Feature definition.
 */
export interface Feature {
  /** Unique identifier. Must be URL-safe (lowercase, hyphens). */
  readonly id: string;

  /** Human-readable label for the help command. */
  readonly label: string;

  /**
   * Called when the feature is activated.
   * Receives the full context. Returns a cleanup function (or void).
   */
  activate(context: FeatureContext): (() => void) | void;

  /**
   * Optional: called when the feature is deactivated (before cleanup).
   */
  deactivate?(): void;
}
```

## Feature Manager

The `FeatureManager` is the platform component that:

1. **Loads** feature definitions (built-in, local, or remote — same resolution as plugins)
2. **Creates** a `FeatureContext` for each feature, with scoped sync namespaces
3. **Activates** features after slides are loaded
4. **Dispatches** lifecycle events to all active features
5. **Deactivates** features on teardown or deck reload

```typescript
export class FeatureManager {
  readonly #features = new Map<string, {
    feature: Feature;
    context: FeatureContext;
    cleanup: (() => void) | null;
  }>();

  constructor(
    private readonly slideshow: Slideshow,
    private readonly commands: CommandSystem,
    private readonly sync: SyncManager | null,
    private readonly config: GeekSlidesConfig,
    private readonly role: 'presenter' | 'viewer',
    private readonly container: HTMLElement,
    private readonly output: { show(msg: string): void },
  ) {}

  /** Register and activate a feature. */
  async register(feature: Feature): Promise<void>;

  /** Deactivate and remove a feature. */
  async unregister(featureId: string): Promise<void>;

  /** Dispatch a lifecycle event to all active features. */
  emit<K extends keyof FeatureLifecycleEvents>(
    event: K,
    payload: FeatureLifecycleEvents[K],
  ): void;

  /** Deactivate all features (deck teardown). */
  deactivateAll(): void;
}
```

### Scoped Sync Namespaces

Each feature gets its own isolated namespace in the Yjs doc:

```
Y.Doc
├── sessionState          (existing — navigation, mode, presenter)
├── whiteboardStrokes     (migrated → features.whiteboard.strokes)
├── liveStrokes           (migrated → features.whiteboard.liveStrokes)
└── features              (Y.Map)
    ├── whiteboard        (Y.Map — whiteboard feature state)
    │   ├── strokes       (Y.Array)
    │   ├── liveStrokes   (Y.Map)
    │   └── visible       (boolean)
    ├── survey            (Y.Map — hypothetical survey feature)
    │   ├── active        (boolean)
    │   ├── question      (string)
    │   └── votes         (Y.Map)
    └── ...
```

This prevents features from accidentally corrupting each other's state while avoiding sandboxing overhead.

## Config Integration

Features are activated per-deck in `config.json`. Two forms are supported.

### Bundle syntax (recommended)

```json
{
  "title": "My Talk",
  "content": "README.md",
  "plugins": ["media", "whiteboard"]
}
```

Bundles that include features (`media` → `media-sync`, `whiteboard` → `whiteboard`) resolve their feature list automatically.

### Explicit `features` array

```json
{
  "title": "My Talk",
  "content": "README.md",
  "plugins": {
    "preprocessors": ["header"],
    "processors": ["chart", "mermaid"]
  },
  "features": ["whiteboard", "./features/survey.js", "https://cdn.example.com/qa-feature.js"]
}
```

Feature resolution follows the same three-source pattern as plugins:
- **Built-in name** → resolved from engine's built-in feature registry (`whiteboard`, `media-sync`, `poll`)
- **Relative path** (`./features/survey.js`) → loaded via dynamic import
- **HTTPS URL** → fetched via plugin proxy, loaded as ESM module

> **Note:** No features are active by default — decks explicitly opt in.

### Feature Module Format

External features export a `Feature` object as default:

```javascript
/** @type {import('@geekslides/engine').Feature} */
export default {
  id: 'survey',
  label: 'Live Survey',

  activate(ctx) {
    // Register commands
    ctx.commands.register({
      name: 'survey',
      label: 'Start a live survey',
      execute: (args) => {
        if (ctx.role !== 'presenter') {
          ctx.output.show('Only the presenter can start surveys');
          return;
        }
        const question = args?.join(' ') || 'Yes or No?';
        ctx.sync.getSharedMap().set('question', question);
        ctx.sync.getSharedMap().set('active', true);
      },
      category: 'survey',
    });

    // Listen for sync data
    ctx.sync.getSharedMap().observe((event) => {
      if (event.keysChanged.has('active')) {
        // Render survey UI...
      }
    });

    // Listen for slide changes
    const unsub = ctx.on('slide:enter', ({ slideIndex }) => {
      // Update feature UI for current slide
    });

    // Return cleanup
    return () => {
      unsub();
    };
  },
};
```

## Lifecycle Event Flow

```
1. Config loaded, slides parsed
2. Slideshow rendered
3. FeatureManager created with context
4. For each feature in config.features:
   a. Load feature module (built-in / local / remote)
   b. Create scoped FeatureContext
   c. Call feature.activate(context)
   d. Store cleanup function
5. Emit 'presentation:ready'
6. On navigation:
   a. Emit 'slide:leave' to all features
   b. Navigate slideshow
   c. Emit 'slide:enter' to all features
7. On partial reveal:
   a. Emit 'partial:reveal' to all features
8. On sync state change:
   a. Emit 'sync:state' to all features
9. On mode change:
   a. Emit 'mode:change' to all features
10. On deck reload / teardown:
    a. Call feature.deactivate() if defined
    b. Call cleanup function
    c. Clear feature DOM container
```

## Whiteboard as First Feature

The whiteboard is the proof-of-concept refactor. Today it's ~120 lines of imperative setup in `main.js`. As a feature:

### Before (main.js glue code)

```javascript
// ~120 lines of:
// - createElement('geek-whiteboard')
// - createElement('geek-whiteboard-toolbar')
// - addEventListener for tool-change, color-change, hide-request, clear-request
// - addEventListener for navigate → slideIndex update
// - pointerdown/pointermove/pointerup auto-activation
// - WhiteboardSync setup
// - Replay existing strokes
// - 10+ command registrations (whiteboard, whiteboard-clear, wb-toolbar, wb-pen, ...)
```

### After (WhiteboardFeature)

```typescript
const WhiteboardFeature: Feature = {
  id: 'whiteboard',
  label: 'Drawing whiteboard overlay',

  activate(ctx: FeatureContext) {
    // Create components
    const whiteboard = document.createElement('geek-whiteboard');
    const toolbar = document.createElement('geek-whiteboard-toolbar');
    ctx.container.appendChild(whiteboard);
    whiteboard.shadowRoot?.appendChild(toolbar);

    // Wire toolbar events (same as today)
    // Register commands (same as today)
    // Setup auto-activation (same as today)
    // Setup sync bridge (using ctx.sync scoped namespace)

    // Lifecycle hooks
    const unsubEnter = ctx.on('slide:enter', ({ slideIndex }) => {
      whiteboard.slideIndex = slideIndex;
    });

    const unsubSync = ctx.on('sync:state', ({ connected }) => {
      // Handle sync connect/disconnect
    });

    return () => {
      unsubEnter();
      unsubSync();
      whiteboard.remove();
    };
  },
};
```

### Migration Strategy

The whiteboard refactor is **backward-compatible**:

1. **Phase 1**: Create `FeatureManager`, `FeatureContext` types, and lifecycle event plumbing in the engine
2. **Phase 2**: Create `WhiteboardFeature` that encapsulates all whiteboard setup logic
3. **Phase 3**: Update `main.js` to use `FeatureManager` — remove hardwired whiteboard code
4. **Phase 4**: Add `"features": ["whiteboard"]` to config.json; whiteboard is now opt-in per deck
5. **Phase 5**: Add feature loading for local/remote features (same as plugin loading)

The existing Whiteboard, WhiteboardToolbar, and WhiteboardSync classes remain unchanged — they're the implementation. The feature is just the activation/wiring layer.

### Yjs Migration for Whiteboard

The whiteboard sync data moves from top-level Y.Doc keys to the feature namespace:

| Before | After |
|--------|-------|
| `doc.getArray('whiteboardStrokes')` | `doc.getMap('features').get('whiteboard').get('strokes')` |
| `doc.getMap('liveStrokes')` | `doc.getMap('features').get('whiteboard').get('liveStrokes')` |
| `sessionState.whiteboardVisible` | `doc.getMap('features').get('whiteboard').get('visible')` |

**Backward compatibility**: During migration, the SyncManager can observe both old and new locations, preferring new if present. This lets old and new clients coexist temporarily.

## DOM Mounting

Features mount their UI into a dedicated container element inside the slideshow shadow root:

```html
<geek-slideshow>
  shadowRoot
  ├── <style>
  └── <div class="gs-container">
      ├── <geek-slide> x N
      └── <div class="gs-features">        <!-- Feature mount point -->
          ├── <div data-feature="whiteboard">
          │   └── <geek-whiteboard>
          │       └── <geek-whiteboard-toolbar>
          └── <div data-feature="survey">
              └── (survey UI)
```

Each feature gets its own `<div data-feature="{id}">` container, passed as `context.container`. Features manage their own DOM within this container.

## Implementation Status

All phases are complete. Key files:

| File | Purpose |
|------|---------|
| `packages/engine/src/features/types.ts` | `Feature`, `FeatureContext`, `FeatureLifecycleEvents` interfaces |
| `packages/engine/src/features/FeatureManager.ts` | Registration, lifecycle, event dispatch |
| `packages/engine/src/features/feature-loader.ts` | Resolves built-in / local / remote feature names |
| `packages/engine/src/features/index.ts` | Public exports |
| `plugins/whiteboard/whiteboard-feature.ts` | Whiteboard wiring |
| `plugins/media/media-sync-feature.ts` | Media playback sync |
| `plugins/poll/poll-feature.ts` | Live audience polling |
| `packages/cli/app/main.js` | Uses `FeatureManager`; no hardwired feature setup |

## Open Questions (resolved)

1. **Feature ordering** — parallel activation, no ordering guarantees. ✅
2. **Feature-to-feature communication** — via Yjs shared state only. ✅
3. **Hot reload** — features reload on HMR via the standard Vite HMR infrastructure. ✅
4. **Print rendering** — features are runtime-only; PDF export renders flat HTML without them. ✅
