/**
 * GeekSlides v2 — Decorative css-doodle patterns.
 */

import type { DoodlePattern } from './types.ts';

export const confetti: DoodlePattern = {
  name: 'confetti',
  category: 'decorative',
  defaultGrid: '20',
  description: 'Confetti burst — rectangular pieces exploding from center',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    position: absolute;
    top: @rand(2%, 95%);
    left: @rand(2%, 95%);
    @size: @rand(5px, 14px) @rand(12px, 28px);
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    opacity: @rand(0.65, 1);
    transform: rotate(@rand(-80deg, 80deg));
    ${animate ? `
    animation: confetti-fall @rand(${String(1.5 / speed)}s, ${String(4 / speed)}s) linear infinite;
    animation-delay: @rand(${String(-4 / speed)}s, 0s);
    ` : ''}
    
    ${animate ? `
    @keyframes confetti-fall {
      0%   { transform: translateY(-120%) rotate(0deg); opacity: 1; }
      80%  { opacity: 0.8; }
      100% { transform: translateY(130vh) rotate(@rand(-360deg, 360deg)); opacity: 0; }
    }
    ` : ''}
  `,
};

export const stars: DoodlePattern = {
  name: 'stars',
  category: 'decorative',
  defaultGrid: '16',
  description: 'Star field with twinkling',
  generate: ({ colors, grid, animate, speed }) => `
    @grid: ${grid} / 100%;
    @size: @rand(2px, 8px);
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    border-radius: 50%;
    opacity: @rand(0.3, 1);
    box-shadow: 0 0 @rand(2px, 6px) @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    position: relative;
    left: @rand(-40%, 40%);
    top: @rand(-40%, 40%);
    ${animate ? `animation: twinkle @rand(${String(1 / speed)}s, ${String(3 / speed)}s) ease-in-out infinite;` : ''}
    
    ${animate ? `
    @keyframes twinkle {
      0%, 100% { opacity: @rand(0.3, 1); transform: scale(1); }
      50% { opacity: @rand(0.1, 0.5); transform: scale(@rand(0.5, 1.5)); }
    }
    ` : ''}
  `,
};

export const mosaic: DoodlePattern = {
  name: 'mosaic',
  category: 'decorative',
  defaultGrid: '12',
  description: 'Stained-glass mosaic effect',
  generate: ({ colors, grid }) => `
    @grid: ${grid} / 100%;
    background: @pick(${colors.map((c, i) => `var(--doodle-c${String(i + 1)})`).join(', ')});
    clip-path: polygon(
      @rand(20%, 40%) @rand(0%, 30%),
      @rand(60%, 80%) @rand(0%, 30%),
      @rand(80%, 100%) @rand(40%, 60%),
      @rand(60%, 80%) @rand(70%, 100%),
      @rand(20%, 40%) @rand(70%, 100%),
      @rand(0%, 20%) @rand(40%, 60%)
    );
    opacity: @rand(0.5, 0.9);
    margin: -2px;
  `,
};

export const decorativePatterns: readonly DoodlePattern[] = [
  confetti,
  stars,
  mosaic,
];
