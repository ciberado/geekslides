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

  it('toggleFollow snaps to presenter position when re-enabled', () => {
    const sm = new SyncManager(new EventTarget());
    const target = createMockTarget();
    sm.bind(target);

    // First publish some state
    sm.publishState(7, 3, 'present');

    // Disable follow
    sm.toggleFollow();
    expect(sm.isFollowing).toBe(false);

    // Re-enable follow — should snap to current state
    sm.toggleFollow();
    expect(sm.isFollowing).toBe(true);
    expect(target.goTo).toHaveBeenCalledWith(7, 3);
  });

  it('addStroke pushes to Y.Array', () => {
    const sm = new SyncManager(new EventTarget());
    const stroke = {
      id: 'stroke-1',
      slideIndex: 0,
      points: [[0.1, 0.2], [0.3, 0.4]] as [number, number][],
      color: '#ff0000',
      width: 3,
      clientId: 'test',
    };

    sm.addStroke(stroke);

    const strokes = sm.doc.getArray('whiteboardStrokes');
    expect(strokes.length).toBe(1);
  });

  it('getStrokes returns all existing strokes', () => {
    const sm = new SyncManager(new EventTarget());
    const stroke1 = {
      id: 'stroke-1',
      slideIndex: 0,
      points: [[0.1, 0.2], [0.3, 0.4]] as [number, number][],
      color: '#ff0000',
      width: 3,
      clientId: 'test',
    };
    const stroke2 = {
      id: 'stroke-2',
      slideIndex: 1,
      points: [[0.5, 0.6]] as [number, number][],
      color: '#00ff00',
      width: 2,
      clientId: 'test',
    };

    sm.addStroke(stroke1);
    sm.addStroke(stroke2);

    const result = sm.getStrokes();
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('stroke-1');
    expect(result[1]?.id).toBe('stroke-2');
  });

  it('getStrokes returns strokes from remote doc sync', () => {
    const sm = new SyncManager(new EventTarget());
    const remoteDoc = new Y.Doc();
    const remoteStrokes = remoteDoc.getArray('whiteboardStrokes');
    remoteStrokes.push([{
      id: 'remote-1',
      slideIndex: 2,
      points: [[0.1, 0.2]],
      color: '#0000ff',
      width: 4,
      clientId: 'remote',
    }]);

    // Simulate late-join sync
    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    const result = sm.getStrokes();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('remote-1');
    expect(result[0]?.slideIndex).toBe(2);
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

  it('addStroke is a no-op in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });
    const stroke = {
      id: 'stroke-1',
      slideIndex: 0,
      points: [[0.1, 0.2]] as [number, number][],
      color: '#ff0000',
      width: 3,
      clientId: 'test',
    };

    sm.addStroke(stroke);

    const strokes = sm.doc.getArray('whiteboardStrokes');
    expect(strokes.length).toBe(0);
  });

  it('updateLiveStroke is a no-op in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });
    const stroke = {
      id: 'stroke-1',
      slideIndex: 0,
      points: [[0.1, 0.2]] as [number, number][],
      color: '#ff0000',
      width: 3,
      clientId: 'test',
    };

    sm.updateLiveStroke(stroke);

    const liveStrokes = sm.doc.getMap('liveStrokes');
    expect(liveStrokes.size).toBe(0);
  });

  it('clearStrokes is a no-op in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });

    // Add a stroke via the underlying Y.Doc directly (simulating remote)
    const remoteDoc = new Y.Doc();
    remoteDoc.getArray('whiteboardStrokes').push([{
      id: 'remote-1',
      slideIndex: 0,
      points: [[0.1, 0.2]],
      color: '#ff0000',
      width: 3,
      clientId: 'remote',
    }]);
    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    // Attempt to clear — should be no-op
    sm.clearStrokes(0);

    expect(sm.getStrokes()).toHaveLength(1);
  });

  it('clearAllStrokes removes all strokes across all slides', () => {
    const sm = new SyncManager(new EventTarget());
    sm.addStroke({ id: 'a', slideIndex: 0, points: [[0, 0]], color: '#f00', width: 2, clientId: 'x' });
    sm.addStroke({ id: 'b', slideIndex: 1, points: [[0, 0]], color: '#0f0', width: 2, clientId: 'x' });
    sm.addStroke({ id: 'c', slideIndex: 2, points: [[0, 0]], color: '#00f', width: 2, clientId: 'x' });

    sm.clearAllStrokes();

    expect(sm.getStrokes()).toHaveLength(0);
  });

  it('clearAllStrokes is a no-op when there are no strokes', () => {
    const sm = new SyncManager(new EventTarget());
    expect(() => sm.clearAllStrokes()).not.toThrow();
    expect(sm.getStrokes()).toHaveLength(0);
  });

  it('clearAllStrokes is a no-op in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });

    const remoteDoc = new Y.Doc();
    remoteDoc.getArray('whiteboardStrokes').push([
      { id: 'r1', slideIndex: 0, points: [[0, 0]], color: '#f00', width: 2, clientId: 'remote' },
      { id: 'r2', slideIndex: 1, points: [[0, 0]], color: '#0f0', width: 2, clientId: 'remote' },
    ]);
    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    sm.clearAllStrokes();

    expect(sm.getStrokes()).toHaveLength(2);
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

  it('getStrokes still works in readonly mode (for whiteboard replay)', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });

    const remoteDoc = new Y.Doc();
    remoteDoc.getArray('whiteboardStrokes').push([{
      id: 'remote-1',
      slideIndex: 0,
      points: [[0.1, 0.2]],
      color: '#ff0000',
      width: 3,
      clientId: 'remote',
    }]);
    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    expect(sm.getStrokes()).toHaveLength(1);
  });
});

describe('SyncManager remote-clear event', () => {
  it('dispatches geek:whiteboard:remote-clear when remote strokes are deleted', () => {
    const eventTarget = new EventTarget();
    const sm = new SyncManager(eventTarget);

    // Add two strokes on slide 0 and one on slide 1
    sm.addStroke({ id: 's1', slideIndex: 0, points: [[0.1, 0.2]], color: '#f00', width: 3, clientId: 'a' });
    sm.addStroke({ id: 's2', slideIndex: 0, points: [[0.3, 0.4]], color: '#f00', width: 3, clientId: 'a' });
    sm.addStroke({ id: 's3', slideIndex: 1, points: [[0.5, 0.6]], color: '#0f0', width: 3, clientId: 'a' });

    // Listen for remote-clear on another SyncManager sharing the same doc (simulates a peer)
    const peer = new SyncManager(eventTarget);
    Y.applyUpdate(peer.doc, Y.encodeStateAsUpdate(sm.doc));

    const clearEvents: CustomEvent[] = [];
    eventTarget.addEventListener('geek:whiteboard:remote-clear', (e) => {
      clearEvents.push(e as CustomEvent);
    });

    // Simulate a remote peer deleting slide-0 strokes
    const remoteDoc = new Y.Doc();
    Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(peer.doc));
    // Delete both slide-0 strokes from the remote doc
    remoteDoc.transact(() => {
      const arr = remoteDoc.getArray('whiteboardStrokes');
      // Delete indices 0 and 1 (both slide 0 strokes)
      arr.delete(1, 1);
      arr.delete(0, 1);
    });

    Y.applyUpdate(peer.doc, Y.encodeStateAsUpdate(remoteDoc));

    expect(clearEvents.length).toBeGreaterThanOrEqual(1);
    const slideIndices = clearEvents.map((e) => (e as CustomEvent<{ slideIndex: number }>).detail.slideIndex);
    expect(slideIndices).toContain(0);
  });

  it('publishWhiteboardVisible writes whiteboardVisible to sessionState', () => {
    const sm = new SyncManager(new EventTarget());
    sm.publishWhiteboardVisible(false);
    expect(sm.doc.getMap('sessionState').get('whiteboardVisible')).toBe(false);
    sm.publishWhiteboardVisible(true);
    expect(sm.doc.getMap('sessionState').get('whiteboardVisible')).toBe(true);
  });

  it('publishWhiteboardVisible is a no-op in readonly mode', () => {
    const sm = new SyncManager(new EventTarget(), { readonly: true });
    sm.publishWhiteboardVisible(false);
    expect(sm.doc.getMap('sessionState').get('whiteboardVisible')).toBeUndefined();
  });

  it('dispatches geek:whiteboard:remote-visibility when remote peer sets whiteboardVisible', () => {
    const eventTarget = new EventTarget();
    const sm = new SyncManager(eventTarget);

    const visibilityEvents: CustomEvent[] = [];
    eventTarget.addEventListener('geek:whiteboard:remote-visibility', (e) => {
      visibilityEvents.push(e as CustomEvent);
    });

    // Simulate a remote peer publishing visibility=false
    const remoteDoc = new Y.Doc();
    remoteDoc.getMap('sessionState').set('whiteboardVisible', false);
    Y.applyUpdate(sm.doc, Y.encodeStateAsUpdate(remoteDoc));

    expect(visibilityEvents).toHaveLength(1);
    expect((visibilityEvents[0] as CustomEvent<{ visible: boolean }>).detail.visible).toBe(false);
  });
});
