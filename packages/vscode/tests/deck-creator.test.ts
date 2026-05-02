import { describe, expect, it, vi } from 'vitest';
import { createDeck } from '../src/deck-creator.ts';

describe('createDeck', () => {
  it('runs the create command with the requested title and directory', async () => {
    const stderr = { on: vi.fn() };
    const child = {
      stderr,
      on: vi.fn((event: string, handler: (code: number) => void) => {
        if (event === 'exit') {
          handler(0);
        }
      }),
    };

    const spawnProcess = vi.fn(() => child);

    await expect(createDeck('/repo', '/repo/new-deck', 'My Deck', {
      resolveCli: () => ({ command: 'geekslides', args: [] }),
      spawnProcess,
    })).resolves.toBe('/repo/new-deck/README.md');

    expect(spawnProcess).toHaveBeenCalledWith(
      'geekslides',
      ['create', '--title', 'My Deck', '--dir', '/repo/new-deck'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });
});
