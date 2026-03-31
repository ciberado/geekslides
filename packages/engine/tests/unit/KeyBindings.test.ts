// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyBindings } from '../../src/input/KeyBindings.ts';
import { CommandSystem } from '../../src/input/CommandSystem.ts';

describe('KeyBindings', () => {
  let cs: CommandSystem;
  let kb: KeyBindings;

  beforeEach(() => {
    vi.useFakeTimers();
    cs = new CommandSystem();
    kb = new KeyBindings(cs, document);
    kb.activate();

    // Register some commands
    const noop = (): void => { /* noop */ };
    cs.register({ name: 'next', label: 'Next', execute: noop });
    cs.register({ name: 'prev', label: 'Prev', execute: noop });
    cs.register({ name: 'go-first', label: 'First', execute: noop });
    cs.register({ name: 'go-last', label: 'Last', execute: noop });
    cs.register({ name: 'toggle-speaker', label: 'Speaker', execute: noop });
    cs.register({ name: 'toggle-overview', label: 'Overview', execute: noop });
  });

  afterEach(() => {
    kb.deactivate();
    vi.useRealTimers();
  });

  it('direct keys execute immediately in NORMAL mode', () => {
    const spy = vi.spyOn(cs, 'execute');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(spy).toHaveBeenCalledWith('next');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(spy).toHaveBeenCalledWith('prev');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(spy).toHaveBeenCalledWith('go-first');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(spy).toHaveBeenCalledWith('go-last');
  });

  it('Ctrl+B transitions to PREFIX mode', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    expect(kb.mode).toBe('prefix');
  });

  it('follow-up key in PREFIX mode executes command and returns to NORMAL', () => {
    const spy = vi.spyOn(cs, 'execute');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    expect(kb.mode).toBe('prefix');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(spy).toHaveBeenCalledWith('toggle-speaker');
    expect(kb.mode).toBe('normal');
  });

  it('timeout in PREFIX mode returns to NORMAL', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    expect(kb.mode).toBe('prefix');

    vi.advanceTimersByTime(1500);
    expect(kb.mode).toBe('normal');
  });

  it(': opens palette mode', () => {
    const paletteSpy = vi.fn();
    kb.onPaletteOpen(paletteSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: ':' }));
    expect(kb.mode).toBe('palette');
    expect(paletteSpy).toHaveBeenCalledOnce();
  });

  it('ignores events on input elements', () => {
    const spy = vi.spyOn(cs, 'execute');

    const inputEl = { tagName: 'INPUT' } as HTMLElement;
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
    }));

    // Create event with input target manually
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(event, 'target', { value: inputEl });
    document.dispatchEvent(event);

    // First call should have happened (no input target)
    // Second call should be ignored (input target)
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
