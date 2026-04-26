# Phase 1: Parser & Config

**Status**: Implemented
**Depends on**: Phase 0 (project foundation)
**Unlocks**: Phase 2 (rendering), Phase 3 (plugins), Phase 8 (print)

## Goal

Implement the markdown-to-slides data pipeline: typed configuration loading,
markdown parsing into structured `SlideData[]`, and per-slide CSS scoping.
This phase produces the data layer that every rendering path depends on —
browser components, print renderer, and the plugin pipeline all consume
`SlideData`.

At the end of this phase, a test can load `config.json` + `README.md`,
parse them, and assert on the resulting slide structure: HTML content, attributes,
speaker notes, style blocks, and partial counts.

## Deliverables

### 1. Config (`packages/engine/src/core/Config.ts`)

Typed configuration object mirroring `config.json`. Responsible for:

- **Type definition**: `GeekSlidesConfig` interface with all fields from
  [presentation-format](../../../archived/v1/vibe/v1/presentation-format.md): `title`, `content` (string or
  array of strings — multiple files are concatenated in order), `styles` (array of CSS URLs),
  `plugins` (preprocessors/processors lists), `aspectRatio` (default `"16/9"`), `sync`
  (object with `enabled`, `server`, `room`), `background`, `class`.

- **Defaults**: A `DEFAULT_CONFIG` constant with sensible defaults for every optional field.

- **`loadConfig(url: string): Promise<GeekSlidesConfig>`**: Fetches the JSON, validates
  required fields (`content` must exist), deep-merges with defaults, returns the typed config.
  Throws a descriptive error on fetch failure or missing required fields.

### 2. SlideParser (`packages/engine/src/core/SlideParser.ts`)

Converts raw markdown into an array of `SlideData` objects. This replaces v1's
`MarkdownToHTML` class.

- **`SlideData` type**: `id` (string, from anchor or auto-generated), `html` (rendered
  HTML string), `classes` (string array), `backgroundImage` (string | undefined),
  `backgroundColor` (string | undefined), `rawCss` (string | undefined, extracted
  `<style>` content), `notesHtml` (string | undefined, rendered speaker notes),
  `partialCount` (number).

- **`parse(markdown: string): SlideData[]`**: Pipeline:
  1. Run markdown-it to convert markdown → HTML.
  2. Split the HTML on empty `<a>` elements (the `[](.class#id,bgurl(...),bgcolor(...))`
     separator convention from v1).
  3. For each section, extract attributes from the empty link (classes, id, background
     URL, background color) using the same regex patterns as v1's `#parseSectionAttrs`.
  4. Extract `::: Notes` container blocks into `notesHtml` (re-render notes markdown
     through markdown-it). Remove notes from main `html`.
  5. Extract `<style>` blocks into `rawCss`, remove from main `html`.
  6. Count elements with the `[partial]` attribute for `partialCount`.
  7. Return the `SlideData[]` array.

- **markdown-it configuration**: CommonMark mode, HTML enabled (for `<style>`, iframes,
  video). The `markdown-it-container` plugin handles `::: Notes` blocks.

### 3. StyleScoper (`packages/engine/src/core/StyleScoper.ts`)

Rewrites CSS selectors to scope them to a specific slide.

- **`scope(css: string, slideId: string): string`**: Uses `CSSStyleSheet.replaceSync()`
  to parse the CSS. Iterates all `CSSStyleRule` entries and prefixes each selector
  with `geek-slide[data-id="<slideId>"]`. Preserves at-rules (`@keyframes`, `@media`)
  without prefixing. Returns the rewritten CSS string.

- Handles compound selectors (`.box > .title`), pseudo-elements (`::before`),
  and comma-separated selector lists correctly.

### 4. Unit Tests

**`packages/engine/tests/unit/SlideParser.test.ts`**:
- Splits markdown with empty-link separators into correct number of slides.
- Extracts class, id, background URL, background color from the separator syntax.
- Extracts `::: Notes` blocks into `notesHtml`, excludes them from `html`.
- Extracts `<style>` blocks into `rawCss`, excludes them from `html`.
- Counts `[partial]` elements correctly.
- Handles edge cases: slide with no attributes, slide with only notes, empty markdown.

**`packages/engine/tests/unit/StyleScoper.test.ts`**:
- Simple selectors (`h2`) are correctly prefixed.
- Compound selectors (`.box > .title`) are correctly prefixed.
- Already-scoped selectors are not double-prefixed.
- `@keyframes` and `@media` at-rules are preserved.
- Comma-separated selectors are each prefixed independently.

**`packages/engine/tests/unit/Config.test.ts`**:
- Default values are applied for missing optional fields.
- Required field `content` causes an error when absent.
- All provided fields override defaults.

## File List

```
packages/engine/src/core/
├── Config.ts
├── SlideParser.ts
└── StyleScoper.ts

packages/engine/tests/unit/
├── Config.test.ts
├── SlideParser.test.ts
└── StyleScoper.test.ts
```

## Acceptance Criteria

- [ ] `SlideParser.parse()` correctly splits the archived v1 `archived/v1/demo/content.md` into the
      expected number of slides with correct attributes.
- [ ] Speaker notes are extracted and excluded from slide HTML.
- [ ] `<style>` blocks are extracted into `rawCss` and excluded from slide HTML.
- [ ] `StyleScoper.scope()` prefixes selectors without breaking at-rules.
- [ ] `loadConfig()` returns typed config with defaults merged.
- [ ] All unit tests pass (`npm test -w @geekslides/engine`).
- [ ] No `any` types — full TypeScript strict compliance.

## Reference Docs

- [architecture-v2.md](../architecture-v2.md) — SlideParser in data flow diagram
- [components.md](../components.md) — StyleScoper usage in `<geek-slide>`
- [plugin-system.md](../plugin-system.md) — preprocessors run before SlideParser
- [presentation-format](../../../archived/v1/vibe/v1/presentation-format.md) — v1 separator syntax and config schema
