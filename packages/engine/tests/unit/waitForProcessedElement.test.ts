// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitForProcessedElement } from '../../src/utils/waitForProcessedElement.ts';

// Helper: build a minimal slide content section with an anchor element inside it.
function makeSlideContent(anchorTag = 'span'): { content: HTMLElement; anchor: HTMLElement } {
  const content = document.createElement('section');
  content.className = 'content';
  const anchor = document.createElement(anchorTag);
  content.appendChild(anchor);
  document.body.appendChild(content);
  return { content, anchor };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('waitForProcessedElement', () => {
  describe('when element already exists', () => {
    it('invokes callback synchronously with the existing element', () => {
      const { content, anchor } = makeSlideContent();
      const target = document.createElement('css-doodle');
      content.appendChild(target);

      const cb = vi.fn();
      waitForProcessedElement('css-doodle', anchor, cb);

      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(target);
    });

    it('returns a no-op cleanup function', () => {
      const { content, anchor } = makeSlideContent();
      content.appendChild(document.createElement('css-doodle'));

      const cleanup = waitForProcessedElement('css-doodle', anchor, vi.fn());
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('when element does not yet exist', () => {
    it('does not invoke callback immediately', () => {
      const { anchor } = makeSlideContent();
      const cb = vi.fn();
      waitForProcessedElement('css-doodle', anchor, cb);
      expect(cb).not.toHaveBeenCalled();
    });

    it('invokes callback when element is added to the content section', async () => {
      const { content, anchor } = makeSlideContent();
      const cb = vi.fn();
      waitForProcessedElement('css-doodle', anchor, cb);

      const target = document.createElement('css-doodle');
      content.appendChild(target);

      // MutationObserver callbacks fire asynchronously (microtask).
      await Promise.resolve();

      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(target);
    });

    it('invokes callback when element is added in a descendant', async () => {
      const { content, anchor } = makeSlideContent();
      const cb = vi.fn();
      waitForProcessedElement('css-doodle', anchor, cb);

      const wrapper = document.createElement('div');
      const target = document.createElement('css-doodle');
      wrapper.appendChild(target);
      content.appendChild(wrapper);

      await Promise.resolve();

      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(target);
    });

    it('invokes callback only once even if multiple mutations fire', async () => {
      const { content, anchor } = makeSlideContent();
      const cb = vi.fn();
      waitForProcessedElement('css-doodle', anchor, cb);

      content.appendChild(document.createElement('css-doodle'));
      content.appendChild(document.createElement('css-doodle'));

      await Promise.resolve();

      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe('cleanup / cancellation', () => {
    it('cleanup stops the observer before element appears', async () => {
      const { content, anchor } = makeSlideContent();
      const cb = vi.fn();
      const cancel = waitForProcessedElement('css-doodle', anchor, cb);

      cancel();
      content.appendChild(document.createElement('css-doodle'));

      await Promise.resolve();

      expect(cb).not.toHaveBeenCalled();
    });

    it('cleanup after match is a no-op', async () => {
      const { content, anchor } = makeSlideContent();
      const cb = vi.fn();
      const cancel = waitForProcessedElement('css-doodle', anchor, cb);

      content.appendChild(document.createElement('css-doodle'));
      await Promise.resolve();

      expect(() => cancel()).not.toThrow();
    });
  });

  describe('anchor resolution', () => {
    it('finds content via section.content ancestor', () => {
      const { content, anchor } = makeSlideContent();
      const target = document.createElement('canvas');
      content.appendChild(target);

      const cb = vi.fn();
      waitForProcessedElement('canvas', anchor, cb);
      expect(cb).toHaveBeenCalledWith(target);
    });

    it('finds content via class containing "content"', () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'slide-content-area';
      const anchor = document.createElement('span');
      wrapper.appendChild(anchor);
      document.body.appendChild(wrapper);

      const target = document.createElement('canvas');
      wrapper.appendChild(target);

      const cb = vi.fn();
      waitForProcessedElement('canvas', anchor, cb);
      expect(cb).toHaveBeenCalledWith(target);
    });

    it('returns no-op cleanup when anchor has no content ancestor', () => {
      // Anchor not inside any content section — orphaned element.
      const anchor = document.createElement('span');
      const cb = vi.fn();

      const cleanup = waitForProcessedElement('css-doodle', anchor, cb);

      expect(cb).not.toHaveBeenCalled();
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('various selectors', () => {
    it('works with arbitrary CSS selectors', async () => {
      const { content, anchor } = makeSlideContent();
      const cb = vi.fn();
      waitForProcessedElement('.gs-chart', anchor, cb);

      const target = document.createElement('div');
      target.className = 'gs-chart';
      content.appendChild(target);

      await Promise.resolve();
      expect(cb).toHaveBeenCalledWith(target);
    });
  });
});
