/**
 * GeekSlides v2 — Abstract css-doodle patterns.
 */

import type { DoodlePattern } from './types.ts';

export const dots: DoodlePattern = {
  name: 'dots',
  category: 'abstract',
  defaultGrid: '20',
  description: 'Dot matrix with size and color variation',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    border-radius: 50%;
    @size: @rand(2px, 12px);
    opacity: @rand(0.3, 1);
    ${animate ? `animation: dot-pulse @rand(${String(1.5 / speed)}s, ${String(4 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes dot-pulse {
      from { transform: scale(1); opacity: @rand(0.2, 0.9); }
      to { transform: scale(@rand(0.75, 1.45)); opacity: @rand(0.3, 1); }
    }
    ` : ''}
  `,
};

export const lines: DoodlePattern = {
  name: 'lines',
  category: 'abstract',
  defaultGrid: '30',
  description: 'Diagonal lines at random steep angles',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    @size: @rand(1px, 3px) 150%;
    opacity: @rand(0.2, 0.8);
    transform: rotate(@rand(-75deg, 75deg));
    ${animate ? `animation: line-shift @rand(${String(1.8 / speed)}s, ${String(4.5 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes line-shift {
      from { transform: rotate(@rand(-75deg, 75deg)) translateX(0); opacity: @rand(0.15, 0.65); }
      to { transform: rotate(@rand(-75deg, 75deg)) translateX(@rand(-10px, 10px)); opacity: @rand(0.25, 0.85); }
    }
    ` : ''}
  `,
};

export const crosshatch: DoodlePattern = {
  name: 'crosshatch',
  category: 'abstract',
  defaultGrid: '16',
  description: 'Cross-hatched texture',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: linear-gradient(
      @pick(45deg, -45deg, 90deg, 0deg),
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')}) 0%,
      transparent 50%
    );
    opacity: @rand(0.3, 0.6);
    ${animate ? `animation: hatch-tilt @rand(${String(2 / speed)}s, ${String(5 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes hatch-tilt {
      from { transform: rotate(0deg); opacity: @rand(0.25, 0.55); }
      to { transform: rotate(@rand(-10deg, 10deg)); opacity: @rand(0.35, 0.75); }
    }
    ` : ''}
  `,
};

export const noise: DoodlePattern = {
  name: 'noise',
  category: 'abstract',
  defaultGrid: '20',
  description: 'Perlin-noise-like visual texture',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    @size: @rand(1px, 3px);
    opacity: @rand(0.1, 0.5);
    border-radius: @rand(0%, 50%);
    ${animate ? `animation: noise-jitter @rand(${String(0.6 / speed)}s, ${String(1.8 / speed)}s) step-end infinite;` : ''}
    
    ${animate ? `
    @keyframes noise-jitter {
      0% { transform: translate(0, 0); }
      25% { transform: translate(@rand(-2px, 2px), @rand(-2px, 2px)); }
      50% { transform: translate(@rand(-2px, 2px), @rand(-2px, 2px)); }
      75% { transform: translate(@rand(-2px, 2px), @rand(-2px, 2px)); }
      100% { transform: translate(0, 0); }
    }
    ` : ''}
  `,
};

export const gradientGrid: DoodlePattern = {
  name: 'gradient-grid',
  category: 'abstract',
  defaultGrid: '8',
  description: 'Smooth gradient transitions across cells',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: linear-gradient(
      @calc((@row + @col) * 45)deg,
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')}),
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')})
    );
    opacity: @rand(0.5, 1);
    ${animate ? `animation: grad-flow @rand(${String(2 / speed)}s, ${String(6 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes grad-flow {
      from { filter: hue-rotate(0deg) saturate(1); }
      to { filter: hue-rotate(@rand(-35deg, 35deg)) saturate(@rand(0.8, 1.35)); }
    }
    ` : ''}
  `,
};

export const abstractPatterns: readonly DoodlePattern[] = [
  dots,
  lines,
  crosshatch,
  noise,
  gradientGrid,
];
