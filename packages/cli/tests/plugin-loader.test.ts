// @vitest-environment jsdom
/**
 * Unit tests for the dynamic plugin loader.
 *
 * Tests the public API of plugin-loader.js:
 * - initPluginLoader / resetPluginLoader
 * - resolvePlugin / resolveFeature
 * - expandPluginBundles
 * - isKnownBundle / getKnownBundles
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initPluginLoader,
  resetPluginLoader,
  resolvePlugin,
  resolveFeature,
  expandPluginBundles,
  isKnownBundle,
  getKnownBundles,
} from '../app/plugin-loader.js';

describe('plugin-loader', () => {
  beforeEach(() => {
    resetPluginLoader();
  });

  describe('initPluginLoader', () => {
    it('accepts a PluginAPI object without throwing', () => {
      const api = { version: 1, createLogger: vi.fn() };
      expect(() => initPluginLoader(api)).not.toThrow();
    });
  });

  describe('isKnownBundle', () => {
    it('returns true for all built-in bundles', () => {
      expect(isKnownBundle('core')).toBe(true);
      expect(isKnownBundle('media')).toBe(true);
      expect(isKnownBundle('whiteboard')).toBe(true);
      expect(isKnownBundle('chart')).toBe(true);
      expect(isKnownBundle('mermaid')).toBe(true);
      expect(isKnownBundle('css-doodle')).toBe(true);
      expect(isKnownBundle('poll')).toBe(true);
    });

    it('returns false for unknown names', () => {
      expect(isKnownBundle('unknown')).toBe(false);
      expect(isKnownBundle('')).toBe(false);
      expect(isKnownBundle('https://example.com/plugin.json')).toBe(false);
    });
  });

  describe('getKnownBundles', () => {
    it('returns all 7 bundle names', () => {
      const bundles = getKnownBundles();
      expect(bundles).toHaveLength(7);
      expect(bundles).toContain('core');
      expect(bundles).toContain('media');
      expect(bundles).toContain('whiteboard');
      expect(bundles).toContain('chart');
      expect(bundles).toContain('mermaid');
      expect(bundles).toContain('css-doodle');
      expect(bundles).toContain('poll');
    });

    it('returns a new array each time', () => {
      const a = getKnownBundles();
      const b = getKnownBundles();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('resolvePlugin', () => {
    it('returns null for unknown plugin name when bundle is not loaded', async () => {
      const result = await resolvePlugin('nonexistent', 'preprocessor').catch(() => null);
      expect(result).toBeNull();
    });

    it('resolves a preprocessor from its known bundle', async () => {
      // Initialize the plugin API so activate() can succeed
      const api = { version: 1, createLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
      initPluginLoader(api);
      // 'youtube-url' maps to 'media' bundle
      const result = await resolvePlugin('youtube-url', 'preprocessor');
      expect(result).toBeTypeOf('function');
    });
  });

  describe('resolveFeature', () => {
    it('returns null for unknown feature name', async () => {
      const result = await resolveFeature('nonexistent').catch(() => null);
      expect(result).toBeNull();
    });

    it('resolves a feature from its known bundle', async () => {
      const api = { version: 1, createLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
      initPluginLoader(api);
      const result = await resolveFeature('whiteboard');
      expect(result).toBeDefined();
      expect(result.id).toBe('whiteboard');
      expect(result.activate).toBeTypeOf('function');
    });
  });

  describe('expandPluginBundles', () => {
    it('returns empty collections for empty input', async () => {
      const result = await expandPluginBundles([]);
      expect(result).toEqual({ preprocessors: {}, processors: {}, features: {} });
    });

    it('skips unknown non-bundle names gracefully', async () => {
      const result = await expandPluginBundles(['not-a-bundle']);
      expect(result).toEqual({ preprocessors: {}, processors: {}, features: {} });
    });

    it('deduplicates bundle names', async () => {
      const result = await expandPluginBundles(['not-a-bundle', 'not-a-bundle']);
      expect(result).toEqual({ preprocessors: {}, processors: {}, features: {} });
    });

    it('loads and expands a known bundle', async () => {
      const api = { version: 1, createLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
      initPluginLoader(api);
      const result = await expandPluginBundles(['core']);
      expect(result.preprocessors).toHaveProperty('header');
      expect(result.preprocessors).toHaveProperty('source-notes');
      expect(result.processors).toHaveProperty('iframe');
    });

    it('loads bundle with dependencies', async () => {
      const api = { version: 1, createLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
      initPluginLoader(api);
      // 'media' depends on 'core' — loading media should load core into cache
      const result = await expandPluginBundles(['media']);
      // Should have media members
      expect(result.preprocessors).toHaveProperty('youtube-url');
      expect(result.preprocessors).toHaveProperty('audio-url');
      expect(result.preprocessors).toHaveProperty('video-url');
      expect(result.preprocessors).toHaveProperty('iframe-url');
      // Core deps are loaded into cache (available via resolvePlugin)
      const headerFn = await resolvePlugin('header', 'preprocessor');
      expect(headerFn).toBeTypeOf('function');
    });

    it('caches bundles (loading same bundle twice returns same exports)', async () => {
      const api = { version: 1, createLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) };
      initPluginLoader(api);
      const r1 = await expandPluginBundles(['core']);
      const r2 = await expandPluginBundles(['core']);
      // Same preprocessor function reference (from cache)
      expect(r1.preprocessors['header']).toBe(r2.preprocessors['header']);
    });
  });

  describe('resetPluginLoader', () => {
    it('clears state while keeping static registries', () => {
      const api = { version: 1, createLogger: vi.fn() };
      initPluginLoader(api);
      resetPluginLoader();
      // Static data still accessible
      expect(getKnownBundles()).toHaveLength(7);
    });
  });
});
