/**
 * GeekSlides v2 — Abstract css-doodle patterns.
 */

import type { DoodlePattern } from './types.ts';

export const dots: DoodlePattern = {
  name: 'dots',
  category: 'abstract',
  defaultGrid: '20',
  description: 'Dot matrix with size and color variation',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    border-radius: 50%;
    @size: @rand(2px, 12px);
    opacity: @rand(0.3, 1);
  `,
};

export const lines: DoodlePattern = {
  name: 'lines',
  category: 'abstract',
  defaultGrid: '30',
  description: 'Diagonal lines at random steep angles',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    @size: @rand(1px, 3px) 150%;
    opacity: @rand(0.2, 0.8);
    transform: rotate(@rand(-75deg, 75deg));
  `,
};

export const crosshatch: DoodlePattern = {
  name: 'crosshatch',
  category: 'abstract',
  defaultGrid: '16',
  description: 'Cross-hatched texture',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: linear-gradient(
      @pick(45deg, -45deg, 90deg, 0deg),
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')}) 0%,
      transparent 50%
    );
    opacity: @rand(0.3, 0.6);
  `,
};

export const noise: DoodlePattern = {
  name: 'noise',
  category: 'abstract',
  defaultGrid: '40',
  description: 'Perlin-noise-like visual texture',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    @size: @rand(1px, 3px);
    opacity: @rand(0.1, 0.5);
    border-radius: @rand(0%, 50%);
  `,
};

export const gradientGrid: DoodlePattern = {
  name: 'gradient-grid',
  category: 'abstract',
  defaultGrid: '8',
  description: 'Smooth gradient transitions across cells',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: linear-gradient(
      @calc((@row + @col) * 45)deg,
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')}),
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')})
    );
    opacity: @rand(0.5, 1);
  `,
};

export const abstractPatterns: readonly DoodlePattern[] = [
  dots,
  lines,
  crosshatch,
  noise,
  gradientGrid,
];
