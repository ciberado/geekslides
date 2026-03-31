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
    cs.register({ name: 'toggle-overview', label: 'Overview', execute: noop });
    cs.register({ name: 'toggle-toolbar', label: 'Toolbar', execute: noop });

    // Mock HTMLElement
    target = {
      clientWidth: 1000,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;

    ti = new TouchInput(cs, target);
    ti.activate();
  });

  afterEach(() => {
    ti.deactivate();
    vi.useRealTimers();
  });

  it('horizontal swipe left triggers next', () => {
    const spy = vi.spyOn(cs, 'execute');

    // Extract the handlers from addEventListener calls
    const addCalls = (target.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const startHandler = addCalls.find((c: unknown[]) => c[0] === 'touchstart')?.[1] as (e: TouchEvent) => void;
    const endHandler = addCalls.find((c: unknown[]) => c[0] === 'touchend')?.[1] as (e: TouchEvent) => void;

    startHandler(createTouchEvent('touchstart', 500, 300));
    vi.advanceTimersByTime(100);
    endHandler(createTouchEvent('touchend', 400, 300));

    expect(spy).toHaveBeenCalledWith('next');
  });

  it('horizontal swipe right triggers prev', () => {
    const spy = vi.spyOn(cs, 'execute');

    const addCalls = (target.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const startHandler = addCalls.find((c: unknown[]) => c[0] === 'touchstart')?.[1] as (e: TouchEvent) => void;
    const endHandler = addCalls.find((c: unknown[]) => c[0] === 'touchend')?.[1] as (e: TouchEvent) => void;

    startHandler(createTouchEvent('touchstart', 400, 300));
    vi.advanceTimersByTime(100);
    endHandler(createTouchEvent('touchend', 500, 300));

    expect(spy).toHaveBeenCalledWith('prev');
  });

  it('tap in right 2/3 triggers next', () => {
    const spy = vi.spyOn(cs, 'execute');

    const addCalls = (target.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const startHandler = addCalls.find((c: unknown[]) => c[0] === 'touchstart')?.[1] as (e: TouchEvent) => void;
    const endHandler = addCalls.find((c: unknown[]) => c[0] === 'touchend')?.[1] as (e: TouchEvent) => void;

    startHandler(createTouchEvent('touchstart', 700, 300));
    vi.advanceTimersByTime(50);
    endHandler(createTouchEvent('touchend', 700, 300));

    expect(spy).toHaveBeenCalledWith('next');
  });

  it('tap in left 1/3 triggers prev', () => {
    const spy = vi.spyOn(cs, 'execute');

    const addCalls = (target.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const startHandler = addCalls.find((c: unknown[]) => c[0] === 'touchstart')?.[1] as (e: TouchEvent) => void;
    const endHandler = addCalls.find((c: unknown[]) => c[0] === 'touchend')?.[1] as (e: TouchEvent) => void;

    startHandler(createTouchEvent('touchstart', 200, 300));
    vi.advanceTimersByTime(50);
    endHandler(createTouchEvent('touchend', 200, 300));

    expect(spy).toHaveBeenCalledWith('prev');
  });
});
