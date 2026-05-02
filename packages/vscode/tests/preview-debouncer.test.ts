import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewDebouncer } from '../src/preview/preview-debouncer.ts';

describe('PreviewDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('delays execution by specified delay', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn, { delay: 150 });

    debouncer.call('arg1', 'arg2');

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(149);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels previous call when called again', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn, { delay: 150 });

    debouncer.call('first');
    vi.advanceTimersByTime(100);

    debouncer.call('second');
    vi.advanceTimersByTime(149);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('executes only the last call in rapid succession', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn, { delay: 150 });

    debouncer.call('call1');
    vi.advanceTimersByTime(50);
    debouncer.call('call2');
    vi.advanceTimersByTime(50);
    debouncer.call('call3');

    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledWith('call3');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('handles explicit cancel', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn, { delay: 150 });

    debouncer.call('arg');
    vi.advanceTimersByTime(100);

    debouncer.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it('tracks pending state correctly', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn, { delay: 150 });

    expect(debouncer.pending).toBe(false);

    debouncer.call('arg');
    expect(debouncer.pending).toBe(true);

    vi.advanceTimersByTime(150);
    expect(debouncer.pending).toBe(false);
  });

  it('resets pending state after cancel', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn, { delay: 150 });

    debouncer.call('arg');
    expect(debouncer.pending).toBe(true);

    debouncer.cancel();
    expect(debouncer.pending).toBe(false);
  });

  it('uses default delay if not specified', () => {
    const fn = vi.fn();
    const debouncer = new PreviewDebouncer(fn);

    debouncer.call();
    vi.advanceTimersByTime(149);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalled();
  });

  it('accepts custom setTimeout/clearTimeout', () => {
    const fn = vi.fn();
    const customSetTimeout = vi.fn((cb, delay) => setTimeout(cb, delay));
    const customClearTimeout = vi.fn(clearTimeout);

    const debouncer = new PreviewDebouncer(fn, {
      delay: 150,
      setTimeoutFn: customSetTimeout as typeof setTimeout,
      clearTimeoutFn: customClearTimeout as typeof clearTimeout,
    });

    debouncer.call('arg');
    expect(customSetTimeout).toHaveBeenCalledWith(expect.any(Function), 150);

    debouncer.cancel();
    expect(customClearTimeout).toHaveBeenCalled();
  });
});
