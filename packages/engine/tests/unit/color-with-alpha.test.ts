// @vitest-environment jsdom
/**
 * Unit tests for the colorWithAlpha helper used in Canvas2D gradients.
 *
 * This utility was introduced to fix Firefox DOMException when using
 * oklch() or string concatenation for gradient color stops.
 */
import { describe, it, expect } from 'vitest';
import { colorWithAlpha } from '../../src/components/AudioSlide.ts';

describe('colorWithAlpha', () => {
  describe('hex colors (6-digit)', () => {
    it('converts #5b8def with alpha 0.3 to rgba()', () => {
      expect(colorWithAlpha('#5b8def', 0.3)).toBe('rgba(91,141,239,0.3)');
    });

    it('converts #000000 with alpha 1 to rgba()', () => {
      expect(colorWithAlpha('#000000', 1)).toBe('rgba(0,0,0,1)');
    });

    it('converts #ffffff with alpha 0 to rgba()', () => {
      expect(colorWithAlpha('#ffffff', 0)).toBe('rgba(255,255,255,0)');
    });

    it('converts #ff0000 with alpha 0.5 to rgba()', () => {
      expect(colorWithAlpha('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    });
  });

  describe('hex colors (3-digit shorthand)', () => {
    it('converts #f00 with alpha 0.5 to rgba()', () => {
      expect(colorWithAlpha('#f00', 0.5)).toBe('rgba(255,0,0,0.5)');
    });

    it('converts #fff with alpha 0.8 to rgba()', () => {
      expect(colorWithAlpha('#fff', 0.8)).toBe('rgba(255,255,255,0.8)');
    });

    it('converts #000 with alpha 0.1 to rgba()', () => {
      expect(colorWithAlpha('#000', 0.1)).toBe('rgba(0,0,0,0.1)');
    });
  });

  describe('rgb() colors', () => {
    it('converts rgb(100, 200, 50) with alpha 0.6', () => {
      expect(colorWithAlpha('rgb(100, 200, 50)', 0.6)).toBe('rgba(100,200,50,0.6)');
    });

    it('converts rgb(0,0,0) with alpha 1', () => {
      expect(colorWithAlpha('rgb(0,0,0)', 1)).toBe('rgba(0,0,0,1)');
    });
  });

  describe('rgba() colors', () => {
    it('replaces existing alpha in rgba(100, 200, 50, 0.9)', () => {
      expect(colorWithAlpha('rgba(100, 200, 50, 0.9)', 0.2)).toBe('rgba(100,200,50,0.2)');
    });
  });

  describe('unsupported color formats (fallback)', () => {
    it('returns the color unchanged for oklch()', () => {
      const oklch = 'oklch(65% 0.25 255)';
      expect(colorWithAlpha(oklch, 0.5)).toBe(oklch);
    });

    it('returns the color unchanged for hsl()', () => {
      const hsl = 'hsl(200, 80%, 50%)';
      expect(colorWithAlpha(hsl, 0.5)).toBe(hsl);
    });

    it('returns the color unchanged for named colors', () => {
      expect(colorWithAlpha('red', 0.5)).toBe('red');
    });
  });
});
