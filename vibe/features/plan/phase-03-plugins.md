# Phase 3: Plugin System

**Status**: Not started
**Depends on**: Phase 1 (SlideParser), Phase 2 (rendered slides for processors)
**Unlocks**: Phase 6 (chart/video processors), Phase 8 (print uses preprocessed markdown)

## Goal

Implement the plugin pipeline: typed `Preprocessor` and `Processor` interfaces,
`PluginManager` for registration and execution, and two built-in plugins (header
preprocessor and iframe processor). The chart and video processors are deferred to
Phase 6 because they depend on their respective components.

At the end of this phase, the `SlideshowController` (or entry-point wiring) runs
markdown through `PluginManager.preprocess()` before parsing and calls
`PluginManager.process()` on each rendered slide after DOM insertion.

## Deliverables

### 1. Plugin types (`packages/engine/src/plugins/types.ts`)

Define the extension interfaces:

- **`Preprocessor`**: `(markdown: string, config: GeekSlidesConfig) => string` —
  transforms raw markdown before `SlideParser.parse()`.

- **`Processor`**: `(slideElement: HTMLElement, context: ProcessorContext) => void` —
  transforms a rendered slide's DOM after HTML insertion.

- **`ProcessorContext`**: `{ slideIndex: number, slideCount: number, config: GeekSlidesConfig, slideshow: HTMLElement }`.

- **`Plugin`**: `{ name: string, preprocessors?: Preprocessor[], processors?: Processor[] }` —
  a bundle that can provide both types.

### 2. PluginManager (`packages/engine/src/plugins/PluginManager.ts`)

Manages registration and sequential execution.

- `#preprocessors: Array<{ name: string, fn: Preprocessor }>` — ordered list.
- `#processors: Array<{ name: string, fn: Processor }>` — ordered list.
- **`register(plugin: Plugin)`**: Pushes each preprocessor/processor with the plugin's name.
- **`preprocess(markdown: string, config: GeekSlidesConfig): string`**: Reduces
  through all preprocessors sequentially, threading the output of each into the next.
- **`process(slideElement: HTMLElement, context: ProcessorContext): void`**: Calls
  each processor in order on the given element.
- **`list(): { preprocessors: string[], processors: string[] }`**: Returns registered
  plugin names for diagnostics.

### 3. Built-in: header-preprocessor (`packages/engine/src/plugins/builtins/header-preprocessor.ts`)

Same logic as v1's `headerPreprocessor`: matches lines starting with `## ` and inserts
an empty-link slide separator (`[](.slide#anchor)`) above each one. Anchor is generated
by lowercasing the title, replacing non-alphanumeric runs with hyphens, trimming edges.

### 4. Built-in: iframe-processor (`packages/engine/src/plugins/builtins/iframe-processor.ts`)

Lazy-loads iframes by converting `data-src` to `src` only when the slide becomes active.
Sets up a `MutationObserver` on the slide element watching for the `active` attribute.
When active is set, copies `data-src` to `src` (once). When active is removed, optionally
clears `src` to unload the iframe (configurable).

### 5. Plugin registration via config

Update the entry-point wiring (from Phase 2) to:
1. Read `config.plugins.preprocessors` and `config.plugins.processors` arrays.
2. Map short names (`"header"`, `"iframe"`) to the built-in plugin functions.
3. Register all configured plugins with `PluginManager`.
4. Call `pluginManager.preprocess(markdown, config)` before `SlideParser.parse()`.
5. Call `pluginManager.process(slideEl, ctx)` for each slide after DOM insertion.

### 6. Plugin barrel export (`packages/engine/src/plugins/index.ts`)

Re-export `PluginManager`, types, and all built-in plugins for external consumers.

### 7. Unit Tests

**`packages/engine/tests/unit/PluginManager.test.ts`**:
- Preprocessors run in sequence (output of one feeds into the next).
- Processors modify slide elements in place.
- Empty plugin (no preprocessors, no processors) registers without error.
- `list()` returns correct names.

**`packages/engine/tests/unit/header-preprocessor.test.ts`**:
- `## Title` gets a `[](.slide#title)` separator inserted above.
- Multiple `##` headers produce multiple separators.
- `#` (h1) and `###` (h3) headers are not affected.
- Special characters in titles produce clean anchors.

**`packages/engine/tests/unit/iframe-processor.test.ts`**:
- Sets `src` from `data-src` when slide gets `[active]` attribute.
- Does not double-set if already loaded.
- Handles slides with no iframes gracefully.

## File List

```
packages/engine/src/plugins/
├── types.ts
├── PluginManager.ts
├── index.ts
└── builtins/
    ├── header-preprocessor.ts
    └── iframe-processor.ts

packages/engine/tests/unit/
├── PluginManager.test.ts
├── header-preprocessor.test.ts
└── iframe-processor.test.ts
```

## Acceptance Criteria

- [ ] `PluginManager.preprocess()` chains preprocessors correctly.
- [ ] `PluginManager.process()` runs processors on each slide element.
- [ ] Header preprocessor generates correct slide separators from `##` headers.
- [ ] Iframe processor lazy-loads iframes on slide activation.
- [ ] Plugins are loaded from `config.json` `plugins` field.
- [ ] All unit tests pass.
- [ ] External plugins can be registered programmatically alongside built-ins.

## Reference Docs

- [plugin-system.md](../plugin-system.md) — full plugin architecture spec
- [architecture-v2.md](../architecture-v2.md) — plugin pipeline in data flow diagram
