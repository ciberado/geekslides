# Create a Custom Layout with Modifier Variations

This guide shows you how to create a custom layout class with modifier variations that adapt its behavior. You'll learn the CSS nesting pattern, structured documentation format, and how the VSCode autocomplete automatically picks up your new classes.

## What are layout modifiers?

**Modifiers** are CSS classes that modify a layout's behavior without changing its core structure. They're combined with the layout class:

```markdown
[](.layout-cover.mod-coverbg#hero,bgurl(hero.jpg))
```

In this example:
- `layout-cover` is the base layout (image + text positioning)
- `mod-coverbg` is the modifier (makes image full-bleed background)

## The nesting pattern

GeekSlides uses CSS nesting (`&`) to keep modifiers visually grouped with their parent layouts:

```css
section.content.layout-cover {
  /* Base layout styles */
  
  /**
   * Modifier documentation
   */
  &.mod-coverbg {
    /* Modifier styles */
  }
}
```

This makes it crystal clear which modifiers work with which layouts.

## Example: Create a layout with two modifiers

Let's create a `layout-feature` with two modifier variations: `mod-reverse` (swaps image/text sides) and `mod-compact` (reduces spacing).

### Step 1: Write the CSS with documentation

Add to your deck's `css/layouts.css`:

```css
/**
 * @layout layout-feature
 * @detail Feature showcase — image left, text right
 * @markdown
 * [](.layout-feature#product)
 * ![Product](product.jpg)
 * ### Key Feature
 * - Benefit 1
 * - Benefit 2
 * @structure
 * ┌─────────┬─────────────┐
 * │         │ ### Heading │
 * │  IMAGE  │ - Benefits  │
 * │         │             │
 * └─────────┴─────────────┘
 * @usage
 * Two-column grid with image on left. Use mod-reverse to flip sides.
 */
section.content.layout-feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gs-gap);
  align-items: center;

  /**
   * @modifier mod-reverse
   * @detail Flip image to right side
   * @usage
   * [](.layout-feature.mod-reverse#product)
   * Reverses grid columns — text left, image right.
   */
  &.mod-reverse {
    direction: rtl;
    
    > * {
      direction: ltr;
    }
  }

  /**
   * @modifier mod-compact
   * @detail Reduce spacing for tighter layout
   * @usage
   * [](.layout-feature.mod-compact#product)
   * Reduces gap from 32px to 16px.
   */
  &.mod-compact {
    gap: calc(var(--gs-gap) / 2);
  }
}
```

### Step 2: Rebuild the VSCode extension

If you're working on the GeekSlides repository (developing layouts for the CLI templates):

```bash
cd packages/vscode
npm run build
```

The `prebuild` script automatically:
1. Reads your CSS file
2. Extracts `@layout` and `@modifier` documentation
3. Generates `class-registry-generated.ts`
4. Bundles the extension

### Step 3: Test in VSCode

1. Reload VSCode window (Cmd/Ctrl + Shift + P → "Developer: Reload Window")
2. Open a deck's `README.md`
3. Type `[](.layout-fe` — your new layout appears!
4. Type `[](.layout-feature.mod-` — both modifiers appear with documentation!

### Step 4: Use in your slides

```markdown
[](.layout-feature#product)
![Product](product.jpg)
### Revolutionary Feature
- 10x faster
- Zero configuration

[](.layout-feature.mod-reverse#testimonial)
### What customers say
"This changed everything!"
![Customer](avatar.jpg)

[](.layout-feature.mod-compact.mod-reverse#tight-space)
![Icon](small-icon.png)
### Compact view
Brief description.
```

## Documentation tags explained

### For layouts (@layout block)

| Tag | Required | Purpose |
|-----|----------|---------|
| `@layout` | ✅ | CSS class name (e.g., `layout-feature`) |
| `@detail` | ✅ | One-line description for autocomplete |
| `@markdown` | ✅ | Complete example with slide marker |
| `@structure` | ✅ | ASCII diagram showing visual layout |
| `@usage` | ❌ | Additional notes, compatible modifiers |

### For modifiers (@modifier block)

| Tag | Required | Purpose |
|-----|----------|---------|
| `@modifier` | ✅ | CSS class name (e.g., `mod-reverse`) |
| `@detail` | ✅ | One-line description for autocomplete |
| `@usage` | ❌ | Usage notes, parent layout context |

**Note**: Modifiers don't need `@markdown` or `@structure` — they inherit from the parent layout.

## Where to add your layouts

### For deck-specific layouts

Add to your deck's `css/local.css` or create `css/custom-layouts.css` and reference it in `config.json`:

```json
{
  "styles": [
    "css/layouts.css",
    "css/theme-default.css",
    "css/custom-layouts.css"
  ]
}
```

### For CLI template layouts

Add to `packages/cli/src/templates/layouts.css` so all new decks get your layout.

## Global modifiers vs. layout-specific modifiers

**Layout-specific** (nested with `&`):
```css
section.content.layout-cover {
  &.mod-coverbg {
    /* Only makes sense with layout-cover */
  }
}
```

**Global** (top-level):
```css
section.content.mod-partial {
  /* Works with any layout */
  li, tr {
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  li.gs-visible, tr.gs-visible {
    opacity: 1;
  }
}
```

Use nesting when a modifier only makes sense with specific layouts. Use top-level for modifiers that work universally (like `mod-partial` for progressive reveal).

## ASCII diagram tips

Keep diagrams simple and visual:

```css
/**
 * @structure
 * ┌───────────┬───────────┐
 * │ [IMAGE]   │ Heading   │  ← Image spans full height
 * │           │ Content   │
 * └───────────┴───────────┘
 */
```

Use annotations (`←`, `↑`, labels) to explain non-obvious behaviors.

Box drawing characters: `┌ ─ ┬ ─ ┐  │  ├ ─ ┼ ─ ┤  └ ─ ┴ ─ ┘`

## Common patterns

### Responsive columns

```css
/**
 * @modifier mod-single-col
 * @detail Stack to single column on narrow slides
 */
&.mod-single-col {
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
}
```

### Dark/light variants

```css
/**
 * @modifier mod-dark
 * @detail Dark background variant
 */
&.mod-dark {
  background: var(--gs-color-dark);
  color: var(--gs-color-light);
}
```

### Alignment variants

```css
/**
 * @modifier mod-center
 * @detail Center all content
 */
&.mod-center {
  text-align: center;
  justify-items: center;
}
```

## Troubleshooting

**Autocomplete doesn't show my layout:**
1. Check CSS comment syntax (all required tags present?)
2. Run `cd packages/vscode && npm run prebuild` manually
3. Check `class-registry-generated.ts` for errors
4. Reload VSCode window

**Modifier doesn't appear in autocomplete:**
1. Ensure `@modifier` tag matches `&.mod-*` selector exactly
2. Verify modifier is nested inside parent layout block
3. Rebuild VSCode extension

**CSS not applying:**
1. Check browser DevTools → inspect slide element
2. Verify class names match: `layout-feature`, not `feature-layout`
3. Check CSS file is loaded (look in `config.json` → `styles`)

## Further reading

- [Style Your Deck](07-style-your-deck.md) — CSS layer system
- [CSS Documentation Format](../packages/vscode/src/completion/css-doc-format.md) — Complete tag reference
- [CSS Layout System](../vibe/features/css-layouts-theme.md) — Architecture overview

---

← Previous: [Use the VSCode Extension](18-use-the-vscode-extension.md) | Back to [index →](README.md)
