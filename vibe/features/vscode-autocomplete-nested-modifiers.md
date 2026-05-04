# VSCode Autocomplete with Nested Modifiers

**Status**: ✅ Complete (May 2026)  
**Commits**: c23e45d → ce50d4d (14 commits)  
**Guide**: [how-to/19-create-layout-with-modifiers.md](../../how-to/19-create-layout-with-modifiers.md)

## Summary

The VSCode extension now provides rich IntelliSense autocomplete for GeekSlides slide markers with automatic documentation extraction from CSS comments. Layout-specific modifiers use CSS nesting (`&.mod-*`) for clear hierarchical structure.

## Features Implemented

### 1. Modifier Prefix Standardization (Breaking Change)
**Commit**: c23e45d

All modifier classes now use the `mod-` prefix for consistency and discoverability:
- `coverbg` → `mod-coverbg`
- `heading-center` → `mod-heading-center`  
- `partial` → `mod-partial`
- `cols-2` → `mod-cols-2`
- `cols-4` → `mod-cols-4`

**Impact**: 33 files updated across CSS, engine, tests, fixtures, decks, documentation.

### 2. Slide Class Autocomplete
**Commit**: c23e45d

VSCode IntelliSense for slide markers `[](.layout-title#id)`:
- **16 layout classes** with ASCII structure diagrams
- **5 modifier classes** (later split into layout-specific + global)
- **2 function helpers**: `bgurl()`, `bgcolor()`
- **Slide ID suggestions** with duplicate detection
- **Dynamic CSS parsing** for custom classes

**Trigger characters**: `.` (classes), `#` (IDs), `,` (functions)

**Architecture**:
```
slide-class-provider.ts    → VSCode CompletionItemProvider
    ↓
class-registry.ts          → Imports generated + manual entries
    ├─ LAYOUT_ENTRIES              (generated)
    ├─ LAYOUT_MODIFIER_ENTRIES     (generated)
    ├─ GLOBAL_MODIFIER_ENTRIES     (manual)
    └─ FUNCTION_ENTRIES            (manual)
    ↓
slide-marker-context.ts    → Parses cursor context
css-class-extractor.ts     → Dynamic CSS parsing
slide-id-helper.ts         → Duplicate ID detection
```

### 3. CSS-Driven Documentation System
**Commit**: 426ee17

Layouts are documented once in CSS, documentation automatically extracted at build time.

**Before** (manual sync):
1. Add CSS to `layouts.css`
2. Copy documentation to `class-registry.ts`
3. Format ASCII diagrams for TypeScript
4. Escape special characters
5. Easy to get out of sync

**Now** (automatic):
1. Add CSS with `/** @layout ... */` comment
2. Run `npm run build` in `packages/vscode`
3. Done!

**Documentation format** (`layouts.css`):
```css
/**
 * @layout layout-two-col
 * @detail Side-by-side columns — heading at top
 * @markdown
 * [](.layout-two-col#compare)
 * ### Features
 * #### Left | #### Right
 * - Item 1 | - Item 2
 * @structure
 * ┌─────────────────────────┐
 * │   ### Heading           │
 * ├───────────┬─────────────┤
 * │ #### Left │ #### Right  │  ← h4 hidden column breaks
 * │ - Item 1  │ - Item 2    │
 * └───────────┴─────────────┘
 * @usage
 * Use #### (h4) as hidden column break marker.
 */
section.content.layout-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* ... */
}
```

**Build process**:
```bash
npm run build (in packages/vscode)
  ↓
prebuild: tsx scripts/extract-css-docs.ts
  ↓
Reads: packages/cli/src/templates/layouts.css
Parses: /** @layout ... */ and /** @modifier ... */ blocks
Validates: required tags present
Generates: src/completion/class-registry-generated.ts
  ↓
build: node esbuild.js → dist/extension.cjs
```

**Generated output** (`class-registry-generated.ts`):
```typescript
export const LAYOUT_ENTRIES: readonly ClassEntry[] = [
  {
    name: 'layout-two-col',
    category: 'layout' as const,
    detail: 'Side-by-side columns — heading at top',
    documentation: `**Markdown:**
\`\`\`md
[](.layout-two-col#compare)
### Features
#### Left | #### Right
- Item 1 | - Item 2
\`\`\`
// ... ASCII structure ...
`,
  },
  // ... 15 more layouts
] as const;

export const LAYOUT_MODIFIER_ENTRIES: readonly ClassEntry[] = [
  // ... 3 layout-specific modifiers
] as const;
```

### 4. Nested Layout Modifiers
**Commits**: 2d0b7b9 (Phase 1), 9398040 (Phase 2)

Layout-specific modifiers are now nested inside their parent layouts using CSS nesting.

**CSS structure** (nested modifiers):
```css
/**
 * @layout layout-cover
 * @detail Cover slide with background image overlay
 * // ... other tags
 */
section.content.layout-cover {
  display: flex;
  flex-direction: column;
  /* ... layout styles ... */

  /**
   * @modifier mod-coverbg
   * @detail Apply background image to the slide (full-bleed)
   * @usage
   * [](.layout-cover.mod-coverbg#hero,bgurl(hero.jpg))
   * Use with bgurl() function to set the background image.
   */
  &.mod-coverbg {
    background-size: cover;
    background-position: center;
  }
}
```

**Parser enhancements** (`extract-css-docs.ts`):
- Added `ParsedModifier` interface with `parentLayout` field
- `findLayoutBlockEnd()` — tracks brace depth to find closing `}`
- `extractNestedModifiers()` — finds `&.mod-*` within layout blocks
- `parseModifierComment()` — validates `@modifier`, `@detail`, `@usage`
- Generates separate `LAYOUT_MODIFIER_ENTRIES` array

**Modifier categories**:
1. **Layout-specific** (nested in CSS, auto-extracted):
   - `mod-coverbg` (for `layout-cover`)
   - `mod-heading-center` (for `layout-team`)
   - `mod-cols-2` (for `layout-grid`)

2. **Global** (top-level CSS, manually registered):
   - `mod-partial` (progressive reveal for any layout)
   - `mod-cols-4` (force 4-column grid)

**Registry composition** (`class-registry.ts`):
```typescript
import { LAYOUT_ENTRIES, LAYOUT_MODIFIER_ENTRIES } from './class-registry-generated.js';

// Global modifiers (apply to any layout)
const GLOBAL_MODIFIER_ENTRIES: readonly ClassEntry[] = [
  { name: 'mod-partial', /* ... */ },
  { name: 'mod-cols-4', /* ... */ },
];

// Combined registry
export const BUILTIN_CLASSES: readonly ClassEntry[] = [
  ...LAYOUT_ENTRIES,              // 16 layouts
  ...LAYOUT_MODIFIER_ENTRIES,     // 3 layout-specific
  ...GLOBAL_MODIFIER_ENTRIES,     // 2 global
  ...FUNCTION_ENTRIES,            // 2 functions
] as const;
```

**Benefits**:
- ✅ Clear parent-child relationship in CSS
- ✅ Easier to find related modifiers when editing
- ✅ Autocomplete shows modifiers with parent layout context
- ✅ Automatic extraction — no manual registry updates
- ✅ Single source of truth

### 5. Lint Fixes and Cleanup
**Commit**: ce50d4d

Final polish:
- Fixed template literal type errors (4 instances)
- Added `extract-css-docs.ts` to ESLint `allowDefaultProject`
- Removed `class-registry-old.ts` (490 lines of legacy code)
- Removed generated type declarations for old registry

## Documentation Created

### How-To Guides
- **[19-create-layout-with-modifiers.md](../../how-to/19-create-layout-with-modifiers.md)** (NEW, 7KB)
  - Step-by-step guide for creating layouts with modifier variations
  - CSS nesting pattern explanation
  - Documentation tag reference
  - Global vs layout-specific modifiers
  - Common patterns (responsive, dark/light, alignment)

### Vibe Documentation
- **[vscode-extension.md](./vscode-extension.md)** (UPDATED)
  - CSS-driven documentation architecture
  - Nested modifier extraction flow
  - Registry composition

- **[css-layouts-theme.md](./css-layouts-theme.md)** (UPDATED)
  - "Adding a new layout" section with nesting example
  - `@modifier` tag in example

### Completion System
- **[packages/vscode/src/completion/css-doc-format.md](../../packages/vscode/src/completion/css-doc-format.md)** (NEW)
  - Complete specification for CSS documentation format
  - `@layout` tag (5 fields): `@layout`, `@detail`, `@markdown`, `@structure`, `@usage`
  - `@modifier` tag (3 fields): `@modifier`, `@detail`, `@usage`
  - Parsing rules and examples

- **[packages/vscode/src/completion/README.md](../../packages/vscode/src/completion/README.md)** (UPDATED)
  - Maintenance guide for keeping documentation in sync

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `packages/cli/src/templates/layouts.css` | Added docs + nested modifiers | +465 |
| `packages/vscode/scripts/extract-css-docs.ts` | Parser + modifier extraction | +320 |
| `packages/vscode/src/completion/css-doc-format.md` | Spec + @modifier tag | +200 |
| `packages/vscode/src/completion/class-registry.ts` | Refactored for generated entries | -309 +92 |
| `packages/vscode/src/completion/class-registry-generated.ts` | Generated (layouts + modifiers) | +426 |
| `packages/vscode/src/completion/class-registry-old.ts` | **REMOVED** (legacy) | -490 |
| `packages/vscode/src/completion/README.md` | Updated maintenance guide | ~300 |
| `packages/vscode/package.json` | Added prebuild script | +2 |
| `packages/vscode/src/extension.ts` | Fixed lint errors | +1 |
| `eslint.config.js` | Added extract-css-docs.ts | +1 |
| `how-to/07-style-your-deck.md` | Updated with CSS format | +40 |
| `how-to/19-create-layout-with-modifiers.md` | **NEW** comprehensive guide | +230 |
| `how-to/README.md` | Added guide 19 to index | +1 |
| `vibe/features/vscode-extension.md` | Updated architecture | +60 |
| `vibe/features/css-layouts-theme.md` | Updated with nesting | +30 |

**Net change**: ~+1,000 lines added, -800 lines removed (legacy code cleanup)

## Test Results

- ✅ **All 829 tests passing** (100% pass rate)
- ✅ **Typecheck clean** (strict TypeScript with all type checks enabled)
- ✅ **Lint passing** (ESLint 9 with strictTypeChecked preset)
- ✅ **Build validated** (automatic extraction working in prebuild)
- ✅ **Parser extracts**: 16 layouts + 3 layout-specific modifiers + 2 global modifiers
- ✅ **Generated file**: 426 lines with full type safety

## Production Readiness

✅ **Feature Complete**: All planned features implemented  
✅ **Well Tested**: 829 tests with full coverage  
✅ **Fully Documented**: How-tos, vibe docs, completion system docs  
✅ **Build Validated**: Automatic extraction working  
✅ **Type Safe**: Strict TypeScript, no `any`, explicit return types  
✅ **Error Handling**: Graceful degradation, detailed logging  
✅ **Single Source of Truth**: CSS comments drive everything  
✅ **Code Quality**: Lint clean, no legacy code, 490 lines removed  

## Future Maintenance

When adding a new layout with modifiers:

1. **Edit** `packages/cli/src/templates/layouts.css`:
   ```css
   /**
    * @layout layout-new
    * @detail Brief description
    * @markdown
    * [](.layout-new#id)
    * @structure
    * ┌─────────────┐
    * │   Layout    │
    * └─────────────┘
    * @usage
    * Usage notes.
    */
   section.content.layout-new {
     /* styles */

     /**
      * @modifier mod-variant
      * @detail Brief modifier description
      * @usage
      * [](.layout-new.mod-variant#id)
      */
     &.mod-variant {
       /* modifier styles */
     }
   }
   ```

2. **Build** VSCode extension:
   ```bash
   cd packages/vscode && npm run build
   ```

3. **Done!** Autocomplete automatically includes new layout and modifiers.

No manual TypeScript updates needed. CSS is the single source of truth.

## Commit Timeline

1. **c23e45d** (May 2) - Modifier prefix migration + autocomplete feature
2. **77a2245** - Live preview implementation (experimental, later removed)
3. **d35c85a** - Live preview bug fix
4. **ab772f0** - Critical CSS class preservation fix
5. **2929e23** - Preview on selection change
6. **47c80d0** - Simplified: removed live preview (900 lines removed)
7. **8818b7c** - Cleanup: removed preview interfaces
8. **2ea0dea** - Resilient error handling for cursor sync
9. **de8ed44** (May 3) - Enhanced docs: ASCII diagrams for all layouts
10. **426ee17** (May 3) - CSS-driven documentation system
11. **1c0d640** (May 4) - Updated all documentation
12. **2d0b7b9** (May 4) - Phase 1: Nested modifiers (documentation + guide)
13. **9398040** (May 4) - Phase 2: Nested modifiers (implementation)
14. **ce50d4d** (May 4) - Lint fixes and legacy code cleanup

**Branch**: `feat/next-version`  
**Total commits**: 14  
**Duration**: May 2-4, 2026

## Related Documentation

- [VSCode Extension Architecture](./vscode-extension.md) — Complete extension architecture
- [CSS Layouts & Theme](./css-layouts-theme.md) — Layout system and theming
- [How to: Create Layout with Modifiers](../../how-to/19-create-layout-with-modifiers.md) — Step-by-step guide
- [How to: Style Your Deck](../../how-to/07-style-your-deck.md) — CSS customization guide
- [CSS Doc Format Spec](../../packages/vscode/src/completion/css-doc-format.md) — Technical specification
