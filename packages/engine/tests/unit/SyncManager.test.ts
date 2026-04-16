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
