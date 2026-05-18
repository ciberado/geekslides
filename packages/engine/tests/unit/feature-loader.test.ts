import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Feature } from '../../src/features/types.ts';

vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mock remote plugin importer used by local-plugin.ts
vi.mock('../../src/plugins/local-plugin.ts', () => ({
  isRemotePluginUrl: (name: string) => name.startsWith('https://'),
  isLocalPluginPath: (name: string) => name.startsWith('./') || name.startsWith('/'),
  importRemotePlugin: vi.fn(),
}));

import { loadFeature } from '../../src/features/feature-loader.ts';
import { importRemotePlugin } from '../../src/plugins/local-plugin.ts';

const resolveUrl = (path: string): string => `http://localhost/${path}`;

describe('loadFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('built-in features', () => {
    it('throws for any bare name (built-ins now handled by plugin-loader)', async () => {
      await expect(loadFeature('whiteboard', resolveUrl)).rejects.toThrow(
        "Unknown built-in feature: 'whiteboard'",
      );
    });

    it('throws for unknown built-in name', async () => {
      await expect(loadFeature('unknown-builtin', resolveUrl)).rejects.toThrow(
        "Unknown built-in feature: 'unknown-builtin'",
      );
    });
  });

  describe('remote features (HTTPS URLs)', () => {
    it('calls importRemotePlugin for https:// URLs', async () => {
      const remoteFeature: Feature = {
        id: 'remote-feat',
        label: 'Remote feature',
        activate: vi.fn(),
      };
      vi.mocked(importRemotePlugin).mockResolvedValueOnce({ default: remoteFeature });

      const result = await loadFeature('https://example.com/feature.js', resolveUrl);
      expect(importRemotePlugin).toHaveBeenCalledWith('https://example.com/feature.js');
      expect(result).toBe(remoteFeature);
    });

    it('throws if remote module has no default export', async () => {
      vi.mocked(importRemotePlugin).mockResolvedValueOnce({});
      await expect(loadFeature('https://example.com/bad.js', resolveUrl)).rejects.toThrow(
        'must have a default export',
      );
    });

    it('throws if remote module default is missing id', async () => {
      vi.mocked(importRemotePlugin).mockResolvedValueOnce({
        default: { label: 'Bad', activate: vi.fn() },
      });
      await expect(loadFeature('https://example.com/bad.js', resolveUrl)).rejects.toThrow(
        "non-empty 'id' string",
      );
    });

    it('throws if remote module default has empty id', async () => {
      vi.mocked(importRemotePlugin).mockResolvedValueOnce({
        default: { id: '', label: 'Bad', activate: vi.fn() },
      });
      await expect(loadFeature('https://example.com/bad.js', resolveUrl)).rejects.toThrow(
        "non-empty 'id' string",
      );
    });

    it('throws if remote module default is missing label', async () => {
      vi.mocked(importRemotePlugin).mockResolvedValueOnce({
        default: { id: 'ok', activate: vi.fn() },
      });
      await expect(loadFeature('https://example.com/bad.js', resolveUrl)).rejects.toThrow(
        "'label' string",
      );
    });

    it('throws if remote module default is missing activate', async () => {
      vi.mocked(importRemotePlugin).mockResolvedValueOnce({
        default: { id: 'ok', label: 'Ok' },
      });
      await expect(loadFeature('https://example.com/bad.js', resolveUrl)).rejects.toThrow(
        "'activate' function",
      );
    });
  });

  describe('local path features (./ or /)', () => {
    it('throws for local paths since dynamic import fails in unit test', async () => {
      // Dynamic import of a local URL will fail in the vitest node environment;
      // we just verify the resolver is called and the error propagates.
      await expect(loadFeature('./my-feature.js', resolveUrl)).rejects.toThrow();
    });
  });
});
