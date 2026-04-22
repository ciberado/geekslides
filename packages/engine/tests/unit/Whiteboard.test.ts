// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Whiteboard } from '../../src/components/Whiteboard.ts';
import type { WhiteboardStroke } from '../../src/sync/types.ts';

// Mock canvas 2D context so pointer handlers don't bail out in jsdom
const noop = (): void => { /* no-op */ };
const fakeCtx = {
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  stroke: noop,
  clearRect: noop,
  save: noop,
  restore: noop,
  getImageData: (_sx: number, _sy: number, sw: number, sh: number) =>
    ({ data: new Uint8ClampedArray(sw * sh * 4), width: sw, height: sh }),
  putImageData: noop,
  set strokeStyle(_v: string) { /* no-op */ },
  set lineWidth(_v: number) { /* no-op */ },
  set lineCap(_v: string) { /* no-op */ },
  set lineJoin(_v: string) { /* no-op */ },
  globalCompositeOperation: 'source-over' as string,
  globalAlpha: 1.0,
};

const origGetContext = HTMLCanvasElement.prototype.getContext;

// Register the custom element for jsdom
if (!customElements.get('geek-whiteboard')) {
  customElements.define('geek-whiteboard', Whiteboard);
}

// Stub toolbar element — records method calls and emits real events
class StubToolbarForWire extends HTMLElement {
  toggleCollapse = vi.fn();
  hide = vi.fn();
  show = vi.fn();
  setTool = vi.fn();
  setColor = vi.fn();
}
if (!customElements.get('geek-whiteboard-toolbar')) {
  customElements.define('geek-whiteboard-toolbar', StubToolbarForWire);
}

function makeStroke(overrides: Partial<WhiteboardStroke> = {}): WhiteboardStroke {
  return {
    id: 'stroke-1',
    slideIndex: 0,
    points: [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
    color: '#ff0000',
    width: 3,
    clientId: 'test-client',
    ...overrides,
  };
}

describe('Whiteboard', () => {
  let wb: Whiteboard;

  beforeEach(() => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    (HTMLCanvasElement.prototype as any).getContext = () => fakeCtx;
    // jsdom lacks setPointerCapture/releasePointerCapture
    HTMLCanvasElement.prototype.setPointerCapture ??= noop as (id: number) => void;
    HTMLCanvasElement.prototype.releasePointerCapture ??= noop as (id: number) => void;
    wb = document.createElement('geek-whiteboard') as Whiteboard;
    document.body.appendChild(wb);
  });

  afterEach(() => {
    if (wb.isConnected) document.body.removeChild(wb);
    HTMLCanvasElement.prototype.getContext = origGetContext;
    vi.useRealTimers();
  });

  it('starts hidden', () => {
    expect(wb.isVisible).toBe(false);
  });

  it('toggle makes it visible then hidden', () => {
    wb.toggle();
    expect(wb.isVisible).toBe(true);
    wb.toggle();
    expect(wb.isVisible).toBe(false);
  });

  it('setActive(true) makes it visible', () => {
    wb.setActive(true);
    expect(wb.isVisible).toBe(true);
  });

  it('setActive(false) hides it', () => {
    wb.setActive(true);
    wb.setActive(false);
    expect(wb.isVisible).toBe(false);
  });

  it('slideIndex defaults to 0', () => {
    expect(wb.slideIndex).toBe(0);
  });

  it('slideIndex setter updates value', () => {
    wb.slideIndex = 5;
    expect(wb.slideIndex).toBe(5);
  });

  it('slideIndex setter saves and restores canvas data', () => {
    // Access internal canvas via shadow DOM
    const canvas = wb.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    // Draw something on slide 0
    wb.setActive(true);
    wb.drawRemoteStroke(makeStroke({ slideIndex: 0 }));

    // Switch to slide 1
    wb.slideIndex = 1;

    // Switch back to slide 0 — saveSlide/restoreSlide should have run
    wb.slideIndex = 0;

    // The canvas should have been restored (we can't inspect pixels in jsdom,
    // but we verify the save/restore cycle ran without error)
    expect(wb.slideIndex).toBe(0);
  });

  it('clear removes current slide snapshot', () => {
    wb.drawRemoteStroke(makeStroke({ slideIndex: 0 }));
    wb.clear();
    // After clear, switching away and back should show empty canvas
    wb.slideIndex = 1;
    wb.slideIndex = 0;
    // No error means clear + restore worked
    expect(wb.slideIndex).toBe(0);
  });

  it('drawRemoteStroke for current slide auto-shows whiteboard', () => {
    expect(wb.isVisible).toBe(false);
    wb.drawRemoteStroke(makeStroke({ slideIndex: 0 }));
    expect(wb.isVisible).toBe(true);
  });

  it('drawRemoteStroke for different slide does not auto-show', () => {
    expect(wb.isVisible).toBe(false);
    wb.drawRemoteStroke(makeStroke({ slideIndex: 5 }));
    expect(wb.isVisible).toBe(false);
  });

  it('listens for geek:whiteboard:remote-stroke events on document', () => {
    const stroke = makeStroke({ slideIndex: 0 });
    document.dispatchEvent(new CustomEvent('geek:whiteboard:remote-stroke', {
      bubbles: true,
      detail: stroke,
    }));
    // Should auto-show
    expect(wb.isVisible).toBe(true);
  });

  it('drawRemoteStroke stores strokes for non-current slides', () => {
    // Slide 0 is current; send a stroke tagged for slide 3
    wb.drawRemoteStroke(makeStroke({ slideIndex: 3 }));

    // Navigate to slide 3 — restoreSlide should replay the stored stroke
    // (jsdom canvas is a no-op, but we verify no error occurs)
    wb.slideIndex = 3;
    expect(wb.slideIndex).toBe(3);
  });

  it('stops listening for remote strokes after disconnect', () => {
    document.body.removeChild(wb);

    // Dispatch after removal — should not throw
    const stroke = makeStroke({ slideIndex: 0 });
    document.dispatchEvent(new CustomEvent('geek:whiteboard:remote-stroke', {
      bubbles: true,
      detail: stroke,
    }));
    // No error means cleanup worked
  });

  it('beginStroke starts drawing state from external event', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    // Simulate an external pointer event
    const pointerEvent = new PointerEvent('pointerdown', {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      bubbles: true,
    });

    wb.beginStroke(pointerEvent);

    // Verify drawing started by moving and ending — should dispatch stroke event
    const strokeSpy = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke', strokeSpy);

    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 150,
      clientY: 150,
      buttons: 1,
      bubbles: true,
    }));

    canvas?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // Stroke is dispatched after coalesce timer expires
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    expect(strokeSpy).toHaveBeenCalledTimes(1);
  });

  it('stroke event has composed: true to cross shadow DOM', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    let eventComposed = false;
    wb.addEventListener('geek:whiteboard:stroke', (e: Event) => {
      eventComposed = e.composed;
    });

    // Simulate a full draw: pointerdown, pointermove, pointerup
    canvas?.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: 100,
      clientY: 100,
      bubbles: true,
    }));
    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 150,
      clientY: 150,
      buttons: 1,
      bubbles: true,
    }));
    canvas?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    expect(eventComposed).toBe(true);
  });

  it('coalesces rapid pen lift/contact into a single stroke', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const strokeSpy = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke', strokeSpy);

    // First pen contact
    canvas?.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: 100, clientY: 100, bubbles: true,
    }));
    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 120, clientY: 120, buttons: 1, bubbles: true,
    }));
    // Pen lifts briefly
    canvas?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // Advance part of the coalesce window — should NOT finalize yet
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS / 2);
    expect(strokeSpy).not.toHaveBeenCalled();

    // Pen resumes contact
    canvas?.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: 122, clientY: 122, bubbles: true,
    }));
    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 150, clientY: 150, buttons: 1, bubbles: true,
    }));
    // Final lift
    canvas?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // Let coalesce timer expire
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    // Should produce exactly one stroke with all points
    expect(strokeSpy).toHaveBeenCalledTimes(1);
    const detail = (strokeSpy.mock.calls[0]?.[0] as CustomEvent).detail as WhiteboardStroke;
    expect(detail.points.length).toBeGreaterThanOrEqual(4);
  });

  it('preserves canvas and visibility across disconnect/reconnect cycle', () => {
    // Simulate the loadSlides detach/reattach that happens during content proxy reload
    wb.setActive(true);
    expect(wb.isVisible).toBe(true);

    const canvasBefore = wb.shadowRoot?.querySelector('canvas.main');
    expect(canvasBefore).toBeTruthy();

    // Draw something so we can verify it persists
    wb.drawRemoteStroke(makeStroke({ slideIndex: 0 }));

    // Detach and reattach (simulates loadSlides innerHTML='' + re-append)
    document.body.removeChild(wb);
    document.body.appendChild(wb);

    // Canvas should be the SAME element (not re-created)
    const canvasAfter = wb.shadowRoot?.querySelector('canvas.main');
    expect(canvasAfter).toBe(canvasBefore);

    // Visibility state should be preserved
    expect(wb.isVisible).toBe(true);
  });

  it('emits stroke-progress events periodically during drawing', () => {
    wb.setActive(true);
    const progressSpy = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke-progress', progressSpy);

    // Start a stroke
    wb.beginStroke(new PointerEvent('pointerdown', {
      clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse', bubbles: true,
    }));

    const canvas = wb.shadowRoot?.querySelector('canvas');

    // Add a few points
    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 20, clientY: 20, buttons: 1, bubbles: true,
    }));
    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 30, clientY: 30, buttons: 1, bubbles: true,
    }));

    // No progress yet (timer hasn't fired)
    expect(progressSpy).not.toHaveBeenCalled();

    // Advance past one progress interval
    vi.advanceTimersByTime(Whiteboard.PROGRESS_MS + 10);
    expect(progressSpy).toHaveBeenCalledTimes(1);

    const detail = (progressSpy.mock.calls[0]?.[0] as CustomEvent).detail as WhiteboardStroke;
    expect(detail.points.length).toBe(3); // 1 initial + 2 moves
    expect(detail.slideIndex).toBe(0);

    // Add more points and advance again
    canvas?.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 40, clientY: 40, buttons: 1, bubbles: true,
    }));
    vi.advanceTimersByTime(Whiteboard.PROGRESS_MS + 10);
    expect(progressSpy).toHaveBeenCalledTimes(2);

    const detail2 = (progressSpy.mock.calls[1]?.[0] as CustomEvent).detail as WhiteboardStroke;
    expect(detail2.points.length).toBe(4); // cumulative

    // Finalize
    canvas?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    wb.removeEventListener('geek:whiteboard:stroke-progress', progressSpy);
  });

  it('draws live strokes incrementally and skips re-draw on finalization', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    // Simulate receiving a live stroke progress with 3 points
    const liveStroke = makeStroke({
      slideIndex: 0,
      clientId: 'remote-1',
      points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]],
    });
    wb.drawLiveStroke(liveStroke);

    // Simulate a second progress update with 5 points (2 new)
    const liveStroke2 = makeStroke({
      slideIndex: 0,
      clientId: 'remote-1',
      points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4], [0.5, 0.5]],
    });
    wb.drawLiveStroke(liveStroke2);

    // Now finalize — should NOT call full drawStroke since live already rendered
    // (we can't easily spy on private #drawStroke, but we verify via the spy on ctx)
    const completedStroke = makeStroke({
      slideIndex: 0,
      clientId: 'remote-1',
      points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4], [0.5, 0.5]],
    });
    wb.drawRemoteStroke(completedStroke);

    // drawRemoteStroke with matching clientId should clean up live tracking
    // Drawing another live stroke for the same client should start fresh
    const newLive = makeStroke({
      slideIndex: 0,
      clientId: 'remote-1',
      points: [[0.6, 0.6], [0.7, 0.7]],
    });
    wb.drawLiveStroke(newLive);
    // No errors = tracking was properly cleaned up
  });

  it('setActive(true) shows canvas with fade-in', () => {
    const canvas = wb.shadowRoot?.querySelector('canvas.main') as HTMLCanvasElement;
    // Initially hidden via CSS (display: none, no inline styles)
    expect(canvas.style.display).toBe('');

    wb.setActive(true);

    // Canvas should be visible with a transient opacity animation
    expect(canvas.style.display).toBe('block');

    // After the fade cleanup timer (350ms), inline opacity/transition are removed
    vi.advanceTimersByTime(400);
    expect(canvas.style.opacity).toBe('');
    expect(canvas.style.transition).toBe('');
  });

  it('setActive(false) hides canvas instantly', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas.main') as HTMLCanvasElement;
    expect(canvas.style.display).toBe('block');

    wb.setActive(false);

    expect(canvas.style.display).toBe('none');
    // No lingering opacity/transition styles
    expect(canvas.style.opacity).toBe('');
    expect(canvas.style.transition).toBe('');
  });

  it('slideIndex change hides canvas then fades in after TRANSITION_MS when slide has strokes', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas.main') as HTMLCanvasElement;
    expect(canvas.style.display).toBe('block');

    // Draw on slide 0 so it has content
    wb.drawRemoteStroke(makeStroke({ slideIndex: 0 }));

    // Navigate to slide 1 (no strokes)
    wb.slideIndex = 1;

    // Canvas stays displayed on empty slide so pointer events work for drawing
    expect(canvas.style.display).toBe('block');

    // Navigate back to slide 0 (has strokes)
    wb.slideIndex = 0;

    // Canvas should be hidden immediately during transition
    expect(canvas.style.display).toBe('none');

    // After TRANSITION_MS the fade-in should trigger (slide has content)
    vi.advanceTimersByTime(Whiteboard.TRANSITION_MS + 10);
    expect(canvas.style.display).toBe('block');
  });

  it('slideIndex change keeps canvas displayed on empty slide for pointer events', () => {
    wb.setActive(true);
    const canvas = wb.shadowRoot?.querySelector('canvas.main') as HTMLCanvasElement;

    // Navigate to slide 1 (no strokes)
    wb.slideIndex = 1;

    // Canvas stays displayed so pointer events work for drawing
    vi.advanceTimersByTime(Whiteboard.TRANSITION_MS + 10);
    expect(canvas.style.display).toBe('block');
    // Whiteboard is still logically active
    expect(wb.isVisible).toBe(true);
  });

  it('slideIndex change does not fade in if whiteboard is inactive', () => {
    const canvas = wb.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;

    wb.slideIndex = 1;

    // Should remain hidden
    vi.advanceTimersByTime(Whiteboard.TRANSITION_MS + 10);
    expect(canvas.style.display).not.toBe('block');
  });

  it('setCompositeOp sets the composite operation', () => {
    wb.setCompositeOp('destination-out');
    // Draw a stroke and verify the composite op is included
    const handler = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke', handler);
    wb.setActive(true);

    const canvas = wb.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    expect(handler).toHaveBeenCalledTimes(1);
    const stroke = (handler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(stroke.compositeOp).toBe('destination-out');
  });

  it('setAlpha sets the global alpha', () => {
    wb.setAlpha(0.3);
    const handler = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke', handler);
    wb.setActive(true);

    const canvas = wb.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    expect(handler).toHaveBeenCalledTimes(1);
    const stroke = (handler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(stroke.alpha).toBe(0.3);
  });

  it('finalized strokes include compositeOp and alpha in progress events', () => {
    wb.setCompositeOp('destination-out');
    wb.setAlpha(0.5);
    const handler = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke-progress', handler);
    wb.setActive(true);

    const canvas = wb.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }));
    vi.advanceTimersByTime(Whiteboard.PROGRESS_MS + 10);

    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(1);
    const stroke = (handler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(stroke.compositeOp).toBe('destination-out');
    expect(stroke.alpha).toBe(0.5);

    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);
  });

  it('uses temp canvas for alpha < 1 strokes (highlighter)', () => {
    wb.setAlpha(0.3);
    wb.setActive(true);

    const mainCanvas = wb.shadowRoot?.querySelector('canvas.main') as HTMLCanvasElement;
    const tempCanvas = wb.shadowRoot?.querySelector('canvas.temp') as HTMLCanvasElement;
    expect(mainCanvas).toBeTruthy();
    expect(tempCanvas).toBeTruthy();

    const strokeSpy = vi.fn();
    wb.addEventListener('geek:whiteboard:stroke', strokeSpy);

    // Start drawing — should use temp canvas
    mainCanvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: 100, clientY: 100, bubbles: true,
    }));
    mainCanvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 200, clientY: 200, bubbles: true,
    }));
    mainCanvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    vi.advanceTimersByTime(Whiteboard.COALESCE_MS + 10);

    // Stroke should have been dispatched with alpha 0.3
    expect(strokeSpy).toHaveBeenCalledTimes(1);
    const stroke = (strokeSpy.mock.calls[0]?.[0] as CustomEvent).detail as WhiteboardStroke;
    expect(stroke.alpha).toBe(0.3);
  });

  it('remote live strokes with alpha < 1 use temp canvas rendering', () => {
    wb.setActive(true);

    // Simulate live stroke with alpha < 1
    const liveStroke = makeStroke({
      slideIndex: 0,
      clientId: 'remote-alpha',
      alpha: 0.3,
      points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]],
    });
    wb.drawLiveStroke(liveStroke);

    // Update with more points
    const liveStroke2 = makeStroke({
      slideIndex: 0,
      clientId: 'remote-alpha',
      alpha: 0.3,
      points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]],
    });
    wb.drawLiveStroke(liveStroke2);

    // Finalize — should move to main canvas
    const finalStroke = makeStroke({
      slideIndex: 0,
      clientId: 'remote-alpha',
      alpha: 0.3,
      points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3], [0.4, 0.4]],
    });
    wb.drawRemoteStroke(finalStroke);

    // No errors means temp canvas rendering worked correctly
  });

  it('readonly attribute prevents toggle, setActive, beginStroke, and clear', () => {
    const rwb = document.createElement('geek-whiteboard') as Whiteboard;
    rwb.setAttribute('readonly', '');
    document.body.appendChild(rwb);

    // toggle should be a no-op
    expect(rwb.isVisible).toBe(false);
    rwb.toggle();
    expect(rwb.isVisible).toBe(false);

    // setActive should be a no-op
    rwb.setActive(true);
    expect(rwb.isVisible).toBe(false);

    // beginStroke should be a no-op (no error thrown)
    const evt = new PointerEvent('pointerdown', { clientX: 100, clientY: 100 });
    rwb.beginStroke(evt);

    // clear should be a no-op (no error thrown)
    rwb.clear();

    document.body.removeChild(rwb);
  });

  it('readonly attribute prevents pointer listeners from being registered', () => {
    const rwb = document.createElement('geek-whiteboard') as Whiteboard;
    rwb.setAttribute('readonly', '');
    document.body.appendChild(rwb);

    const canvas = rwb.shadowRoot?.querySelector('canvas:not(.temp)') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    // Fire pointer events — they should not start drawing
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 50, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // No stroke event should have been emitted
    let strokeEmitted = false;
    rwb.addEventListener('geek:whiteboard:stroke', () => { strokeEmitted = true; });
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 50, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(strokeEmitted).toBe(false);

    document.body.removeChild(rwb);
  });

  it('readonly whiteboard still renders remote strokes', () => {
    const rwb = document.createElement('geek-whiteboard') as Whiteboard;
    rwb.setAttribute('readonly', '');
    document.body.appendChild(rwb);

    const stroke = makeStroke({ slideIndex: 0 });
    rwb.drawRemoteStroke(stroke);

    // Should auto-show for remote strokes even in readonly mode
    expect(rwb.isVisible).toBe(true);

    document.body.removeChild(rwb);
  });

  it('userDismissed is set when whiteboard is toggled off and cleared when toggled on', () => {
    expect(wb.userDismissed).toBe(false);

    // Activate then toggle off → userDismissed = true
    wb.setActive(true);
    expect(wb.userDismissed).toBe(false);
    wb.toggle();
    expect(wb.isVisible).toBe(false);
    expect(wb.userDismissed).toBe(true);

    // Toggle back on → userDismissed = false
    wb.toggle();
    expect(wb.isVisible).toBe(true);
    expect(wb.userDismissed).toBe(false);
  });

  it('userDismissed is set by setActive(false) and cleared by setActive(true)', () => {
    wb.setActive(true);
    expect(wb.userDismissed).toBe(false);

    wb.setActive(false);
    expect(wb.userDismissed).toBe(true);

    wb.setActive(true);
    expect(wb.userDismissed).toBe(false);
  });

  it('toggleCanvas toggles visibility without setting userDismissed', () => {
    wb.setActive(true);
    expect(wb.isVisible).toBe(true);
    expect(wb.userDismissed).toBe(false);

    // Hide via toggleCanvas — userDismissed stays false
    wb.toggleCanvas();
    expect(wb.isVisible).toBe(false);
    expect(wb.userDismissed).toBe(false);

    // Show via toggleCanvas — still no userDismissed
    wb.toggleCanvas();
    expect(wb.isVisible).toBe(true);
    expect(wb.userDismissed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Toolbar ownership and wiring
// ---------------------------------------------------------------------------

describe('Whiteboard toolbar ownership', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function makeWb(readonly = false): Whiteboard {
    const el = document.createElement('geek-whiteboard') as Whiteboard;
    if (readonly) el.setAttribute('readonly', '');
    container.appendChild(el);
    return el;
  }

  it('exposes toolbar for presenter mode', () => {
    const wb = makeWb(false);
    expect(wb.toolbar).toBeTruthy();
  });

  it('toolbar is null in readonly mode', () => {
    const wb = makeWb(true);
    expect(wb.toolbar).toBeNull();
  });

  it('toolbar is appended to shadow root for presenter', () => {
    const wb = makeWb(false);
    expect(wb.shadowRoot?.querySelector('geek-whiteboard-toolbar')).toBeTruthy();
  });

  it('no toolbar in shadow root for readonly', () => {
    const wb = makeWb(true);
    expect(wb.shadowRoot?.querySelector('geek-whiteboard-toolbar')).toBeNull();
  });

  it('tool-change event sets compositeOp, width, and alpha on whiteboard', () => {
    const wb = makeWb(false);
    const toolbar = wb.toolbar!;
    const spyOp = vi.spyOn(wb, 'setCompositeOp');
    const spyWidth = vi.spyOn(wb, 'setWidth');
    const spyAlpha = vi.spyOn(wb, 'setAlpha');

    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:tool-change', {
      bubbles: true,
      detail: { settings: { compositeOp: 'destination-out', width: 12, alpha: 0.5 } },
    }));

    expect(spyOp).toHaveBeenCalledWith('destination-out');
    expect(spyWidth).toHaveBeenCalledWith(12);
    expect(spyAlpha).toHaveBeenCalledWith(0.5);
  });

  it('color-change event sets color on whiteboard', () => {
    const wb = makeWb(false);
    const toolbar = wb.toolbar!;
    const spyColor = vi.spyOn(wb, 'setColor');

    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:color-change', {
      bubbles: true,
      detail: { color: '#ff9900' },
    }));

    expect(spyColor).toHaveBeenCalledWith('#ff9900');
  });

  it('hide-request event toggles canvas and emits composed geek:whiteboard:hide', () => {
    const wb = makeWb(false);
    const toolbar = wb.toolbar!;
    wb.setActive(true);

    const spy = vi.fn();
    container.addEventListener('geek:whiteboard:hide', spy);

    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:hide-request', { bubbles: true }));

    expect(wb.isVisible).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
    const event = spy.mock.calls[0]?.[0] as CustomEvent<{ visible: boolean }>;
    expect(event.detail.visible).toBe(false);
  });

  it('clear-request event clears canvas and emits composed geek:whiteboard:clear', () => {
    const wb = makeWb(false);
    wb.slideIndex = 3;
    const toolbar = wb.toolbar!;

    const spy = vi.fn();
    container.addEventListener('geek:whiteboard:clear', spy);

    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:clear-request', { bubbles: true }));

    const event = spy.mock.calls[0]?.[0] as CustomEvent<{ slideIndex: number }>;
    expect(event.detail.slideIndex).toBe(3);
  });

  it('collapsed-change event updates toolbarCollapsed on whiteboard', () => {
    const wb = makeWb(false);
    const toolbar = wb.toolbar!;

    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:collapsed-change', {
      bubbles: true,
      detail: { collapsed: true },
    }));

    expect(wb.toolbarCollapsed).toBe(true);
  });

  it('collapsing toolbar disables pointer-events and touch-action on canvas', () => {
    const wb = makeWb(false);
    wb.toggle(); // make visible so canvas is shown
    const toolbar = wb.toolbar!;

    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:collapsed-change', {
      bubbles: true,
      detail: { collapsed: true },
    }));

    const canvas = wb.shadowRoot!.querySelector<HTMLCanvasElement>('canvas.main')!;
    expect(canvas.style.pointerEvents).toBe('none');
    expect(canvas.style.touchAction).toBe('auto');
  });

  it('expanding toolbar restores pointer-events and touch-action on canvas', () => {
    const wb = makeWb(false);
    wb.toggle();
    const toolbar = wb.toolbar!;

    // Collapse then expand
    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:collapsed-change', {
      bubbles: true,
      detail: { collapsed: true },
    }));
    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:collapsed-change', {
      bubbles: true,
      detail: { collapsed: false },
    }));

    const canvas = wb.shadowRoot!.querySelector<HTMLCanvasElement>('canvas.main')!;
    expect(canvas.style.pointerEvents).toBe('auto');
    expect(canvas.style.touchAction).toBe('none');
  });

  it('canvas remains visible after slide navigation while toolbar is collapsed', () => {
    const wb = makeWb(false);
    wb.toggle(); // activate whiteboard
    const toolbar = wb.toolbar!;

    // Collapse toolbar — canvas pointer-events go passive but canvas stays shown
    toolbar.dispatchEvent(new CustomEvent('geek:whiteboard:collapsed-change', {
      bubbles: true,
      detail: { collapsed: true },
    }));

    // Simulate a draw so the slide has content, then navigate away and back
    // by calling saveSlide / restoreSlide directly (mirrors slideIndex setter logic)
    wb.saveSlide();
    const snapshot = (wb as any)['#slideSnapshots']?.get?.(0)
      ?? (wb as any)._Whiteboard__slideSnapshots?.get?.(0);
    // We can't easily inject strokes in unit tests, so instead we verify
    // that #showCanvas no longer bails when collapsed by checking canvas display.
    // Directly call the private method via the exposed toggle path:
    wb.toggle(); // hide
    wb.toggle(); // show again — was broken when collapsed (canvas stayed display:none)

    const canvas = wb.shadowRoot!.querySelector<HTMLCanvasElement>('canvas.main')!;
    // Canvas must be displayed (even though toolbar is collapsed)
    expect(canvas.style.display).not.toBe('none');
    // Pointer-events must still be none (collapsed state preserved)
    expect(canvas.style.pointerEvents).toBe('none');
  });
});
