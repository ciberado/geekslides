// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SpeakerView } from '../../src/components/SpeakerView.ts';
import type { SlideData } from '../../src/core/SlideParser.ts';

// Register the custom element for testing
if (!customElements.get('geek-speaker-view')) {
  customElements.define('geek-speaker-view', SpeakerView);
}

function makeSlides(count: number): SlideData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `slide-${String(i + 1)}`,
    html: `<h2>Slide ${String(i + 1)}</h2>`,
    notesHtml: i % 2 === 0 ? `<p>Notes for slide ${String(i + 1)}</p>` : undefined,
    rawCss: undefined,
    classes: [] as string[],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 0,
  }));
}

describe('SpeakerView', () => {
  it('renders shadow DOM with thumbnails and controls', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    const shadow = el.shadowRoot;
    expect(shadow).not.toBeNull();
    expect(shadow!.querySelector('.thumbnail.current')).not.toBeNull();
    expect(shadow!.querySelector('.thumbnail.next')).not.toBeNull();
    expect(shadow!.querySelector('.notes')).not.toBeNull();
    expect(shadow!.querySelector('.controls')).not.toBeNull();
    expect(shadow!.querySelector('.timer')).not.toBeNull();
    expect(shadow!.querySelector('.counter')).not.toBeNull();

    document.body.removeChild(el);
  });

  it('loadSlides() populates thumbnails and notes', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    const slides = makeSlides(3);
    el.loadSlides(slides);

    const shadow = el.shadowRoot!;
    const currentThumb = shadow.querySelector('.current .thumbnail-inner');
    expect(currentThumb!.innerHTML).toContain('Slide 1');

    const nextThumb = shadow.querySelector('.next .thumbnail-inner');
    expect(nextThumb!.innerHTML).toContain('Slide 2');

    // First slide has notes (even index)
    const notes = shadow.querySelector('.notes');
    expect(notes!.innerHTML).toContain('Notes for slide 1');

    // Counter
    const counter = shadow.querySelector('.counter');
    expect(counter!.textContent).toBe('1 / 3');

    document.body.removeChild(el);
  });

  it('updateSlide() changes displayed slide and notes', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    const slides = makeSlides(4);
    el.loadSlides(slides);
    el.updateSlide(1);

    const shadow = el.shadowRoot!;
    const currentThumb = shadow.querySelector('.current .thumbnail-inner');
    expect(currentThumb!.innerHTML).toContain('Slide 2');

    const nextThumb = shadow.querySelector('.next .thumbnail-inner');
    expect(nextThumb!.innerHTML).toContain('Slide 3');

    // Slide 2 (index 1) has no notes (odd index)
    const notes = shadow.querySelector('.notes');
    expect(notes!.textContent).toBe('No notes for this slide');
    expect(notes!.classList.contains('no-notes')).toBe(true);

    // Counter
    const counter = shadow.querySelector('.counter');
    expect(counter!.textContent).toBe('2 / 4');

    document.body.removeChild(el);
  });

  it('shows end-of-presentation for next slide on last slide', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    const slides = makeSlides(2);
    el.loadSlides(slides);
    el.updateSlide(1);

    const shadow = el.shadowRoot!;
    const nextThumb = shadow.querySelector('.next .thumbnail-inner');
    expect(nextThumb!.innerHTML).toContain('End of presentation');

    document.body.removeChild(el);
  });

  it('dispatches navigation events from buttons', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    const events: string[] = [];
    el.addEventListener('geek:speaker:navigate', ((e: CustomEvent) => {
      events.push(e.detail.direction as string);
    }) as EventListener);

    const shadow = el.shadowRoot!;
    const buttons = shadow.querySelectorAll('button');
    // Buttons: Pause, Reset, Prev, Next
    const prevBtn = buttons[2];
    const nextBtn = buttons[3];

    prevBtn?.click();
    nextBtn?.click();

    expect(events).toEqual(['prev', 'next']);

    document.body.removeChild(el);
  });
});
