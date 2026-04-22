// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TouchInput } from '../../src/input/TouchInput.ts';
import { CommandSystem } from '../../src/input/CommandSystem.ts';

/**
 * Create a mock TouchEvent with start/end points.
 */
function createTouchEvent(type: string, clientX: number, clientY: number): TouchEvent {
  const touch = { clientX, clientY, identifier: 0, target: null };
  return new TouchEvent(type, {
    touches: type === 'touchstart' ? [touch as unknown as Touch] : [],
    changedTouches: [touch as unknown as Touch],
  });
}

function getHandlers(target: HTMLElement): {
  startHandler: (e: TouchEvent) => void;
  endHandler: (e: TouchEvent) => void;
} {
  const addCalls = (target.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
  const startHandler = addCalls.find((c: unknown[]) => c[0] === 'touchstart')?.[1] as (e: TouchEvent) => void;
  const endHandler = addCalls.find((c: unknown[]) => c[0] === 'touchend')?.[1] as (e: TouchEvent) => void;
  return { startHandler, endHandler };
}

describe('TouchInput', () => {
  let cs: CommandSystem;
  let target: HTMLElement;
  let ti: TouchInput;

  beforeEach(() => {
    vi.useFakeTimers();
    cs = new CommandSystem();
    const noop = (): void => { /* noop */ };
    cs.register({ name: 'next', label: 'Next', execute: noop });
    cs.register({ name: 'prev', label: 'Prev', execute: noop });
    cs.register({ name: 'overview', label: 'Overview', execute: noop });
    cs.register({ name: 'toggle-toolbar', label: 'Toolbar', execute: noop });

    // Mock HTMLElement
    target = {
      clientWidth: 1000,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
  });

  afterEach(() => {
    ti.deactivate();
    vi.useRealTimers();
  });

  describe('swipe gestures', () => {
    beforeEach(() => {
      ti = new TouchInput(cs, target);
      ti.activate();
    });

    it('horizontal swipe left triggers next', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      startHandler(createTouchEvent('touchstart', 500, 300));
      vi.advanceTimersByTime(100);
      endHandler(createTouchEvent('touchend', 400, 300));

      expect(spy).toHaveBeenCalledWith('next');
    });

    it('horizontal swipe right triggers prev', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      startHandler(createTouchEvent('touchstart', 400, 300));
      vi.advanceTimersByTime(100);
      endHandler(createTouchEvent('touchend', 500, 300));

      expect(spy).toHaveBeenCalledWith('prev');
    });
  });

  describe('tap zones (default ratio 0.25)', () => {
    beforeEach(() => {
      ti = new TouchInput(cs, target);
      ti.activate();
    });

    it('tap in right 25% triggers next', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=800 is in the right 25% zone (> 750 = 1000 * 0.75)
      startHandler(createTouchEvent('touchstart', 800, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 800, 300));

      expect(spy).toHaveBeenCalledWith('next');
    });

    it('tap in left 25% triggers prev', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=200 is in the left 25% zone (< 250 = 1000 * 0.25)
      startHandler(createTouchEvent('touchstart', 200, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 200, 300));

      expect(spy).toHaveBeenCalledWith('prev');
    });

    it('tap in centre dead zone fires no command', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=500 is in the centre zone (250..750)
      startHandler(createTouchEvent('touchstart', 500, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 500, 300));

      expect(spy).not.toHaveBeenCalled();
    });

    it('tap at exact boundary of prev zone triggers prev', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=249 is just inside the left 25% zone (< 250)
      startHandler(createTouchEvent('touchstart', 249, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 249, 300));

      expect(spy).toHaveBeenCalledWith('prev');
    });

    it('tap at exact boundary of next zone triggers next', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=751 is just inside the right 25% zone (> 750)
      startHandler(createTouchEvent('touchstart', 751, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 751, 300));

      expect(spy).toHaveBeenCalledWith('next');
    });
  });

  describe('custom tap zone ratio', () => {
    it('respects custom tapZoneRatio', () => {
      // 0.4 ratio → left 40% = prev, right 40% = next, centre 20% = dead zone
      ti = new TouchInput(cs, target, { tapZoneRatio: 0.4 });
      ti.activate();

      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=350 is in the left 40% zone (< 400 = 1000 * 0.4)
      startHandler(createTouchEvent('touchstart', 350, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 350, 300));

      expect(spy).toHaveBeenCalledWith('prev');
    });

    it('centre dead zone scales with custom ratio', () => {
      // 0.4 ratio → centre zone is 400..600
      ti = new TouchInput(cs, target, { tapZoneRatio: 0.4 });
      ti.activate();

      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=500 is in the centre dead zone (400..600)
      startHandler(createTouchEvent('touchstart', 500, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 500, 300));

      expect(spy).not.toHaveBeenCalled();
    });

    it('custom ratio right zone works', () => {
      ti = new TouchInput(cs, target, { tapZoneRatio: 0.4 });
      ti.activate();

      const spy = vi.spyOn(cs, 'execute');
      const { startHandler, endHandler } = getHandlers(target);

      // x=650 is in the right 40% zone (> 600 = 1000 * 0.6)
      startHandler(createTouchEvent('touchstart', 650, 300));
      vi.advanceTimersByTime(50);
      endHandler(createTouchEvent('touchend', 650, 300));

      expect(spy).toHaveBeenCalledWith('next');
    });
  });

  describe('long press', () => {
    beforeEach(() => {
      ti = new TouchInput(cs, target);
      ti.activate();
    });

    it('long press triggers toggle-toolbar', () => {
      const spy = vi.spyOn(cs, 'execute');
      const { startHandler } = getHandlers(target);

      startHandler(createTouchEvent('touchstart', 500, 300));
      vi.advanceTimersByTime(500);

      expect(spy).toHaveBeenCalledWith('toggle-toolbar');
    });
  });
});
