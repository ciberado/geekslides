// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhiteboardToolbar, TOOL_SETTINGS, PALETTE_COLORS } from '../../src/components/WhiteboardToolbar.ts';
import type { WhiteboardTool } from '../../src/components/WhiteboardToolbar.ts';

if (!customElements.get('geek-whiteboard-toolbar')) {
  customElements.define('geek-whiteboard-toolbar', WhiteboardToolbar);
}

describe('WhiteboardToolbar', () => {
  let toolbar: WhiteboardToolbar;

  beforeEach(() => {
    toolbar = document.createElement('geek-whiteboard-toolbar') as WhiteboardToolbar;
    document.body.appendChild(toolbar);
  });

  afterEach(() => {
    if (toolbar.isConnected) document.body.removeChild(toolbar);
  });

  it('renders shadow DOM with toolbar structure', () => {
    const shadow = toolbar.shadowRoot;
    expect(shadow).toBeTruthy();
    expect(shadow?.querySelector('.toolbar')).toBeTruthy();
    expect(shadow?.querySelector('.collapse-btn')).toBeTruthy();
    expect(shadow?.querySelector('.body')).toBeTruthy();
  });

  it('renders three tool buttons', () => {
    const tools = toolbar.shadowRoot?.querySelectorAll('.tool-btn');
    expect(tools?.length).toBe(3);
    const toolNames = Array.from(tools ?? []).map((btn) => btn.getAttribute('data-tool'));
    expect(toolNames).toEqual(['pen', 'highlighter', 'eraser']);
  });

  it('renders 16 color swatches in a 4×4 palette', () => {
    const swatches = toolbar.shadowRoot?.querySelectorAll('.swatch');
    expect(swatches?.length).toBe(16);
  });

  it('renders hide and clear action buttons', () => {
    const hideBtn = toolbar.shadowRoot?.querySelector('[data-action="hide"]');
    const clearBtn = toolbar.shadowRoot?.querySelector('[data-action="clear"]');
    expect(hideBtn).toBeTruthy();
    expect(clearBtn).toBeTruthy();
  });

  it('starts with pen as default tool', () => {
    expect(toolbar.tool).toBe('pen');
    const activeBtn = toolbar.shadowRoot?.querySelector('.tool-btn.active');
    expect(activeBtn?.getAttribute('data-tool')).toBe('pen');
  });

  it('starts with #ff0000 as default color', () => {
    expect(toolbar.color).toBe('#ff0000');
    const activeSwatch = toolbar.shadowRoot?.querySelector('.swatch.active');
    expect(activeSwatch?.getAttribute('data-color')).toBe('#ff0000');
  });

  it('setTool updates active tool button and dispatches event', () => {
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:tool-change', handler);

    toolbar.setTool('highlighter');

    expect(toolbar.tool).toBe('highlighter');
    const activeBtn = toolbar.shadowRoot?.querySelector('.tool-btn.active');
    expect(activeBtn?.getAttribute('data-tool')).toBe('highlighter');
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail.tool).toBe('highlighter');
    expect(detail.settings).toEqual(TOOL_SETTINGS.highlighter);
  });

  it('setColor updates active swatch and dispatches event', () => {
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:color-change', handler);

    toolbar.setColor('#0066ff');

    expect(toolbar.color).toBe('#0066ff');
    const activeSwatch = toolbar.shadowRoot?.querySelector('.swatch.active');
    expect(activeSwatch?.getAttribute('data-color')).toBe('#0066ff');
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail.color).toBe('#0066ff');
  });

  it('clicking a tool button changes tool', () => {
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:tool-change', handler);

    const eraserBtn = toolbar.shadowRoot?.querySelector('[data-tool="eraser"]') as HTMLButtonElement;
    eraserBtn.click();

    expect(toolbar.tool).toBe('eraser');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('clicking a swatch changes color', () => {
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:color-change', handler);

    const swatch = toolbar.shadowRoot?.querySelector('[data-color="#000000"]') as HTMLButtonElement;
    swatch.click();

    expect(toolbar.color).toBe('#000000');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('toggleCollapse hides and shows the body', () => {
    const body = toolbar.shadowRoot?.querySelector('.body') as HTMLElement;
    expect(body.classList.contains('collapsed')).toBe(false);
    expect(toolbar.collapsed).toBe(false);

    toolbar.toggleCollapse();
    expect(body.classList.contains('collapsed')).toBe(true);
    expect(toolbar.collapsed).toBe(true);

    toolbar.toggleCollapse();
    expect(body.classList.contains('collapsed')).toBe(false);
    expect(toolbar.collapsed).toBe(false);
  });

  it('clicking collapse button toggles collapsed state', () => {
    const btn = toolbar.shadowRoot?.querySelector('.collapse-btn') as HTMLButtonElement;
    btn.click();
    expect(toolbar.collapsed).toBe(true);

    btn.click();
    expect(toolbar.collapsed).toBe(false);
  });

  it('hide/show controls host display', () => {
    toolbar.hide();
    expect(toolbar.style.display).toBe('none');
    expect(toolbar.isHidden).toBe(true);

    toolbar.show();
    expect(toolbar.style.display).toBe('');
    expect(toolbar.isHidden).toBe(false);
  });

  it('hide button dispatches hide-request event', () => {
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:hide-request', handler);

    const hideBtn = toolbar.shadowRoot?.querySelector('[data-action="hide"]') as HTMLButtonElement;
    hideBtn.click();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('clear button requires double-click for confirmation', () => {
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:clear-request', handler);

    const clearBtn = toolbar.shadowRoot?.querySelector('[data-action="clear"]') as HTMLButtonElement;

    // First click: enters confirmation state
    clearBtn.click();
    expect(handler).not.toHaveBeenCalled();
    expect(clearBtn.classList.contains('confirm')).toBe(true);
    expect(clearBtn.textContent).toBe('?');

    // Second click: confirms and dispatches event
    clearBtn.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(clearBtn.classList.contains('confirm')).toBe(false);
    expect(clearBtn.textContent).toBe('✕');
  });

  it('clear confirmation auto-cancels after timeout', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    toolbar.addEventListener('geek:whiteboard:clear-request', handler);

    const clearBtn = toolbar.shadowRoot?.querySelector('[data-action="clear"]') as HTMLButtonElement;
    clearBtn.click();
    expect(clearBtn.classList.contains('confirm')).toBe(true);

    vi.advanceTimersByTime(3100);
    expect(clearBtn.classList.contains('confirm')).toBe(false);
    expect(clearBtn.textContent).toBe('✕');

    // Clicking now enters confirm state again, not executing
    clearBtn.click();
    expect(handler).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('TOOL_SETTINGS has correct values', () => {
    expect(TOOL_SETTINGS.pen).toEqual({ compositeOp: 'source-over', width: 3, alpha: 1.0 });
    expect(TOOL_SETTINGS.highlighter).toEqual({ compositeOp: 'source-over', width: 20, alpha: 0.3 });
    expect(TOOL_SETTINGS.eraser).toEqual({ compositeOp: 'destination-out', width: 20, alpha: 1.0 });
  });

  it('PALETTE_COLORS has 16 entries', () => {
    expect(PALETTE_COLORS.length).toBe(16);
  });

  it('all palette colors appear as swatches', () => {
    for (const color of PALETTE_COLORS) {
      const swatch = toolbar.shadowRoot?.querySelector(`[data-color="${color}"]`);
      expect(swatch).toBeTruthy();
    }
  });

  it('only one tool button is active at a time', () => {
    toolbar.setTool('eraser');
    const activeButtons = toolbar.shadowRoot?.querySelectorAll('.tool-btn.active');
    expect(activeButtons?.length).toBe(1);
    expect(activeButtons?.[0]?.getAttribute('data-tool')).toBe('eraser');
  });

  it('only one swatch is active at a time', () => {
    toolbar.setColor('#000080');
    const activeSwatches = toolbar.shadowRoot?.querySelectorAll('.swatch.active');
    expect(activeSwatches?.length).toBe(1);
    expect(activeSwatches?.[0]?.getAttribute('data-color')).toBe('#000080');
  });
});
