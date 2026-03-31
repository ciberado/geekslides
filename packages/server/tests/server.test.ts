import { describe, it, expect } from 'vitest';
import { SERVER_VERSION } from '../src/index.ts';

describe('server', () => {
  it('exports version', () => {
    expect(SERVER_VERSION).toBe('2.0.0-alpha.0');
  });
});
