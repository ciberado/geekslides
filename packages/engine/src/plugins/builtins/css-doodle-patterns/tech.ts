/**
 * GeekSlides v2 — Tech-themed css-doodle patterns.
 */

import type { DoodlePattern } from './types.ts';

export const circuit: DoodlePattern = {
  name: 'circuit',
  category: 'tech',
  defaultGrid: '14',
  description: 'Circuit-board traces with nodes and vias',
  generate: ({ grid }) => `
    @grid: ${grid} / 100%;
    background: @pick(
      /* horizontal trace — full span */
      linear-gradient(transparent 42%, var(--doodle-c1) 42%, var(--doodle-c1) 58%, transparent 58%),
      /* vertical trace — full span */
      linear-gradient(90deg, transparent 42%, var(--doodle-c1) 42%, var(--doodle-c1) 58%, transparent 58%),
      /* horizontal stub — right half */
      linear-gradient(transparent 42%, var(--doodle-c1) 42%, var(--doodle-c1) 58%, transparent 58%) 50% 50% / 50% 100% no-repeat,
      /* vertical stub — bottom half */
      linear-gradient(90deg, transparent 42%, var(--doodle-c1) 42%, var(--doodle-c1) 58%, transparent 58%) 50% 50% / 100% 50% no-repeat,
      /* pad — filled square */
      radial-gradient(circle, var(--doodle-c1) 28%, transparent 28%),
      /* via — hollow ring */
      radial-gradient(circle, transparent 16%, var(--doodle-c2) 16%, var(--doodle-c2) 28%, transparent 28%),
      /* empty */ transparent, transparent, transparent, transparent
    );
    opacity: @rand(0.7, 1);
  `,
};

export const matrix: DoodlePattern = {
  name: 'matrix',
  category: 'tech',
  defaultGrid: '20x30',
  description: 'Digital rain / matrix-style characters',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    color: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    opacity: @rand(0.2, 1);
    font-family: monospace;
    font-size: @rand(8px, 16px);
    display: flex;
    align-items: center;
    justify-content: center;
    ${animate ? `animation: flicker @rand(${String(0.5 / speed)}s, ${String(2 / speed)}s) step-end infinite;` : ''}
    
    :after {
      content: @pick('0', '1', 'A', 'B', 'C', 'D', 'E', 'F', '*', '#');
    }
    
    ${animate ? `
    @keyframes flicker {
      0%   { opacity: 1; }
      50%  { opacity: @rand(0.1, 0.5); }
      100% { opacity: @rand(0.2, 1); }
    }
    ` : ''}
  `,
};

export const pixels: DoodlePattern = {
  name: 'pixels',
  category: 'tech',
  defaultGrid: '24',
  description: 'Retro pixelated blocks',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    opacity: @rand(0.4, 1);
    margin: 1px;
  `,
};

export const binary: DoodlePattern = {
  name: 'binary',
  category: 'tech',
  defaultGrid: '16x20',
  description: 'Binary digit patterns',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    :after {
      content: @pick('0', '1');
      color: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
      opacity: @rand(0.3, 0.9);
      font-family: monospace;
      font-size: @rand(10px, 14px);
      font-weight: bold;
    }
  `,
};

export const techPatterns: readonly DoodlePattern[] = [
  circuit,
  matrix,
  pixels,
  binary,
];
