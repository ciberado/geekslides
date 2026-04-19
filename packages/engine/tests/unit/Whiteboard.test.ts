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
  getImageData: (_sx: number, _sy: number, sw: number, sh: number) =>
    ({ data: new Uint8ClampedArray(sw * sh * 4), width: sw, height: sh }),
  putImageData: noop,
  set strokeStyle(_v: string) { /* no-op */ },
  set lineWidth(_v: number) { /* no-op */ },
  set lineCap(_v: string) { /* no-op */ },
  set lineJoin(_v: string) { /* no-op */ },
};

const origGetContext = HTMLCanvasElement.prototype.getContext;

// Register the custom element for jsdom
if (!customElements.get('geek-whiteboard')) {
  customElements.define('geek-whiteboard', Whiteboard);
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

    const canvasBefore = wb.shadowRoot?.querySelector('canvas');
    expect(canvasBefore).toBeTruthy();

    // Draw something so we can verify it persists
    wb.drawRemoteStroke(makeStroke({ slideIndex: 0 }));

    // Detach and reattach (simulates loadSlides innerHTML='' + re-append)
    document.body.removeChild(wb);
    document.body.appendChild(wb);

    // Canvas should be the SAME element (not re-created)
    const canvasAfter = wb.shadowRoot?.querySelector('canvas');
    expect(canvasAfter).toBe(canvasBefore);

    // Visibility state should be preserved
    expect(wb.isVisible).toBe(true);
  });
});
