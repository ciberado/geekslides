# Custom Web Components in Slides

## Status

**Proposed** — Design document for loading and using custom web components inside presentation slides.

## Problem

Deck authors need to embed interactive UI elements within slides — custom controls, data visualisations, mini-apps — but there is no mechanism to:

1. **Load** custom web component definitions (JavaScript) alongside the deck
2. **Use** those components in markdown by embedding HTML tags
3. **Interact** with other slide elements at runtime (e.g. control css-doodle parameters)

The existing plugin system (preprocessors/processors) and the feature system solve different problems:

- **Plugins** transform content at parse-time; they fire once and have no ongoing runtime access.
- **Features** are long-lived interactive extensions with full API access — but they are presentation-scoped overlays (whiteboard, Q&A), not slide-embedded UI.

What's missing is a way for deck authors to say: *"load this JavaScript file that defines `<my-widget>`, and let me use `<my-widget>` inside my markdown."*

## Solution: `scripts` Config Field + HTML-in-Markdown

### Overview

Add a `scripts` array to `config.json`. Each entry is a JavaScript file (local relative path or HTTPS URL) that is dynamically imported **before** slides render. These scripts can register custom elements, set up global state, or provide any browser-side setup.

Since markdown-it is configured with `html: true`, raw HTML tags pass through to the rendered DOM — so once a custom element is registered, authors embed it directly in markdown.

### Design Principles

1. **Zero magic** — Scripts are standard ES modules. No special API, no wrapper classes. `customElements.define()` is the platform.
2. **Deck-scoped by default** — Scripts are loaded per-deck via config. Different decks can use different components.
3. **Load before render** — Scripts are `await`ed before the processor pipeline runs, so custom elements are defined by the time the DOM is built.
4. **Same resolution as plugins** — Relative paths (`./components/my-widget.js`) and HTTPS URLs follow the same pattern as local/remote plugins.
5. **No inline `<script>` tags** — Markdown `<script>` blocks are intentionally not supported (security, complexity, markdown-it stripping). Components are always in separate `.js` files.

### Config Schema

```json
{
  "title": "My Deck",
  "content": ["README.md"],
  "scripts": [
    "./components/doodle-controls.js",
    "./components/live-chart.js",
    "https://cdn.example.com/my-widget.js"
  ],
  "plugins": {
    "preprocessors": ["header", "css-doodle"],
    "processors": ["css-doodle"]
  }
}
```

### Script Module Format

Scripts are standard ES modules. They are imported for their side effects — the primary use case is calling `customElements.define()`:

```javascript
// components/doodle-controls.js

class DoodleControls extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<input type="range" min="2" max="40" value="8">`;
    this.querySelector('input').addEventListener('input', (e) => {
      // Find and update the css-doodle in this slide
      const doodle = this.closest('section.content')?.querySelector('css-doodle');
      if (doodle) {
        doodle.grid = e.target.value;
      }
    });
  }
}

customElements.define('doodle-controls', DoodleControls);
```

Scripts MAY also export a default `init` function for post-load setup:

```javascript
export default function init(config) {
  console.log('Component loaded for deck:', config.title);
}
```

If a default export exists and is a function, it is called with the deck config after import.

### Usage in Markdown

Once a script registers a custom element, use it directly in markdown:

```markdown
## My Slide

Here's a triangular pattern:

![css-doodle](#triangles,grid=8)

<doodle-controls></doodle-controls>
```

The `<doodle-controls>` HTML passes through markdown-it unchanged and becomes a live custom element in the rendered slide DOM.

### Component Scoping: Deck-Level vs Slide-Level

**Deck-level** (v1 — this proposal): Scripts in `config.json` are loaded once for the entire deck. Components are globally registered and available in all slides.

**Slide-level** (future): A hypothetical syntax for per-slide scripts. Deferred because:
- `customElements.define()` is global — you can't scope a tag name to one slide
- Slide-level scripts would need a preprocessor to extract and manage `<script>` blocks
- The use case is rare: most components are reusable across slides

For "show this component only on slide X", authors simply place the HTML tag in that slide's markdown. The component definition is global, but the instances are slide-scoped.

### Loading Flow

```
config.json loaded
    │
    ▼
scripts[] resolved (relative paths → absolute URLs)
    │
    ▼
┌─────────────────────────────────────┐
│  For each script (sequential):      │
│  1. Dynamic import(url)             │
│  2. If default export is function:  │
│     call init(config)               │
│  3. Custom elements now registered  │
└─────────────────────────────────────┘
    │
    ▼
Preprocessor pipeline (markdown → HTML placeholders)
    │
    ▼
SlideParser.parse() (markdown-it renders HTML, custom tags pass through)
    │
    ▼
Processor pipeline (DOM transforms, css-doodle elements created)
    │
    ▼
Slides ready (custom elements upgrade and render)
```

### Interaction with css-doodle (the Demo Use Case)

To enable custom components to interact with css-doodle elements:

1. **Data attributes on `<css-doodle>`**: The processor stores the pattern name and config as `data-*` attributes on the created element, so components can read them.

2. **css-doodle's `.update()` API**: The library natively supports `.update(newCSS)` to re-render with new styles. Components call this directly — no GeekSlides-specific API needed.

3. **Pattern registry access**: The engine exports the `patternRegistry` and pattern generation utilities so components can regenerate CSS with modified parameters.

### Engine Exports for Component Authors

The engine will export pattern utilities for use by custom components:

```typescript
// From @geekslides/engine (or available on window.__geekslides)
export { patternRegistry } from './plugins/builtins/css-doodle-patterns/index.ts';
export type { DoodlePattern, DoodlePatternConfig } from './plugins/builtins/css-doodle-patterns/types.ts';
```

Since deck-local scripts can't easily import from `@geekslides/engine` (they run in the browser, not in the build pipeline), the engine exposes these utilities on `window.__geekslides`:

```typescript
window.__geekslides = {
  patternRegistry,
  // Future: other utilities for component authors
};
```

### HMR Support

When running in dev mode with Vite HMR:
- Script files are added to the HMR watch list alongside content and style files
- When a script file changes, the deck reloads (full reload, since custom element re-registration requires a fresh page)

### Security Considerations

- **Same-origin scripts** (relative paths): Trusted — they're part of the deck repo
- **Remote scripts** (HTTPS URLs): Loaded via the plugin proxy (same as remote plugins), subject to the same security constraints (`.js` only, 1 MB max, HTTPS required in production)
- **No inline scripts**: `<script>` tags in markdown are NOT executed. This prevents XSS in user-contributed markdown.

### Print / PDF Export

Custom components render in the DOM, so they appear in print output if they produce visible content. For PDF export via Playwright, the components will render as they do in the browser.

Components that are purely interactive (controls, buttons) can use `@media print { display: none; }` to hide themselves in PDF output.

## Implementation Plan

### Phase 1: `scripts` in Config

- Add `scripts: readonly string[]` to `GeekSlidesConfig` interface
- Stop deleting legacy `scripts` field in `normalizeLegacyConfig()`
- Parse and validate `scripts` array in `loadConfig()`
- Default to `[]` (empty — backward compatible)

### Phase 2: Script Loading in main.js

- Add `loadScripts(config, resolveUrl)` function
- Load scripts sequentially via dynamic `import()`
- Call optional default init function with config
- Run script loading AFTER config load, BEFORE preprocessor pipeline
- Add scripts to HMR watch list

### Phase 3: Engine Utilities Export

- Export `patternRegistry` and pattern types from engine's public API
- Expose `window.__geekslides` with pattern utilities
- Store pattern name and config as data attributes on `<css-doodle>` elements

### Phase 4: css-doodle Updatability

- Modify css-doodle processor to store config metadata on elements
- Add `data-pattern`, `data-grid`, `data-colors`, `data-animate`, `data-speed`, `data-opacity` attributes
- Export `buildColorVars()` and `parseConfig()` utilities for component reuse

### Phase 5: Demo Component (`<doodle-controls>`)

- Create `decks/css-doodle-demo/components/doodle-controls.js`
- Implement controls: grid slider, color pickers, opacity slider, speed slider, animate toggle, pattern selector
- Wire controls to css-doodle's `.update()` API
- Update `decks/css-doodle-demo/config.json` to include the script
- Update `decks/css-doodle-demo/README.md` to embed `<doodle-controls>` in slides

### Phase 6: Tests

- Unit tests for script loading
- Unit tests for config `scripts` parsing
- E2E test: deck with custom component renders and interacts

### Phase 7: Documentation

- Update `vibe/features/architecture-v2.md` with scripts loading stage
- Update `vibe/features/plugin-system.md` with cross-reference
- Create how-to guide for writing custom components

## Relationship to Other Systems

| System | Role | Interaction |
|--------|------|-------------|
| **Plugins** | Content transformation at parse time | Scripts load before plugins run |
| **Features** | Presentation-level interactive overlays | Orthogonal — features use FeatureManager, scripts are plain ES modules |
| **Themes** | CSS custom properties for colors/fonts | Components can read `--gs-color-*` vars |
| **Sync** | Real-time state via Yjs | Components don't directly access sync (they could via `window.__geekslides` in the future) |

## Open Questions

1. **Script ordering**: Should scripts execute in parallel or sequential? (Proposed: sequential — order might matter for dependencies.)
2. **Error handling**: If a script fails to load, should the deck still render? (Proposed: yes — warn and continue.)
3. **TypeScript components**: Should we support `.ts` scripts via Vite's transform? (Proposed: yes for local scripts in dev mode — Vite handles this automatically via `import()`.)
4. **NPM packages**: Should `scripts` support bare specifiers like `"my-component"` resolved via import maps? (Proposed: defer — YAGNI for now.)
