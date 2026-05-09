/**
 * GeekSlides v2 — Organic css-doodle patterns.
 */

import type { DoodlePattern } from './types.ts';

export const waves: DoodlePattern = {
  name: 'waves',
  category: 'organic',
  defaultGrid: '20x10',
  description: 'Sinusoidal wave pattern',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: linear-gradient(
      @rand(160deg, 200deg),
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')}),
      transparent @rand(50%, 80%)
    );
    opacity: @rand(0.3, 0.7);
    ${animate ? `animation: wave @rand(${String(3 / speed)}s, ${String(6 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes wave {
      from { transform: translateY(0); }
      to { transform: translateY(@rand(-15px, 15px)); }
    }
    ` : ''}
  `,
};

export const bubbles: DoodlePattern = {
  name: 'bubbles',
  category: 'organic',
  defaultGrid: '15',
  description: 'Floating circular shapes with opacity variance',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    border-radius: 50%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    @size: @rand(20px, 80px);
    opacity: @rand(0.2, 0.6);
    position: relative;
    left: @rand(-20%, 20%);
    top: @rand(-20%, 20%);
    ${animate ? `animation: float @rand(${String(4 / speed)}s, ${String(8 / speed)}s) ease-in-out infinite;` : ''}
    
    ${animate ? `
    @keyframes float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(@rand(-30px, -10px)) scale(@rand(0.8, 1.2)); }
    }
    ` : ''}
  `,
};

export const petals: DoodlePattern = {
  name: 'petals',
  category: 'organic',
  defaultGrid: '8',
  description: 'Flower-petal radial arrangement',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    border-radius: 50% 0 50% 0;
    opacity: @rand(0.4, 0.8);
    transform: rotate(@calc(@index * 360 / @size)deg);
    @size: @rand(40%, 60%);
    ${animate ? `animation: petal-sway @rand(${String(2 / speed)}s, ${String(5 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes petal-sway {
      from { transform: rotate(@calc(@index * 360 / @size)deg) scale(1); }
      to { transform: rotate(@calc(@index * 360 / @size + @rand(-25deg, 25deg))) scale(@rand(0.9, 1.12)); }
    }
    ` : ''}
  `,
};

export const branches: DoodlePattern = {
  name: 'branches',
  category: 'organic',
  defaultGrid: '16x12',
  description: 'Tree-like branching lines',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    @size: @rand(2px, 4px) @rand(20%, 60%);
    opacity: @rand(0.3, 0.7);
    transform: rotate(@rand(360deg));
    border-radius: 50%;
    ${animate ? `animation: branch-flicker @rand(${String(1.5 / speed)}s, ${String(4 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes branch-flicker {
      from { transform: rotate(@rand(360deg)); opacity: @rand(0.2, 0.65); }
      to { transform: rotate(@rand(360deg)); opacity: @rand(0.35, 0.9); }
    }
    ` : ''}
  `,
};

export const organicPatterns: readonly DoodlePattern[] = [
  waves,
  bubbles,
  petals,
  branches,
];
