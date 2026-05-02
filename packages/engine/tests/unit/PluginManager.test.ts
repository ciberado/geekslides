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

  it('composes line mappings across preprocessors', () => {
    const pm = new PluginManager();

    pm.register({
      name: 'test',
      preprocessors: [
        (markdown) => ({
          content: `[](#intro)\n\n${markdown}`,
          lineMapping: [1, 1, 1],
        }),
      ],
    });

    const result = pm.preprocessWithLineMapping('# Intro', DEFAULT_CONFIG);

    expect(result.content).toContain('[](#intro)');
    expect(result.lineMapping).toEqual([1, 1, 1]);
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

  it('wraps preprocessor errors with plugin name and preserves root cause', () => {
    const pm = new PluginManager();
    const rootError = new Error('syntax error at line 3');

    pm.register({
      name: 'broken-pre',
      preprocessors: [() => { throw rootError; }],
    });

    let thrown: unknown;
    try {
      pm.preprocess('# Hello', DEFAULT_CONFIG);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toContain('broken-pre');
    expect(error.message).toContain('Preprocessor');
    // Root cause must be preserved — not swallowed
    expect(error.cause).toBe(rootError);
  });

  it('includes a snippet of the input markdown in the preprocessor error', () => {
    const pm = new PluginManager();

    pm.register({
      name: 'crasher',
      preprocessors: [() => { throw new Error('boom'); }],
    });

    let thrown: unknown;
    try {
      pm.preprocess('# Title\n\nSome content here', DEFAULT_CONFIG);
    } catch (err) {
      thrown = err;
    }

    const error = thrown as Error;
    // The snippet should appear in the wrapper message to aid diagnosis
    expect(error.message).toContain('# Title');
  });

  it('wraps processor errors with plugin name, slide index and preserves root cause', () => {
    const pm = new PluginManager();
    const rootError = new TypeError('unexpected null element');

    pm.register({
      name: 'broken-proc',
      processors: [() => { throw rootError; }],
    });

    const ctx = {
      slideIndex: 4,
      slideCount: 10,
      config: DEFAULT_CONFIG,
      slideshow: {} as HTMLElement,
    };

    let thrown: unknown;
    try {
      pm.process({} as HTMLElement, ctx);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toContain('broken-proc');
    expect(error.message).toContain('5'); // slideIndex 4 displayed as "slide 5 of 10"
    expect(error.message).toContain('10');
    // Root cause preserved
    expect(error.cause).toBe(rootError);
  });
});
