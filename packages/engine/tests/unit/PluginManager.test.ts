import { describe, it, expect } from 'vitest';
import { PluginManager } from '../../src/plugins/PluginManager.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import type { Plugin } from '../../src/plugins/types.ts';

describe('PluginManager', () => {
  it('runs preprocessors in sequence', () => {
    const pm = new PluginManager();

    const plugin: Plugin = {
      name: 'test',
      preprocessors: [
        (md) => md + '\n---first---',
        (md) => md + '\n---second---',
      ],
    };

    pm.register(plugin);
    const result = pm.preprocess('input', DEFAULT_CONFIG);
    expect(result).toBe('input\n---first---\n---second---');
  });

  it('runs processors on slide elements', () => {
    const pm = new PluginManager();
    const calls: number[] = [];

    const plugin: Plugin = {
      name: 'test',
      processors: [
        (_el, ctx) => { calls.push(ctx.slideIndex); },
      ],
    };

    pm.register(plugin);

    const mockElement = {} as HTMLElement;
    const ctx = {
      slideIndex: 3,
      slideCount: 10,
      config: DEFAULT_CONFIG,
      slideshow: {} as HTMLElement,
    };

    pm.process(mockElement, ctx);
    expect(calls).toEqual([3]);
  });

  it('registers empty plugins without error', () => {
    const pm = new PluginManager();
    const plugin: Plugin = { name: 'empty' };

    pm.register(plugin);
    const listed = pm.list();
    expect(listed.preprocessors).toEqual([]);
    expect(listed.processors).toEqual([]);
  });

  it('lists registered plugin names', () => {
    const pm = new PluginManager();

    pm.register({
      name: 'alpha',
      preprocessors: [(md) => md],
    });

    pm.register({
      name: 'beta',
      processors: [() => { /* noop */ }],
    });

    const listed = pm.list();
    expect(listed.preprocessors).toEqual(['alpha']);
    expect(listed.processors).toEqual(['beta']);
  });
});
