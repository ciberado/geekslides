import { describe, expect, it, vi } from 'vitest';
import { openDeckInBrowser } from '../src/browser-opener.ts';

describe('openDeckInBrowser', () => {
  it('returns false when no presentation url is available', async () => {
    await expect(openDeckInBrowser(undefined, vi.fn())).resolves.toBe(false);
  });

  it('opens the presentation url', async () => {
    const openExternal = vi.fn().mockResolvedValue(true);
    await expect(openDeckInBrowser('http://localhost:5173', openExternal)).resolves.toBe(true);
    expect(openExternal).toHaveBeenCalledWith('http://localhost:5173');
  });
});
