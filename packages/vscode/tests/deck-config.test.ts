import { describe, expect, it, vi } from 'vitest';
import { findNearestDeckConfig, loadDeckMetadata } from '../src/deck-config.ts';

describe('deck-config helpers', () => {
  it('finds config.json by walking up from the active file', () => {
    const configPath = findNearestDeckConfig(
      '/repo/deck/slides/README.md',
      ['/repo/deck'],
      (path) => path === '/repo/deck/config.json',
    );
    expect(configPath).toBe('/repo/deck/config.json');
  });

  it('returns null when no config exists', () => {
    expect(findNearestDeckConfig('/repo/deck/README.md', ['/repo/deck'], () => false)).toBeNull();
  });

  it('loads room and content metadata from config', async () => {
    const readText = vi.fn().mockResolvedValue(JSON.stringify({
      content: 'slides.md',
      sync: { room: 'authors' },
    }));

    await expect(loadDeckMetadata('/repo/deck/config.json', readText)).resolves.toEqual({
      configPath: '/repo/deck/config.json',
      contentPath: '/repo/deck/slides.md',
      room: 'authors',
    });
  });
});
