import { describe, it, expect, vi } from 'vitest';
import { SpeakerTimer } from '../../src/components/SpeakerTimer.ts';

describe('SpeakerTimer', () => {
  it('format() returns HH:MM:SS', () => {
    expect(SpeakerTimer.format(0)).toBe('00:00:00');
    expect(SpeakerTimer.format(5_000)).toBe('00:00:05');
    expect(SpeakerTimer.format(65_000)).toBe('00:01:05');
    expect(SpeakerTimer.format(3_661_000)).toBe('01:01:01');
  });

  it('reset() calls callback with 00:00:00', () => {
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const cb = vi.fn();
    const timer = new SpeakerTimer(cb);
    timer.reset();
    expect(cb).toHaveBeenCalledWith('00:00:00');
    vi.unstubAllGlobals();
  });

  it('running property reflects state', () => {
    const timer = new SpeakerTimer(() => {});

    expect(timer.running).toBe(false);

    // start() requires rAF — just test the flag via the public getter
    // In a Node env without rAF, start() would throw, so we mock it
    const rafMock = vi.fn().mockReturnValue(1);
    vi.stubGlobal('requestAnimationFrame', rafMock);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('performance', { now: () => 1000 });

    timer.start();
    expect(timer.running).toBe(true);

    timer.pause();
    expect(timer.running).toBe(false);

    vi.unstubAllGlobals();
  });

  it('start() is idempotent when already running', () => {
    const rafMock = vi.fn().mockReturnValue(1);
    vi.stubGlobal('requestAnimationFrame', rafMock);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('performance', { now: () => 1000 });

    const timer = new SpeakerTimer(() => {});
    timer.start();
    timer.start(); // second call should be no-op
    expect(rafMock).toHaveBeenCalledTimes(1);

    timer.reset();
    vi.unstubAllGlobals();
  });
});
