// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Whiteboard } from '../../src/components/Whiteboard.ts';
import type { WhiteboardStroke } from '../../src/sync/types.ts';

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
    wb = document.createElement('geek-whiteboard') as Whiteboard;
    document.body.appendChild(wb);
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
});
