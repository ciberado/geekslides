# css-doodle

Renders generative CSS doodle patterns as slide backgrounds or decorative elements. Patterns are defined in a built-in registry; custom patterns can be added via `config.scripts`.

## What it provides

| Part | Name | Role |
|------|------|------|
| Preprocessor | `css-doodle` | Converts `![css-doodle](#pattern-name,opts)` markers to placeholder `<div>` elements |
| Processor | `css-doodle` | Replaces the placeholders with live `<css-doodle>` web components |

## Usage

```json
{ "plugins": ["css-doodle"] }
```

## Markdown syntax

```markdown
![css-doodle](#pattern-name)
![css-doodle](#pattern-name,grid=12,opacity=0.4)
![css-doodle](#pattern-name,color=#3a7bd5,bgColor=#1a1a2e)
```

The `#pattern-name` refers to a key in the built-in pattern registry.

### Available options

| Option | Description | Default |
|--------|-------------|---------|
| `grid` | Grid size for `<css-doodle>` (e.g. `12` → 12×12) | pattern default |
| `opacity` | Opacity of the doodle layer (0–1) | `1` |
| `color` | Primary colour override (hex or CSS colour) | pattern default |
| `bgColor` | Background colour override | pattern default |

## Extending with custom patterns

In a script loaded via `config.scripts`, register new patterns through the engine's `patternRegistry`:

```js
// config.scripts: ["./components/my-patterns.js"]
import { patternRegistry } from '@geekslides/engine';

patternRegistry.register({
  id: 'my-pattern',
  label: 'My custom pattern',
  grid: 8,
  rule: `
    :doodle { @size: 100%; background: #111; }
    background: hsl(@r(360), 60%, 60%);
    margin: 1px;
    border-radius: 50%;
  `,
});
```

Or via the global exposed on `window` when scripts run in the browser:

```js
window.__geekslides.patternRegistry.register({ id: 'my-pattern', ... });
```

## Notes

- Requires the [css-doodle](https://css-doodle.com/) web component to be available. It is bundled with the GeekSlides engine.
- The `css-doodle` plugin does not pull in `core`. For heading-based slides, use `plugins: ["core", "css-doodle"]`.
