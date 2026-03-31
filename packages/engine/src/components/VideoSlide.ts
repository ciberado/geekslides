/**
 * GeekSlides v2 — <geek-video> Web Component.
 *
 * Video player with timestamp-based partial control.
 */

export class VideoSlide extends HTMLElement {
  #timestamps: number[] = [];

  static get observedAttributes(): string[] {
    return ['data-timestamps', 'partial'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
    this.#parseTimestamps();
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null): void {
    if (name === 'data-timestamps') {
      this.#parseTimestamps();
    }
    if (name === 'partial' && newVal !== null) {
      this.#seekToPartial(Number(newVal));
    }
  }

  /**
   * Seek to a specific partial index.
   */
  seekToPartial(index: number): void {
    this.#seekToPartial(index);
  }

  #parseTimestamps(): void {
    const attr = this.getAttribute('data-timestamps');
    if (!attr) {
      this.#timestamps = [];
      return;
    }
    this.#timestamps = attr.split(',').map((s) => Number(s.trim()));
  }

  #seekToPartial(index: number): void {
    const video = this.shadowRoot?.querySelector('video');
    if (!video) return;

    if (index >= 0 && index < this.#timestamps.length) {
      const time = this.#timestamps[index];
      if (time !== undefined) {
        video.currentTime = time;
        void video.play();
      }
    }
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; }
      video { width: 100%; height: auto; }
    `;

    // Move the <video> from light DOM into shadow
    const video = this.querySelector('video');
    if (video) {
      shadow.replaceChildren(style, video);
    } else {
      shadow.replaceChildren(style);
    }
  }
}
