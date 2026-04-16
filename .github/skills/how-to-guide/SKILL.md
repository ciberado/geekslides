---
name: how-to-guide
description: 'Create or update how-to guides in the how-to/ directory. Use when: writing a new how-to, adding a tutorial, documenting a feature as a step-by-step guide, updating the how-to index.'
argument-hint: 'Topic for the new how-to guide'
---

# How-To Guide

Create how-to guides that match the established conventions in `how-to/`.

## When to Use

- Adding a new how-to guide
- Updating an existing guide to match conventions
- Reviewing a guide for consistency

## Procedure

### 1. Determine the next number

List `how-to/` and pick the next sequential number (e.g. if `07-*.md` exists, use `08`).

### 2. Create the file

File path: `how-to/NN-slug.md` where `NN` is zero-padded and `slug` is lowercase-kebab-case.

### 3. Follow the format

Every guide must follow this structure:

```markdown
# Title (imperative or action-oriented)

One-paragraph intro: what this guide covers and why it matters.

## First Section

Step-by-step content with code blocks, tables, and images as needed.

## More Sections

...

---

Next: [Next Guide Title →](NN-next-guide.md)
```

#### Format rules

- **Title**: `# Title` on line 1 — action-oriented, no "How to" prefix (e.g. "Style Your Deck", "Export to PDF")
- **Intro paragraph**: One paragraph immediately after the title. States what the reader will learn and sets context.
- **Sections**: Use `##` headings. Keep them scannable.
- **Code blocks**: Use fenced blocks with language tags (`json`, `css`, `bash`, `markdown`).
- **Tables**: Use Markdown tables for reference data (keyboard shortcuts, config fields, comparisons).
- **Images**: Reference screenshots as `![Alt text](screenshots/name.png)`. Images live in `how-to/screenshots/`.
- **Tips**: Use `> **Tip:**` blockquotes for non-essential but helpful information.
- **Footer**: End with `---` then a `Next:` link to the following guide, or `← Previous | Back to index` for the last guide.
- **Length**: Aim for 100–250 lines. Split longer topics into separate guides.

### 4. Update the index

Add a row to the table in `how-to/README.md`:

```markdown
| [Guide Title](NN-slug.md) | One-sentence description of what the reader learns |
```

The row goes at the end of the table, before the blank line.

### 5. Fix navigation links

- Update the **previous guide's** footer `Next:` link to point to the new guide.
- Set the **new guide's** footer `Next:` link to point to the next guide or back to the index if it's the last one.

### 6. Commit

Stage both files and commit:

```
docs: add how-to guide for <topic>
```
