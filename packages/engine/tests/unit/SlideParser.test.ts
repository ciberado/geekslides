import { describe, it, expect, vi } from 'vitest';
import { parse } from '../../src/core/SlideParser.ts';

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));
vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  }),
}));

describe('SlideParser', () => {
  it('splits markdown with empty-link separators into slides', () => {
    const md = `# First slide

[](.intro#first)

Content of second slide

[](.outro#last)

Content of third slide
`;
    const slides = parse(md);
    expect(slides.length).toBe(3);
  });

  it('extracts class, id, background from separator syntax', () => {
    const md = `[](.hero.dark#splash,bgurl(img.jpg),bgcolor(#333))

Slide content
`;
    const slides = parse(md);
    expect(slides.length).toBe(1);
    expect(slides[0]!.id).toBe('splash');
    expect(slides[0]!.classes).toContain('hero');
    expect(slides[0]!.classes).toContain('dark');
    expect(slides[0]!.backgroundImage).toBe('img.jpg');
    expect(slides[0]!.backgroundColor).toBe('#333');
  });

  it('extracts ::: Notes blocks into notesHtml', () => {
    const md = `# Slide

Some content

::: Notes
These are speaker notes with **bold**.
:::
`;
    const slides = parse(md);
    expect(slides.length).toBe(1);
    expect(slides[0]!.notesHtml).toBeDefined();
    expect(slides[0]!.notesHtml).toContain('speaker notes');
    // Notes should not appear in main html
    expect(slides[0]!.html).not.toContain('speaker notes');
  });

  it('merges multiple ::: Notes blocks into notesHtml', () => {
    const md = `# Slide

Intro

::: Notes
First note.
:::

Middle

::: Notes
Second note.
:::
`;
    const slides = parse(md);

    expect(slides[0]!.notesHtml).toContain('First note.');
    expect(slides[0]!.notesHtml).toContain('Second note.');
    expect(slides[0]!.html).not.toContain('First note.');
    expect(slides[0]!.html).not.toContain('Second note.');
  });

  it('extracts <style> blocks into rawCss', () => {
    const md = `# Styled Slide

<style>
h1 { color: red; }
</style>

Some content
`;
    const slides = parse(md);
    expect(slides.length).toBe(1);
    expect(slides[0]!.rawCss).toBeDefined();
    expect(slides[0]!.rawCss).toContain('color: red');
    // Style blocks should not appear in html
    expect(slides[0]!.html).not.toContain('<style>');
  });

  it('counts [partial] elements', () => {
    const md = `# Slide

- Item 1 [partial]
- Item 2 [partial]
- Item 3 [partial]
`;
    const slides = parse(md);
    expect(slides[0]!.partialCount).toBe(3);
  });

  it('removes [partial] marker text from rendered html', () => {
    const md = `# Slide

- Item 1 [partial]
- Item 2 [partial]
`;
    const slides = parse(md);

    expect(slides[0]!.partialCount).toBe(2);
    expect(slides[0]!.html).not.toContain('[partial]');
  });

  it('treats slide-level .partial as implicit list partials', () => {
    const md = `[](.partial)

# Slide

- Item 1
- Item 2
- Item 3
`;
    const slides = parse(md);

    expect(slides[0]!.partialCount).toBe(3);
    expect(slides[0]!.classes).toContain('partial');
  });

  it('does not double-count explicit [partial] markers on .partial slides', () => {
    const md = `[](.partial)

# Slide

- Item 1 [partial]
- Item 2
`;
    const slides = parse(md);

    expect(slides[0]!.partialCount).toBe(2);
    expect(slides[0]!.html).not.toContain('[partial]');
  });

  it('handles slide with no attributes', () => {
    const md = `# Simple slide

Just some content.
`;
    const slides = parse(md);
    expect(slides.length).toBe(1);
    expect(slides[0]!.id).toMatch(/^slide-\d+$/);
    expect(slides[0]!.classes).toEqual([]);
    expect(slides[0]!.backgroundImage).toBeUndefined();
    expect(slides[0]!.backgroundColor).toBeUndefined();
  });

  it('handles slide with only notes', () => {
    const md = `# Slide

::: Notes
Only notes here.
:::
`;
    const slides = parse(md);
    expect(slides.length).toBe(1);
    expect(slides[0]!.notesHtml).toContain('Only notes here.');
  });

  it('merges multiple ::: Details blocks into detailsHtml', () => {
    const md = `# Slide

Intro

::: Details
First detail.
:::

Middle

::: Details
Second detail.
:::
`;
    const slides = parse(md);

    expect(slides[0]!.detailsHtml).toContain('First detail.');
    expect(slides[0]!.detailsHtml).toContain('Second detail.');
  });

  it('handles empty markdown gracefully', () => {
    const slides = parse('');
    expect(slides.length).toBe(0);
  });

  it('auto-generates sequential IDs when not provided', () => {
    const md = `# First

Content

[](#id2)

Content 2
`;
    const slides = parse(md);
    expect(slides[0]!.id).toMatch(/^slide-\d+$/);
    expect(slides[1]!.id).toBe('id2');
  });

  it('warns about duplicate slide IDs', () => {
    warnMock.mockClear();
    const md = `[](#dup)

First slide

[](#dup)

Second slide
`;
    parse(md);
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dup' }),
      expect.stringContaining('duplicate slide ID'),
    );
  });

  it('tracks source line ranges when explicit separators are present', () => {
    const slides = parse([
      '[](#intro)',
      '',
      '# Intro',
      '',
      'Hello',
    ].join('\n'));

    expect(slides[0]?.sourceLineStart).toBe(1);
    expect(slides[0]?.sourceLineEnd).toBe(6);
  });
});
