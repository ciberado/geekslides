# Web Components Architecture

## Overview

geekslides v2 uses native Web Components (Custom Elements + Shadow DOM) for all UI
elements. This gives true style encapsulation, standard lifecycle hooks, and zero
framework overhead.

## Component Hierarchy

```
<geek-slideshow>                    # root component, owns slide state
├── <geek-slide>                    # one per slide section
│   ├── (slide HTML content)        # from markdown rendering
│   ├── <style>                     # scoped per-slide styles
│   └── <geek-chart>?               # optional chart component
│       └── <canvas>
├── <geek-toolbar>                  # bottom toolbar (touch/mouse)
│   ├── slide counter
│   ├── mode buttons
│   └── sync indicator
├── <geek-command-palette>          # modal command search (hidden by default)
│   ├── <input> (search)
│   └── <ul> (filtered commands)
├── <geek-whiteboard>               # canvas overlay (hidden by default)
│   └── <canvas>
└── <geek-video>?                   # video partial controller
    └── <video>
```

## Shadow DOM Strategy

### Browser Rendering (Shadow DOM ON)

Each component uses Shadow DOM for full style isolation:

```typescript
class GeekSlideshow extends HTMLElement {
  #shadow: ShadowRoot;
  #slides: GeekSlide[] = [];

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#shadow.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          position: relative;
        }
        :host([mode="speaker"]) {
          /* speaker mode layout */
        }
        ::slotted(geek-slide) {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.3s, transform 0.3s;
        }
        ::slotted(geek-slide[active]) {
          opacity: 1;
        }
      </style>
      <slot></slot>
    `;
  }
}

customElements.define('geek-slideshow', GeekSlideshow);
```

### Print Rendering (Shadow DOM OFF)

WeasyPrint cannot pierce Shadow DOM boundaries. The `PrintRenderer` produces a flat
HTML document with equivalent styles inlined in the `<head>`:

```typescript
class PrintRenderer {
  render(slides: SlideData[], template: 'slides' | 'slides-notes' | 'book'): string {
    const templateHtml = this.loadTemplate(template);
    
    // Render slides as plain <section> elements (no custom elements)
    const slidesHtml = slides.map((slide, i) => `
      <section class="gs-slide" id="slide-${i}" ${slide.attrs}>
        <style>${slide.scopedCss}</style>
        ${slide.html}
        ${template !== 'slides' ? `
          <aside class="gs-notes">${slide.notes}</aside>
        ` : ''}
      </section>
    `).join('\n');

    return templateHtml
      .replace('{{slides}}', slidesHtml)
      .replace('{{styles}}', this.collectStyles());
  }
}
```

## Component Specifications

### `<geek-slideshow>`

The root orchestrator. Manages slide deck state, navigation, and aspect ratio scaling.

```typescript
class GeekSlideshow extends HTMLElement {
  // --- Observed attributes ---
  static observedAttributes = ['aspect-ratio', 'mode', 'current-slide', 'current-partial'];

  // --- Public properties ---
  get currentSlide(): number;
  set currentSlide(n: number);
  get currentPartial(): number;
  set currentPartial(n: number);
  get mode(): 'present' | 'speaker' | 'overview';
  set mode(m: string);
  get slideCount(): number;

  // --- Public methods ---
  loadSlides(sections: SlideData[]): void;  // populate from parsed markdown
  next(): void;                              // next partial or slide
  prev(): void;                              // previous partial or slide
  goTo(slide: number, partial?: number): void;

  // --- Events emitted ---
  // 'geek:navigate' — after any navigation
  // 'geek:slides:loaded' — after loadSlides()

  // --- Events listened ---
  // 'geek:navigate' — from CommandSystem/SyncManager
  // 'geek:mode' — mode changes
  // 'geek:hmr:update' — re-fetch and re-render markdown
}
```

**Aspect ratio scaling** (preserved from v1):
```typescript
#rescale(): void {
  const { width, height } = this.getBoundingClientRect();
  const targetRatio = this.#aspectRatio; // e.g. 16/9
  const currentRatio = width / height;
  
  const scale = currentRatio > targetRatio
    ? height / (width / targetRatio)
    : width / (height * targetRatio);
  
  this.#container.style.transform = `scale(${scale})`;
}
```

### `<geek-slide>`

Individual slide. Lightweight wrapper around content HTML.

```typescript
class GeekSlide extends HTMLElement {
  static observedAttributes = ['active', 'partial'];

  // --- Properties ---
  get partialCount(): number;        // count of [partial] elements
  get notes(): string;               // speaker notes HTML
  get backgroundImage(): string;     // from slide attributes
  get backgroundColor(): string;

  // --- Internal ---
  #content: HTMLElement;             // shadow DOM content container
  #scopedStyle: HTMLStyleElement;    // per-slide scoped CSS

  connectedCallback(): void {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--gs-slide-padding, 2rem);
          font-size: var(--gs-base-font-size, 1.8rem);
        }
        :host([active]) { /* visible */ }
        .content ::slotted([partial]) {
          visibility: hidden;
        }
        .content ::slotted([partial][visible]) {
          visibility: visible;
        }
      </style>
      <div class="content"><slot></slot></div>
    `;
  }

  // Reveal next partial
  revealPartial(n: number): void {
    const partials = this.querySelectorAll('[partial]');
    partials.forEach((el, i) => {
      el.toggleAttribute('visible', i < n);
    });
  }
}
```

### `<geek-toolbar>`

Bottom toolbar for touch/presenter controls.

```typescript
class GeekToolbar extends HTMLElement {
  // Renders: prev/next buttons, slide counter, mode toggle, sync indicator
  // All actions dispatch CustomEvents bubbling up to document
  
  connectedCallback(): void {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,0.8);
          color: white;
          z-index: 1000;
          transform: translateY(100%);
          transition: transform 0.2s;
        }
        :host([visible]) {
          transform: translateY(0);
        }
      </style>
      <button data-cmd="prev">◀</button>
      <span class="counter"><slot name="counter"></slot></span>
      <button data-cmd="next">▶</button>
      <button data-cmd="toggle-whiteboard">✏️</button>
      <span class="sync-status"></span>
    `;
  }
}
```

### `<geek-command-palette>`

Modal command search UI activated by `:`.

```typescript
class GeekCommandPalette extends HTMLElement {
  // Shadow DOM contains:
  // - Backdrop overlay
  // - Search input
  // - Filtered command list
  // - Keyboard navigation (up/down/enter/escape)

  open(): void;    // show palette, focus input
  close(): void;   // hide palette
  
  register(commands: Command[]): void;  // populate command list
}
```

### `<geek-whiteboard>`

Canvas overlay for freehand drawing, synced via Yjs.

```typescript
class GeekWhiteboard extends HTMLElement {
  // Canvas element in Shadow DOM
  // Pointer events for drawing
  // Color/width selection
  // Dispatches 'geek:whiteboard:stroke' events
  // Listens for remote strokes from WhiteboardSync
  
  clear(): void;
  toggle(): void;
  setColor(color: string): void;
  setWidth(width: number): void;
}
```

### `<geek-chart>`

Replaces `<table>` content with a Chart.js canvas.

```typescript
class GeekChart extends HTMLElement {
  static observedAttributes = ['type']; // bar, line, pie, etc.
  
  connectedCallback(): void {
    // Parse table data from light DOM
    // Create <canvas> in shadow DOM
    // Initialize Chart.js
  }
}
```

## Per-Slide Style Scoping

When a markdown slide contains a `<style>` block:

```markdown
[](#my-slide)

<style>
h2 { color: red; }
.highlight { background: yellow; }
</style>

## This is red

Some <span class="highlight">highlighted</span> text.
```

The `StyleScoper` rewrites selectors at parse time:

```typescript
class StyleScoper {
  scope(css: string, slideId: string): string {
    // Parse CSS, prefix each selector with the slide container
    // "h2" → "geek-slide#my-slide h2"
    // ".highlight" → "geek-slide#my-slide .highlight"
    
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    
    let scoped = '';
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule) {
        scoped += `geek-slide[data-id="${slideId}"] ${rule.selectorText} {
          ${rule.style.cssText}
        }\n`;
      }
    }
    return scoped;
  }
}
```

The scoped `<style>` is injected into the light DOM (not shadow) so it only affects
that specific slide's descendant elements.

## CSS Custom Properties (Theming)

Components expose CSS custom properties for theme customization:

```css
/* Default theme (can be overridden in local.css) */
:root {
  /* Slideshow */
  --gs-bg: #ffffff;
  --gs-color: #333333;
  --gs-font-family: system-ui, sans-serif;
  --gs-base-font-size: 1.8rem;
  --gs-slide-padding: 2rem;
  --gs-aspect-ratio: 16 / 9;
  
  /* Code blocks */
  --gs-code-bg: #f5f5f5;
  --gs-code-font: 'Fira Code', monospace;
  --gs-code-font-size: 0.9em;
  
  /* Transitions */
  --gs-transition-duration: 0.3s;
  --gs-transition-timing: ease-in-out;
  
  /* Toolbar */
  --gs-toolbar-bg: rgba(0, 0, 0, 0.8);
  --gs-toolbar-color: #ffffff;
  --gs-toolbar-height: 48px;
  
  /* Whiteboard */
  --gs-wb-default-color: #ff0000;
  --gs-wb-default-width: 3px;
}
```

## Registration

All custom elements are registered in the engine's entry point:

```typescript
// packages/engine/src/index.ts
export { GeekSlideshow } from './core/Slideshow';
export { GeekSlide } from './core/Slide';
export { GeekToolbar } from './components/Toolbar';
export { GeekCommandPalette } from './components/CommandPalette';
export { GeekWhiteboard } from './components/Whiteboard';
export { GeekChart } from './components/ChartSlide';
export { GeekVideo } from './components/VideoSlide';

// Auto-register when imported
const components: [string, CustomElementConstructor][] = [
  ['geek-slideshow', GeekSlideshow],
  ['geek-slide', GeekSlide],
  ['geek-toolbar', GeekToolbar],
  ['geek-command-palette', GeekCommandPalette],
  ['geek-whiteboard', GeekWhiteboard],
  ['geek-chart', GeekChart],
  ['geek-video', GeekVideo],
];

for (const [name, ctor] of components) {
  if (!customElements.get(name)) {
    customElements.define(name, ctor);
  }
}
```
