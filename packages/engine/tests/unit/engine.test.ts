import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import { parse } from '../../src/core/SlideParser.ts';

describe('engine smoke test', () => {
  it('core modules are importable', () => {
    expect(DEFAULT_CONFIG.aspectRatio).toBe('16/9');
    expect(typeof parse).toBe('function');
  });
});
