// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhiteboardSync } from '../../src/sync/WhiteboardSync.ts';
import type { SyncManager } from '../../src/sync/SyncManager.ts';
import type { WhiteboardStroke } from '../../src/sync/types.ts';

vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

function makeStroke(overrides: Partial<WhiteboardStroke> = {}): WhiteboardStroke {
  return {
    id: 'stroke-1',
    slideIndex: 0,
    points: [[0.1, 0.2], [0.3, 0.4]],
    color: '#ff0000',
    width: 3,
    clientId: 'test-client',
    ...overrides,
  };
}

function makeSyncManager(): SyncManager {
  return {
    addStroke: vi.fn(),
    clearLiveStroke: vi.fn(),
    updateLiveStroke: vi.fn(),
  } as unknown as SyncManager;
}

describe('WhiteboardSync', () => {
  let sync: SyncManager;
  let target: EventTarget;
  let wbSync: WhiteboardSync;

  beforeEach(() => {
    sync = makeSyncManager();
    target = new EventTarget();
    wbSync = new WhiteboardSync(sync, target);
  });

  it('uses document as default event target', () => {
    const defaultSync = new WhiteboardSync(sync);
    // Just verify it constructs without error
    expect(defaultSync).toBeInstanceOf(WhiteboardSync);
  });

  it('does not forward events before activate()', () => {
    const stroke = makeStroke();
    target.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', { detail: stroke }));
    expect(sync.addStroke).not.toHaveBeenCalled();
  });

  it('forwards completed stroke to syncManager.addStroke on activate', () => {
    wbSync.activate();
    const stroke = makeStroke();
    target.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', { detail: stroke }));
    expect(sync.clearLiveStroke).toHaveBeenCalledOnce();
    expect(sync.addStroke).toHaveBeenCalledOnce();
    expect(sync.addStroke).toHaveBeenCalledWith(stroke);
  });

  it('forwards in-progress stroke to syncManager.updateLiveStroke', () => {
    wbSync.activate();
    const stroke = makeStroke({ id: 'live-1' });
    target.dispatchEvent(new CustomEvent('geek:whiteboard:stroke-progress', { detail: stroke }));
    expect(sync.updateLiveStroke).toHaveBeenCalledOnce();
    expect(sync.updateLiveStroke).toHaveBeenCalledWith(stroke);
  });

  it('stops forwarding events after deactivate()', () => {
    wbSync.activate();
    wbSync.deactivate();
    const stroke = makeStroke();
    target.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', { detail: stroke }));
    expect(sync.addStroke).not.toHaveBeenCalled();
  });

  it('stops forwarding progress events after deactivate()', () => {
    wbSync.activate();
    wbSync.deactivate();
    target.dispatchEvent(
      new CustomEvent('geek:whiteboard:stroke-progress', { detail: makeStroke() }),
    );
    expect(sync.updateLiveStroke).not.toHaveBeenCalled();
  });

  it('can be reactivated after deactivate', () => {
    wbSync.activate();
    wbSync.deactivate();
    wbSync.activate();
    const stroke = makeStroke({ id: 'reactivated' });
    target.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', { detail: stroke }));
    expect(sync.addStroke).toHaveBeenCalledOnce();
    expect(sync.addStroke).toHaveBeenCalledWith(stroke);
  });

  it('clears live stroke before adding finalized stroke', () => {
    const callOrder: string[] = [];
    vi.mocked(sync.clearLiveStroke).mockImplementation(() => { callOrder.push('clear'); });
    vi.mocked(sync.addStroke).mockImplementation(() => { callOrder.push('add'); });

    wbSync.activate();
    target.dispatchEvent(
      new CustomEvent('geek:whiteboard:stroke', { detail: makeStroke() }),
    );
    expect(callOrder).toEqual(['clear', 'add']);
  });
});
