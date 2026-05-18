# How to Embed Custom Web Components

**Level**: Advanced  
**Time**: 10 minutes

Load your own web components into a deck and use them inside markdown slides for interactive controls, data widgets, or custom visualizations.

---

## What You'll Learn

- How to add scripts to your deck configuration
- How to write a custom web component
- How to embed components in markdown slides
- How to interact with existing slide elements (e.g. css-doodle)
- How to use `window.__geekslides` engine utilities

---

## Prerequisites

- A GeekSlides deck (see [02-create-your-first-deck.md](02-create-your-first-deck.md))
- Basic JavaScript and web components knowledge

---

## Step 1: Create a Component File

Create a `components/` directory in your deck and add a JavaScript file:

```
my-deck/
  config.json
  README.md
  components/
    my-widget.js
```

Write a standard custom element:

```js
class MyWidget extends HTMLElement {
  connectedCallback() {
    const label = document.createElement('span');
    label.textContent = 'Hello from my widget!';
    label.style.color = 'var(--gs-color-accent)';
    this.appendChild(label);
  }
}

customElements.define('my-widget', MyWidget);
```

> **Tip**: Components run inside the slide's Shadow DOM, so they inherit the deck's CSS custom properties like `--gs-color-accent`.

---

## Step 2: Register the Script

Add the `scripts` field to your `config.json`:

```json
{
  "title": "My Presentation",
  "content": ["README.md"],
  "styles": ["css/layouts.css", "css/theme-default.css"],
  "scripts": ["./components/my-widget.js"]
}
```

Scripts are loaded as ES modules during deck initialization, before slides render. You can list multiple scripts and they load in order.

---

## Step 3: Use the Component in Markdown

GeekSlides' markdown parser has `html: true`, so custom element tags pass through unchanged:

```markdown
# My Slide

Some explanatory text.

<my-widget></my-widget>
```

The custom element renders inline with other slide content.

---

## Step 4: Add an Init Function (Optional)

If your script exports an `init()` function, it will be called automatically after loading. Use this for one-time setup:

```js
class MyWidget extends HTMLElement {
  connectedCallback() {
    this.textContent = 'Ready!';
  }
}

customElements.define('my-widget', MyWidget);

export function init() {
  console.log('my-widget script initialized');
}
```

---

## Step 5: Interact with css-doodle Elements

Custom components can interact with css-doodle patterns through data attributes and the engine API.

### Reading Doodle Data Attributes

The css-doodle processor sets these `data-*` attributes on every `<css-doodle>` element:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-pattern` | Pattern name | `triangles` |
| `data-grid` | Grid dimensions | `18`, `20x10` |
| `data-animate` | Animation enabled | (presence = true) |
| `data-speed` | Animation speed | `1.5` |
| `data-opacity` | Overall opacity | `0.3` |
| `data-nohole` | No-hole mode | (presence = true) |
| `data-colors` | Custom colors (pipe-separated) | `red\|blue` |
| `data-seed` | Random seed | `42` |

### Using the Engine API

Scripts can access engine utilities through `window.__geekslides`:

```js
const { patternRegistry, buildColorVars, parseDoodleConfig } = window.__geekslides;

// List all available patterns
for (const [name, pattern] of patternRegistry) {
  console.log(name, pattern.defaultGrid);
}

// Generate pattern CSS
const config = { grid: '16', colors: ['var(--doodle-c1)', 'var(--doodle-c2)'], animate: false, speed: 1 };
const pattern = patternRegistry.get('triangles');
const css = pattern.generate(config);

// Build color variable declarations
const colorVars = buildColorVars(['#ff6b6b', '#4ecdc4'], false);
```

### Updating a Doodle Dynamically

Find the `<css-doodle>` element in the same slide and call `.update()`:

```js
class DoodleSlider extends HTMLElement {
  connectedCallback() {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '4';
    slider.max = '30';
    slider.value = '12';
    slider.addEventListener('input', () => this.#update(slider.value));
    this.appendChild(slider);
  }

  #update(gridSize) {
    const slide = this.closest('section.content');
    const doodle = slide?.querySelector('css-doodle');
    if (!doodle) return;

    const { patternRegistry, buildColorVars } = window.__geekslides;
    const patternName = doodle.dataset.pattern;
    const pattern = patternRegistry.get(patternName);
    if (!pattern) return;

    const config = {
      grid: gridSize,
      colors: Array.from({ length: 5 }, (_, i) => `var(--doodle-c${i + 1})`),
      animate: false,
      speed: 1,
    };

    const css = `
      :host { ${buildColorVars(undefined, false)} }
      ${pattern.generate(config)}
    `;

    doodle.update(css);
  }
}

customElements.define('doodle-slider', DoodleSlider);
```

---

## Step 6: Load Remote Scripts

Scripts can also be remote URLs:

```json
{
  "scripts": [
    "./components/local-widget.js",
    "https://cdn.example.com/remote-widget.js"
  ]
}
```

Remote scripts load as ES modules, same as local ones.

---

## Example: The css-doodle-demo Deck

The `decks/css-doodle-demo/` deck ships with a `<doodle-controls>` component that provides interactive controls for css-doodle patterns, including shape scale, animation, color, and a live config summary. Check it out for a full working example:

```
decks/css-doodle-demo/
  config.json               ← scripts: ["./components/doodle-controls.js"]
  README.md                 ← <doodle-controls></doodle-controls> in each slide
  components/
    doodle-controls.js      ← Full control panel with sliders, color pickers, config text, etc.
```

---

## Tips

- **Script order matters**: Scripts load sequentially. If component B depends on component A, list A first.
- **Shadow DOM access**: Components embedded in slides live inside the slide's Shadow DOM. Use `this.closest('section.content')` to find sibling elements.
- **HMR support**: During `npm run dev`, script files are watched for changes. Editing a component file triggers a full deck reload.
- **Print mode**: Components render normally in print/PDF export. Make sure they display something meaningful without user interaction.
- **Theme integration**: Use CSS custom properties (`--gs-color-accent`, `--gs-color-surface`, etc.) for colors so your component respects theme changes.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Component doesn't appear | Check that the custom element tag in markdown matches the name in `customElements.define()` |
| Script fails to load | Open browser console for errors; verify the path in `config.json` is relative to the deck root |
| `window.__geekslides` is undefined | Scripts load before render — `__geekslides` is set in `main.js` at boot. Make sure you're not accessing it at module-level; use it inside `connectedCallback()` or event handlers |
| Doodle `.update()` has no effect | Ensure you're calling `.update(css)` with a full CSS string, not just a fragment |

---

Next: [Embed Rich Media →](22-embed-rich-media.md)
