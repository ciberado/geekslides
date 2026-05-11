// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerLayoutTransform,
  applyLayoutTransforms,
} from '../../src/core/LayoutTransforms.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSection(...classes: string[]): HTMLElement {
  const el = document.createElement('section');
  el.className = ['content', ...classes].join(' ');
  return el;
}

// ─── Registry tests ───────────────────────────────────────────────────────────

describe('registerLayoutTransform / applyLayoutTransforms', () => {
  it('calls a registered transform when the matching class is present', () => {
    registerLayoutTransform('layout-test-basic', (section) => {
      section.dataset['transformed'] = 'yes';
    });

    const section = makeSection('layout-test-basic');
    applyLayoutTransforms(section);

    expect(section.dataset['transformed']).toBe('yes');
  });

  it('does not call a transform when the class is absent', () => {
    let called = false;
    registerLayoutTransform('layout-test-absent', () => { called = true; });

    const section = makeSection('layout-other');
    applyLayoutTransforms(section);

    expect(called).toBe(false);
  });

  it('calls multiple transforms when multiple registered classes are present', () => {
    registerLayoutTransform('layout-test-multi-a', (s) => { s.dataset['a'] = '1'; });
    registerLayoutTransform('layout-test-multi-b', (s) => { s.dataset['b'] = '2'; });

    const section = makeSection('layout-test-multi-a', 'layout-test-multi-b');
    applyLayoutTransforms(section);

    expect(section.dataset['a']).toBe('1');
    expect(section.dataset['b']).toBe('2');
  });

  it('is a no-op when no classes match any registered transform', () => {
    const section = makeSection('layout-totally-unknown');
    expect(() => applyLayoutTransforms(section)).not.toThrow();
  });

  it('later registration overwrites earlier registration for the same class', () => {
    registerLayoutTransform('layout-test-overwrite', (s) => { s.dataset['v'] = 'first'; });
    registerLayoutTransform('layout-test-overwrite', (s) => { s.dataset['v'] = 'second'; });

    const section = makeSection('layout-test-overwrite');
    applyLayoutTransforms(section);

    expect(section.dataset['v']).toBe('second');
  });
});

// ─── Built-in: layout-three-col ──────────────────────────────────────────────

describe('built-in: layout-three-col transform', () => {
  let section: HTMLElement;

  beforeEach(() => {
    section = makeSection('layout-three-col');
    section.innerHTML = `
      <h3>Section Title</h3>
      <h4>Card A</h4>
      <p>Content A</p>
      <h4>Card B</h4>
      <ul><li>Item B</li></ul>
      <h4>Card C</h4>
      <div class="block-image"><img src="img.png" alt="C"></div>
    `;
    applyLayoutTransforms(section);
  });

  it('wraps each h4 and its sibling content into a .gs-card div', () => {
    const cards = section.querySelectorAll(':scope > .gs-card');
    expect(cards).toHaveLength(3);
  });

  it('places h4 as the first child of each card', () => {
    const cards = section.querySelectorAll(':scope > .gs-card');
    for (const card of cards) {
      expect(card.firstElementChild?.tagName).toBe('H4');
    }
  });

  it('moves a following <p> into the card', () => {
    const card = section.querySelector(':scope > .gs-card:nth-child(2)')!;
    expect(card.querySelector('p')).not.toBeNull();
  });

  it('moves a following <ul> into the card', () => {
    const card = section.querySelector(':scope > .gs-card:nth-child(3)')!;
    expect(card.querySelector('ul')).not.toBeNull();
  });

  it('moves a following .block-image into the card', () => {
    const card = section.querySelector(':scope > .gs-card:nth-child(4)')!;
    expect(card.querySelector('.block-image')).not.toBeNull();
  });

  it('preserves the h3 section title as a direct child of section', () => {
    expect(section.querySelector(':scope > h3')).not.toBeNull();
  });

  it('does not create .gs-card wrappers when there are no h4 elements', () => {
    const plain = makeSection('layout-three-col');
    plain.innerHTML = '<h3>Only a title</h3><p>Some text</p>';
    applyLayoutTransforms(plain);
    expect(plain.querySelectorAll('.gs-card')).toHaveLength(0);
  });

  it('wraps an h4 without a following content sibling into a single-child card', () => {
    const sparse = makeSection('layout-three-col');
    sparse.innerHTML = '<h4>Lone Card</h4>';
    applyLayoutTransforms(sparse);
    const cards = sparse.querySelectorAll('.gs-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.querySelector('h4')).not.toBeNull();
    expect(cards[0]?.children).toHaveLength(1);
  });
});

// ─── Built-in: layout-compare ────────────────────────────────────────────────

describe('built-in: layout-compare transform', () => {
  it('replaces h4 with a span.gs-vs-badge', () => {
    const section = makeSection('layout-compare');
    section.innerHTML = `
      <ul><li>Option A</li></ul>
      <h4>vs</h4>
      <ul><li>Option B</li></ul>
    `;
    applyLayoutTransforms(section);

    const badge = section.querySelector('.gs-vs-badge');
    expect(badge).not.toBeNull();
    expect(badge?.tagName).toBe('SPAN');
    expect(badge?.textContent).toBe('vs');
  });

  it('removes the original h4 element', () => {
    const section = makeSection('layout-compare');
    section.innerHTML = '<h4>VS</h4>';
    applyLayoutTransforms(section);

    expect(section.querySelector('h4')).toBeNull();
  });

  it('preserves badge text content', () => {
    const section = makeSection('layout-compare');
    section.innerHTML = '<h4>versus</h4>';
    applyLayoutTransforms(section);

    expect(section.querySelector('.gs-vs-badge')?.textContent).toBe('versus');
  });

  it('is a no-op when there is no h4 in the section', () => {
    const section = makeSection('layout-compare');
    section.innerHTML = '<ul><li>A</li></ul><ul><li>B</li></ul>';
    applyLayoutTransforms(section);

    expect(section.querySelector('.gs-vs-badge')).toBeNull();
    expect(section.querySelectorAll('ul')).toHaveLength(2);
  });

  it('only replaces the first h4 (the VS badge position)', () => {
    const section = makeSection('layout-compare');
    section.innerHTML = '<h4>VS</h4><h4>Extra</h4>';
    applyLayoutTransforms(section);

    // First h4 → span, second h4 remains untouched
    expect(section.querySelector('.gs-vs-badge')).not.toBeNull();
    expect(section.querySelector('h4')).not.toBeNull();
    expect(section.querySelector('h4')?.textContent).toBe('Extra');
  });
});

// ─── Built-in: layout-features ───────────────────────────────────────────────

describe('built-in: layout-features transform (reuses threeColTransform)', () => {
  it('wraps all four h4+content pairs in .gs-card divs', () => {
    const section = makeSection('layout-features');
    section.innerHTML = `
      <h3>Key Features</h3>
      <h4>⚡ Fast</h4><p>One million events/sec.</p>
      <h4>🔒 Secure</h4><p>E2E encryption.</p>
      <h4>📦 Simple</h4><p>One-line install.</p>
      <h4>🌐 Global</h4><p>50 edge locations.</p>
    `;
    applyLayoutTransforms(section);

    const cards = section.querySelectorAll('.gs-card');
    expect(cards).toHaveLength(4);
  });

  it('each .gs-card contains an h4 and a content element', () => {
    const section = makeSection('layout-features');
    section.innerHTML = `
      <h4>Fast</h4><p>Description A.</p>
      <h4>Secure</h4><ul><li>Item</li></ul>
    `;
    applyLayoutTransforms(section);

    const cards = Array.from(section.querySelectorAll('.gs-card'));
    for (const card of cards) {
      expect(card.querySelector('h4')).not.toBeNull();
      expect(card.children.length).toBe(2);
    }
  });

  it('does not affect the optional h3 title', () => {
    const section = makeSection('layout-features');
    section.innerHTML = `
      <h3>Title</h3>
      <h4>Feature A</h4><p>Body A.</p>
    `;
    applyLayoutTransforms(section);

    expect(section.querySelector('h3')).not.toBeNull();
    expect(section.querySelector('.gs-card')).not.toBeNull();
  });
});
