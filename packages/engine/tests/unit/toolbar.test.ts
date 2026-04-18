// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Slideshow } from '../../src/core/Slideshow.ts';
import { Slide } from '../../src/core/Slide.ts';

// jsdom does not provide ResizeObserver
const resizeObserverMock = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

beforeAll(() => {
  globalThis.ResizeObserver = resizeObserverMock as unknown as typeof ResizeObserver;
});

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete (globalThis as Record<string, unknown>)['ResizeObserver'];
});

// Register custom elements for testing
if (!customElements.get('geek-slideshow')) {
  customElements.define('geek-slideshow', Slideshow);
}
if (!customElements.get('geek-slide')) {
  customElements.define('geek-slide', Slide);
}

describe('Slideshow toolbar', () => {
  function createSlideshow(): Slideshow {
    const el = document.createElement('geek-slideshow') as Slideshow;
    document.body.appendChild(el);
    return el;
  }

  function cleanup(el: Slideshow): void {
    document.body.removeChild(el);
  }

  it('renders a toolbar element in the shadow DOM', () => {
    const el = createSlideshow();
    const toolbar = el.shadowRoot?.querySelector('.gs-toolbar');

    expect(toolbar).not.toBeNull();
    expect(toolbar?.getAttribute('role')).toBe('toolbar');
    expect(toolbar?.getAttribute('aria-label')).toBe('Presentation controls');

    cleanup(el);
  });

  it('toolbar is hidden by default (no open attribute)', () => {
    const el = createSlideshow();
    const toolbar = el.shadowRoot?.querySelector('.gs-toolbar');

    expect(toolbar?.hasAttribute('open')).toBe(false);

    cleanup(el);
  });

  it('toggleToolbar() opens and closes the toolbar', () => {
    const el = createSlideshow();
    const toolbar = el.shadowRoot?.querySelector('.gs-toolbar');

    el.toggleToolbar();
    expect(toolbar?.hasAttribute('open')).toBe(true);

    el.toggleToolbar();
    expect(toolbar?.hasAttribute('open')).toBe(false);

    cleanup(el);
  });

  it('toolbar contains expected command buttons', () => {
    const el = createSlideshow();
    const buttons = el.shadowRoot?.querySelectorAll('.gs-toolbar button');

    expect(buttons).toBeDefined();
    const commands = [...(buttons ?? [])].map((b) => (b as HTMLElement).dataset.command);

    expect(commands).toContain('prev');
    expect(commands).toContain('next');
    expect(commands).toContain('overview');
    expect(commands).toContain('fullscreen');
    expect(commands).toContain('whiteboard');
    expect(commands).toContain('speaker');

    cleanup(el);
  });

  it('button click dispatches geek:toolbar:command event', () => {
    const el = createSlideshow();
    const spy = vi.fn();
    el.addEventListener('geek:toolbar:command', spy);

    const nextBtn = el.shadowRoot?.querySelector('button[data-command="next"]') as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();

    nextBtn.click();

    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls[0]?.[0] as CustomEvent<{ command: string }>).detail;
    expect(detail.command).toBe('next');

    cleanup(el);
  });

  it('each button dispatches the correct command', () => {
    const el = createSlideshow();
    const events: string[] = [];
    el.addEventListener('geek:toolbar:command', (e) => {
      events.push((e as CustomEvent<{ command: string }>).detail.command);
    });

    const buttons = el.shadowRoot?.querySelectorAll<HTMLButtonElement>('.gs-toolbar button');
    for (const btn of buttons ?? []) {
      btn.click();
    }

    expect(events).toEqual(['prev', 'next', 'overview', 'fullscreen', 'whiteboard', 'speaker']);

    cleanup(el);
  });

  it('buttons have accessible aria-labels', () => {
    const el = createSlideshow();
    const buttons = el.shadowRoot?.querySelectorAll('.gs-toolbar button');

    for (const btn of buttons ?? []) {
      expect(btn.getAttribute('aria-label')).toBeTruthy();
    }

    cleanup(el);
  });

  it('toolbar has separator elements for visual grouping', () => {
    const el = createSlideshow();
    const separators = el.shadowRoot?.querySelectorAll('.gs-toolbar .gs-toolbar-sep');

    expect(separators?.length).toBeGreaterThan(0);

    cleanup(el);
  });
});
