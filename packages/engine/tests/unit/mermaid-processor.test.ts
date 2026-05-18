// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mermaidProcessor } from '../../../../plugins/mermaid/mermaid-processor.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import type { ProcessorContext } from '../../src/plugins/types.ts';

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

// Mock the mermaid module
vi.mock('mermaid', () => {
  const renderMock = vi.fn<(id: string, definition: string) => Promise<{ svg: string }>>()
    .mockResolvedValue({ svg: '<svg class="mermaid">diagram</svg>' });
  return {
    default: {
      initialize: vi.fn(),
      render: renderMock,
    },
  };
});

function makeContext(el: HTMLElement): ProcessorContext {
  return { slideIndex: 0, slideCount: 1, config: DEFAULT_CONFIG, slideshow: el };
}

/**
 * Flush all pending microtasks (promise callbacks) by yielding multiple times.
 */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => { queueMicrotask(r); });
  }
}

describe('mermaid-processor', () => {
  beforeEach(async () => {
    // Re-set the mock return value (clearAllMocks would strip it)
    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockResolvedValue({ svg: '<svg class="mermaid">diagram</svg>' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores slides without mermaid code blocks', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>Just text</p>';

    mermaidProcessor(el, makeContext(el));

    // No mermaid blocks — nothing changes
    expect(el.querySelector('.gs-mermaid')).toBeNull();
    expect(el.querySelector('p')).not.toBeNull();
  });

  it('finds language-mermaid code blocks and triggers render', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">graph TD; A-->B</code></pre>';

    mermaidProcessor(el, makeContext(el));

    // Allow the async render promises to settle
    await vi.waitFor(() => {
      expect(el.querySelector('.gs-mermaid')).not.toBeNull();
    });

    const container = el.querySelector('.gs-mermaid');
    expect(container).not.toBeNull();
    expect(container?.innerHTML).toContain('<svg');
  });

  it('skips empty mermaid definitions', () => {
    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">   </code></pre>';

    mermaidProcessor(el, makeContext(el));

    // Empty definition — pre stays unchanged
    expect(el.querySelector('pre')).not.toBeNull();
    expect(el.querySelector('.gs-mermaid')).toBeNull();
  });

  it('handles multiple mermaid blocks in one slide', async () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <pre><code class="language-mermaid">graph TD; A-->B</code></pre>
      <pre><code class="language-mermaid">graph LR; C-->D</code></pre>
    `;

    mermaidProcessor(el, makeContext(el));

    // The processor kicks off async work — poll until both replacements land
    await vi.waitFor(() => {
      expect(el.querySelectorAll('.gs-mermaid')).toHaveLength(2);
    });
  });

  it('adds error class when mermaid render fails', async () => {
    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockRejectedValueOnce(new Error('Parse error'));

    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-mermaid">invalid syntax %%%</code></pre>';

    warnMock.mockClear();

    mermaidProcessor(el, makeContext(el));

    await vi.waitFor(() => {
      expect(el.querySelector('.gs-mermaid-error')).not.toBeNull();
    });

    const pre = el.querySelector('pre');
    expect(pre?.classList.contains('gs-mermaid-error')).toBe(true);
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'failed to render diagram',
    );
  });

  it('ignores code blocks without language-mermaid class', () => {
    const el = document.createElement('div');
    el.innerHTML = '<pre><code class="language-javascript">const x = 1;</code></pre>';

    mermaidProcessor(el, makeContext(el));

    expect(el.querySelector('.gs-mermaid')).toBeNull();
    expect(el.querySelector('pre')).not.toBeNull();
  });
});
