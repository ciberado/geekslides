/**
 * GeekSlides v2 — CSS Doodle plugin unit tests.
 */

import { describe, it, expect } from 'vitest';
import { cssDoodlePreprocessor } from '../../../../plugins/css-doodle/css-doodle-preprocessor.ts';
import { patternRegistry } from '../../../../plugins/css-doodle/css-doodle-patterns/index.ts';

describe('css-doodle-preprocessor', () => {
  it('converts ![css-doodle](#pattern) to placeholder div', () => {
    const input = '![css-doodle](#triangles)';
    const output = cssDoodlePreprocessor(input, {} as never);
    
    expect(output).toContain('<div class="gs-doodle"');
    expect(output).toContain('data-doodle="triangles"');
  });

  it('preserves config parameters in data attribute', () => {
    const input = '![css-doodle](#squares,grid=12,opacity=0.5)';
    const output = cssDoodlePreprocessor(input, {} as never);
    
    expect(output).toContain('<div class="gs-doodle"');
    expect(output).toContain('data-doodle=');
    // Should be URL-encoded
    expect(output).toContain('squares');
  });

  it('handles multiple doodles in same markdown', () => {
    const input = `
# Title
![css-doodle](#triangles)

## Slide 2
![css-doodle](#dots,grid=20)
    `;
    const output = cssDoodlePreprocessor(input, {} as never);
    
    const matches = output.match(/class="gs-doodle"/g);
    expect(matches).toHaveLength(2);
  });

  it('does not modify regular images', () => {
    const input = '![Regular Image](photo.jpg)';
    const output = cssDoodlePreprocessor(input, {} as never);
    
    expect(output).toBe(input);
  });

  it('is case-insensitive for css-doodle marker', () => {
    const input = '![CSS-DOODLE](#pattern)';
    const output = cssDoodlePreprocessor(input, {} as never);
    
    expect(output).toContain('<div class="gs-doodle"');
  });
});

describe('pattern-registry', () => {
  it('has all geometric patterns registered', () => {
    expect(patternRegistry.has('triangles')).toBe(true);
    expect(patternRegistry.has('squares')).toBe(true);
    expect(patternRegistry.has('hexagons')).toBe(true);
    expect(patternRegistry.has('diamonds')).toBe(true);
    expect(patternRegistry.has('circles')).toBe(true);
  });

  it('has all organic patterns registered', () => {
    expect(patternRegistry.has('waves')).toBe(true);
    expect(patternRegistry.has('bubbles')).toBe(true);
    expect(patternRegistry.has('petals')).toBe(true);
    expect(patternRegistry.has('branches')).toBe(true);
  });

  it('has all abstract patterns registered', () => {
    expect(patternRegistry.has('dots')).toBe(true);
    expect(patternRegistry.has('lines')).toBe(true);
    expect(patternRegistry.has('crosshatch')).toBe(true);
    expect(patternRegistry.has('noise')).toBe(true);
    expect(patternRegistry.has('gradient-grid')).toBe(true);
  });

  it('has all tech patterns registered', () => {
    expect(patternRegistry.has('circuit')).toBe(true);
    expect(patternRegistry.has('matrix')).toBe(true);
    expect(patternRegistry.has('pixels')).toBe(true);
    expect(patternRegistry.has('binary')).toBe(true);
  });

  it('has all decorative patterns registered', () => {
    expect(patternRegistry.has('confetti')).toBe(true);
    expect(patternRegistry.has('stars')).toBe(true);
    expect(patternRegistry.has('mosaic')).toBe(true);
  });

  it('returns undefined for unknown pattern', () => {
    expect(patternRegistry.get('nonexistent')).toBeUndefined();
  });

  it('returns pattern object with correct structure', () => {
    const triangles = patternRegistry.get('triangles');
    
    expect(triangles).toBeDefined();
    expect(triangles?.name).toBe('triangles');
    expect(triangles?.category).toBe('geometric');
    expect(triangles?.defaultGrid).toBeDefined();
    expect(triangles?.description).toBeDefined();
    expect(typeof triangles?.generate).toBe('function');
  });

  it('pattern generate function returns CSS string', () => {
    const triangles = patternRegistry.get('triangles');
    const css = triangles?.generate({
      grid: '12',
      colors: ['#ff0000', '#00ff00'],
      animate: false,
      speed: 1,
    });
    
    expect(typeof css).toBe('string');
    expect(css).toContain('@grid');
  });

  it('lists patterns by category', () => {
    const geometric = patternRegistry.listByCategory('geometric');
    expect(geometric.length).toBeGreaterThan(0);
    expect(geometric.every(p => p.category === 'geometric')).toBe(true);
  });

  it('lists all patterns', () => {
    const all = patternRegistry.list();
    expect(all.length).toBeGreaterThanOrEqual(21); // We have 21 patterns
  });
});
