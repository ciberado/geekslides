// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBridge } from '../../src/sync/EventBridge.ts';
import type { EventBridgeSyncAPI, EventBridgeConfig } from '../../src/sync/EventBridge.ts';

function createMockSyncAPI(): EventBridgeSyncAPI & {
  sharedMap: Map<string, unknown>;
  sharedArray: unknown[];
  ephemeralMap: Map<string, unknown>;
} {
  const sharedMap = new Map<string, unknown>();
  const sharedArray: unknown[] = [];
  const ephemeralMap = new Map<string, unknown>();

  return {
    readonly: false,
    sharedMap,
    sharedArray,
    ephemeralMap,
    getSharedMap() {
      return {
        set: (k: string, v: unknown) => sharedMap.set(k, v),
        get: (k: string) => sharedMap.get(k),
        delete: (k: string) => sharedMap.delete(k),
      } as unknown as ReturnType<EventBridgeSyncAPI['getSharedMap']>;
    },
    getSharedArray() {
      return {
        push: (items: unknown[]) => sharedArray.push(...items),
        toArray: () => [...sharedArray],
        get length() { return sharedArray.length; },
      } as unknown as ReturnType<EventBridgeSyncAPI['getSharedArray']>;
    },
    getEphemeralMap() {
      return {
        set: (k: string, v: unknown) => ephemeralMap.set(k, v),
        get: (k: string) => ephemeralMap.get(k),
        delete: (k: string) => ephemeralMap.delete(k),
      } as unknown as ReturnType<EventBridgeSyncAPI['getEphemeralMap']>;
    },
  };
}

describe('EventBridge', () => {
  let syncAPI: ReturnType<typeof createMockSyncAPI>;
  let eventTarget: EventTarget;

  beforeEach(() => {
    syncAPI = createMockSyncAPI();
    eventTarget = new EventTarget();
  });

  describe('lifecycle', () => {
    it('starts inactive', () => {
      const bridge = new EventBridge(syncAPI, { eventTarget, actions: [] });
      expect(bridge.isActive).toBe(false);
    });

    it('becomes active after activate()', () => {
      const bridge = new EventBridge(syncAPI, { eventTarget, actions: [] });
      bridge.activate();
      expect(bridge.isActive).toBe(true);
    });

    it('becomes inactive after deactivate()', () => {
      const bridge = new EventBridge(syncAPI, { eventTarget, actions: [] });
      bridge.activate();
      bridge.deactivate();
      expect(bridge.isActive).toBe(false);
    });

    it('activate() is idempotent', () => {
      const spy = vi.spyOn(eventTarget, 'addEventListener');
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{ event: 'test', target: 'map' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();
      bridge.activate();
      // Only one listener added despite double activate
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('deactivate() is idempotent', () => {
      const bridge = new EventBridge(syncAPI, { eventTarget, actions: [] });
      bridge.deactivate();
      expect(bridge.isActive).toBe(false);
    });

    it('removes all listeners on deactivate', () => {
      const spy = vi.spyOn(eventTarget, 'removeEventListener');
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [
          { event: 'evt1', target: 'map' },
          { event: 'evt2', target: 'array' },
        ],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();
      bridge.deactivate();
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('map target', () => {
    it('sets event detail in shared map with specified key', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{ event: 'my:state', target: 'map', key: 'status' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('my:state', { detail: { playing: true } }));
      expect(syncAPI.sharedMap.get('status')).toEqual({ playing: true });
    });

    it('uses event name as key when key is omitted', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{ event: 'my:state', target: 'map' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('my:state', { detail: 'hello' }));
      expect(syncAPI.sharedMap.get('my:state')).toBe('hello');
    });

    it('applies transform before setting', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{
          event: 'my:data',
          target: 'map',
          key: 'count',
          transform: (d: unknown) => (d as number) * 2,
        }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('my:data', { detail: 5 }));
      expect(syncAPI.sharedMap.get('count')).toBe(10);
    });
  });

  describe('array target', () => {
    it('pushes event detail to shared array', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{ event: 'my:item', target: 'array' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('my:item', { detail: { x: 1, y: 2 } }));
      eventTarget.dispatchEvent(new CustomEvent('my:item', { detail: { x: 3, y: 4 } }));
      expect(syncAPI.sharedArray).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    });

    it('applies transform before pushing', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{
          event: 'add',
          target: 'array',
          transform: (d: unknown) => ({ ...(d as object), ts: 999 }),
        }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('add', { detail: { name: 'a' } }));
      expect(syncAPI.sharedArray).toEqual([{ name: 'a', ts: 999 }]);
    });
  });

  describe('ephemeral target', () => {
    it('sets ephemeral state for progress events', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{ event: 'my:progress', target: 'ephemeral' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('my:progress', { detail: { percent: 50 } }));
      expect(syncAPI.ephemeralMap.get('_self')).toEqual({ percent: 50 });
    });

    it('clears ephemeral state when clear flag is set', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [
          { event: 'my:progress', target: 'ephemeral' },
          { event: 'my:done', target: 'ephemeral', clear: true },
        ],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('my:progress', { detail: { percent: 100 } }));
      expect(syncAPI.ephemeralMap.get('_self')).toEqual({ percent: 100 });

      eventTarget.dispatchEvent(new CustomEvent('my:done', { detail: null }));
      expect(syncAPI.ephemeralMap.has('_self')).toBe(false);
    });
  });

  describe('readonly mode', () => {
    it('does not forward events when sync is readonly', () => {
      const readonlySyncAPI = createMockSyncAPI();
      (readonlySyncAPI as { readonly: boolean }).readonly = true;

      const config: EventBridgeConfig = {
        eventTarget,
        actions: [
          { event: 'evt1', target: 'map', key: 'k' },
          { event: 'evt2', target: 'array' },
          { event: 'evt3', target: 'ephemeral' },
        ],
      };
      const bridge = new EventBridge(readonlySyncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('evt1', { detail: 'x' }));
      eventTarget.dispatchEvent(new CustomEvent('evt2', { detail: 'y' }));
      eventTarget.dispatchEvent(new CustomEvent('evt3', { detail: 'z' }));

      expect(readonlySyncAPI.sharedMap.size).toBe(0);
      expect(readonlySyncAPI.sharedArray).toHaveLength(0);
      expect(readonlySyncAPI.ephemeralMap.size).toBe(0);
    });
  });

  describe('no forwarding after deactivate', () => {
    it('stops forwarding events after deactivate', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [{ event: 'my:event', target: 'map', key: 'k' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();
      bridge.deactivate();

      eventTarget.dispatchEvent(new CustomEvent('my:event', { detail: 'should-not-appear' }));
      expect(syncAPI.sharedMap.size).toBe(0);
    });
  });

  describe('multiple actions', () => {
    it('handles multiple different events simultaneously', () => {
      const config: EventBridgeConfig = {
        eventTarget,
        actions: [
          { event: 'stroke', target: 'array' },
          { event: 'progress', target: 'ephemeral' },
          { event: 'state', target: 'map', key: 'visible' },
        ],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      eventTarget.dispatchEvent(new CustomEvent('stroke', { detail: { points: [] } }));
      eventTarget.dispatchEvent(new CustomEvent('progress', { detail: { x: 10 } }));
      eventTarget.dispatchEvent(new CustomEvent('state', { detail: true }));

      expect(syncAPI.sharedArray).toHaveLength(1);
      expect(syncAPI.ephemeralMap.get('_self')).toEqual({ x: 10 });
      expect(syncAPI.sharedMap.get('visible')).toBe(true);
    });
  });

  describe('defaults to document as eventTarget', () => {
    it('uses document when eventTarget is not specified', () => {
      const config: EventBridgeConfig = {
        actions: [{ event: 'global:event', target: 'map', key: 'g' }],
      };
      const bridge = new EventBridge(syncAPI, config);
      bridge.activate();

      document.dispatchEvent(new CustomEvent('global:event', { detail: 42 }));
      expect(syncAPI.sharedMap.get('g')).toBe(42);

      bridge.deactivate();
    });
  });
});
