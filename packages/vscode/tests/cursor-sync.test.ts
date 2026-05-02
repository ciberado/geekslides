import { afterEach, describe, expect, it, vi } from 'vitest';
import { CursorSyncController } from '../src/sync/cursor-sync.ts';

describe('CursorSyncController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces editor selection changes and publishes the mapped slide', async () => {
    vi.useFakeTimers();
    const setSlide = vi.fn();
    const refreshSlideMap = vi.fn().mockResolvedValue(undefined);
    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 300,
      refreshSlideMap,
      getSlideForLine: () => 2,
      getLineForSlide: () => undefined,
      setSlide,
      onRemoteSlideChange: () => () => {},
      moveCursorToLine: vi.fn(),
    });

    controller.onSelectionChange('/repo/README.md', 10);
    controller.onSelectionChange('/repo/README.md', 11);
    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    expect(refreshSlideMap).toHaveBeenCalledTimes(1);
    expect(setSlide).toHaveBeenCalledWith(2, 0);
  });

  it('ignores remote slide changes during the cooldown window', async () => {
    vi.useFakeTimers();
    const moveCursorToLine = vi.fn();
    let remoteListener: ((slideIndex: number) => void) | undefined;
    let currentTime = 0;

    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 10,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => 1,
      getLineForSlide: () => 12,
      setSlide: vi.fn(),
      onRemoteSlideChange: (listener) => {
        remoteListener = listener;
        return () => {
          remoteListener = undefined;
        };
      },
      moveCursorToLine,
      now: () => currentTime,
      setTimeoutFn: setTimeout,
      clearTimeoutFn: clearTimeout,
    });

    controller.start();
    controller.onSelectionChange('/repo/README.md', 2);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();

    remoteListener?.(1);
    expect(moveCursorToLine).not.toHaveBeenCalled();

    currentTime = 1000;
    remoteListener?.(1);
    await Promise.resolve();

    expect(moveCursorToLine).toHaveBeenCalledWith(12);
  });

  it('does nothing for unrelated documents', async () => {
    vi.useFakeTimers();
    const setSlide = vi.fn();
    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 50,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => 0,
      getLineForSlide: () => undefined,
      setSlide,
      onRemoteSlideChange: () => () => {},
      moveCursorToLine: vi.fn(),
    });

    controller.onSelectionChange('/repo/other.md', 4);
    vi.advanceTimersByTime(50);
    await vi.runAllTimersAsync();

    expect(setSlide).not.toHaveBeenCalled();
  });

  it('does not re-publish when the slide has not changed', async () => {
    vi.useFakeTimers();
    const setSlide = vi.fn();
    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 10,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => 0,
      getLineForSlide: () => undefined,
      setSlide,
      onRemoteSlideChange: () => () => {},
      moveCursorToLine: vi.fn(),
    });

    // First selection change → publishes slide 0
    controller.onSelectionChange('/repo/README.md', 1);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();
    expect(setSlide).toHaveBeenCalledTimes(1);

    // Second selection change, same slide → should not re-publish
    controller.onSelectionChange('/repo/README.md', 2);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();
    expect(setSlide).toHaveBeenCalledTimes(1);
  });

  it('does not publish when getSlideForLine returns undefined (gap in slide map)', async () => {
    vi.useFakeTimers();
    const setSlide = vi.fn();
    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 10,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => undefined,
      getLineForSlide: () => undefined,
      setSlide,
      onRemoteSlideChange: () => () => {},
      moveCursorToLine: vi.fn(),
    });

    controller.onSelectionChange('/repo/README.md', 5);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();

    expect(setSlide).not.toHaveBeenCalled();
  });

  it('does not move cursor when getLineForSlide returns undefined (stale map)', async () => {
    const moveCursorToLine = vi.fn();
    let remoteListener: ((slideIndex: number) => void) | undefined;

    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 10,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => undefined,
      getLineForSlide: () => undefined,
      setSlide: vi.fn(),
      onRemoteSlideChange: (listener) => {
        remoteListener = listener;
        return () => {
          remoteListener = undefined;
        };
      },
      moveCursorToLine,
    });

    controller.start();
    // Remote says go to slide 5, but we have no mapping for it
    remoteListener?.(5);
    await Promise.resolve();

    expect(moveCursorToLine).not.toHaveBeenCalled();
  });

  it('toggle disables and re-enables sync', async () => {
    vi.useFakeTimers();
    const setSlide = vi.fn();
    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 10,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => 1,
      getLineForSlide: () => undefined,
      setSlide,
      onRemoteSlideChange: () => () => {},
      moveCursorToLine: vi.fn(),
    });

    // Disable sync
    const enabled = controller.toggle();
    expect(enabled).toBe(false);

    controller.onSelectionChange('/repo/README.md', 5);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();
    expect(setSlide).not.toHaveBeenCalled();

    // Re-enable sync
    const reEnabled = controller.toggle();
    expect(reEnabled).toBe(true);

    controller.onSelectionChange('/repo/README.md', 5);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();
    expect(setSlide).toHaveBeenCalledWith(1, 0);
  });

  it('stop cancels pending debounce timer', async () => {
    vi.useFakeTimers();
    const setSlide = vi.fn();
    const controller = new CursorSyncController({
      deckContentPath: '/repo/README.md',
      debounceMs: 100,
      refreshSlideMap: vi.fn().mockResolvedValue(undefined),
      getSlideForLine: () => 0,
      getLineForSlide: () => undefined,
      setSlide,
      onRemoteSlideChange: () => () => {},
      moveCursorToLine: vi.fn(),
    });

    controller.onSelectionChange('/repo/README.md', 1);
    // Stop before the debounce fires
    controller.stop();
    vi.advanceTimersByTime(200);
    await vi.runAllTimersAsync();

    expect(setSlide).not.toHaveBeenCalled();
  });
});
