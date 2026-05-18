# core

Essential building blocks automatically included by any bundle that declares `dependsOn: ["core"]`.

## What it provides

| Part | Name | Role |
|------|------|------|
| Preprocessor | `header` | Converts `# Heading` lines into slide separators, generating `id`-anchors from the heading text |
| Processor | `iframe` | Lazy-loads `<iframe data-src="…">` elements: activates them when the slide becomes active and resets `src` on navigation away so embedded media stops |

## Usage

```json
{ "plugins": ["core"] }
```

`core` is pulled in automatically when you use a bundle that depends on it (e.g. `media`), so you rarely need to list it explicitly.

## Preprocessor: `header`

Inserts empty-link slide separators before every top-level heading:

```markdown
# Introduction        →  []()  +  # Introduction
## Subtopic           →  (left unchanged — only level-1 triggers a new slide)
```

The generated anchor ID is slugified from the heading text (`Introduction` → `#introduction`). Headings inside `::: Notes` or other container blocks are ignored.

## Processor: `iframe`

Raw `<iframe>` tags in markdown require a `data-src` attribute instead of `src` to prevent the browser from loading all iframes at page load. The processor swaps `data-src → src` when the slide becomes active and clears it again on navigation:

```html
<!-- In your slide markdown -->
<iframe data-src="https://example.com/demo.html" title="Demo"></iframe>
```

The `iframe-url` preprocessor (part of the `media` bundle) generates `data-src` iframes automatically from image-like markdown syntax.
