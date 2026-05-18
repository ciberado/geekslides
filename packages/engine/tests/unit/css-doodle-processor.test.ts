// @vitest-environment jsdom
/**
 * GeekSlides v2 — CSS Doodle processor unit tests.
 *
 * Tests the exported parseConfig() and buildColorVars() utilities, and
 * verifies that the processor sets the correct data attributes on
 * <css-doodle> elements for custom component discoverability.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseConfig, buildColorVars } from '../../../../plugins/css-doodle/css-doodle-processor.ts';
import type { ParsedDoodleConfig } from '../../../../plugins/css-doodle/css-doodle-patterns/types.ts';

// ────────────────────────────────────────────────────────────────────────────
// parseConfig
// ────────────────────────────────────────────────────────────────────────────

describe('parseConfig', () => {
  it('extracts pattern name from simple input', () => {
    const result = parseConfig('triangles');
    expect(result.patternName).toBe('triangles');
  });

  it('defaults pattern name to "triangles" when input is empty', () => {
    const result = parseConfig('');
    expect(result.patternName).toBe('');
  });

  it('parses grid key-value parameter', () => {
    const result = parseConfig('dots,grid=20');
    expect(result.patternName).toBe('dots');
    expect(result.grid).toBe('20');
  });

  it('parses grid with NxM format', () => {
    const result = parseConfig('waves,grid=20x10');
    expect(result.grid).toBe('20x10');
  });

  it('parses opacity parameter', () => {
    const result = parseConfig('triangles,opacity=0.35');
    expect(result.opacity).toBe('0.35');
  });

  it('parses speed parameter as number', () => {
    const result = parseConfig('squares,speed=2.5');
    expect(result.speed).toBe(2.5);
  });

  it('defaults speed to 1 for invalid value', () => {
    const result = parseConfig('squares,speed=abc');
    expect(result.speed).toBe(1);
  });

  it('parses size parameter', () => {
    const result = parseConfig('circles,size=400px');
    expect(result.size).toBe('400px');
  });

  it('parses shape parameter as number', () => {
    const result = parseConfig('triangles,shape=150');
    expect(result.shape).toBe(150);
  });

  it('parses seed parameter', () => {
    const result = parseConfig('confetti,seed=42');
    expect(result.seed).toBe('42');
  });

  it('parses colors as pipe-separated list', () => {
    const result = parseConfig('triangles,colors=#ff6b6b|#4ecdc4|#45b7d1');
    expect(result.colors).toEqual(['#ff6b6b', '#4ecdc4', '#45b7d1']);
  });

  it('trims whitespace around color values', () => {
    const result = parseConfig('triangles,colors= red | blue ');
    expect(result.colors).toEqual(['red', 'blue']);
  });

  it('parses boolean flag: bg', () => {
    const result = parseConfig('triangles,bg');
    expect(result.bg).toBe(true);
  });

  it('parses boolean flag: cover', () => {
    const result = parseConfig('mosaic,cover');
    expect(result.cover).toBe(true);
  });

  it('parses boolean flag: animate', () => {
    const result = parseConfig('squares,animate');
    expect(result.animate).toBe(true);
  });

  it('parses boolean flag: nohole', () => {
    const result = parseConfig('triangles,nohole');
    expect(result.nohole).toBe(true);
  });

  it('parses multiple parameters at once', () => {
    const result = parseConfig('confetti,animate,speed=1,grid=16,opacity=0.5,nohole,colors=red|blue');
    expect(result.patternName).toBe('confetti');
    expect(result.animate).toBe(true);
    expect(result.speed).toBe(1);
    expect(result.grid).toBe('16');
    expect(result.opacity).toBe('0.5');
    expect(result.nohole).toBe(true);
    expect(result.colors).toEqual(['red', 'blue']);
  });

  it('ignores unknown boolean flags', () => {
    const result = parseConfig('triangles,unknown');
    expect(result.patternName).toBe('triangles');
    // Should not have set any boolean flags
    expect(result.bg).toBeUndefined();
    expect(result.cover).toBeUndefined();
    expect(result.animate).toBeUndefined();
    expect(result.nohole).toBeUndefined();
  });

  it('ignores unknown key-value pairs', () => {
    const result = parseConfig('triangles,unknown=value');
    expect(result.patternName).toBe('triangles');
  });

  it('handles empty parts (trailing comma)', () => {
    const result = parseConfig('triangles,grid=8,');
    expect(result.patternName).toBe('triangles');
    expect(result.grid).toBe('8');
  });

  it('trims whitespace around parts', () => {
    const result = parseConfig('triangles , grid=8 , bg');
    expect(result.patternName).toBe('triangles');
    expect(result.grid).toBe('8');
    expect(result.bg).toBe(true);
  });

  it('leaves non-specified fields undefined', () => {
    const result = parseConfig('triangles');
    expect(result.grid).toBeUndefined();
    expect(result.size).toBeUndefined();
    expect(result.opacity).toBeUndefined();
    expect(result.colors).toBeUndefined();
    expect(result.seed).toBeUndefined();
    expect(result.bg).toBeUndefined();
    expect(result.cover).toBeUndefined();
    expect(result.animate).toBeUndefined();
    expect(result.speed).toBeUndefined();
    expect(result.nohole).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildColorVars
// ────────────────────────────────────────────────────────────────────────────

describe('buildColorVars', () => {
  it('generates theme-based CSS variables when no custom colors', () => {
    const css = buildColorVars(undefined, false);
    expect(css).toContain('--doodle-c1:');
    expect(css).toContain('--doodle-c2:');
    expect(css).toContain('--doodle-c3:');
    expect(css).toContain('--doodle-c4:');
    expect(css).toContain('--doodle-c5:');
    expect(css).toContain('var(--gs-color-accent');
    expect(css).toContain('var(--gs-color-surface');
  });

  it('generates nohole palette without surface color when nohole=true', () => {
    const css = buildColorVars(undefined, true);
    expect(css).toContain('--doodle-c1:');
    expect(css).toContain('var(--gs-color-accent');
    expect(css).toContain('black');
    // nohole should NOT reference surface color
    expect(css).not.toContain('var(--gs-color-surface');
  });

  it('uses custom colors when provided', () => {
    const css = buildColorVars(['#ff0000', '#00ff00', '#0000ff'], false);
    expect(css).toContain('--doodle-c1: #ff0000');
    expect(css).toContain('--doodle-c2: #00ff00');
    expect(css).toContain('--doodle-c3: #0000ff');
    // Should NOT reference theme vars
    expect(css).not.toContain('var(--gs-color-accent');
  });

  it('pads custom colors to 5 slots by repeating last color', () => {
    const css = buildColorVars(['#ff0000', '#00ff00'], false);
    expect(css).toContain('--doodle-c1: #ff0000');
    expect(css).toContain('--doodle-c2: #00ff00');
    // Slots 3, 4, 5 should all get the last color (#00ff00)
    expect(css).toContain('--doodle-c3: #00ff00');
    expect(css).toContain('--doodle-c4: #00ff00');
    expect(css).toContain('--doodle-c5: #00ff00');
  });

  it('uses single custom color for all 5 slots', () => {
    const css = buildColorVars(['pink'], false);
    expect(css).toContain('--doodle-c1: pink');
    expect(css).toContain('--doodle-c2: pink');
    expect(css).toContain('--doodle-c5: pink');
  });

  it('custom colors override nohole flag', () => {
    const css = buildColorVars(['red', 'blue'], true);
    // Custom colors should take priority even with nohole=true
    expect(css).toContain('--doodle-c1: red');
    expect(css).toContain('--doodle-c2: blue');
  });

  it('empty custom colors array falls through to theme colors', () => {
    const css = buildColorVars([], false);
    expect(css).toContain('var(--gs-color-accent');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// css-doodle processor — data attribute tests
// ────────────────────────────────────────────────────────────────────────────

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

vi.mock('css-doodle', () => ({}));

describe('css-doodle processor data attributes', () => {
  beforeEach(async () => {
    warnMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets data-pattern attribute on created css-doodle element', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = '<div class="gs-doodle" data-doodle="triangles"></div>';

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle).not.toBeNull();
      expect(doodle?.getAttribute('data-pattern')).toBe('triangles');
    });
  });

  it('sets data-grid attribute from pattern default', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = '<div class="gs-doodle" data-doodle="triangles"></div>';

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle).not.toBeNull();
      // triangles default grid is '18'
      expect(doodle?.getAttribute('data-grid')).toBe('18');
    });
  });

  it('sets data-grid from explicit config override', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('triangles,grid=24')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-grid')).toBe('24');
    });
  });

  it('sets data-animate when animate flag is present', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('squares,animate')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle).not.toBeNull();
      expect(doodle?.hasAttribute('data-animate')).toBe(true);
    });
  });

  it('does not set data-animate when animate flag is absent', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = '<div class="gs-doodle" data-doodle="triangles"></div>';

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle).not.toBeNull();
      expect(doodle?.hasAttribute('data-animate')).toBe(false);
    });
  });

  it('sets data-speed when speed is specified', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('squares,speed=2.5')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-speed')).toBe('2.5');
    });
  });

  it('sets data-opacity when opacity is specified', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('triangles,opacity=0.3')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-opacity')).toBe('0.3');
    });
  });

  it('sets data-size when size is specified', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('triangles,size=70%')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-size')).toBe('70%');
    });
  });

  it('sets data-shape when shape is specified', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('triangles,shape=150')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-shape')).toBe('150');
    });
  });

  it('sets data-nohole when nohole flag is present', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('triangles,nohole')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.hasAttribute('data-nohole')).toBe(true);
    });
  });

  it('sets data-colors when custom colors are specified', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('triangles,colors=#ff0000|#00ff00')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-colors')).toBe('#ff0000|#00ff00');
    });
  });

  it('sets data-seed and seed attribute when seed is specified', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent('confetti,seed=42')}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle?.getAttribute('data-seed')).toBe('42');
      expect(doodle?.getAttribute('seed')).toBe('42');
    });
  });

  it('injects CSS content as textContent', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = '<div class="gs-doodle" data-doodle="triangles"></div>';

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle).not.toBeNull();
      const text = doodle?.textContent ?? '';
      expect(text).toContain('--doodle-c1:');
      expect(text).toContain('@grid');
    });
  });

  it('skips slides without gs-doodle placeholders', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = '<p>No doodle here</p>';

    // Should not throw
    expect(() => cssDoodleProcessor(el)).not.toThrow();
    expect(el.querySelector('css-doodle')).toBeNull();
  });

  it('warns and skips unknown pattern names', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = '<div class="gs-doodle" data-doodle="nonexistent"></div>';

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      expect(warnMock).toHaveBeenCalledWith(
        expect.objectContaining({ patternName: 'nonexistent' }),
        'Pattern not found',
      );
    });

    // Placeholder should remain since pattern was not found
    expect(el.querySelector('.gs-doodle')).not.toBeNull();
    expect(el.querySelector('css-doodle')).toBeNull();
  });

  it('handles multiple doodle placeholders in one slide', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="gs-doodle" data-doodle="triangles"></div>
      <div class="gs-doodle" data-doodle="dots"></div>
    `;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodles = el.querySelectorAll('css-doodle');
      expect(doodles).toHaveLength(2);
      expect(doodles[0]?.getAttribute('data-pattern')).toBe('triangles');
      expect(doodles[1]?.getAttribute('data-pattern')).toBe('dots');
    });
  });

  it('sets all data attributes together on a fully configured doodle', async () => {
    const { cssDoodleProcessor } = await import('../../../../plugins/css-doodle/css-doodle-processor.ts');
    const el = document.createElement('div');
    const config = 'confetti,grid=16,shape=140,animate,speed=2,opacity=0.5,nohole,colors=red|blue,seed=7';
    el.innerHTML = `<div class="gs-doodle" data-doodle="${encodeURIComponent(config)}"></div>`;

    cssDoodleProcessor(el);

    await vi.waitFor(() => {
      const doodle = el.querySelector('css-doodle');
      expect(doodle).not.toBeNull();
      expect(doodle?.getAttribute('data-pattern')).toBe('confetti');
      expect(doodle?.getAttribute('data-grid')).toBe('16');
      expect(doodle?.getAttribute('data-shape')).toBe('140');
      expect(doodle?.hasAttribute('data-animate')).toBe(true);
      expect(doodle?.getAttribute('data-speed')).toBe('2');
      expect(doodle?.getAttribute('data-opacity')).toBe('0.5');
      expect(doodle?.hasAttribute('data-nohole')).toBe(true);
      expect(doodle?.getAttribute('data-colors')).toBe('red|blue');
      expect(doodle?.getAttribute('data-seed')).toBe('7');
      expect(doodle?.getAttribute('seed')).toBe('7');
    });
  });
});
