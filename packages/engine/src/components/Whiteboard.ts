/**
 * GeekSlides v2 — <geek-whiteboard> Web Component.
 *
 * Canvas overlay for freehand drawing, synced via Yjs.
 * Coordinates normalized to 0–1 for resolution independence.
 */

import type { WhiteboardStroke } from '../sync/types.ts';

export class Whiteboard extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #isDrawing = false;
  #currentPoints: [number, number][] = [];
  #color = '#ff0000';
  #lineWidth = 3;
  #visible = false;
  #strokeIdCounter = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
    this.#setupListeners();
  }

  disconnectedCallback(): void {
    this.#removeListeners();
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
   * Clear all strokes from the canvas.
   */
  clear(): void {
    if (this.#ctx && this.#canvas) {
      this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
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
   * Draw a remote stroke on the canvas.
   */
  drawRemoteStroke(stroke: WhiteboardStroke): void {
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
    if (window.matchMedia('(max-width: 768px)').matches) return;

    this.#canvas.addEventListener('pointerdown', this.#onPointerDown);
    this.#canvas.addEventListener('pointermove', this.#onPointerMove);
    this.#canvas.addEventListener('pointerup', this.#onPointerUp);
  }

  #removeListeners(): void {
    if (!this.#canvas) return;
    this.#canvas.removeEventListener('pointerdown', this.#onPointerDown);
    this.#canvas.removeEventListener('pointermove', this.#onPointerMove);
    this.#canvas.removeEventListener('pointerup', this.#onPointerUp);
  }

  #normalize(clientX: number, clientY: number): [number, number] {
    if (!this.#canvas) return [0, 0];
    const rect = this.#canvas.getBoundingClientRect();
    return [
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height,
    ];
  }

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
        slideIndex: 0, // Set by parent
        points: this.#currentPoints,
        color: this.#color,
        width: this.#lineWidth,
        clientId: '',
      };

      this.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', {
        bubbles: true,
        detail: stroke,
      }));
    }

    this.#currentPoints = [];
  };
}
