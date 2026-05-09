/**
 * GeekSlides v2 — Geometric css-doodle patterns.
 */

import type { DoodlePattern } from './types.ts';

export const triangles: DoodlePattern = {
  name: 'triangles',
  category: 'geometric',
  defaultGrid: '18',
  description: 'Randomized triangular mosaic via clip-path',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    margin: -.5px;
    clip-path: polygon(@pick(
      '0 0, 100% 0, 100% 100%',
      '0 0, 100% 0, 0 100%',
      '0 0, 100% 100%, 0 100%',
      '100% 0, 100% 100%, 0 100%'
    ));
    ${animate ? `animation: tri-drift @rand(${String(2.5 / speed)}s, ${String(7 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes tri-drift {
      from { transform: rotate(0deg) scale(1); opacity: @rand(0.35, 0.95); }
      to { transform: rotate(@rand(-12deg, 12deg)) scale(@rand(0.9, 1.08)); opacity: @rand(0.2, 0.85); }
    }
    ` : ''}
  `,
};

export const squares: DoodlePattern = {
  name: 'squares',
  category: 'geometric',
  defaultGrid: '12',
  description: 'Rotated and scaled squares with varying opacity',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    opacity: @rand(0.3, 1);
    transform: rotate(@rand(360deg)) scale(@rand(0.5, 1.5));
    ${animate ? `animation: spin @rand(${String(5 / speed)}s, ${String(10 / speed)}s) linear infinite;` : ''}
    margin: -.5px;
    
    ${animate ? `
    @keyframes spin {
      to { transform: rotate(360deg) scale(@rand(0.5, 1.5)); }
    }
    ` : ''}
  `,
};

export const hexagons: DoodlePattern = {
  name: 'hexagons',
  category: 'geometric',
  defaultGrid: '10x12',
  description: 'Staggered honeycomb grid using clip-path polygons',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
    opacity: @rand(0.5, 1);
    transform: @if(@mod(@row, 2), translateX(50%), translateX(0));
    ${animate ? `animation: hex-pulse @rand(${String(2 / speed)}s, ${String(5 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes hex-pulse {
      from { transform: @if(@mod(@row, 2), translateX(50%), translateX(0)) scale(1); opacity: @rand(0.45, 0.95); }
      to { transform: @if(@mod(@row, 2), translateX(50%), translateX(0)) scale(@rand(0.88, 1.12)); opacity: @rand(0.25, 0.9); }
    }
    ` : ''}
  `,
};

export const diamonds: DoodlePattern = {
  name: 'diamonds',
  category: 'geometric',
  defaultGrid: '10',
  description: 'Diamond lattice pattern',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    transform: rotate(@pick(0deg, 45deg, 90deg));
    opacity: @rand(0.4, 1);
    margin: -.5px;
    ${animate ? `animation: diamond-spin @rand(${String(3 / speed)}s, ${String(8 / speed)}s) linear infinite;` : ''}
    
    ${animate ? `
    @keyframes diamond-spin {
      from { transform: rotate(@pick(0deg, 45deg, 90deg)); }
      to { transform: rotate(@pick(180deg, 225deg, 270deg, 360deg)); }
    }
    ` : ''}
  `,
};

export const circles: DoodlePattern = {
  name: 'circles',
  category: 'geometric',
  defaultGrid: '12',
  description: 'Overlapping circles with gradient fills',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')}),
      transparent
    );
    opacity: @rand(0.3, 0.8);
    transform: scale(@rand(0.5, 1.5));
    ${animate ? `animation: orb-breathe @rand(${String(2 / speed)}s, ${String(6 / speed)}s) ease-in-out infinite alternate;` : ''}
    
    ${animate ? `
    @keyframes orb-breathe {
      from { transform: scale(@rand(0.5, 1.2)); opacity: @rand(0.25, 0.75); }
      to { transform: scale(@rand(0.8, 1.6)); opacity: @rand(0.4, 0.95); }
    }
    ` : ''}
  `,
};

export const quarters: DoodlePattern = {
  name: 'quarters',
  category: 'geometric',
  defaultGrid: '8',
  description: 'Bauhaus quarter-circle tiles — each cell shows a rounded corner in a random orientation',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    opacity: @rand(0.35, 0.95);
    border-radius: @pick(
      '100% 0 0 0',
      '0 100% 0 0',
      '0 0 100% 0',
      '0 0 0 100%'
    );
    ${animate ? `animation: quarter-rotate @rand(${String(2 / speed)}s, ${String(6 / speed)}s) ease-in-out infinite;` : ''}
    
    ${animate ? `
    @keyframes quarter-rotate {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(@pick(90deg, -90deg, 180deg)); }
    }
    ` : ''}
  `,
};

export const geometricPatterns: readonly DoodlePattern[] = [
  triangles,
  squares,
  hexagons,
  diamonds,
  circles,
  quarters,
];
