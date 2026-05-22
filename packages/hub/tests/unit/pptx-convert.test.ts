import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the internal pptx2html fork so real PPTX parsing never runs in unit tests.
vi.mock('../../src/server/services/pptx/process-pptx.ts', () => ({
  default: vi.fn(),
}));

// Predictable CSS output.
vi.mock('../../src/server/services/pptx/pptx-css.ts', () => ({
  pptxCss: '.block { position: absolute; }',
}));

// D3/jsdom chart renderer — return null (no chart) by default.
vi.mock('../../src/server/services/pptx/chart-renderer.ts', () => ({
  renderChart: vi.fn().mockReturnValue(null),
}));

// Bullet numbering — identity transform by default.
vi.mock('../../src/server/services/pptx/bullet-numbering.ts', () => ({
  resolveNumericBullets: vi.fn((html: string) => html),
}));

import type { Mock } from 'vitest';

const processPptxModule = await import('../../src/server/services/pptx/process-pptx.ts');
const mockProcessPptx = processPptxModule.default as Mock;
const { convertPptx } = await import('../../src/server/services/pptx-convert.ts');

// ─── test helper ─────────────────────────────────────────────────────────────

function setupMockPptx(
  slides: string[],
  opts: { globalCSS?: string; slideSize?: { width: number; height: number }; charts?: unknown[] } = {},
): void {
  mockProcessPptx.mockImplementation(
    (
      setOnMessage: (handler: (msg: unknown) => void) => void,
      postMessage: (msg: unknown) => void,
    ) => {
      setOnMessage((msg) => {
        const m = msg as { type: string };
        if (m.type !== 'processPPTX') return;
        postMessage({ type: 'slideSize', data: opts.slideSize ?? { width: 960, height: 540 } });
        for (const slide of slides) postMessage({ type: 'slide', data: slide });
        postMessage({ type: 'globalCSS', data: opts.globalCSS ?? '' });
        postMessage({ type: 'Done', data: { time: 0, charts: opts.charts ?? [] } });
      });
    },
  );
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('convertPptx', () => {
  beforeEach(() => { mockProcessPptx.mockReset(); });

  describe('output files', () => {
    it('produces config.json, slides.html, and pptx.css', async () => {
      setupMockPptx(['<section>S1</section>']);
      const { files } = await convertPptx(Buffer.from(''));
      expect(files.map((f) => f.path)).toEqual(['config.json', 'slides.html', 'pptx.css']);
    });

    it('config.json has title, content, styles, aspectRatio', async () => {
      setupMockPptx(['<section>S1</section>'], { slideSize: { width: 1280, height: 720 } });
      const { files } = await convertPptx(Buffer.from(''), 'My Deck');
      const cfg = JSON.parse(files[0]!.data.toString('utf8')) as Record<string, unknown>;
      expect(cfg['title']).toBe('My Deck');
      expect(cfg['content']).toBe('slides.html');
      expect(cfg['styles']).toEqual(['pptx.css']);
      expect(cfg['aspectRatio']).toBe('16/9');
    });

    it('derives 4:3 aspectRatio from slideSize 720×540', async () => {
      setupMockPptx(['<section>S1</section>'], { slideSize: { width: 720, height: 540 } });
      const cfg = JSON.parse(
        (await convertPptx(Buffer.from(''))).files[0]!.data.toString('utf8'),
      ) as Record<string, unknown>;
      expect(cfg['aspectRatio']).toBe('4/3');
    });

    it('slides.html contains each slide verbatim', async () => {
      setupMockPptx([
        '<section style="width:960px;">Slide 1</section>',
        '<section style="width:960px;">Slide 2</section>',
      ]);
      const html = (await convertPptx(Buffer.from(''))).files[1]!.data.toString('utf8');
      expect(html).toContain('Slide 1');
      expect(html).toContain('Slide 2');
      expect(html.match(/<section/g)).toHaveLength(2);
    });

    it('pptx.css contains both pptxCss and globalCSS', async () => {
      setupMockPptx(['<section>S1</section>'], { globalCSS: '.theme { color: red; }' });
      const css = (await convertPptx(Buffer.from(''))).files[2]!.data.toString('utf8');
      expect(css).toContain('.block { position: absolute; }');
      expect(css).toContain('.theme { color: red; }');
    });
  });

  describe('title extraction', () => {
    it('uses userTitle over slide content', async () => {
      setupMockPptx(['<section><span style="font-size:48pt">Big</span></section>']);
      const cfg = JSON.parse(
        (await convertPptx(Buffer.from(''), 'Override')).files[0]!.data.toString('utf8'),
      ) as Record<string, unknown>;
      expect(cfg['title']).toBe('Override');
    });

    it('extracts title from largest font-size text in slide 1', async () => {
      setupMockPptx([
        '<section><span style="font-size:12pt">Small</span><span style="font-size:36pt">Main</span></section>',
        '<section><span style="font-size:72pt">Ignored (slide 2)</span></section>',
      ]);
      expect((await convertPptx(Buffer.from(''))).extractedTitle).toBe('Main');
    });

    it('extractedTitle reflects slide content regardless of userTitle', async () => {
      setupMockPptx(['<section><span style="font-size:48pt">FromSlide</span></section>']);
      const { files, extractedTitle } = await convertPptx(Buffer.from(''), 'User Title');
      const cfg = JSON.parse(files[0]!.data.toString('utf8')) as Record<string, unknown>;
      expect(cfg['title']).toBe('User Title');
      expect(extractedTitle).toBe('FromSlide');
    });

    it('falls back to "Untitled" when slide has no text', async () => {
      setupMockPptx(['<section><img src="x.png"/></section>']);
      const { files, extractedTitle } = await convertPptx(Buffer.from(''));
      const cfg = JSON.parse(files[0]!.data.toString('utf8')) as Record<string, unknown>;
      expect(cfg['title']).toBe('Untitled');
      expect(extractedTitle).toBeNull();
    });

    it('returns null extractedTitle when there are no slides', async () => {
      setupMockPptx([]);
      expect((await convertPptx(Buffer.from(''))).extractedTitle).toBeNull();
    });
  });

  describe('error handling', () => {
    it('rejects when the converter emits ERROR', async () => {
      mockProcessPptx.mockImplementation(
        (_setOnMessage: unknown, postMessage: (msg: unknown) => void) => {
          postMessage({ type: 'ERROR', data: 'Corrupt file' });
        },
      );
      await expect(convertPptx(Buffer.from(''))).rejects.toThrow('Corrupt file');
    });
  });
});
