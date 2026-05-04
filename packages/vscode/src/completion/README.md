# VSCode Autocomplete Completion System

## Overview

The completion system provides IntelliSense for GeekSlides slide markers with rich documentation including ASCII diagrams.

**NEW**: Layout documentation is now **automatically generated** from structured comments in `layouts.css`. No manual sync needed!

## Architecture

```
slide-class-provider.ts         → CompletionItemProvider (VSCode API)
    ↓
class-registry.ts              → Imports generated layouts + manual modifiers/functions
    ├─ class-registry-generated.ts  → Auto-generated from CSS (16 layouts)
    ├─ MODIFIER_ENTRIES        → Manual (5 modifiers)
    └─ FUNCTION_ENTRIES        → Manual (2 functions)
    ↓
slide-marker-context.ts        → Parses cursor position to determine context (class/id/function)
    ↓
css-class-extractor.ts         → Dynamically extracts custom classes from deck CSS
    ↓
slide-id-helper.ts             → Scans document for duplicate IDs
```

## Build Process

```
npm run build (in packages/vscode)
  ↓
npm run prebuild (runs automatically)
  ↓
tsx scripts/extract-css-docs.ts
  ↓
Reads: packages/cli/src/templates/layouts.css
Parses: /** @layout ... */ comment blocks
Generates: src/completion/class-registry-generated.ts
  ↓
npm run build (esbuild)
  ↓
Bundles everything into dist/extension.cjs
```

## Trigger Characters

- `.` — Layout and modifier classes
- `#` — Slide IDs
- `,` — Functions (bgurl, bgcolor)

## Adding a New Layout Class

When you add a layout to `packages/cli/src/templates/layouts.css`, you **only need to add a structured comment** — the registry updates automatically on build.

### Step-by-Step Process

1. **Add CSS with structured comment to layouts.css**
   ```css
   /**
    * @layout layout-example
    * @detail Brief one-line description for quick preview
    * @markdown
    * [](.layout-example#id)
    * # Heading
    * Content here
    * @structure
    * ┌───────────┬───────────┐
    * │ Left      │ Right     │  ← Describe the layout
    * │ Column    │ Column    │     visually with ASCII
    * └───────────┴───────────┘
    * @usage
    * Usage notes: column breaks, special behaviors, compatible modifiers.
    */
   section.content.layout-example {
     display: grid;
     grid-template-columns: 1fr 1fr;
   }
   ```

2. **Build the VSCode extension**
   ```bash
   cd packages/vscode
   npm run build  # Runs prebuild automatically
   ```

3. **Verify the output**
   - Check `src/completion/class-registry-generated.ts` was updated
   - Layout count should increase by 1
   - Test autocomplete in VSCode shows new layout

4. **Update documentation**
   - Add to layout table in `how-to/07-style-your-deck.md`
   - Add to layout table in `vibe/features/css-layouts-theme.md`

That's it! The CSS comment is the **single source of truth**.
   - Use box drawing characters: `┌─┬─┐ │ ├─┼─┤ └─┴─┘`
   - Show visual structure, not implementation details
   - Keep diagrams compact (max 5-6 lines tall)
   - Add arrows and labels for clarity: `← h4 heading`, `↑ column break`
   - Example annotations:
     ```
     ┌─────────┬────┬─────────┐
     │ #### A  │ VS │ #### B  │  ← 1fr auto 1fr grid
     │ Content │    │ Content │
     └─────────┴────┴─────────┘
     ```

4. **Documentation Structure**
   - **Markdown:** Complete slide marker example with content
   - **Structure:** ASCII box drawing diagram
   - **Usage notes:** Key behaviors, column breaks, compatible modifiers

5. **Update documentation**
   - Add to layout table in `how-to/07-style-your-deck.md`
   - Add to layout table in `vibe/features/css-layouts-theme.md`

## Modifier Classes

Modifiers enhance layouts. Documentation can be simpler:

```typescript
{
  name: 'mod-example',
  category: 'modifier',
  detail: 'Brief description',
  documentation: '\`\`\`md\n[](.layout-title.mod-example#id)\n\`\`\`\nWhat the modifier does.',
}
```

## Function Helpers

Functions use `insertText` with `$1` placeholder for cursor positioning:

```typescript
{
  name: 'myfunc',
  category: 'function',
  detail: 'Function description',
  documentation: '\`\`\`md\n[](#id,myfunc(value))\n\`\`\`\nWhat it does.',
  insertText: 'myfunc($1)',
}
```

## Testing

After adding/modifying layouts or build system:

```bash
cd packages/vscode

# Generate from CSS
npm run prebuild

# Check generated file
cat src/completion/class-registry-generated.ts

# Build extension
npm run build

# Run tests
cd ../..
npm test
npm run typecheck
```

Tests validate:
- Trigger character behavior
- Context parsing (class vs ID vs function)
- Duplicate ID detection
- Dynamic CSS extraction

## Debugging

If autocomplete doesn't show a layout:

1. **Check CSS comment format**:
   ```bash
   grep -A 20 "@layout layout-name" packages/cli/src/templates/layouts.css
   ```

2. **Verify generated file**:
   ```bash
   grep "layout-name" packages/vscode/src/completion/class-registry-generated.ts
   ```

3. **Rebuild extension**:
   ```bash
   cd packages/vscode && npm run build
   ```

4. **Check VSCode Output panel**: "GeekSlides" channel shows any errors
npm test -w @geekslides/vscode
```

Tests validate:
- Trigger character behavior
- Context parsing (class vs ID vs function)
- Duplicate ID detection
- Dynamic CSS extraction

## Dynamic CSS Extraction

The system also reads deck CSS files to extract custom classes:

```css
/* Your deck's css/local.css */
section.content.layout-custom-hero { /* ... */ }
section.content.mod-dark-theme { /* ... */ }
```

These appear in autocomplete automatically (no registry entry needed).

## Box Drawing Character Reference

```
┌─┬─┐  ╔═╦═╗  ┏━┳━┓  ╓─╥─╖  ╒═╤═╕
│ │ │  ║ ║ ║  ┃ ┃ ┃  ║ ║ ║  │ │ │
├─┼─┤  ╠═╬═╣  ┣━╋━┫  ╟─╫─╢  ╞═╪═╡
│ │ │  ║ ║ ║  ┃ ┃ ┃  ║ ║ ║  │ │ │
└─┴─┘  ╚═╩═╝  ┗━┻━┛  ╙─╨─╜  ╘═╧═╛
```

Use single-line (`─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`) for cleaner diagrams.

## Maintenance Checklist

When adding a new layout:

- [ ] CSS added to `packages/cli/src/templates/layouts.css` with /** @layout ... */ comment
- [ ] Comment includes all required tags: @layout, @detail, @markdown, @structure
- [ ] ASCII diagram included and properly formatted
- [ ] VSCode extension rebuilt: `cd packages/vscode && npm run build`
- [ ] Generated file verified: check `class-registry-generated.ts`
- [ ] Tests pass: `npm test && npm run typecheck`
- [ ] Documentation updated: `how-to/07-style-your-deck.md`
- [ ] Architecture doc updated: `vibe/features/css-layouts-theme.md`
- [ ] Manual test: Open deck in VSCode, type `[](.layout-`, verify autocomplete shows new entry with diagram

## Common Mistakes

❌ **Forgetting required @tags**
```css
/**
 * @layout layout-new
 * @detail Two-column layout
 */
```
✅ **All required tags present**
```css
/**
 * @layout layout-new
 * @detail Two-column layout
 * @markdown
 * [](.layout-new#id)
 * @structure
 * ┌───┬───┐
 * │ A │ B │
 * └───┴───┘
 */
```

❌ **@layout name doesn't match selector**
```css
/**
 * @layout layout-new-thing
 */
section.content.layout-new {  /* ← Mismatch! */
```
✅ **Names match exactly**
```css
/**
 * @layout layout-new
 */
section.content.layout-new {  /* ← Correct */
```

❌ **ASCII diagram too complex**
```
╔════════════════════════════════════════╗
║  ┌────────┐  ┌────────┐  ┌────────┐  ║
║  │ Col One│  │ Col Two│  │ Col 3  │  ║
╚════════════════════════════════════════╝
```

✅ **Simple, clear diagram**
```
┌──────┬──────┬──────┐
│ Col1 │ Col2 │ Col3 │  ← Three equal columns
└──────┴──────┴──────┘
```

## Further Reading

- [VSCode Extension Architecture](../../../vibe/features/vscode-extension.md)
- [CSS Layout System](../../../vibe/features/css-layouts-theme.md)
- [How to Style Your Deck](../../../how-to/07-style-your-deck.md)
