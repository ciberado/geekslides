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
  strokes: WhiteboardStroke[];
}

export class Whiteboard extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #tempCanvas: HTMLCanvasElement | null = null;
  #tempCtx: CanvasRenderingContext2D | null = null;
  #isDrawing = false;
  #currentPoints: [number, number][] = [];
  #color = '#ff0000';
  /** When true, the canvas is suppressed so pointer events pass through to the slide. */
  #toolbarCollapsed = false;
  #lineWidth = 3;
  #compositeOp: GlobalCompositeOperation = 'source-over';
  #alpha = 1.0;
  #visible = false;
  /** Set when the user explicitly hides the whiteboard; suppresses auto-activation. */
  #userDismissed = false;
  /** True when drawing on the temp canvas (alpha < 1 strokes). */
  #usingTempCanvas = false;
  /** Remote live strokes with alpha < 1, rendered on temp canvas. */
  #remoteTempStrokes = new Map<string, WhiteboardStroke>();
  #strokeIdCounter = 0;
  #slideIndex = 0;
  #slideSnapshots = new Map<number, SlideSnapshot>();
  #onRemoteStroke: ((e: Event) => void) | null = null;
  #onRemoteProgress: ((e: Event) => void) | null = null;
  /** Timer for coalescing rapid pen lift/contact cycles into one stroke. */
  #coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Timer for emitting stroke progress to remote viewers. */
  #progressTimer: ReturnType<typeof setInterval> | null = null;
  /** Tracks how many points of each remote live stroke we have already drawn. */
  #liveStrokesRendered = new Map<string, number>();
  /** Timer for deferred fade-in after slide transition. */
  #fadeTimer: ReturnType<typeof setTimeout> | null = null;
  static readonly COALESCE_MS = 80;
  static readonly PROGRESS_MS = 100;
  /** Must match --gs-transition-duration (default 500ms). */
  static readonly TRANSITION_MS = 500;

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
    this.#cancelCoalesce();
    this.#stopProgress();
    this.#cancelFade();
    this.#finalizeStroke();
  }

  /**
   * Current slide index for tagging strokes.
   */
  get slideIndex(): number {
    return this.#slideIndex;
  }

  set slideIndex(value: number) {
    if (value === this.#slideIndex) return;

    // Hide canvas immediately during slide transition
    if (this.#canvas && this.#visible) {
      this.#cancelFade();
      this.#canvas.style.display = 'none';
      this.#canvas.style.opacity = '';
      this.#canvas.style.transition = '';
    }

    this.saveSlide();
    this.#slideIndex = value;
    this.restoreSlide();

    // Only fade in if the target slide has drawn content.
    if (this.#visible && this.#hasContent()) {
      this.#scheduleFadeIn();
    } else if (this.#visible) {
      // Empty slide while active — keep canvas displayed so pointer
      // events still work for drawing.  An empty canvas is fully
      // transparent, so there is no visual artifact.
      if (this.#canvas) {
        this.#canvas.style.display = 'block';
        this.#canvas.style.opacity = '';
        this.#canvas.style.transition = '';
      }
      if (this.#tempCanvas) {
        this.#tempCanvas.style.display = 'block';
        this.#tempCanvas.style.opacity = '';
        this.#tempCanvas.style.transition = '';
      }
    }
  }

  get isVisible(): boolean {
    return this.#visible;
  }

  /**
   * True when the user explicitly dismissed the whiteboard.
   * Auto-activation should check this and skip reactivation.
   */
  get userDismissed(): boolean {
    return this.#userDismissed;
  }

  /**
   * Whether the toolbar is currently collapsed.
   * When collapsed the canvas is hidden so pointer events reach the slide content.
   */
  get toolbarCollapsed(): boolean {
    return this.#toolbarCollapsed;
  }

  /**
   * Called by the toolbar when the user collapses or expands it.
   * Hides/restores the canvas so pointer events pass through when collapsed.
   */
  setToolbarCollapsed(collapsed: boolean): void {
    if (collapsed === this.#toolbarCollapsed) return;
    this.#toolbarCollapsed = collapsed;
    if (!this.#canvas) return;
    if (collapsed) {
      this.#hideCanvas();
    } else if (this.#visible) {
      this.#showCanvas();
    }
  }

  /**
   * Toggle whiteboard visibility.
   */
  toggle(): void {
    if (this.hasAttribute('readonly')) return;
    this.#visible = !this.#visible;
    this.#userDismissed = !this.#visible;
    if (this.#canvas) {
      if (this.#visible) {
        this.#showCanvas();
      } else {
        this.#hideCanvas();
      }
    }
  }

  /**
   * Toggle canvas visibility without setting userDismissed.
   * Used by the toolbar hide button so auto-activation still works
   * and the toolbar remains accessible.
   */
  toggleCanvas(): void {
    if (this.hasAttribute('readonly')) return;
    this.#visible = !this.#visible;
    if (this.#canvas) {
      if (this.#visible) {
        this.#showCanvas();
      } else {
        this.#hideCanvas();
      }
    }
  }

  /**
   * Show the whiteboard (auto-activate).
   */
  setActive(active: boolean): void {
    if (this.hasAttribute('readonly')) return;
    this.#userDismissed = !active;
    this.#setActiveInternal(active);
  }

  /** Internal activation — used by remote stroke auto-show (bypasses readonly). */
  #setActiveInternal(active: boolean): void {
    this.#visible = active;
    if (this.#canvas) {
      if (active) {
        this.#showCanvas();
      } else {
        this.#hideCanvas();
      }
    }
  }

  /**
   * Begin a stroke from an external pointer event (e.g. auto-activation drag).
   */
  beginStroke(e: PointerEvent): void {
    if (this.hasAttribute('readonly')) return;
    // Ensure canvas is visible — it may be hidden on an empty slide.
    if (this.#canvas && this.#canvas.style.display !== 'block') {
      this.#showCanvas();
    }
    this.#onPointerDown(e);
  }

  /**
   * Clear all strokes from the canvas and the current slide snapshot.
   */
  clear(): void {
    if (this.hasAttribute('readonly')) return;
    if (this.#ctx && this.#canvas) {
      this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
    if (this.#tempCtx && this.#tempCanvas) {
      this.#tempCtx.clearRect(0, 0, this.#tempCanvas.width, this.#tempCanvas.height);
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
   * Set canvas composite operation (e.g. 'source-over', 'destination-out').
   */
  setCompositeOp(op: GlobalCompositeOperation): void {
    this.#compositeOp = op;
  }

  /**
   * Set canvas global alpha (0–1).
   */
  setAlpha(alpha: number): void {
    this.#alpha = alpha;
  }

  /**
   * Save current canvas state for the active slide.
   */
  saveSlide(): void {
    // Strokes are already tracked incrementally in the snapshot.
    // Ensure an entry exists so #hasContent() can check it.
    if (!this.#slideSnapshots.has(this.#slideIndex)) {
      this.#slideSnapshots.set(this.#slideIndex, { strokes: [] });
    }
  }

  /**
   * Restore canvas state for the active slide by redrawing strokes.
   * Avoids getImageData/putImageData which causes opaque-canvas
   * tinting in Firefox due to alpha compositing issues.
   */
  restoreSlide(): void {
    if (!this.#ctx || !this.#canvas) return;
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    if (this.#tempCtx && this.#tempCanvas) {
      this.#tempCtx.clearRect(0, 0, this.#tempCanvas.width, this.#tempCanvas.height);
    }
    // Canvas was wiped — any live-progress tracking from the previous slide
    // is stale and must be reset so incoming strokes redraw fully.
    this.#liveStrokesRendered.clear();
    this.#remoteTempStrokes.clear();
    const snapshot = this.#slideSnapshots.get(this.#slideIndex);
    if (snapshot) {
      for (const stroke of snapshot.strokes) {
        this.#drawStroke(stroke);
      }
    }
  }

  /**
   * Draw a remote stroke on the canvas (only if it belongs to the current slide).
   */
  drawRemoteStroke(stroke: WhiteboardStroke): void {
    if (stroke.slideIndex !== this.#slideIndex) {
      // Store for later display when we navigate to that slide
      this.#storeRemoteStroke(stroke);
      // Clean up stale live-progress tracking for this client
      this.#liveStrokesRendered.delete(stroke.clientId);
      this.#remoteTempStrokes.delete(stroke.clientId);
      return;
    }

    // If we drew this stroke incrementally via live progress, clean up.
    // Remote alpha strokes were on the temp canvas — draw final on main.
    if (this.#remoteTempStrokes.has(stroke.clientId)) {
      this.#remoteTempStrokes.delete(stroke.clientId);
      this.#drawStroke(stroke);
      this.#refreshTempCanvas();

      let sn = this.#slideSnapshots.get(this.#slideIndex);
      if (!sn) {
        sn = { strokes: [] };
        this.#slideSnapshots.set(this.#slideIndex, sn);
      }
      sn.strokes.push(stroke);
      return;
    }

    const renderedCount = this.#liveStrokesRendered.get(stroke.clientId);
    if (renderedCount !== undefined) {
      this.#liveStrokesRendered.delete(stroke.clientId);
      if (renderedCount < stroke.points.length) {
        this.#drawStrokeSegment(stroke, renderedCount);
      }
      // Store the finalized stroke so restoreSlide() can redraw it after navigation
      let sn = this.#slideSnapshots.get(this.#slideIndex);
      if (!sn) {
        sn = { strokes: [] };
        this.#slideSnapshots.set(this.#slideIndex, sn);
      }
      sn.strokes.push(stroke);
      // Auto-show already handled by live progress
      return;
    }

    this.#drawStroke(stroke);

    // Track the stroke in the current slide snapshot
    let snapshot = this.#slideSnapshots.get(this.#slideIndex);
    if (!snapshot) {
      snapshot = { strokes: [] };
      this.#slideSnapshots.set(this.#slideIndex, snapshot);
    }
    snapshot.strokes.push(stroke);

    // Auto-show when receiving remote strokes
    if (!this.#visible || this.#canvas?.style.display !== 'block') {
      this.#setActiveInternal(true);
    }
  }

  /**
   * Draw an in-progress remote stroke incrementally (only new points).
   */
  drawLiveStroke(stroke: WhiteboardStroke): void {
    if (stroke.slideIndex !== this.#slideIndex) return;

    // Semi-transparent strokes must be drawn as full single paths on the
    // temp canvas to avoid alpha compounding at segment overlaps.
    if (stroke.alpha != null && stroke.alpha < 1) {
      this.#remoteTempStrokes.set(stroke.clientId, stroke);
      this.#refreshTempCanvas();
      if (!this.#visible || this.#canvas?.style.display !== 'block') {
        this.#setActiveInternal(true);
      }
      return;
    }

    const alreadyDrawn = this.#liveStrokesRendered.get(stroke.clientId) ?? 0;
    if (stroke.points.length <= alreadyDrawn) return;

    this.#drawStrokeSegment(stroke, alreadyDrawn);
    this.#liveStrokesRendered.set(stroke.clientId, stroke.points.length);

    // Auto-show when receiving live strokes
    if (!this.#visible || this.#canvas?.style.display !== 'block') {
      this.#setActiveInternal(true);
    }
  }

  #storeRemoteStroke(stroke: WhiteboardStroke): void {
    const snapshot = this.#slideSnapshots.get(stroke.slideIndex);
    if (snapshot) {
      snapshot.strokes.push(stroke);
    } else {
      this.#slideSnapshots.set(stroke.slideIndex, {
        strokes: [stroke],
      });
    }
  }

  #drawStroke(stroke: WhiteboardStroke): void {
    if (!this.#ctx || !this.#canvas) return;
    this.#drawStrokeSegment(stroke, 0);
  }

  /**
   * Draw a segment of a stroke starting from `fromIndex`.
   * Used both for full strokes (fromIndex=0) and incremental live updates.
   */
  #drawStrokeSegment(stroke: WhiteboardStroke, fromIndex: number, targetCtx?: CanvasRenderingContext2D): void {
    const ctx = targetCtx ?? this.#ctx;
    if (!ctx || !this.#canvas) return;
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    ctx.save();
    ctx.globalCompositeOperation = stroke.compositeOp ?? 'source-over';
    ctx.globalAlpha = stroke.alpha ?? 1.0;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    // When continuing from a previous segment, moveTo the last drawn point
    // so the connecting line is seamless.
    const startIdx = fromIndex > 0 ? fromIndex - 1 : 0;

    for (let i = startIdx; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      if (!point) continue;
      const x = point[0] * w;
      const y = point[1] * h;
      if (i === startIdx) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  #render(): void {
    // Skip re-render when reconnecting after loadSlides() detach/reattach.
    // Preserves canvas state, drawings, and visibility across the cycle.
    if (this.#canvas) return;

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
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: none;
        touch-action: none;
      }
      canvas.main {
        pointer-events: auto;
        cursor: crosshair;
      }
      canvas.temp {
        pointer-events: none;
      }
    `;

    this.#canvas = document.createElement('canvas');
    this.#canvas.className = 'main';
    this.#canvas.width = 1920;
    this.#canvas.height = 1080;
    this.#ctx = this.#canvas.getContext('2d');

    this.#tempCanvas = document.createElement('canvas');
    this.#tempCanvas.className = 'temp';
    this.#tempCanvas.width = 1920;
    this.#tempCanvas.height = 1080;
    this.#tempCtx = this.#tempCanvas.getContext('2d');

    shadow.replaceChildren(style, this.#canvas, this.#tempCanvas);
  }

  #setupListeners(): void {
    if (!this.#canvas) return;
    // In readonly mode, skip all pointer/touch listeners — canvas is view-only.
    if (this.hasAttribute('readonly')) return;

    // Disable drawing on mobile to avoid conflict with navigation gestures
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches) return;

    this.#canvas.addEventListener('pointerdown', this.#onPointerDown);
    this.#canvas.addEventListener('pointermove', this.#onPointerMove);
    this.#canvas.addEventListener('pointerup', this.#onPointerUp);
    this.#canvas.addEventListener('pointercancel', this.#onPointerUp);

    // Capture pointer on canvas-originated events to retain tracking
    this.#canvas.addEventListener('pointerdown', this.#capturePointer);

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
    this.#canvas.removeEventListener('pointercancel', this.#onPointerUp);
    this.#canvas.removeEventListener('pointerdown', this.#capturePointer);
    this.#canvas.removeEventListener('touchstart', this.#stopTouchPropagation);
    this.#canvas.removeEventListener('touchmove', this.#stopTouchPropagation);
    this.#canvas.removeEventListener('touchend', this.#stopTouchPropagation);
  }

  #listenForRemoteStrokes(): void {
    this.#onRemoteStroke = (e: Event) => {
      const stroke = (e as CustomEvent<WhiteboardStroke>).detail;
      this.drawRemoteStroke(stroke);
    };
    this.#onRemoteProgress = (e: Event) => {
      const stroke = (e as CustomEvent<WhiteboardStroke>).detail;
      this.drawLiveStroke(stroke);
    };
    document.addEventListener('geek:whiteboard:remote-stroke', this.#onRemoteStroke);
    document.addEventListener('geek:whiteboard:remote-stroke-progress', this.#onRemoteProgress);
  }

  #stopListeningForRemoteStrokes(): void {
    if (this.#onRemoteStroke) {
      document.removeEventListener('geek:whiteboard:remote-stroke', this.#onRemoteStroke);
      this.#onRemoteStroke = null;
    }
    if (this.#onRemoteProgress) {
      document.removeEventListener('geek:whiteboard:remote-stroke-progress', this.#onRemoteProgress);
      this.#onRemoteProgress = null;
    }
  }

  #showCanvas(): void {
    if (!this.#canvas) return;
    this.#cancelFade();
    // Make visible, start transparent, animate to opaque
    this.#canvas.style.display = 'block';
    if (this.#tempCanvas) this.#tempCanvas.style.display = 'block';
    this.#canvas.style.opacity = '0';
    this.#canvas.style.transition = 'opacity 0.3s ease-in';
    if (this.#tempCanvas) {
      this.#tempCanvas.style.opacity = '0';
      this.#tempCanvas.style.transition = 'opacity 0.3s ease-in';
    }
    // Force layout so the transition triggers from opacity:0
    void this.#canvas.offsetHeight;
    this.#canvas.style.opacity = '1';
    if (this.#tempCanvas) this.#tempCanvas.style.opacity = '1';
    // Clean up inline styles after animation to avoid a permanent
    // compositing layer that tints the slide below (Firefox).
    this.#fadeTimer = setTimeout(() => {
      this.#fadeTimer = null;
      if (this.#canvas) {
        this.#canvas.style.opacity = '';
        this.#canvas.style.transition = '';
      }
      if (this.#tempCanvas) {
        this.#tempCanvas.style.opacity = '';
        this.#tempCanvas.style.transition = '';
      }
    }, 350); // slightly longer than the 300ms transition
  }

  #hideCanvas(): void {
    if (!this.#canvas) return;
    this.#cancelFade();
    this.#canvas.style.display = 'none';
    this.#canvas.style.opacity = '';
    this.#canvas.style.transition = '';
    if (this.#tempCanvas) {
      this.#tempCanvas.style.display = 'none';
      this.#tempCanvas.style.opacity = '';
      this.#tempCanvas.style.transition = '';
    }
  }

  #scheduleFadeIn(): void {
    this.#cancelFade();
    this.#fadeTimer = setTimeout(() => {
      this.#fadeTimer = null;
      if (this.#visible) {
        this.#showCanvas();
      }
    }, Whiteboard.TRANSITION_MS);
  }

  #cancelFade(): void {
    if (this.#fadeTimer !== null) {
      clearTimeout(this.#fadeTimer);
      this.#fadeTimer = null;
    }
  }

  /**
   * True when the current slide has any recorded strokes.
   */
  #hasContent(): boolean {
    const snapshot = this.#slideSnapshots.get(this.#slideIndex);
    return snapshot !== undefined && snapshot.strokes.length > 0;
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

  #capturePointer = (e: PointerEvent): void => {
    this.#canvas?.setPointerCapture(e.pointerId);
  };

  #cancelCoalesce(): void {
    if (this.#coalesceTimer !== null) {
      clearTimeout(this.#coalesceTimer);
      this.#coalesceTimer = null;
    }
  }

  #startProgress(): void {
    if (this.#progressTimer !== null) return;
    this.#progressTimer = setInterval(() => { this.#emitProgress(); }, Whiteboard.PROGRESS_MS);
  }

  #stopProgress(): void {
    if (this.#progressTimer !== null) {
      clearInterval(this.#progressTimer);
      this.#progressTimer = null;
    }
  }

  #emitProgress(): void {
    if (this.#currentPoints.length < 2) return;
    this.dispatchEvent(new CustomEvent('geek:whiteboard:stroke-progress', {
      bubbles: true,
      composed: true,
      detail: {
        id: `stroke-${String(this.#strokeIdCounter + 1)}`,
        slideIndex: this.#slideIndex,
        points: this.#currentPoints.slice(),
        color: this.#color,
        width: this.#lineWidth,
        clientId: '',
        compositeOp: this.#compositeOp,
        alpha: this.#alpha,
      } satisfies WhiteboardStroke,
    }));
  }

  #onPointerDown = (e: PointerEvent): void => {
    const point = this.#normalize(e.clientX, e.clientY);

    // If pen resumed contact within the coalesce window, continue the stroke
    if (this.#coalesceTimer !== null) {
      this.#cancelCoalesce();
      this.#isDrawing = true;
      this.#currentPoints.push(point);

      if (this.#usingTempCanvas) {
        this.#refreshTempCanvas();
      } else if (this.#ctx && this.#canvas) {
        this.#ctx.lineTo(point[0] * this.#canvas.width, point[1] * this.#canvas.height);
        this.#ctx.stroke();
        this.#ctx.beginPath();
        this.#ctx.moveTo(point[0] * this.#canvas.width, point[1] * this.#canvas.height);
      }
      return;
    }

    // Start a new stroke
    this.#isDrawing = true;
    this.#currentPoints = [point];
    this.#usingTempCanvas = this.#alpha < 1;
    this.#startProgress();

    if (!this.#usingTempCanvas && this.#ctx) {
      this.#ctx.globalCompositeOperation = this.#compositeOp;
      this.#ctx.globalAlpha = this.#alpha;
      this.#ctx.strokeStyle = this.#color;
      this.#ctx.lineWidth = this.#lineWidth;
      this.#ctx.lineCap = 'round';
      this.#ctx.lineJoin = 'round';
      this.#ctx.beginPath();
      this.#ctx.moveTo(point[0] * (this.#canvas?.width ?? 1920), point[1] * (this.#canvas?.height ?? 1080));
    }
  };

  #onPointerMove = (e: PointerEvent): void => {
    if (!this.#isDrawing || !this.#canvas) return;

    const point = this.#normalize(e.clientX, e.clientY);
    this.#currentPoints.push(point);

    if (this.#usingTempCanvas) {
      this.#refreshTempCanvas();
    } else if (this.#ctx) {
      this.#ctx.lineTo(point[0] * this.#canvas.width, point[1] * this.#canvas.height);
      this.#ctx.stroke();
      this.#ctx.beginPath();
      this.#ctx.moveTo(point[0] * this.#canvas.width, point[1] * this.#canvas.height);
    }
  };

  #onPointerUp = (): void => {
    if (!this.#isDrawing) return;
    this.#isDrawing = false;

    // Delay finalization to coalesce rapid pen lift/contact cycles
    this.#cancelCoalesce();
    this.#coalesceTimer = setTimeout(() => {
      this.#coalesceTimer = null;
      this.#finalizeStroke();
    }, Whiteboard.COALESCE_MS);
  };

  #finalizeStroke(): void {
    this.#stopProgress();

    if (this.#currentPoints.length > 1) {
      const stroke: WhiteboardStroke = {
        id: `stroke-${String(++this.#strokeIdCounter)}`,
        slideIndex: this.#slideIndex,
        points: this.#currentPoints,
        color: this.#color,
        width: this.#lineWidth,
        clientId: '',
        compositeOp: this.#compositeOp,
        alpha: this.#alpha,
      };

      // If drawn on temp canvas, commit to main canvas
      if (this.#usingTempCanvas) {
        this.#drawStroke(stroke);
      }

      // Store locally for per-slide persistence
      let snapshot = this.#slideSnapshots.get(this.#slideIndex);
      if (!snapshot) {
        snapshot = { strokes: [] };
        this.#slideSnapshots.set(this.#slideIndex, snapshot);
      }
      snapshot.strokes.push(stroke);

      this.dispatchEvent(new CustomEvent('geek:whiteboard:stroke', {
        bubbles: true,
        composed: true,
        detail: stroke,
      }));
    }

    this.#usingTempCanvas = false;
    this.#currentPoints = [];
    this.#refreshTempCanvas();
  };

  /**
   * Redraw the temp canvas with all in-progress alpha strokes
   * (local + remote live) as single paths to avoid alpha overlap.
   */
  #refreshTempCanvas(): void {
    if (!this.#tempCtx || !this.#tempCanvas) return;
    this.#tempCtx.clearRect(0, 0, this.#tempCanvas.width, this.#tempCanvas.height);

    // Local in-progress stroke
    if (this.#usingTempCanvas && this.#currentPoints.length > 1) {
      const localStroke: WhiteboardStroke = {
        id: '',
        slideIndex: this.#slideIndex,
        points: this.#currentPoints,
        color: this.#color,
        width: this.#lineWidth,
        clientId: '',
        compositeOp: this.#compositeOp,
        alpha: this.#alpha,
      };
      this.#drawStrokeSegment(localStroke, 0, this.#tempCtx);
    }

    // Remote live strokes with alpha < 1
    for (const stroke of this.#remoteTempStrokes.values()) {
      this.#drawStrokeSegment(stroke, 0, this.#tempCtx);
    }
  }
}
