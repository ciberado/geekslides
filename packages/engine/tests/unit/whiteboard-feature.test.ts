// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeatureContext } from '../../src/features/types.ts';
import type { WhiteboardStroke } from '../../src/sync/types.ts';

vi.mock('../../src/logging.ts', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// --- Stub WhiteboardSync ---
const mockWbSyncActivate = vi.fn();
const mockWbSyncDeactivate = vi.fn();
vi.mock('../../src/sync/WhiteboardSync.ts', () => ({
  WhiteboardSync: vi.fn().mockImplementation(() => ({
    activate: mockWbSyncActivate,
    deactivate: mockWbSyncDeactivate,
  })),
}));

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

import { whiteboardFeature } from '../../src/features/builtins/whiteboard-feature.ts';
import type { SyncManager } from '../../src/sync/SyncManager.ts';

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

function makeSyncManager(strokes: WhiteboardStroke[] = []): SyncManager {
  return {
    getStrokes: vi.fn(() => strokes),
    publishWhiteboardVisible: vi.fn(),
    clearStrokes: vi.fn(),
    clearAllStrokes: vi.fn(),
  } as unknown as SyncManager;
}

type EventHandler = (payload: Record<string, unknown>) => void;

function makeContext(
  overrides: Partial<{
    role: 'presenter' | 'viewer';
    syncManager: SyncManager | null;
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
  // Using parentElement on ctx.container gives .gs-features (wrong),
  // while closest('.gs-container') correctly skips up to .gs-container.
  const gsContainer = document.createElement('div');
  gsContainer.className = 'gs-container';
  const gsFeaturesDiv = document.createElement('div');
  gsFeaturesDiv.className = 'gs-features';
  const container = document.createElement('div');
  container.setAttribute('data-feature', 'whiteboard');
  gsFeaturesDiv.appendChild(container);
  gsContainer.appendChild(gsFeaturesDiv);
  document.body.appendChild(gsContainer);

  const ctx: FeatureContext = {
    featureId: 'whiteboard',
    config: {} as never,
    role: overrides.role ?? 'presenter',
    slideshow: { currentSlide: overrides.currentSlide ?? 0, slideCount: 5, mode: overrides.mode ?? 'present' } as never,
    commands: { register: commands } as never,
    sync: null,
    syncManager: overrides.syncManager ?? null,
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
    // Viewer whiteboard has readonly attr — toolbar is not created internally
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
    // Toolbar is owned by the component; feature accesses it via wb.toolbar
    expect(wb.toolbar).toBeTruthy();
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

  it('activates WhiteboardSync when syncManager is provided', () => {
    const { ctx } = makeContext({ syncManager: makeSyncManager() });
    whiteboardFeature.activate(ctx);
    expect(mockWbSyncActivate).toHaveBeenCalledOnce();
  });

  it('does not activate WhiteboardSync when syncManager is null', () => {
    const { ctx } = makeContext({ syncManager: null });
    whiteboardFeature.activate(ctx);
    expect(mockWbSyncActivate).not.toHaveBeenCalled();
  });

  it('replays existing strokes from syncManager on activation', () => {
    const existingStrokes = [makeStroke({ id: 's1' }), makeStroke({ id: 's2' })];
    const syncManager = makeSyncManager(existingStrokes);
    const { ctx, container } = makeContext({ syncManager });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.drawRemoteStroke).toHaveBeenCalledTimes(2);
    expect(wb.drawRemoteStroke).toHaveBeenCalledWith(existingStrokes[0]);
    expect(wb.drawRemoteStroke).toHaveBeenCalledWith(existingStrokes[1]);
  });

  it('does not call drawRemoteStroke when there are no existing strokes', () => {
    const { ctx, container } = makeContext({ syncManager: makeSyncManager([]) });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;
    expect(wb.drawRemoteStroke).not.toHaveBeenCalled();
  });

  // --- Command behaviour ---

  it('whiteboard command toggles whiteboard visibility', () => {
    const syncManager = makeSyncManager();
    const { ctx, container, commands } = makeContext({ syncManager });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;

    const wbCmd = (commands.mock.calls as Array<[{ name: string; execute: () => void }]>)
      .map(([c]) => c)
      .find((c) => c.name === 'whiteboard');
    wbCmd?.execute();

    expect(wb.toggle).toHaveBeenCalledOnce();
    expect(syncManager.publishWhiteboardVisible).toHaveBeenCalledOnce();
  });

  it('whiteboard-clear command clears the canvas and syncs', () => {
    const syncManager = makeSyncManager();
    const { ctx, container, commands } = makeContext({ syncManager });
    whiteboardFeature.activate(ctx);
    const wb = container.querySelector('geek-whiteboard') as StubWhiteboard;

    const clearCmd = (commands.mock.calls as Array<[{ name: string; execute: () => void }]>)
      .map(([c]) => c)
      .find((c) => c.name === 'whiteboard-clear');
    clearCmd?.execute();

    expect(wb.clear).toHaveBeenCalledOnce();
    expect(syncManager.clearStrokes).toHaveBeenCalledWith(wb.slideIndex);
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
  // Toolbar events are now handled internally by <geek-whiteboard>.
  // The feature layer only listens for composed geek:whiteboard:hide and
  // geek:whiteboard:clear events that bubble out of the shadow root.

  function getWhiteboard(container: HTMLElement): StubWhiteboard {
    return container.querySelector('geek-whiteboard') as StubWhiteboard;
  }

  it('geek:whiteboard:hide event publishes visibility to sync', () => {
    const syncManager = makeSyncManager();
    const { ctx, container } = makeContext({ syncManager });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    wb.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
      bubbles: true, composed: true,
      detail: { visible: false },
    }));

    expect(syncManager.publishWhiteboardVisible).toHaveBeenCalledWith(false);
  });

  it('geek:whiteboard:hide event does not throw when syncManager is null', () => {
    const { ctx, container } = makeContext({ syncManager: null });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    expect(() => {
      wb.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
        bubbles: true, composed: true,
        detail: { visible: false },
      }));
    }).not.toThrow();
  });

  it('geek:whiteboard:clear event calls clearStrokes on sync', () => {
    const syncManager = makeSyncManager();
    const { ctx, container } = makeContext({ syncManager });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    wb.dispatchEvent(new CustomEvent('geek:whiteboard:clear', {
      bubbles: true, composed: true,
      detail: { slideIndex: 2 },
    }));

    expect(syncManager.clearStrokes).toHaveBeenCalledWith(2);
  });

  it('geek:whiteboard:clear event does not throw when syncManager is null', () => {
    const { ctx, container } = makeContext({ syncManager: null });
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
    const syncManager = makeSyncManager();
    const { ctx, container } = makeContext({ role: 'viewer', syncManager });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    wb.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
      bubbles: true, composed: true,
      detail: { visible: false },
    }));

    expect(syncManager.publishWhiteboardVisible).not.toHaveBeenCalled();
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
    firePointer(gsContainer, 'pointermove', { buttons: 1 });

    expect(wb.setActive).toHaveBeenCalledWith(true);
    expect(wb.beginStroke).toHaveBeenCalledOnce();
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

    firePointer(gsContainer, 'pointerdown', { button: 2, buttons: 2 });
    firePointer(gsContainer, 'pointermove', { buttons: 2 });

    expect(wb.setActive).not.toHaveBeenCalled();
  });

  it('clears pointerStartedOnSlide flag on pointerup', () => {
    const { ctx, gsContainer, container } = makeContext({ role: 'presenter' });
    whiteboardFeature.activate(ctx);
    const wb = getWhiteboard(container);

    // Start a drag
    firePointer(gsContainer, 'pointerdown', { button: 0 });
    // Release
    gsContainer.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, buttons: 0 }));
    // Move after release — should not activate
    firePointer(gsContainer, 'pointermove', { buttons: 0 });

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

    // viewer whiteboard is readonly — setActive is not a method on viewer wb,
    // but the stub has it; the guard is that the handler was never attached.
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

  it('cleanup deactivates WhiteboardSync', () => {
    const { ctx } = makeContext({ syncManager: makeSyncManager() });
    const cleanup = whiteboardFeature.activate(ctx);
    cleanup?.();
    expect(mockWbSyncDeactivate).toHaveBeenCalledOnce();
  });

  it('cleanup removes sync event listeners', () => {
    const syncManager = makeSyncManager();
    const { ctx } = makeContext({ syncManager });
    const cleanup = whiteboardFeature.activate(ctx);
    cleanup?.();

    // After cleanup, hide event dispatched directly to the ctx.container should not reach sync
    ctx.container.dispatchEvent(new CustomEvent('geek:whiteboard:hide', {
      bubbles: true, detail: { visible: false },
    }));

    // publishWhiteboardVisible should NOT have been called (listeners removed before cleanup)
    expect(syncManager.publishWhiteboardVisible).not.toHaveBeenCalled();
  });

  it('cleanup calls slide:enter unsubscribe', () => {
    const { ctx, on } = makeContext();
    const unsubSpy = vi.fn();
    vi.mocked(on).mockReturnValueOnce(unsubSpy);
    const cleanup = whiteboardFeature.activate(ctx);
    cleanup?.();
    expect(unsubSpy).toHaveBeenCalledOnce();
  });
});
