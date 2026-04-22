/**
 * HTML output capture tests.
 *
 * These tests call parse() with representative markdown patterns and log
 * the real HTML produced by the engine. Run with:
 *   npx vitest run packages/engine/tests/unit/html-output-capture.test.ts --reporter=verbose
 *
 * The output is used to generate docs/html-reference/slides.md.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/core/SlideParser.ts';

/** Pretty-print HTML with consistent indentation for readability */
function pretty(html: string): string {
  // Simple indent based on open/close tags – good enough for inspection
  let depth = 0;
  return html
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
      const indented = '  '.repeat(depth) + trimmed;
      if (/^<[^/!][^>]*[^/]>$/.test(trimmed) && !/<\//.test(trimmed)) depth++;
      return indented;
    })
    .filter(Boolean)
    .join('\n');
}

const CASES: { name: string; markdown: string }[] = [
  // ── Headings ─────────────────────────────────────────────────────────────
  {
    name: 'H1 only',
    markdown: `# Title Only`,
  },
  {
    name: 'H2 only',
    markdown: `[](.slide#h2-only)

## Subtitle Only`,
  },
  {
    name: 'H3 only',
    markdown: `[](.slide#h3-only)

### Section Heading Only`,
  },
  {
    name: 'H1 + H2',
    markdown: `# Main Title

## Subtitle`,
  },
  {
    name: 'H1 + H2 + H3',
    markdown: `# Main Title

## Subtitle

### Section`,
  },

  // ── Paragraphs ───────────────────────────────────────────────────────────
  {
    name: 'H1 + paragraph',
    markdown: `# Title

This is a paragraph with **bold**, *italic*, and \`inline code\`.`,
  },
  {
    name: 'H1 + multiple paragraphs',
    markdown: `# Title

First paragraph with some text.

Second paragraph with more text.

Third paragraph with even more.`,
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  {
    name: 'H1 + unordered list',
    markdown: `# Title

- First item
- Second item
- Third item`,
  },
  {
    name: 'H1 + ordered list',
    markdown: `# Title

1. First item
2. Second item
3. Third item`,
  },
  {
    name: 'H1 + nested list',
    markdown: `# Title

- Parent item
  - Child item A
  - Child item B
- Another parent
  - Child item C`,
  },
  {
    name: 'H3 + unordered list',
    markdown: `[](.slide#h3-list)

### Section Heading

- First item
- Second item
- Third item`,
  },

  // ── Images ────────────────────────────────────────────────────────────────
  {
    name: 'H1 + block image',
    markdown: `# Title

![Alt text](image.jpg)`,
  },
  {
    name: 'H1 + block image + list',
    markdown: `# Title

![Alt text](image.jpg)

- First item
- Second item`,
  },
  {
    name: 'H3 + image + list',
    markdown: `[](.slide)

### Section Heading

![Alt text](photo.png)

- First item
- Second item
- Third item`,
  },

  // ── Tables ────────────────────────────────────────────────────────────────
  {
    name: 'H1 + table',
    markdown: `# Title

| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`,
  },
  {
    name: 'H3 + table',
    markdown: `[](.slide)

### Section Heading

| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |`,
  },
  {
    name: 'H1 + image + table',
    markdown: `# Title

![Alt text](diagram.png)

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |`,
  },
  {
    name: 'H3 + image + table',
    markdown: `[](.slide)

### Section Heading

![Alt text](diagram.png)

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |`,
  },

  // ── Code ──────────────────────────────────────────────────────────────────
  {
    name: 'H1 + fenced code block',
    markdown: `# Title

\`\`\`javascript
const greeting = 'Hello, world!';
console.log(greeting);
\`\`\``,
  },
  {
    name: 'H1 + list + code block',
    markdown: `# Title

- Step one
- Step two

\`\`\`bash
npm install
npm run dev
\`\`\``,
  },

  // ── Blockquote ────────────────────────────────────────────────────────────
  {
    name: 'H1 + blockquote',
    markdown: `# Title

> This is a blockquote with some inspiring text.
> It can span multiple lines.`,
  },

  // ── Partials ──────────────────────────────────────────────────────────────
  {
    name: 'H1 + list with partials',
    markdown: `# Title

- First item [partial]
- Second item [partial]
- Third item [partial]`,
  },
  {
    name: 'H1 + list (class partial – auto-reveal)',
    markdown: `[](.partial#auto-partial)

# Title

- First item
- Second item
- Third item`,
  },

  // ── Notes & Details ───────────────────────────────────────────────────────
  {
    name: 'H1 + speaker notes',
    markdown: `# Title

Slide content here.

::: Notes
These are **speaker notes** that only appear in speaker view.
They can contain any markdown.
:::`,
  },
  {
    name: 'H1 + details block',
    markdown: `# Title

Slide content here.

::: Details
These are **details** that appear in book/export mode.
:::`,
  },
  {
    name: 'H1 + notes + details',
    markdown: `# Title

Slide content here.

::: Notes
Speaker notes text.
:::

::: Details
Book-mode details text.
:::`,
  },

  // ── Slide attributes ──────────────────────────────────────────────────────
  {
    name: 'Slide with custom classes and id',
    markdown: `[](.hero.dark#my-slide)

# Title`,
  },
  {
    name: 'Slide with background image',
    markdown: `[](.coverbg#bg-slide,bgurl(hero.jpg))

# Title on Background`,
  },
  {
    name: 'Slide with background color',
    markdown: `[](.#color-slide,bgcolor(#1e1e2e))

# Dark Slide`,
  },

  // ── Inline HTML ───────────────────────────────────────────────────────────
  {
    name: 'H1 + inline HTML',
    markdown: `# Title

<div class="custom">Custom HTML block</div>`,
  },

  // ── Per-slide style ───────────────────────────────────────────────────────
  {
    name: 'H1 + per-slide style block',
    markdown: `# Styled Slide

<style>
h1 { color: hotpink; }
</style>

Content below styled heading.`,
  },

  // ── H4 subsections ───────────────────────────────────────────────────────
  {
    name: 'H1 + H4 subsection',
    markdown: `# Main Title

#### Subsection`,
  },
  {
    name: 'H1 + multiple H4 subsections with content',
    markdown: `# Main Title

#### First Subsection

Some paragraph text.

#### Second Subsection

More paragraph text.`,
  },
  {
    name: 'H3 + H4 subsection + list',
    markdown: `[](.slide)

### Section Heading

#### Sub Topic

- First item
- Second item`,
  },
  {
    name: 'H1 + H2 + H4 + list',
    markdown: `# Main Title

## Subtitle

#### Details

- First item
- Second item
- Third item`,
  },

  // ── Lists + paragraphs combinations ──────────────────────────────────────
  {
    name: 'H1 + paragraph + list',
    markdown: `# Title

Introductory paragraph before the list.

- First item
- Second item
- Third item`,
  },
  {
    name: 'H1 + list + paragraph',
    markdown: `# Title

- First item
- Second item
- Third item

Closing paragraph after the list.`,
  },
  {
    name: 'H1 + paragraph + list + paragraph',
    markdown: `# Title

Opening paragraph introduces the list.

- First item
- Second item
- Third item

Closing paragraph after the list.`,
  },
  {
    name: 'H3 + paragraph + list + paragraph',
    markdown: `[](.slide)

### Section Heading

Opening paragraph text here.

- First item
- Second item

Closing paragraph text here.`,
  },

  // ── Multiple lists ────────────────────────────────────────────────────────
  {
    name: 'H1 + two unordered lists',
    markdown: `# Title

- List one, item A
- List one, item B

- List two, item A
- List two, item B`,
  },
  {
    name: 'H1 + unordered list + ordered list',
    markdown: `# Title

- Bullet item A
- Bullet item B

1. Step one
2. Step two`,
  },
  {
    name: 'H3 + paragraph + two lists',
    markdown: `[](.slide)

### Section Heading

Intro paragraph.

- First list, item A
- First list, item B

- Second list, item A
- Second list, item B`,
  },
  {
    name: 'H1 + two ordered lists separated by paragraph',
    markdown: `# Title

1. First step
2. Second step

Intermediary note paragraph.

1. Next step A
2. Next step B`,
  },

  // ── Bold/italic first words in list items ─────────────────────────────────
  {
    name: 'H1 + list with bold first words',
    markdown: `# Title

- **Key term one**: explanation of the first term.
- **Key term two**: explanation of the second term.
- **Key term three**: explanation of the third term.`,
  },
  {
    name: 'H1 + list with italic first words',
    markdown: `# Title

- *First concept*: explanation of first concept.
- *Second concept*: explanation of second concept.
- *Third concept*: explanation of third concept.`,
  },
  {
    name: 'H1 + list mixing bold, italic, and plain items',
    markdown: `# Title

- **Bold item**: has a bold prefix.
- *Italic item*: has an italic prefix.
- Plain item with no emphasis.
- \`code item\`: starts with inline code.`,
  },
  {
    name: 'H1 + ordered list with bold first words',
    markdown: `# Title

1. **Install**: run \`npm install\`.
2. **Configure**: edit config.json.
3. **Run**: execute \`npm run dev\`.`,
  },
  {
    name: 'H3 + list with bold first words + notes',
    markdown: `[](.slide)

### Section Heading

- **First key**: description of first key.
- **Second key**: description of second key.
- **Third key**: description of third key.

::: Notes
Notes about key terms.
:::`,
  },

  // ── Mixed complex ─────────────────────────────────────────────────────────
  {
    name: 'H3 + paragraph + list + notes',
    markdown: `[](.slide)

### Section Heading

Introductory paragraph text.

- First item
- Second item

::: Notes
Presenter notes here.
:::`,
  },
  {
    name: 'H3 + image + list + notes',
    markdown: `[](.slide)

### Section Heading

![Diagram](diagram.png)

- First item
- Second item

::: Notes
Notes about this slide.
:::`,
  },
];

describe('HTML output capture', () => {
  for (const tc of CASES) {
    it(tc.name, () => {
      const slides = parse(tc.markdown);
      expect(slides.length).toBeGreaterThan(0);
      const slide = slides[slides.length - 1]!; // last slide is the one we care about

      // Log structured output for documentation generation
      console.log('\n' + '─'.repeat(60));
      console.log(`CASE: ${tc.name}`);
      console.log('─'.repeat(60));
      console.log('MARKDOWN:');
      console.log(tc.markdown);
      console.log('\nHTML:');
      console.log(pretty(slide.html));
      if (slide.notesHtml) {
        console.log('\nNOTES HTML:');
        console.log(pretty(slide.notesHtml));
      }
      if (slide.detailsHtml) {
        console.log('\nDETAILS HTML:');
        console.log(pretty(slide.detailsHtml));
      }
      if (slide.rawCss) {
        console.log('\nRAW CSS:');
        console.log(slide.rawCss);
      }
      console.log(`\npartialCount: ${String(slide.partialCount)}`);
      console.log(`classes: [${slide.classes.join(', ')}]`);
      console.log(`id: ${slide.id}`);
      console.log('─'.repeat(60));
    });
  }
});
