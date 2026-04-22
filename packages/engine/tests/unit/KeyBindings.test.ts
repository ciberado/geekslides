// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyBindings } from '../../src/input/KeyBindings.ts';
import { CommandSystem } from '../../src/input/CommandSystem.ts';

describe('KeyBindings', () => {
  let cs: CommandSystem;
  let kb: KeyBindings;

  beforeEach(() => {
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

  it('pressing Escape transitions to TERMINAL mode', () => {
    const terminalSpy = vi.fn();
    kb.onTerminalToggle(terminalSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(kb.mode).toBe('terminal');
    expect(terminalSpy).toHaveBeenCalledOnce();
  });

  it('pressing Escape again in TERMINAL mode returns to NORMAL mode', () => {
    const terminalSpy = vi.fn();
    kb.onTerminalToggle(terminalSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(kb.mode).toBe('terminal');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(kb.mode).toBe('normal');
    expect(terminalSpy).toHaveBeenCalledTimes(2);
  });

  it('in TERMINAL mode, direct keys are not handled', () => {
    const spy = vi.spyOn(cs, 'execute');

    // Enter terminal mode
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(kb.mode).toBe('terminal');

    // Arrow keys should NOT be handled (terminal captures them)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    // Only the initial Escape call should be absent from execute (Escape toggles terminal, not a command)
    expect(spy).not.toHaveBeenCalled();
  });

  it('closeTerminal returns to NORMAL mode', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(kb.mode).toBe('terminal');

    kb.closeTerminal();
    expect(kb.mode).toBe('normal');
  });

  it('ignores events on input elements', () => {
    const spy = vi.spyOn(cs, 'execute');

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
    }));

    // Create event with input target manually
    const inputEl = { tagName: 'INPUT' } as HTMLElement;
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(event, 'target', { value: inputEl });
    document.dispatchEvent(event);

    // First call should have happened (no input target)
    // Second call should be ignored (input target)
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('? key triggers shortcuts toggle callback', () => {
    const toggleSpy = vi.fn();
    kb.onShortcutsToggle(toggleSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(toggleSpy).toHaveBeenCalledOnce();
  });
});
