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

  it('sets up MutationObserver when iframes with data-src exist', () => {
    // Mock MutationObserver
    const observeMock = vi.fn();
    vi.stubGlobal('MutationObserver', vi.fn().mockImplementation(() => ({
      observe: observeMock,
      disconnect: vi.fn(),
    })));

    const mockIframe = {
      getAttribute: vi.fn().mockReturnValue('https://example.com'),
      src: '',
    };

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

    vi.unstubAllGlobals();
  });
});
