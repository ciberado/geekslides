// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { iframeProcessor } from '../../src/plugins/builtins/iframe-processor.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';

describe('iframe-processor', () => {
  it('handles slides with no iframes gracefully', () => {
    const el = {
      querySelectorAll: vi.fn().mockReturnValue([]),
      hasAttribute: vi.fn().mockReturnValue(false),
    } as unknown as HTMLElement;

    const ctx = {
      slideIndex: 0,
      slideCount: 1,
      config: DEFAULT_CONFIG,
      slideshow: {} as HTMLElement,
    };

    // Should not throw
    expect(() => iframeProcessor(el, ctx)).not.toThrow();
  });

  it('sets up MutationObserver and loads iframes when slide becomes active', () => {
    // Capture the MutationObserver callback
    let observerCallback: MutationCallback = () => {};
    const observeMock = vi.fn();
    vi.stubGlobal('MutationObserver', vi.fn().mockImplementation((cb: MutationCallback) => {
      observerCallback = cb;
      return {
        observe: observeMock,
        disconnect: vi.fn(),
      };
    }));

    const mockIframe = Object.create(HTMLIFrameElement.prototype, {
      getAttribute: { value: vi.fn().mockReturnValue('https://example.com') },
      src: { value: '', writable: true },
    });

    const el = {
      querySelectorAll: vi.fn().mockReturnValue([mockIframe]),
      hasAttribute: vi.fn().mockReturnValue(false),
    } as unknown as HTMLElement;

    const ctx = {
      slideIndex: 0,
      slideCount: 1,
      config: DEFAULT_CONFIG,
      slideshow: {} as HTMLElement,
    };

    iframeProcessor(el, ctx);

    // MutationObserver should be set up
    expect(observeMock).toHaveBeenCalledWith(el, {
      attributes: true,
      attributeFilter: ['active'],
    });

    // Simulate the slide becoming active
    (el.hasAttribute as ReturnType<typeof vi.fn>).mockReturnValue(true);
    observerCallback(
      [{ attributeName: 'active' } as MutationRecord],
      {} as MutationObserver,
    );

    // iframe should now have src set from data-src
    expect(mockIframe.src).toBe('https://example.com');

    vi.unstubAllGlobals();
  });

  it('does not load iframes when slide is inactive', () => {
    let observerCallback: MutationCallback = () => {};
    vi.stubGlobal('MutationObserver', vi.fn().mockImplementation((cb: MutationCallback) => {
      observerCallback = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }));

    const mockIframe = Object.create(HTMLIFrameElement.prototype, {
      getAttribute: { value: vi.fn().mockReturnValue('https://example.com') },
      src: { value: '', writable: true },
    });

    const el = {
      querySelectorAll: vi.fn().mockReturnValue([mockIframe]),
      hasAttribute: vi.fn().mockReturnValue(false),
    } as unknown as HTMLElement;

    const ctx = {
      slideIndex: 0,
      slideCount: 1,
      config: DEFAULT_CONFIG,
      slideshow: {} as HTMLElement,
    };

    iframeProcessor(el, ctx);

    // Simulate mutation while slide is NOT active
    observerCallback(
      [{ attributeName: 'active' } as MutationRecord],
      {} as MutationObserver,
    );

    // iframe src should remain empty
    expect(mockIframe.src).toBe('');

    vi.unstubAllGlobals();
  });
});
