/**
 * GeekSlides v2 — <geek-whiteboard> Web Component.
 *
 * Canvas overlay for freehand drawing, synced via Yjs.
 * Coordinates normalized to 0–1 for resolution independence.
 *
 * Features:
 * - Per-slide persistence: each slide keeps its own ImageData snapshot.
 * - Auto-activation: becomes visible on first pointer drag.
 * - Remote stroke rendering: listens for geek:whiteboard:remote-stroke events.
 */

import type { WhiteboardStroke } from '../sync/types.ts';

interface SlideSnapshot {
  imageData: ImageData;
  strokes: WhiteboardStroke[];
}

export class Whiteboard extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #isDrawing = false;
  #currentPoints: [number, number][] = [];
  #color = '#ff0000';
  #lineWidth = 3;
  #visible = false;
  #strokeIdCounter = 0;
  #slideIndex = 0;
  #slideSnapshots = new Map<number, SlideSnapshot>();
  #onRemoteStroke: ((e: Event) => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
    this.#setupListeners();
    this.#listenForRemoteStrokes();
  }

  disconnectedCallback(): void {
    this.#removeListeners();
    this.#stopListeningForRemoteStrokes();
  }

  /**
   * Current slide index for tagging strokes.
   */
  get slideIndex(): number {
    return this.#slideIndex;
  }

  set slideIndex(value: number) {
    if (value === this.#slideIndex) return;
    this.saveSlide();
    this.#slideIndex = value;
    this.restoreSlide();
  }

  get isVisible(): boolean {
    return this.#visible;
  }

  /**
   * Toggle whiteboard visibility.
   */
  toggle(): void {
    this.#visible = !this.#visible;
    if (this.#canvas) {
      this.#canvas.style.display = this.#visible ? 'block' : 'none';
    }
  }

  /**
   * Show the whiteboard (auto-activate).
   */
  setActive(active: boolean): void {
    this.#visible = active;
    if (this.#canvas) {
      this.#canvas.style.display = active ? 'block' : 'none';
    }
  }

  /**
   * Begin a stroke from an external pointer event (e.g. auto-activation drag).
   * Captures the pointer so subsequent move/up events target the canvas.
   */
  beginStroke(e: PointerEvent): void {
    if (!this.#canvas) return;
    this.#canvas.setPointerCapture(e.pointerId);
    this.#onPointerDown(e);
  }

  /**
   * Clear all strokes from the canvas and the current slide snapshot.
   */
  clear(): void {
    if (this.#ctx && this.#canvas) {
      this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
    this.#slideSnapshots.delete(this.#slideIndex);
  }

  /**
   * Set drawing color.
   */
  setColor(color: string): void {
    this.#color = color;
  }

  /**
   * Set line width.
   */
  setWidth(width: number): void {
    this.#lineWidth = width;
  }

  /**
   * Save current canvas state for the active slide.
   */
  saveSlide(): void {
    if (!this.#ctx || !this.#canvas) return;
    const imageData = this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
    const existing = this.#slideSnapshots.get(this.#slideIndex);
    this.#slideSnapshots.set(this.#slideIndex, {
      imageData,
      strokes: existing?.strokes ?? [],
    });
  }

  /**
   * Restore canvas state for the active slide.
   */
  restoreSlide(): void {
    if (!this.#ctx || !this.#canvas) return;
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    const snapshot = this.#slideSnapshots.get(this.#slideIndex);
    if (snapshot) {
      this.#ctx.putImageData(snapshot.imageData, 0, 0);
    }
  }

  /**
   * Draw a remote stroke on the canvas (only if it belongs to the current slide).
   */
  drawRemoteStroke(stroke: WhiteboardStroke): void {
    if (stroke.slideIndex !== this.#slideIndex) {
      // Store for later display when we navigate to that slide
      this.#storeRemoteStroke(stroke);
      return;
    }

    this.#drawStroke(stroke);

    // Auto-show when receiving remote strokes
    if (!this.#visible) {
      this.setActive(true);
    }
  }

  #storeRemoteStroke(stroke: WhiteboardStroke): void {
    const snapshot = this.#slideSnapshots.get(stroke.slideIndex);
    if (snapshot) {
      snapshot.strokes.push(stroke);
    } else {
      const w = this.#canvas?.width ?? 1920;
      const h = this.#canvas?.height ?? 1080;
      // ImageData may not be available in test environments
      const imageData = typeof ImageData !== 'undefined'
        ? new ImageData(w, h)
        : { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } as ImageData;
      this.#slideSnapshots.set(stroke.slideIndex, {
        imageData,
        strokes: [stroke],
      });
    }
  }

  #drawStroke(stroke: WhiteboardStroke): void {
    if (!this.#ctx || !this.#canvas) return;

    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      if (!point) continue;
      const x = point[0] * w;
      const y = point[1] * h;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: none;
        pointer-events: auto;
        touch-action: none;
        cursor: crosshair;
      }
    `;

    this.#canvas = document.createElement('canvas');
    this.#canvas.width = 1920;
    this.#canvas.height = 1080;
    this.#ctx = this.#canvas.getContext('2d');

    shadow.replaceChildren(style, this.#canvas);
  }

  #setupListeners(): void {
    if (!this.#canvas) return;

    // Disable drawing on mobile to avoid conflict with navigation gestures
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches) return;

    this.#canvas.addEventListener('pointerdown', this.#onPointerDown);
    this.#canvas.addEventListener('pointermove', this.#onPointerMove);
    this.#canvas.addEventListener('pointerup', this.#onPointerUp);

    // Prevent touch events from bubbling to TouchInput (swipe navigation)
    this.#canvas.addEventListener('touchstart', this.#stopTouchPropagation);
    this.#canvas.addEventListener('touchmove', this.#stopTouchPropagation);
    this.#canvas.addEventListener('touchend', this.#stopTouchPropagation);
  }

  #removeListeners(): void {
    if (!this.#canvas) return;
    this.#canvas.removeEventListener('pointerdown', this.#onPointerDown);
    this.#canvas.removeEventListener('pointermove', this.#onPointerMove);
    this.#canvas.removeEventListener('pointerup', this.#onPointerUp);
    this.#canvas.removeEventListener('touchstart', this.#stopTouchPropagation);
    this.#canvas.removeEventListener('touchmove', this.#stopTouchPropagation);
    this.#canvas.removeEventListener('touchend', this.#stopTouchPropagation);
  }

  #listenForRemoteStrokes(): void {
    this.#onRemoteStroke = (e: Event) => {
      const stroke = (e as CustomEvent<WhiteboardStroke>).detail;
      this.drawRemoteStroke(stroke);
    };
    document.addEventListener('geek:whiteboard:remote-stroke', this.#onRemoteStroke);
  }

  #stopListeningForRemoteStrokes(): void {
    if (this.#onRemoteStroke) {
      document.removeEventListener('geek:whiteboard:remote-stroke', this.#onRemoteStroke);
      this.#onRemoteStroke = null;
    }
  }

  #normalize(clientX: number, clientY: number): [number, number] {
    if (!this.#canvas) return [0, 0];
    const rect = this.#canvas.getBoundingClientRect();
    return [
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height,
    ];
  }

  #stopTouchPropagation = (e: TouchEvent): void => {
    e.stopPropagation();
  };

  #onPointerDown = (e: PointerEvent): void => {
    this.#isDrawing = true;
    this.#currentPoints = [this.#normalize(e.clientX, e.clientY)];

    if (this.#ctx) {
      this.#ctx.strokeStyle = this.#color;
      this.#ctx.lineWidth = this.#lineWidth;
      this.#ctx.lineCap = 'round';
      this.#ctx.lineJoin = 'round';
      this.#ctx.beginPath();
      const [x, y] = this.#normalize(e.clientX, e.clientY);
      this.#ctx.moveTo(x * (this.#canvas?.width ?? 1920), y * (this.#canvas?.height ?? 1080));
    }
  };

  #onPointerMove = (e: PointerEvent): void => {
    if (!this.#isDrawing || !this.#ctx || !this.#canvas) return;

    const point = this.#normalize(e.clientX, e.clientY);
    this.#currentPoints.push(point);

    this.#ctx.lineTo(point[0] * this.#canvas.width, point[1] * this.#canvas.height);
    this.#ctx.stroke();
    this.#ctx.beginPath();
    this.#ctx.moveTo(point[0] * this.#canvas.width, point[1] * this.#canvas.height);
  };

  #onPointerUp = (): void => {
    if (!this.#isDrawing) return;
    this.#isDrawing = false;

    if (this.#currentPoints.length > 1) {
      const stroke: WhiteboardStroke = {
        id: `stroke-${String(++this.#strokeIdCounter)}`,
        slideIndex: this.#slideIndex,
        points: this.#currentPoints,
        color: this.#color,
        width: this.#lineWidth,
        clientId: '',
      };

      // Store locally for per-slide persistence
      const snapshot = this.#slideSnapshots.get(this.#slideIndex);
      if (snapshot) {
        snapshot.strokes.push(stroke);
      }

      this.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', {
        bubbles: true,
        detail: stroke,
      }));
    }

    this.#currentPoints = [];
  };
}
