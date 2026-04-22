// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureManager } from '../../src/features/FeatureManager.ts';
import type { Feature } from '../../src/features/types.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';

// Mock logger
vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  }),
}));

// Minimal Slideshow stub
function makeSlideshow(overrides: Partial<{
  currentSlide: number;
  currentPartial: number;
  slideCount: number;
  mode: string;
}> = {}): {
  currentSlide: number;
  currentPartial: number;
  slideCount: number;
  mode: string;
  goTo: ReturnType<typeof vi.fn>;
  next: ReturnType<typeof vi.fn>;
  prev: ReturnType<typeof vi.fn>;
} {
  return {
    currentSlide: overrides.currentSlide ?? 0,
    currentPartial: overrides.currentPartial ?? 0,
    slideCount: overrides.slideCount ?? 5,
    mode: overrides.mode ?? 'present',
    goTo: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
  };
}

function makeCommandSystem(): { register: ReturnType<typeof vi.fn> } {
  return { register: vi.fn() };
}

function makeOutput(): { show: ReturnType<typeof vi.fn> } {
  return { show: vi.fn() };
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeManager(overrides: { slideshow?: ReturnType<typeof makeSlideshow> } = {}): FeatureManager {
  return new FeatureManager({
    slideshow: (overrides.slideshow ?? makeSlideshow()) as never,
    commands: makeCommandSystem() as never,
    sync: null,
    config: DEFAULT_CONFIG,
    role: 'presenter',
    featuresContainer: makeContainer(),
    output: makeOutput(),
  });
}

describe('FeatureManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers and activates a feature', () => {
    const activate = vi.fn().mockReturnValue(undefined);
    const feature: Feature = { id: 'test', label: 'Test', activate };

    const manager = makeManager();
    manager.register(feature);

    expect(activate).toHaveBeenCalledOnce();
    expect(manager.list()).toContain('test');
  });

  it('calls cleanup when unregistering', () => {
    const cleanup = vi.fn();
    const feature: Feature = { id: 'cleanup-test', label: 'Cleanup Test', activate: () => cleanup };

    const manager = makeManager();
    manager.register(feature);
    manager.unregister('cleanup-test');

    expect(cleanup).toHaveBeenCalledOnce();
    expect(manager.list()).not.toContain('cleanup-test');
  });

  it('calls feature.deactivate() before cleanup', () => {
    const order: string[] = [];
    const feature: Feature = {
      id: 'deactivate-test',
      label: 'Deactivate Test',
      activate: () => () => { order.push('cleanup'); },
      deactivate: () => { order.push('deactivate'); },
    };

    const manager = makeManager();
    manager.register(feature);
    manager.unregister('deactivate-test');

    expect(order).toEqual(['deactivate', 'cleanup']);
  });

  it('skips duplicate registration', () => {
    const activate = vi.fn().mockReturnValue(undefined);
    const feature: Feature = { id: 'dup', label: 'Dup', activate };

    const manager = makeManager();
    manager.register(feature);
    manager.register(feature);

    expect(activate).toHaveBeenCalledOnce();
  });

  it('dispatches lifecycle events to active features', () => {
    const handler = vi.fn();
    const feature: Feature = {
      id: 'events-test',
      label: 'Events Test',
      activate: (ctx) => {
        ctx.on('slide:enter', handler);
      },
    };

    const manager = makeManager();
    manager.register(feature);
    manager.emit('slide:enter', { slideIndex: 3, previousIndex: 2 });

    expect(handler).toHaveBeenCalledWith({ slideIndex: 3, previousIndex: 2 });
  });

  it('does not dispatch events after unregistration', () => {
    const handler = vi.fn();
    const feature: Feature = {
      id: 'unreg-events',
      label: 'Unreg Events',
      activate: (ctx) => {
        ctx.on('slide:enter', handler);
      },
    };

    const manager = makeManager();
    manager.register(feature);
    manager.unregister('unreg-events');
    manager.emit('slide:enter', { slideIndex: 1, previousIndex: 0 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('on() unsubscribe stops receiving events', () => {
    const handler = vi.fn();
    const feature: Feature = {
      id: 'unsub-test',
      label: 'Unsub Test',
      activate: (ctx) => {
        const unsub = ctx.on('slide:enter', handler);
        unsub(); // unsubscribe immediately
      },
    };

    const manager = makeManager();
    manager.register(feature);
    manager.emit('slide:enter', { slideIndex: 1, previousIndex: 0 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('deactivateAll() removes all features', () => {
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    const featureA: Feature = { id: 'a', label: 'A', activate: () => cleanupA };
    const featureB: Feature = { id: 'b', label: 'B', activate: () => cleanupB };

    const manager = makeManager();
    manager.register(featureA);
    manager.register(featureB);
    manager.deactivateAll();

    expect(manager.list()).toHaveLength(0);
    expect(cleanupA).toHaveBeenCalledOnce();
    expect(cleanupB).toHaveBeenCalledOnce();
  });

  it('context.role reflects the configured role', () => {
    let observedRole: string | undefined;
    const feature: Feature = {
      id: 'role-test',
      label: 'Role Test',
      activate: (ctx) => { observedRole = ctx.role; },
    };

    const manager = new FeatureManager({
      slideshow: makeSlideshow() as never,
      commands: makeCommandSystem() as never,
      sync: null,
      config: DEFAULT_CONFIG,
      role: 'viewer',
      featuresContainer: makeContainer(),
      output: makeOutput(),
    });
    manager.register(feature);

    expect(observedRole).toBe('viewer');
  });

  it('context.slideshow proxies live slideshow state', () => {
    const slideshow = makeSlideshow({ currentSlide: 2, slideCount: 10 });
    let ctx2: { currentSlide: number; slideCount: number } | undefined;

    const feature: Feature = {
      id: 'slideshow-test',
      label: 'Slideshow Test',
      activate: (ctx) => { ctx2 = ctx.slideshow; },
    };

    const manager = new FeatureManager({
      slideshow: slideshow as never,
      commands: makeCommandSystem() as never,
      sync: null,
      config: DEFAULT_CONFIG,
      role: 'presenter',
      featuresContainer: makeContainer(),
      output: makeOutput(),
    });
    manager.register(feature);

    expect(ctx2?.currentSlide).toBe(2);
    expect(ctx2?.slideCount).toBe(10);

    slideshow.currentSlide = 5;
    expect(ctx2?.currentSlide).toBe(5);
  });

  it('context.commands.register delegates to CommandSystem', () => {
    const commands = makeCommandSystem();
    let registeredCmd: unknown;
    const feature: Feature = {
      id: 'cmd-test',
      label: 'Cmd Test',
      activate: (ctx) => {
        ctx.commands.register({ name: 'foo', label: 'Foo', execute: () => { /* noop */ } });
      },
    };

    const manager = new FeatureManager({
      slideshow: makeSlideshow() as never,
      commands: commands as never,
      sync: null,
      config: DEFAULT_CONFIG,
      role: 'presenter',
      featuresContainer: makeContainer(),
      output: makeOutput(),
    });
    manager.register(feature);

    expect(commands.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'foo', label: 'Foo' }),
    );
    void registeredCmd;
  });

  it('context.output.show delegates to the output helper', () => {
    const output = makeOutput();
    const feature: Feature = {
      id: 'output-test',
      label: 'Output Test',
      activate: (ctx) => { ctx.output.show('hello'); },
    };

    const manager = new FeatureManager({
      slideshow: makeSlideshow() as never,
      commands: makeCommandSystem() as never,
      sync: null,
      config: DEFAULT_CONFIG,
      role: 'presenter',
      featuresContainer: makeContainer(),
      output,
    });
    manager.register(feature);

    expect(output.show).toHaveBeenCalledWith('hello');
  });

  it('isolates event listeners between features', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    const featureA: Feature = {
      id: 'iso-a',
      label: 'Iso A',
      activate: (ctx) => { ctx.on('presentation:ready', handlerA); },
    };
    const featureB: Feature = {
      id: 'iso-b',
      label: 'Iso B',
      activate: (ctx) => { ctx.on('presentation:ready', handlerB); },
    };

    const manager = makeManager();
    manager.register(featureA);
    manager.register(featureB);

    manager.emit('presentation:ready', { slideCount: 10 });

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).toHaveBeenCalledOnce();

    manager.unregister('iso-a');
    manager.emit('presentation:ready', { slideCount: 10 });

    expect(handlerA).toHaveBeenCalledOnce(); // not called again
    expect(handlerB).toHaveBeenCalledTimes(2);
  });

  it('container is removed from DOM on unregister', () => {
    const parent = makeContainer();
    parent.id = 'features-root';

    const feature: Feature = { id: 'dom-test', label: 'DOM Test', activate: () => undefined };

    const manager = new FeatureManager({
      slideshow: makeSlideshow() as never,
      commands: makeCommandSystem() as never,
      sync: null,
      config: DEFAULT_CONFIG,
      role: 'presenter',
      featuresContainer: parent,
      output: makeOutput(),
    });

    manager.register(feature);
    expect(parent.querySelector('[data-feature="dom-test"]')).not.toBeNull();

    manager.unregister('dom-test');
    expect(parent.querySelector('[data-feature="dom-test"]')).toBeNull();
  });
});
