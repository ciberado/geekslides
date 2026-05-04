# VSCode Autocomplete Completion System

## Overview

The completion system provides IntelliSense for GeekSlides slide markers with rich documentation including ASCII diagrams.

## Architecture

```
slide-class-provider.ts         → CompletionItemProvider (VSCode API)
    ↓
class-registry.ts              → Static registry with 16 layouts + 5 modifiers + 2 functions
    ↓
slide-marker-context.ts        → Parses cursor position to determine context (class/id/function)
    ↓
css-class-extractor.ts         → Dynamically extracts custom classes from deck CSS
    ↓
slide-id-helper.ts             → Scans document for duplicate IDs
```

## Trigger Characters

- `.` — Layout and modifier classes
- `#` — Slide IDs
- `,` — Functions (bgurl, bgcolor)

## Adding a New Layout Class

When you add a layout to `packages/cli/src/templates/layouts.css`, you **must** update the autocomplete registry.

### Step-by-Step Process

1. **Add CSS to layouts.css**
   ```css
   /* 19. Layout: Example — My new layout */
   section.content.layout-example {
     display: grid;
     grid-template-columns: 1fr 1fr;
   }
   ```

2. **Add entry to class-registry.ts**
   ```typescript
   {
     name: 'layout-example',
     category: 'layout',
     detail: 'Brief one-line description for quick preview',
     documentation: `**Markdown:**
\`\`\`md
[](.layout-example#id)
# Heading
Content here
\`\`\`

**Structure:**
\`\`\`
┌───────────┬───────────┐
│ Left      │ Right     │  ← Describe the layout
│ Column    │ Column    │     visually with ASCII
└───────────┴───────────┘
\`\`\`

Usage notes: column breaks, special behaviors, compatible modifiers.`,
   },
   ```

3. **ASCII Diagram Guidelines**
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

After adding/modifying entries:

```bash
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

- [ ] CSS added to `packages/cli/src/templates/layouts.css`
- [ ] Registry entry added to `class-registry.ts` with ASCII diagram
- [ ] Tests pass: `npm test -w @geekslides/vscode`
- [ ] Documentation updated: `how-to/07-style-your-deck.md`
- [ ] Architecture doc updated: `vibe/features/css-layouts-theme.md`
- [ ] VSCode extension rebuilt: `npm run build -w @geekslides/vscode`
- [ ] Manual test: Open deck in VSCode, type `[](.layout-`, verify autocomplete shows new entry with diagram

## Common Mistakes

❌ **Forgetting to add ASCII diagram**
```typescript
documentation: '\`\`\`md\n[](.layout-new#id)\n\`\`\`\nTwo-column layout.'
```

✅ **Complete documentation with diagram**
```typescript
documentation: `**Markdown:**
\`\`\`md
[](.layout-new#id)
\`\`\`

**Structure:**
\`\`\`
┌───────┬───────┐
│ Left  │ Right │
└───────┴───────┘
\`\`\`

Two-column layout with equal widths.`
```

❌ **ASCII diagram too complex**
```
╔════════════════════════════════════════════════════╗
║  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ ║
║  │ Column One   │  │ Column Two   │  │ Column 3 │ ║
║  │ with         │  │ with         │  │ with     │ ║
║  │ content      │  │ more         │  │ stuff    │ ║
║  └──────────────┘  └──────────────┘  └──────────┘ ║
╚════════════════════════════════════════════════════╝
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
