import { describe, it, expect } from 'vitest';
import { CLI_VERSION } from '../src/index.ts';

describe('cli', () => {
  it('exports version', () => {
    expect(CLI_VERSION).toBe('2.0.0-alpha.0');
  });
});
