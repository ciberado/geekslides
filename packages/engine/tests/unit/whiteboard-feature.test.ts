// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeatureContext, FeatureSyncAPI } from '../../src/features/types.ts';
import type { WhiteboardStroke } from '../../src/sync/types.ts';

// --- Stub geek-whiteboard element ---
class StubWhiteboard extends HTMLElement {
  slideIndex = 0;
  isVisible = false;
  userDismissed = false;
  toolbarCollapsed = false;
  toggle = vi.fn(() => { this.isVisible = !this.isVisible; });
  toggleCanvas = vi.fn(() => { this.isVisible = !this.isVisible; });
  setActive = vi.fn(() => { this.isVisible = true; });
  clear = vi.fn();
  setColor = vi.fn();
  setCompositeOp = vi.fn();
  setWidth = vi.fn();
  setAlpha = vi.fn();
  beginStroke = vi.fn();
  drawRemoteStroke = vi.fn();
  // toolbar is created internally by the component (not by the feature)
  #toolbar: StubToolbar | null = null;
  get toolbar(): StubToolbar | null { return this.#toolbar; }
  readonly shadowRoot: ShadowRoot;
  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
  }
  connectedCallback(): void {
    // Create toolbar on connect if not readonly and not already created
    if (!this.hasAttribute('readonly') && !this.#toolbar) {
      this.#toolbar = document.createElement('geek-whiteboard-toolbar') as StubToolbar;
      this.shadowRoot.appendChild(this.#toolbar);
    }
  }
}

// --- Stub geek-whiteboard-toolbar element ---
class StubToolbar extends HTMLElement {
  toggleCollapse = vi.fn();
  toggleVisibility = vi.fn();
  hide = vi.fn();
  show = vi.fn();
  setTool = vi.fn();
  setColor = vi.fn();
}

if (!customElements.get('geek-whiteboard')) {
  customElements.define('geek-whiteboard', StubWhiteboard);
}
if (!customElements.get('geek-whiteboard-toolbar')) {
  customElements.define('geek-whiteboard-toolbar', StubToolbar);
}

import { activate } from '../../../../plugins/whiteboard/index.ts';

const mockApi = {
  version: 1,
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }),
};
const { features } = activate(mockApi as never);
const whiteboardFeature = features!['whiteboard']!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStroke(overrides: Partial<WhiteboardStroke> = {}): WhiteboardStroke {
  return {
    id: 'stroke-1',
    slideIndex: 0,
    points: [[0.1, 0.2]],
    color: '#000',
    width: 2,
    clientId: 'client-1',
    ...overrides,
  };
}

/** Creates a mock FeatureSyncAPI with observable Yjs-like maps/arrays. */
function makeSyncAPI(strokes: WhiteboardStroke[] = [], options?: { readonly?: boolean }): FeatureSyncAPI {
  const sharedMapData = new Map<string, unknown>();
  const sharedArrayData = [...strokes] as unknown[];
  const ephemeralMapData = new Map<string, unknown>();

  const sharedMap = {
    get: vi.fn((key: string) => sharedMapData.get(key)),
    set: vi.fn((key: string, value: unknown) => { sharedMapData.set(key, value); }),
    observe: vi.fn(),
    unobserve: vi.fn(),
  };

  const sharedArray = {
    get length() { return sharedArrayData.length; },
    get: vi.fn((i: number) => sharedArrayData[i]),
    push: vi.fn((items: unknown[]) => { sharedArrayData.push(...items); }),
    delete: vi.fn((index: number, count: number) => { sharedArrayData.splice(index, count); }),
    observe: vi.fn(),
    unobserve: vi.fn(),
    toArray: vi.fn(() => [...sharedArrayData]),
  };

  const ephemeralMap = {
    get: vi.fn((key: string) => ephemeralMapData.get(key)),
    set: vi.fn((key: string, value: unknown) => { ephemeralMapData.set(key, value); }),
    delete: vi.fn((key: string) => { ephemeralMapData.delete(key); }),
    observe: vi.fn(),
    unobserve: vi.fn(),
  };

  const mockBridge = {
    activate: vi.fn(),
    deactivate: vi.fn(),
    isActive: false,
  };

  return {
    connected: true,
    readonly: options?.readonly ?? false,
    getSharedMap: vi.fn(() => sharedMap) as unknown as FeatureSyncAPI['getSharedMap'],
    getSharedArray: vi.fn(() => sharedArray) as unknown as FeatureSyncAPI['getSharedArray'],
    getEphemeralMap: vi.fn(() => ephemeralMap) as unknown as FeatureSyncAPI['getEphemeralMap'],
    createEventBridge: vi.fn(() => mockBridge) as unknown as FeatureSyncAPI['createEventBridge'],
  };
}

type EventHandler = (payload: Record<string, unknown>) => void;

function makeContext(
  overrides: Partial<{
    role: 'presenter' | 'viewer';
    sync: FeatureSyncAPI | null;
    strokes: WhiteboardStroke[];
    currentSlide: number;
    mode: string;
  }> = {},
): { ctx: FeatureContext; container: HTMLElement; gsContainer: HTMLElement; commands: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; outputShow: ReturnType<typeof vi.fn>; handlers: Map<string, EventHandler[]> } {
  const handlers = new Map<string, EventHandler[]>();
  const commands = vi.fn();
  const outputShow = vi.fn();
  const onFn = vi.fn((event: string, handler: EventHandler) => {
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
    return vi.fn(); // unsub
  });

  // Mirror the real DOM nesting created by FeatureManager:
  //   .gs-container
  //     └── .gs-features
  //           └── div[data-feature="whiteboard"]   ← ctx.container
  const gsContainer = document.createElement('div');
  gsContainer.className = 'gs-container';
  const gsFeaturesDiv = document.createElement('div');
  gsFeaturesDiv.className = 'gs-features';
  const container = document.createElement('div');
  container.setAttribute('data-feature', 'whiteboard');
  gsFeaturesDiv.appendChild(container);
  gsContainer.appendChild(gsFeaturesDiv);
  document.body.appendChild(gsContainer);

  const syncAPI = overrides.sync !== undefined ? overrides.sync : makeSyncAPI(overrides.strokes ?? []);

  const ctx: FeatureContext = {
    featureId: 'whiteboard',
    config: {} as never,
    role: overrides.role ?? 'presenter',
    slideshow: { currentSlide: overrides.currentSlide ?? 0, slideCount: 5, mode: overrides.mode ?? 'present' } as never,
    commands: { register: commands } as never,
    sync: syncAPI,
    syncManager: null,
    container,
    on: onFn as never,
    output: { show: outputShow } as never,
  };

  return { ctx, container, gsContainer, commands, on: onFn, outputShow, handlers };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('whiteboardFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('has correct id and label', () => {
    expect(whiteboardFeature.id).toBe('whiteboard');
    expect(whiteboardFeature.label).toContain('whiteboard');
  });

  // --- DOM setup ---

  it('appends geek-whiteboard to the feature container', () => {
    const { ctx, container } = makeContext();
    whiteboardFeature.activate(ctx);
    expect(container.querySelector('geek-whiteboard')).toBeTruthy();
  });

  it('sets whiteboard.slideIndex to current slide on activation', () => {
    const { ctx, container } = makeContext({ currentSlide: 3 });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.slideIndex).toBe(3);
  });

  // --- Viewer mode ---

  it('sets readonly attribute for viewer role', () => {
    const { ctx, container } = makeContext({ role: 'viewer' });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.hasAttribute('readonly')).toBe(true);
  });

  it('does not create toolbar for viewer role', () => {
    const { ctx, container } = makeContext({ role: 'viewer' });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.toolbar).toBeNull();
  });

  it('does not register commands for viewer role', () => {
    const { ctx, commands } = makeContext({ role: 'viewer' });
    whiteboardFeature.activate(ctx);
    expect(commands).not.toHaveBeenCalled();
  });

  // --- Presenter mode ---

  it('does not set readonly attribute for presenter role', () => {
    const { ctx, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.hasAttribute('readonly')).toBe(false);
  });

  it('exposes toolbar via whiteboard.toolbar for presenter', () => {
    const { ctx, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.toolbar).toBeTruthy();
  });

  it('hides the toolbar by default for presenter', () => {
    const { ctx, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    const toolbar = wb.toolbar as StubToolbar;
    expect(toolbar.hide).toHaveBeenCalledOnce();
  });

  it('registers whiteboard toggle command for presenter', () => {
    const { ctx, commands } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const names = (commands.mock.calls as Array<[{ name: string }]>).map(([c]) => c.name);
    expect(names).toContain('whiteboard');
  });

  it('registers whiteboard-clear command for presenter', () => {
    const { ctx, commands } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const names = (commands.mock.calls as Array<[{ name: string }]>).map(([c]) => c.name);
    expect(names).toContain('whiteboard-clear');
  });

  it('registers toolbar commands for presenter', () => {
    const { ctx, commands } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const names = (commands.mock.calls as Array<[{ name: string }]>).map(([c]) => c.name);
    expect(names).toContain('wb-toolbar');
    expect(names).toContain('wb-pen');
    expect(names).toContain('wb-highlighter');
    expect(names).toContain('wb-eraser');
    expect(names).toContain('wb-color');
    expect(names).toContain('wb-hide');
    expect(names).toContain('wb-show');
  });

  it('wb-toolbar command calls toggleVisibility (complete hide/show)', () => {
    const { ctx, commands, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);

    const wbToolbarCall = (commands.mock.calls as Array<[{ name: string; execute: () => void }]>)
      .find(([c]) => c.name === 'wb-toolbar');
    expect(wbToolbarCall).toBeTruthy();

    const toolbar = (container.querySelector('geek-whiteboard') as StubWhiteboard).toolbar as StubToolbar;
    wbToolbarCall![0].execute();
    expect(toolbar.toggleVisibility).toHaveBeenCalledOnce();
    expect(toolbar.toggleCollapse).not.toHaveBeenCalled();
  });

  // --- Slide tracking ---

  it('subscribes to slide:enter lifecycle event', () => {
    const { ctx, on } = makeContext();
    whiteboardFeature.activate(ctx);
    const events = (on.mock.calls as Array<[string]>).map(([e]) => e);
    expect(events).toContain('slide:enter');
  });

  it('updates whiteboard slideIndex on slide:enter event', () => {
    const { ctx, container, handlers } = makeContext();
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    const slideEnterHandlers = handlers.get('slide:enter') ?? [];
    slideEnterHandlers.forEach((h) => h({ slideIndex: 4 }));
    expect(wb.slideIndex).toBe(4);
  });

  // --- Sync integration ---

  it('activates EventBridge when sync is provided', () => {
    const syncAPI = makeSyncAPI();
    const { ctx } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const bridge = (syncAPI.createEventBridge as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(bridge.activate).toHaveBeenCalledOnce();
  });

  it('does not create EventBridge when sync is null', () => {
    const { ctx } = makeContext({ sync: null });
    whiteboardFeature.activate(ctx);
    // No error thrown
  });

  it('replays existing strokes from shared array on activation', () => {
    const existingStrokes = [makeStroke({ id: 's1' }), makeStroke({ id: 's2' })];
    const syncAPI = makeSyncAPI(existingStrokes);
    const { ctx, container } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.drawRemoteStroke).toHaveBeenCalledTimes(2);
  });

  it('does not call drawRemoteStroke when there are no existing strokes', () => {
    const syncAPI = makeSyncAPI([]);
    const { ctx, container } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.drawRemoteStroke).not.toHaveBeenCalled();
  });

  // --- Command behaviour ---

  it('whiteboard command toggles whiteboard and sets visibility in shared map', () => {
    const syncAPI = makeSyncAPI();
    const { ctx, container, commands } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;

    const wbCmd = (commands.mock.calls as Array<[{ name: string; execute: () => void }]>)
      .map(([c]) => c)
      .find((c) => c.name === 'whiteboard');
    wbCmd?.execute();

    expect(wb.toggle).toHaveBeenCalledOnce();
    const sharedMap = (syncAPI.getSharedMap as ReturnType<typeof vi.fn>)();
    expect(sharedMap.set).toHaveBeenCalledWith('visible', wb.isVisible);
  });

  it('whiteboard-clear command clears the canvas and deletes strokes from shared array', () => {
    const existingStrokes = [makeStroke({ id: 's1', slideIndex: 0 }), makeStroke({ id: 's2', slideIndex: 1 })];
    const syncAPI = makeSyncAPI(existingStrokes);
    const { ctx, container, commands } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;

    const clearCmd = (commands.mock.calls as Array<[{ name: string; execute: () => void }]>)
      .map(([c]) => c)
      .find((c) => c.name === 'whiteboard-clear');
    clearCmd?.execute();

    expect(wb.clear).toHaveBeenCalledOnce();
    // Should have called delete on the array for slide 0 strokes
    const sharedArray = (syncAPI.getSharedArray as ReturnType<typeof vi.fn>)();
    expect(sharedArray.delete).toHaveBeenCalled();
  });

  it('wb-color shows error when called without arguments', () => {
    const { ctx, commands, outputShow } = makeContext();
    whiteboardFeature.activate(ctx);

    const colorCmd = (commands.mock.calls as Array<[{ name: string; execute: (args?: string[]) => void }]>)
      .map(([c]) => c)
      .find((c) => c.name === 'wb-color');
    colorCmd?.execute(undefined);

    expect(outputShow).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });

  it('wb-color applies color when argument is provided', () => {
    const { ctx, container, commands } = makeContext();
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    const toolbar = wb.toolbar!;

    const colorCmd = (commands.mock.calls as Array<[{ name: string; execute: (args?: string[]) => void }]>)
      .map(([c]) => c)
      .find((c) => c.name === 'wb-color');
    colorCmd?.execute(['#abcdef']);

    expect(wb.setColor).toHaveBeenCalledWith('#abcdef');
    expect(toolbar.setColor).toHaveBeenCalledWith('#abcdef');
  });

  // --- Sync event bridge (composed events from whiteboard) ---

  function getWhiteboard(container: HTMLElement): StubWhiteboard {
    return container.querySelector('geek-whiteboard') as StubWhiteboard;
  }

  it('geek:whiteboard:hide event sets visibility in shared map', () => {
    const syncAPI = makeSyncAPI();
    const { ctx, container } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    wb.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
      bubbles: true, composed: true,
      detail: { visible: false },
    }));

    const sharedMap = (syncAPI.getSharedMap as ReturnType<typeof vi.fn>)();
    expect(sharedMap.set).toHaveBeenCalledWith('visible', false);
  });

  it('geek:whiteboard:hide event does not throw when sync is null', () => {
    const { ctx, container } = makeContext({ sync: null });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    expect(() => {
      wb.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
        bubbles: true, composed: true,
        detail: { visible: false },
      }));
    }).not.toThrow();
  });

  it('geek:whiteboard:clear event deletes strokes for that slide from shared array', () => {
    const existingStrokes = [makeStroke({ id: 's1', slideIndex: 2 })];
    const syncAPI = makeSyncAPI(existingStrokes);
    const { ctx, container } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    wb.dispatchEvent(new CustomEvent('geek:whiteboard:clear', {
      bubbles: true, composed: true,
      detail: { slideIndex: 2 },
    }));

    const sharedArray = (syncAPI.getSharedArray as ReturnType<typeof vi.fn>)();
    expect(sharedArray.delete).toHaveBeenCalled();
  });

  it('geek:whiteboard:clear event does not throw when sync is null', () => {
    const { ctx, container } = makeContext({ sync: null });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    expect(() => {
      wb.dispatchEvent(new CustomEvent('geek:whiteboard:clear', {
        bubbles: true, composed: true,
        detail: { slideIndex: 0 },
      }));
    }).not.toThrow();
  });

  it('does not attach hide/clear listeners for viewer role', () => {
    const syncAPI = makeSyncAPI();
    const { ctx, container } = makeContext({ role: 'viewer', sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    wb.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
      bubbles: true, composed: true,
      detail: { visible: false },
    }));

    const sharedMap = (syncAPI.getSharedMap as ReturnType<typeof vi.fn>)();
    // The hide listener was not attached for viewer, so set shouldn't be called for visibility
    // (only the observer replay would call it, which only happens if value exists)
    expect(sharedMap.set).not.toHaveBeenCalledWith('visible', false);
  });

  // --- Deck reload clears strokes ---

  it('clears all strokes on geek:presentation:reload event', () => {
    const existingStrokes = [makeStroke({ id: 's1' }), makeStroke({ id: 's2' })];
    const syncAPI = makeSyncAPI(existingStrokes);
    const { ctx, container } = makeContext({ sync: syncAPI });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    document.dispatchEvent(new CustomEvent('geek:presentation:reload'));

    expect(wb.clear).toHaveBeenCalled();
    const sharedArray = (syncAPI.getSharedArray as ReturnType<typeof vi.fn>)();
    expect(sharedArray.delete).toHaveBeenCalled();
  });

  it('cleanup removes reload listener', () => {
    const syncAPI = makeSyncAPI();
    const { ctx, container } = makeContext({ sync: syncAPI });
    const cleanup = whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    cleanup?.();

    // After cleanup, reload should not trigger clear
    wb.clear.mockClear();
    document.dispatchEvent(new CustomEvent('geek:presentation:reload'));
    expect(wb.clear).not.toHaveBeenCalled();
  });

  // --- Pointer drag auto-activation ---

  function firePointer(
    target: EventTarget,
    type: string,
    init: PointerEventInit = {},
  ): void {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      ...init,
    });
    target.dispatchEvent(event);
  }

  it('auto-activates whiteboard on pointer drag over gsContainer', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    // pointerdown on container (not on whiteboard)
    firePointer(gsContainer, 'pointerdown', { button: 0 });
    // pointermove while button held
    firePointer(gsContainer, 'pointermove', { buttons: 1, clientX: 16, clientY: 16 });

    expect(wb.setActive).toHaveBeenCalledWith(true);
    expect(wb.beginStroke).toHaveBeenCalledOnce();
  });

  it('does not auto-activate when drag starts on interactive controls', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    const button = document.createElement('button');
    gsContainer.appendChild(button);

    firePointer(button, 'pointerdown', { button: 0 });
    firePointer(button, 'pointermove', { buttons: 1, clientX: 20, clientY: 20 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('does not auto-activate when whiteboard is already visible', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);
    wb.isVisible = true;

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('does not auto-activate when user dismissed the whiteboard', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);
    wb.userDismissed = true;

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('does not auto-activate when toolbar is collapsed', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);
    wb.toolbarCollapsed = true;

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('ignores non-primary button pointerdown (right-click)', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    firePointer(gsContainer, 'pointerdown', { button: 2 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('ignores pointer drag when not in present mode', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter', mode: 'overview' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('pointermove with buttons=0 clears the drag flag and does not activate', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    // Move with no button held — simulates pointer-leave then move
    firePointer(gsContainer, 'pointermove', { buttons: 0 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('does not auto-activate when slideshow is in overview mode', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter', mode: 'overview' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('cleanup removes pointer listeners from gsContainer', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    const cleanup = whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    cleanup?.();

    // Drag after cleanup should not trigger activation
    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('does not set up pointer listeners for viewer role', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'viewer' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    firePointer(gsContainer, 'pointerdown', { button: 0 });
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  // --- Cleanup ---

  it('cleanup removes whiteboard from DOM', () => {
    const { ctx, container } = makeContext();
    const cleanup = whiteboardFeature.activate(ctx);
    expect(container.querySelector('geek-whiteboard')).toBeTruthy();
    cleanup?.();
    expect(container.querySelector('geek-whiteboard')).toBeNull();
  });

  it('cleanup deactivates EventBridge', () => {
    const syncAPI = makeSyncAPI();
    const { ctx } = makeContext({ sync: syncAPI });
    const cleanup = whiteboardFeature.activate(ctx);
    const bridge = (syncAPI.createEventBridge as ReturnType<typeof vi.fn>).mock.results[0]?.value;

    cleanup?.();
    expect(bridge.deactivate).toHaveBeenCalledOnce();
  });

  it('cleanup unobserves Yjs maps/arrays', () => {
    const syncAPI = makeSyncAPI();
    const { ctx } = makeContext({ sync: syncAPI });
    const cleanup = whiteboardFeature.activate(ctx);

    cleanup?.();

    const sharedArray = (syncAPI.getSharedArray as ReturnType<typeof vi.fn>)();
    const ephemeralMap = (syncAPI.getEphemeralMap as ReturnType<typeof vi.fn>)();
    const sharedMap = (syncAPI.getSharedMap as ReturnType<typeof vi.fn>)();
    expect(sharedArray.unobserve).toHaveBeenCalled();
    expect(ephemeralMap.unobserve).toHaveBeenCalled();
    expect(sharedMap.unobserve).toHaveBeenCalled();
  });

  it('cleanup clears ephemeral entry', () => {
    const syncAPI = makeSyncAPI();
    const { ctx } = makeContext({ sync: syncAPI });
    const cleanup = whiteboardFeature.activate(ctx);

    cleanup?.();

    const ephemeralMap = (syncAPI.getEphemeralMap as ReturnType<typeof vi.fn>)();
    expect(ephemeralMap.delete).toHaveBeenCalledWith('_self');
  });
});
