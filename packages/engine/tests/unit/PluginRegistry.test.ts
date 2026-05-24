/**
 * Unit tests for PluginRegistryClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginRegistryClient, normalizeGitHubUrl } from '../../src/plugins/PluginRegistry.ts';

describe('normalizeGitHubUrl', () => {
  it('converts github.com/user/repo/tree/branch/path to raw URL', () => {
    expect(normalizeGitHubUrl('https://github.com/acme/plugins/tree/main/registry'))
      .toBe('https://raw.githubusercontent.com/acme/plugins/main/registry');
  });

  it('converts github.com/user/repo/tree/branch/nested/path', () => {
    expect(normalizeGitHubUrl('https://github.com/acme/plugins/tree/develop/packages/my-plugins'))
      .toBe('https://raw.githubusercontent.com/acme/plugins/develop/packages/my-plugins');
  });

  it('handles trailing slash on GitHub tree URL', () => {
    expect(normalizeGitHubUrl('https://github.com/acme/plugins/tree/main/registry/'))
      .toBe('https://raw.githubusercontent.com/acme/plugins/main/registry');
  });

  it('converts github.com/user/repo root URL to raw with main branch', () => {
    expect(normalizeGitHubUrl('https://github.com/acme/plugins'))
      .toBe('https://raw.githubusercontent.com/acme/plugins/main');
  });

  it('converts github.com/user/repo/ with trailing slash', () => {
    expect(normalizeGitHubUrl('https://github.com/acme/plugins/'))
      .toBe('https://raw.githubusercontent.com/acme/plugins/main');
  });

  it('passes through non-GitHub URLs unchanged', () => {
    expect(normalizeGitHubUrl('https://cdn.example.com/plugins/'))
      .toBe('https://cdn.example.com/plugins/');
  });

  it('passes through raw.githubusercontent.com URLs unchanged', () => {
    expect(normalizeGitHubUrl('https://raw.githubusercontent.com/acme/plugins/main/registry'))
      .toBe('https://raw.githubusercontent.com/acme/plugins/main/registry');
  });
});

describe('PluginRegistryClient', () => {
  let client: PluginRegistryClient;

  beforeEach(() => {
    client = new PluginRegistryClient('/api/plugin-proxy');
    vi.restoreAllMocks();
  });

  it('fetches and caches a registry manifest', async () => {
    const mockManifest = {
      name: 'Test Registry',
      version: 1,
      plugins: [
        { name: 'emoji', version: '1.0.0', description: 'Emoji plugin', entry: 'emoji/plugin.json' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    const result = await client.fetch('https://example.com/registry');
    expect(result.name).toBe('Test Registry');
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]?.name).toBe('emoji');

    // Second call should use cache (no additional fetch)
    const result2 = await client.fetch('https://example.com/registry');
    expect(result2).toBe(result);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('appends /index.json to registry URL if not present', async () => {
    const mockManifest = { name: 'Test', version: 1, plugins: [] };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    await client.fetch('https://example.com/my-registry');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/plugin-proxy?url=https%3A%2F%2Fexample.com%2Fmy-registry%2Findex.json',
    );
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(client.fetch('https://example.com/bad')).rejects.toThrow(
      /Failed to fetch registry.*HTTP 404/,
    );
  });

  it('throws on missing name field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ plugins: [] }),
    } as Response);

    await expect(client.fetch('https://example.com/bad')).rejects.toThrow(
      /missing required "name" field/,
    );
  });

  it('resolves plugins with full manifest URLs', async () => {
    const mockManifest = {
      name: 'Test',
      version: 1,
      plugins: [
        { name: 'emoji', version: '2.0.0', description: 'Emoji', entry: 'emoji/plugin.json' },
        { name: 'highlight', version: '1.1.0', description: 'Highlight', entry: 'highlight/plugin.json' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    const plugins = await client.resolvePlugins('https://cdn.example.com/plugins/');
    expect(plugins).toHaveLength(2);
    expect(plugins[0]?.manifestUrl).toBe('https://cdn.example.com/plugins/emoji/plugin.json');
    expect(plugins[1]?.manifestUrl).toBe('https://cdn.example.com/plugins/highlight/plugin.json');
    expect(plugins[0]?.registryUrl).toBe('https://cdn.example.com/plugins/');
  });

  it('invalidates cache for a specific URL', async () => {
    const mockManifest = { name: 'Test', version: 1, plugins: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    await client.fetch('https://a.com/reg');
    await client.fetch('https://b.com/reg');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    client.invalidate('https://a.com/reg');
    await client.fetch('https://a.com/reg');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    // b.com should still be cached
    await client.fetch('https://b.com/reg');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('normalizes GitHub directory URLs when fetching', async () => {
    const mockManifest = { name: 'GH Registry', version: 1, plugins: [] };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    await client.fetch('https://github.com/acme/plugins/tree/main/registry');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/plugin-proxy?url=https%3A%2F%2Fraw.githubusercontent.com%2Facme%2Fplugins%2Fmain%2Fregistry%2Findex.json',
    );
  });

  it('resolves plugins with GitHub-normalized base URLs', async () => {
    const mockManifest = {
      name: 'GH Test',
      version: 1,
      plugins: [
        { name: 'emoji', version: '1.0.0', description: 'Emoji', entry: 'emoji/plugin.json' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    } as Response);

    const plugins = await client.resolvePlugins('https://github.com/acme/plugins/tree/main/registry');
    expect(plugins[0]?.manifestUrl).toBe(
      'https://raw.githubusercontent.com/acme/plugins/main/registry/emoji/plugin.json',
    );
  });
});
