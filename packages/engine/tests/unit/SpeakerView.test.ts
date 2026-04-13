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

function makePartialSlides(): SlideData[] {
  return [
    {
      id: 'slide-1',
      html: '<ul><li partial>First point</li><li partial>Second point</li></ul>',
      notesHtml: '<p>Notes</p>',
      rawCss: undefined,
      classes: [] as string[],
      backgroundImage: undefined,
      backgroundColor: undefined,
      partialCount: 2,
    },
    {
      id: 'slide-2',
      html: '<ul><li partial>Upcoming point</li></ul>',
      notesHtml: undefined,
      rawCss: undefined,
      classes: [] as string[],
      backgroundImage: undefined,
      backgroundColor: undefined,
      partialCount: 1,
    },
  ];
}

describe('SpeakerView', () => {
  it('renders shadow DOM with previews, notes, and controls', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    const shadow = el.shadowRoot;
    expect(shadow).not.toBeNull();
    expect(shadow!.querySelector('.preview-stack')).not.toBeNull();
    expect(shadow!.querySelector('.main-layout')).not.toBeNull();
    expect(shadow!.querySelector('.main-splitter')).not.toBeNull();
    expect(shadow!.querySelector('.preview-splitter')).not.toBeNull();
    expect(shadow!.querySelector('.current-card')).not.toBeNull();
    expect(shadow!.querySelector('.next-card')).not.toBeNull();
    expect(shadow!.querySelector('.notes')).not.toBeNull();
    expect(shadow!.querySelector('.notes-body')).not.toBeNull();
    expect(shadow!.querySelector('.notes-font-decrease')).not.toBeNull();
    expect(shadow!.querySelector('.notes-font-increase')).not.toBeNull();
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
    const currentStage = shadow.querySelector('.current-card .stage') as HTMLElement | null;
    expect(currentStage?.style.width).toBe('1920px');
    expect(currentStage?.style.height).toBe('1080px');

    const currentSlide = shadow.querySelector('.current-card geek-slide') as HTMLElement | null;
    expect(currentSlide?.shadowRoot?.querySelector('section.content')?.innerHTML).toContain('Slide 1');

    const nextSlide = shadow.querySelector('.next-card geek-slide') as HTMLElement | null;
    expect(nextSlide?.shadowRoot?.querySelector('section.content')?.innerHTML).toContain('Slide 2');

    // First slide has notes (even index)
    const notes = shadow.querySelector('.notes-body');
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
    const currentSlide = shadow.querySelector('.current-card geek-slide') as HTMLElement | null;
    expect(currentSlide?.shadowRoot?.querySelector('section.content')?.innerHTML).toContain('Slide 2');

    const nextSlide = shadow.querySelector('.next-card geek-slide') as HTMLElement | null;
    expect(nextSlide?.shadowRoot?.querySelector('section.content')?.innerHTML).toContain('Slide 3');

    // Slide 2 (index 1) has no notes (odd index)
    const notes = shadow.querySelector('.notes-body');
    expect(notes!.textContent).toBe('No notes for this slide');
    expect(shadow.querySelector('.notes')!.classList.contains('no-notes')).toBe(true);

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
    const emptyState = shadow.querySelector('.next-card .empty-state');
    expect(emptyState?.textContent).toBe('End of presentation');

    document.body.removeChild(el);
  });

  it('injects shared styles into rendered previews', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    el.loadStyles('.deck-title { color: rgb(255, 0, 0); }');
    el.loadSlides(makeSlides(2));

    const shadow = el.shadowRoot!;
    const currentSlide = shadow.querySelector('.current-card geek-slide') as HTMLElement | null;
    const injectedStyles = currentSlide?.shadowRoot?.querySelector('.gs-external-styles');

    expect(injectedStyles?.textContent).toContain('.deck-title { color: rgb(255, 0, 0); }');

    document.body.removeChild(el);
  });

  it('adjusts notes font size from the notes toolbar', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    el.loadSlides(makeSlides(1));

    const shadow = el.shadowRoot!;
    const increaseBtn = shadow.querySelector('.notes-font-increase') as HTMLButtonElement | null;
    const decreaseBtn = shadow.querySelector('.notes-font-decrease') as HTMLButtonElement | null;

    const initialFontSize = el.style.getPropertyValue('--gs-speaker-notes-font-size');
    increaseBtn?.click();
    const increasedFontSize = el.style.getPropertyValue('--gs-speaker-notes-font-size');
    decreaseBtn?.click();
    const decreasedFontSize = el.style.getPropertyValue('--gs-speaker-notes-font-size');

    expect(Number.parseFloat(increasedFontSize)).toBeGreaterThan(Number.parseFloat(initialFontSize));
    expect(Number.parseFloat(decreasedFontSize)).toBeLessThanOrEqual(Number.parseFloat(increasedFontSize));

    document.body.removeChild(el);
  });

  it('renders unrevealed partials with speaker-preview styling', () => {
    const el = document.createElement('geek-speaker-view') as SpeakerView;
    document.body.appendChild(el);

    el.loadSlides(makePartialSlides());
    el.updateSlide(0, 1);

    const shadow = el.shadowRoot!;
    const currentSlide = shadow.querySelector('.current-card geek-slide') as HTMLElement | null;
    const currentPartials = currentSlide?.shadowRoot?.querySelectorAll('.gs-partial') ?? [];
    expect(currentPartials[0]?.classList.contains('gs-visible')).toBe(true);
    expect(currentPartials[1]?.classList.contains('gs-visible')).toBe(false);
    const previewStyles = currentSlide?.shadowRoot?.querySelector('.gs-speaker-preview-styles');
    expect(previewStyles?.textContent).toContain('.gs-partial');
    expect(previewStyles?.textContent).toContain('opacity: 0.42');

    const nextSlide = shadow.querySelector('.next-card geek-slide') as HTMLElement | null;
    const nextPartials = nextSlide?.shadowRoot?.querySelectorAll('.gs-partial') ?? [];
    expect(nextPartials[0]?.classList.contains('gs-visible')).toBe(false);

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
    const prevBtn = shadow.querySelector('.speaker-prev') as HTMLButtonElement | null;
    const nextBtn = shadow.querySelector('.speaker-next') as HTMLButtonElement | null;

    prevBtn?.click();
    nextBtn?.click();

    expect(events).toEqual(['prev', 'next']);

    document.body.removeChild(el);
  });
});
