import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { SyncManager } from '../../src/sync/SyncManager.ts';
import type { SyncTarget } from '../../src/sync/SyncManager.ts';

function createMockTarget(): SyncTarget & { goTo: ReturnType<typeof vi.fn>; _mode: string } {
  const mock = {
    goTo: vi.fn(),
    _mode: 'present',
    currentSlide: 0,
    currentPartial: 0,
    get mode(): string {
      return mock._mode;
    },
    set mode(value: string) {
      mock._mode = value;
    },
  };
  return mock;
}

describe('SyncManager', () => {
  it('publishState updates Y.Map values', () => {
    const sm = new SyncManager(new EventTarget());

    sm.publishState(3, 1, 'present');

    const state = sm.doc.getMap('sessionState');
    expect(state.get('slide')).toBe(3);
    expect(state.get('partial')).toBe(1);
    expect(state.get('mode')).toBe('present');
    expect(state.get('presenterActive')).toBe(true);
  });

  it('remote Y.Map changes trigger goTo on bound target', () => {
    // Create two Y.Docs synced together manually
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const sm = new SyncManager(new EventTarget());

    const target = createMockTarget();
    sm.bind(target);

    // Sync doc1 → SyncManager's doc by applying update
    const state1 = doc1.getMap('sessionState');

    doc1.transact(() => {
      state1.set('slide', 5);
      state1.set('partial', 2);
      state1.set('mode', 'present');
    });

    // Apply doc1's state to SyncManager's doc (simulating remote sync)
    const update = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(sm.doc, update);

    expect(target.goTo).toHaveBeenCalledWith(5, 2);
  });

  it('isRemoteUpdate prevents echo loops in publishState', () => {
    const sm = new SyncManager(new EventTarget());

    // Publish state
    sm.publishState(1, 0, 'present');

    const state = sm.doc.getMap('sessionState');
    expect(state.get('slide')).toBe(1);

    // Verify no infinite loop: publish again should work
    sm.publishState(2, 0, 'present');
    expect(state.get('slide')).toBe(2);
  });

  it('toggleFollow ignores remote updates when disabled', () => {
    const sm = new SyncManager(new EventTarget());
    const target = createMockTarget();
    sm.bind(target);

    // Disable follow
    sm.toggleFollow();
    expect(sm.isFollowing).toBe(false);

    // Simulate remote update
    const remoteDoc = new Y.Doc();
    const remoteState = remoteDoc.getMap('sessionState');
    remoteDoc.transact(() => {
      remoteState.set('slide', 10);
      remoteState.set('partial', 0);
    });

    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    // goTo should NOT have been called (follow is off)
    expect(target.goTo).not.toHaveBeenCalled();
  });

  it('toggleFollow publishes local position when re-enabled', () => {
    const sm = new SyncManager(new EventTarget());
    const target = createMockTarget();
    sm.bind(target);

    // Set the target's local position
    target.currentSlide = 5;
    target.currentPartial = 2;

    // Disable follow
    sm.toggleFollow();
    expect(sm.isFollowing).toBe(false);

    // Re-enable follow — should publish local state, not snap to remote
    sm.toggleFollow();
    expect(sm.isFollowing).toBe(true);
    // Local position is published to the Y.Doc
    const state = sm.doc.getMap('sessionState');
    expect(state.get('slide')).toBe(5);
    expect(state.get('partial')).toBe(2);
    // goTo is NOT called (we don't snap to remote)
    expect(target.goTo).not.toHaveBeenCalled();
  });

});

describe('SyncManager readonly mode', () => {
  it('isReadonly returns true when constructed with readonly option', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });
    expect(sm.isReadonly).toBe(true);
  });

  it('isReadonly returns false by default', () => {
    const sm = new SyncManager(new EventTarget());
    expect(sm.isReadonly).toBe(false);
  });

  it('publishState is a no-op in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });

    sm.publishState(5, 2, 'present');

    const state = sm.doc.getMap('sessionState');
    expect(state.get('slide')).toBeUndefined();
    expect(state.get('partial')).toBeUndefined();
    expect(state.get('mode')).toBeUndefined();
  });

  it('still receives remote state changes in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });
    const target = createMockTarget();
    sm.bind(target);

    // Simulate remote update
    const remoteDoc = new Y.Doc();
    remoteDoc.transact(() => {
      remoteDoc.getMap('sessionState').set('slide', 8);
      remoteDoc.getMap('sessionState').set('partial', 1);
      remoteDoc.getMap('sessionState').set('mode', 'present');
    });

    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    expect(target.goTo).toHaveBeenCalledWith(8, 1);
  });
});
