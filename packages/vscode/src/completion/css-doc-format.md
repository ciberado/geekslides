# CSS Documentation Format Specification

## Overview

Layout and modifier documentation is embedded in `layouts.css` as structured JSDoc-style comments. A build-time parser extracts these comments and generates TypeScript code for the autocomplete registry.

**Layouts** have top-level documentation blocks before `section.content.layout-*` rules.

**Modifiers** can be:
1. **Global modifiers**: Top-level rules (e.g., `mod-partial`)
2. **Layout-specific modifiers**: Nested inside layout rules using `&` (e.g., `&.mod-coverbg`)

## Layout Comment Block Format

```css
/**
 * @layout layout-name
 * @detail Brief one-line description
 * @markdown
 * [](.layout-name#id)
 * # Heading
 * Content example
 * @structure
 * ┌─────────┬─────────┐
 * │ Visual  │ Layout  │
 * │ Diagram │ Here    │
 * └─────────┴─────────┘
 * @usage
 * Additional notes about usage, column breaks, modifiers, etc.
 */
section.content.layout-name {
  /* CSS rules */
  
  /**
   * @modifier mod-variant
   * @detail Brief description of modifier behavior
   * @usage
   * Combine with parent layout: [](.layout-name.mod-variant#id)
   */
  &.mod-variant {
    /* Modifier CSS */
  }
}
```

## Tags

### For Layouts

#### @layout (required)
The CSS class name without the dot.

**Example:**
```css
 * @layout layout-two-col
```

#### @detail (required)
Single-line description shown in autocomplete preview.

**Example:**
```css
 * @detail Two-column grid layout
```

#### @markdown (required)
Multi-line markdown example. All lines following `@markdown` until the next tag are concatenated.

**Example:**
```css
 * @markdown
 * [](.layout-two-col#comparison)
 * ### Features
 * #### Column A
 * - Item 1
 * #### Column B
 * - Item 2
```

#### @structure (required)
ASCII box drawing diagram. All lines following `@structure` until the next tag are concatenated.

**Example:**
```css
 * @structure
 * ┌───────────┬───────────┐
 * │ ### Left  │ ### Right │
 * │ - Item 1  │ - Item 2  │
 * └───────────┴───────────┘
```

#### @usage (optional)
Additional usage notes, tips, compatible modifiers, special behaviors.

**Example:**
```css
 * @usage
 * Use #### Heading (h4) as a hidden column break marker.
 * Combine with .mod-cols-2 to force two columns.
```

### For Modifiers (Nested)

#### @modifier (required)
The modifier CSS class name without the dot.

**Example:**
```css
 * @modifier mod-coverbg
```

#### @detail (required)
Single-line description shown in autocomplete preview.

**Example:**
```css
 * @detail Full-bleed background image treatment
```

#### @usage (optional)
Usage notes specific to this modifier, including parent layout context.

**Example:**
```css
 * @usage
 * Combine with parent layout: [](.layout-cover.mod-coverbg#id,bgurl(img.jpg))
 * First image in content fills the slide background.
```

## Parsing Rules

1. **Comment extraction**: Find all `/** ... */` blocks immediately preceding `.layout-*` CSS rules
2. **Tag parsing**: Split by `@tag` markers, trim whitespace
3. **Line unwrapping**: Remove leading ` * ` from each line in multi-line tags
4. **Whitespace normalization**: Preserve newlines in @markdown and @structure, collapse elsewhere

## Generated Output

Parser generates TypeScript:

```typescript
// Auto-generated from layouts.css
// DO NOT EDIT MANUALLY

export const LAYOUT_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'layout-two-col',
    category: 'layout',
    detail: 'Two-column grid layout',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-two-col#comparison)
### Features
#### Column A
- Item 1
#### Column B
- Item 2
\`\`\`

**Structure:**
\`\`\`
┌───────────┬───────────┐
│ ### Left  │ ### Right │
│ - Item 1  │ - Item 2  │
└───────────┴───────────┘
\`\`\`

Use #### Heading (h4) as a hidden column break marker.
Combine with .mod-cols-2 to force two columns.`,
  },
  // ... more entries
];
```

## Example: Complete Layout Documentation

```css
/**
 * @layout layout-two-col
 * @detail Two-column grid layout
 * @markdown
 * [](.layout-two-col#comparison)
 * ### Features
 * - Item 1
 * - Item 2
 * #### (column break)
 * - Item 3
 * - Item 4
 * @structure
 * ┌───────────┬───────────┐
 * │ ### Left  │ ### Right │
 * │ - Item 1  │ - Item 3  │
 * │ - Item 2  │ - Item 4  │
 * └───────────┴───────────┘
 * @usage
 * Use #### Heading (h4) as a hidden column break marker.
 */
section.content.layout-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: var(--gs-gap);
}

section.content.layout-two-col > h4 {
  display: none;
}
```

## Minification Considerations

**Not a concern for VSCode extension:**
- Extension parses source CSS files, not minified builds
- Deck CSS files are never minified (served raw by Vite)
- Parser runs at extension build time, not in production
- Generated TypeScript is type-safe and fully self-contained

## Validation

Parser should validate:
- [ ] All required tags present (@layout, @detail, @markdown, @structure)
- [ ] @layout name matches CSS selector (`.layout-*`)
- [ ] @structure contains box drawing characters
- [ ] @markdown contains slide marker syntax `[](.`
- [ ] No duplicate layout names

## Error Handling

On validation failure:
- Print clear error with file, line number, layout name
- Exit build with non-zero code
- Show example of correct format

## Benefits

1. **Single source of truth**: CSS and docs in one file
2. **Compiler-enforced**: Build fails if docs are malformed
3. **Type-safe output**: Generated TypeScript with full types
4. **No manual sync**: Docs automatically updated on CSS changes
5. **Grep-friendly**: Developers can search CSS for layout info
