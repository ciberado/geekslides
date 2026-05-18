// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audioProcessor } from '../../src/plugins/builtins/audio-url-plugin.ts';
import { iframeOverlayProcessor } from '../../src/plugins/builtins/iframe-url-plugin.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import type { ProcessorContext } from '../../src/plugins/types.ts';

// ---------------------------------------------------------------------------
// Shared minimal context required by the Processor signature
// ---------------------------------------------------------------------------
function makeCtx(): ProcessorContext {
  return {
    slideIndex: 0,
    slideCount: 1,
    config: DEFAULT_CONFIG,
    slideshow: document.createElement('div'),
  };
}

// ---------------------------------------------------------------------------

describe('audioProcessor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps a bare <audio> element in <geek-audio>', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<audio src="track.mp3"></audio>';
    document.body.appendChild(slide);

    audioProcessor(slide, makeCtx());

    expect(slide.querySelector('geek-audio')).not.toBeNull();
    expect(slide.querySelector('audio')).toBeNull(); // bare audio replaced
  });

  it('copies the src attribute to the <geek-audio> element', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<audio src="https://example.com/music.mp3"></audio>';
    document.body.appendChild(slide);

    audioProcessor(slide, makeCtx());

    const ga = slide.querySelector('geek-audio');
    expect(ga?.getAttribute('src')).toBe('https://example.com/music.mp3');
  });

  it('copies the title attribute to the <geek-audio> element', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<audio src="music.mp3" title="Background Track"></audio>';
    document.body.appendChild(slide);

    audioProcessor(slide, makeCtx());

    const ga = slide.querySelector('geek-audio');
    expect(ga?.getAttribute('title')).toBe('Background Track');
  });

  it('does NOT copy a missing title (no title attribute on geek-audio)', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<audio src="music.mp3"></audio>';
    document.body.appendChild(slide);

    audioProcessor(slide, makeCtx());

    const ga = slide.querySelector('geek-audio');
    expect(ga?.getAttribute('title')).toBeNull();
  });

  it('does NOT wrap an <audio> element already inside <geek-audio>', () => {
    const slide = document.createElement('div');
    // Simulate what geek-audio renders: audio inside the component
    slide.innerHTML = '<geek-audio src="music.mp3"><audio src="music.mp3"></audio></geek-audio>';
    document.body.appendChild(slide);

    audioProcessor(slide, makeCtx());

    // Still only one geek-audio, not wrapped again
    expect(slide.querySelectorAll('geek-audio').length).toBe(1);
  });

  it('handles a slide with no <audio> elements gracefully', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<p>No audio here</p>';
    document.body.appendChild(slide);

    expect(() => audioProcessor(slide, makeCtx())).not.toThrow();
    expect(slide.querySelector('geek-audio')).toBeNull();
  });

  it('wraps multiple bare <audio> elements', () => {
    const slide = document.createElement('div');
    slide.innerHTML = `
      <audio src="a.mp3"></audio>
      <audio src="b.mp3"></audio>
    `;
    document.body.appendChild(slide);

    audioProcessor(slide, makeCtx());

    expect(slide.querySelectorAll('geek-audio').length).toBe(2);
    expect(slide.querySelectorAll('audio').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('iframeOverlayProcessor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('does nothing when no .gs-iframe-wrapper elements exist', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<p>No iframes here</p>';
    document.body.appendChild(slide);

    expect(() => iframeOverlayProcessor(slide, makeCtx())).not.toThrow();
    expect(slide.querySelector('.gs-iframe-overlay')).toBeNull();
  });

  it('adds one .gs-iframe-overlay per .gs-iframe-wrapper', () => {
    const slide = document.createElement('div');
    slide.innerHTML = `
      <div class="gs-iframe-wrapper"><iframe></iframe></div>
      <div class="gs-iframe-wrapper"><iframe></iframe></div>
    `;
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    expect(slide.querySelectorAll('.gs-iframe-overlay').length).toBe(2);
  });

  it('overlay has role="button"', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector('.gs-iframe-overlay');
    expect(overlay?.getAttribute('role')).toBe('button');
  });

  it('overlay has tabindex="0"', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector('.gs-iframe-overlay');
    expect(overlay?.getAttribute('tabindex')).toBe('0');
  });

  it('overlay has a non-empty aria-label', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector('.gs-iframe-overlay');
    const label = overlay?.getAttribute('aria-label') ?? '';
    expect(label.length).toBeGreaterThan(0);
  });

  it('overlay contains a .gs-iframe-overlay-hint span', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const hint = slide.querySelector('.gs-iframe-overlay-hint');
    expect(hint).not.toBeNull();
    expect(hint?.tagName.toLowerCase()).toBe('span');
  });

  it('overlay hint has the expected instruction text', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const hint = slide.querySelector('.gs-iframe-overlay-hint');
    expect(hint?.textContent).toBe('Click to interact · use ‹ › to navigate');
  });

  it('clicking the overlay hides it (sets display:none)', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(overlay.style.display).toBe('none');
  });

  it('NAV_KEY (ArrowLeft) is dispatched to document on overlay keydown', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'ArrowLeft' }),
    );
  });

  it('NAV_KEY (ArrowRight) is dispatched to document on overlay keydown', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);
    iframeOverlayProcessor(slide, makeCtx());
    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowRight' }));
  });

  it('all seven NAV_KEYS are forwarded to document', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);
    iframeOverlayProcessor(slide, makeCtx());
    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown'];
    for (const key of NAV_KEYS) {
      dispatchSpy.mockClear();
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ key }));
    }
  });

  it('non-nav key "a" is NOT explicitly dispatched to document by the overlay handler', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: false }));

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('non-nav key "Enter" is NOT explicitly dispatched to document by the overlay handler', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: false }));

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('is idempotent — calling processor twice does NOT add a second overlay', () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());
    iframeOverlayProcessor(slide, makeCtx());

    expect(slide.querySelectorAll('.gs-iframe-overlay').length).toBe(1);
  });

  it('overlay is restored (display reset) when slide becomes inactive', async () => {
    const slide = document.createElement('div');
    slide.innerHTML = '<div class="gs-iframe-wrapper"><iframe></iframe></div>';
    document.body.appendChild(slide);

    iframeOverlayProcessor(slide, makeCtx());

    const overlay = slide.querySelector<HTMLElement>('.gs-iframe-overlay')!;

    // Make the slide "active" first so the attribute is present to remove
    slide.setAttribute('active', '');
    await Promise.resolve();
    await Promise.resolve();

    // Click to hide the overlay
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.style.display).toBe('none');

    // Removing the active attribute triggers the MutationObserver → overlay restored
    slide.removeAttribute('active');
    await Promise.resolve();
    await Promise.resolve();

    expect(overlay.style.display).toBe('');
  });
});
