/**
 * Unit tests for RoomPluginManager.
 */

import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { RoomPluginManager } from '../../src/plugins/RoomPluginManager.ts';

describe('RoomPluginManager', () => {
  function createManager(): { doc: Y.Doc; manager: RoomPluginManager } {
    const doc = new Y.Doc();
    const manager = new RoomPluginManager(doc);
    return { doc, manager };
  }

  describe('registries', () => {
    it('adds a registry', () => {
      const { manager } = createManager();
      manager.addRegistry({ url: 'https://example.com/reg', name: 'Test' });
      const list = manager.listRegistries();
      expect(list).toHaveLength(1);
      expect(list[0]?.url).toBe('https://example.com/reg');
      expect(list[0]?.name).toBe('Test');
    });

    it('prevents duplicate registries', () => {
      const { manager } = createManager();
      manager.addRegistry({ url: 'https://example.com/reg', name: 'Test' });
      manager.addRegistry({ url: 'https://example.com/reg', name: 'Test Duplicate' });
      expect(manager.listRegistries()).toHaveLength(1);
    });

    it('removes a registry by URL', () => {
      const { manager } = createManager();
      manager.addRegistry({ url: 'https://a.com/reg', name: 'A' });
      manager.addRegistry({ url: 'https://b.com/reg', name: 'B' });
      const removed = manager.removeRegistry('https://a.com/reg');
      expect(removed).toBe(true);
      expect(manager.listRegistries()).toHaveLength(1);
      expect(manager.listRegistries()[0]?.name).toBe('B');
    });

    it('removes a registry by name', () => {
      const { manager } = createManager();
      manager.addRegistry({ url: 'https://a.com/reg', name: 'Alpha' });
      const removed = manager.removeRegistry('Alpha');
      expect(removed).toBe(true);
      expect(manager.listRegistries()).toHaveLength(0);
    });

    it('returns false when removing non-existent registry', () => {
      const { manager } = createManager();
      expect(manager.removeRegistry('nonexistent')).toBe(false);
    });

    it('removes associated plugins when registry is removed', () => {
      const { manager } = createManager();
      manager.addRegistry({ url: 'https://a.com/reg', name: 'A' });
      manager.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://a.com/reg/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://a.com/reg',
      });
      manager.loadPlugin({
        name: 'highlight',
        manifestUrl: 'https://b.com/reg/highlight/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://b.com/reg',
      });
      expect(manager.listPlugins()).toHaveLength(2);

      manager.removeRegistry('https://a.com/reg');
      const remaining = manager.listPlugins();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.name).toBe('highlight');
    });
  });

  describe('plugins', () => {
    it('loads a plugin', () => {
      const { manager } = createManager();
      manager.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://cdn.example.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://cdn.example.com/',
      });
      const list = manager.listPlugins();
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe('emoji');
      expect(list[0]?.manifestUrl).toBe('https://cdn.example.com/emoji/plugin.json');
    });

    it('prevents duplicate plugin by manifestUrl', () => {
      const { manager } = createManager();
      const entry = {
        name: 'emoji',
        manifestUrl: 'https://cdn.example.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://cdn.example.com/',
      };
      manager.loadPlugin(entry);
      manager.loadPlugin(entry);
      expect(manager.listPlugins()).toHaveLength(1);
    });

    it('unloads a plugin by name', () => {
      const { manager } = createManager();
      manager.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://cdn.example.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://cdn.example.com/',
      });
      const removed = manager.unloadPlugin('emoji');
      expect(removed).toBe(true);
      expect(manager.listPlugins()).toHaveLength(0);
    });

    it('returns false when unloading non-existent plugin', () => {
      const { manager } = createManager();
      expect(manager.unloadPlugin('nonexistent')).toBe(false);
    });
  });

  describe('change notifications', () => {
    it('fires onChange when a plugin is loaded', () => {
      const { manager } = createManager();
      const handler = vi.fn();
      manager.onChange(handler);

      manager.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://cdn.example.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://cdn.example.com/',
      });

      expect(handler).toHaveBeenCalled();
      const lastCall = handler.mock.calls[handler.mock.calls.length - 1];
      expect(lastCall?.[0]).toHaveLength(1);
    });

    it('fires onChange when a plugin is unloaded', () => {
      const { manager } = createManager();
      manager.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://cdn.example.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://cdn.example.com/',
      });

      const handler = vi.fn();
      manager.onChange(handler);

      manager.unloadPlugin('emoji');
      expect(handler).toHaveBeenCalled();
      const lastCall = handler.mock.calls[handler.mock.calls.length - 1];
      expect(lastCall?.[0]).toHaveLength(0);
    });

    it('unsubscribes with returned function', () => {
      const { manager } = createManager();
      const handler = vi.fn();
      const unsub = manager.onChange(handler);

      unsub();
      manager.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://cdn.example.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://cdn.example.com/',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('multi-client sync', () => {
    it('syncs state between two docs', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const manager1 = new RoomPluginManager(doc1);
      const manager2 = new RoomPluginManager(doc2);

      manager1.addRegistry({ url: 'https://a.com', name: 'A' });
      manager1.loadPlugin({
        name: 'emoji',
        manifestUrl: 'https://a.com/emoji/plugin.json',
        version: '1.0.0',
        registryUrl: 'https://a.com',
      });

      // Simulate sync by applying updates
      const update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);

      expect(manager2.listRegistries()).toHaveLength(1);
      expect(manager2.listPlugins()).toHaveLength(1);
      expect(manager2.listPlugins()[0]?.name).toBe('emoji');
    });
  });
});
