import { describe, it, expect, vi } from 'vitest';
import { CommandSystem } from '../../src/input/CommandSystem.ts';

describe('CommandSystem', () => {
  it('registers and executes commands', () => {
    const cs = new CommandSystem();
    const fn = vi.fn();

    cs.register({ name: 'test', label: 'Test Command', execute: fn });
    cs.execute('test');

    expect(fn).toHaveBeenCalledOnce();
  });

  it('warns on unknown command', () => {
    const cs = new CommandSystem();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* noop */ });

    cs.execute('nonexistent');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    warnSpy.mockRestore();
  });

  it('searches by label and name (case-insensitive)', () => {
    const cs = new CommandSystem();
    const noop = (): void => { /* noop */ };

    cs.register({ name: 'go-next', label: 'Next Slide', execute: noop });
    cs.register({ name: 'go-prev', label: 'Previous Slide', execute: noop });
    cs.register({ name: 'toggle-sync', label: 'Toggle Sync', execute: noop });

    const results = cs.search('slide');
    expect(results).toHaveLength(2);

    const byName = cs.search('toggle');
    expect(byName).toHaveLength(1);
    expect(byName[0]?.name).toBe('toggle-sync');
  });

  it('returns all commands', () => {
    const cs = new CommandSystem();
    const noop = (): void => { /* noop */ };

    cs.register({ name: 'a', label: 'A', execute: noop });
    cs.register({ name: 'b', label: 'B', execute: noop });

    expect(cs.all()).toHaveLength(2);
  });
});
