/**
 * GeekSlides v2 — <geek-whiteboard-toolbar> Web Component.
 *
 * Collapsible vertical toolbar anchored to the right edge of the
 * whiteboard overlay. Provides tool selection (pen / highlighter / eraser),
 * a 4×4 color palette, hide-whiteboard, and clear-slide controls.
 *
 * Communicates via custom events — fully decoupled from Whiteboard.
 */

export type WhiteboardTool = 'pen' | 'highlighter' | 'eraser';

export interface ToolSettings {
  readonly compositeOp: GlobalCompositeOperation;
  readonly width: number;
  readonly alpha: number;
}

export const TOOL_SETTINGS: Record<WhiteboardTool, ToolSettings> = {
  pen:         { compositeOp: 'source-over',    width: 3,  alpha: 1.0 },
  highlighter: { compositeOp: 'source-over',    width: 20, alpha: 0.3 },
  eraser:      { compositeOp: 'destination-out', width: 20, alpha: 1.0 },
};

export const PALETTE_COLORS: readonly string[] = [
  '#000000', '#888888', '#8b4513', '#ffffff',
  '#ff0000', '#800000', '#ff6600', '#ffcc00',
  '#00aa00', '#66ff00', '#008080', '#00cccc',
  '#000080', '#0066ff', '#9933cc', '#ff66aa',
] as const;

export class WhiteboardToolbar extends HTMLElement {
  #collapsed = false;
  #hidden = false;
  #tool: WhiteboardTool = 'pen';
  #color = '#ff0000';
  #confirmPending = false;
  #dragging = false;
  #dragOffsetX = 0;
  #dragOffsetY = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
  }

  get tool(): WhiteboardTool {
    return this.#tool;
  }

  get color(): string {
    return this.#color;
  }

  get collapsed(): boolean {
    return this.#collapsed;
  }

  setTool(tool: WhiteboardTool): void {
    this.#tool = tool;
    this.#updateToolButtons();
    this.#dispatchToolChange();
  }

  setColor(color: string): void {
    this.#color = color;
    this.#updateColorSwatches();
    this.#dispatchColorChange();
  }

  toggleCollapse(): void {
    this.#collapsed = !this.#collapsed;
    this.#updateCollapsed();
    this.dispatchEvent(new CustomEvent('geek:whiteboard:collapsed-change', {
      bubbles: true,
      composed: true,
      detail: { collapsed: this.#collapsed },
    }));
  }

  /**
   * Completely hide the toolbar (display: none on host).
   */
  hide(): void {
    this.#hidden = true;
    this.style.display = 'none';
  }

  /**
   * Show the toolbar (restore display).
   */
  show(): void {
    this.#hidden = false;
    this.style.display = '';
  }

  get isHidden(): boolean {
    return this.#hidden;
  }

  // ── Rendering ──────────────────────────────────────────────

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = /* css */ `
      :host {
        position: absolute;
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
        z-index: 110;
        pointer-events: auto;
        font-family: system-ui, sans-serif;
        touch-action: none;
        user-select: none;
      }
      :host(.dragging) {
        cursor: grabbing;
      }

      .toolbar {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: rgba(30, 30, 30, 0.85);
        border-radius: 8px;
        padding: 6px;
        backdrop-filter: blur(6px);
        box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        transition: opacity 0.2s ease;
      }

      .collapse-btn {
        width: 100%;
        height: 36px;
        border: none;
        background: transparent;
        color: #ccc;
        font-size: 16px;
        cursor: grab;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      .collapse-btn:hover { background: rgba(255,255,255,0.15); }
      :host(.dragging) .collapse-btn { cursor: grabbing; }

      .body { display: flex; flex-direction: column; gap: 4px; }
      .body.collapsed { display: none; }

      .separator {
        width: 24px;
        height: 1px;
        background: rgba(255,255,255,0.2);
        margin: 2px auto;
      }

      /* Tool buttons */
      .tool-btn {
        width: 32px;
        height: 32px;
        border: 2px solid transparent;
        border-radius: 6px;
        background: rgba(255,255,255,0.08);
        color: #ddd;
        font-size: 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: border-color 0.15s, background 0.15s;
      }
      .tool-btn:hover { background: rgba(255,255,255,0.18); }
      .tool-btn.active { border-color: #4af; background: rgba(68,170,255,0.25); }

      /* Color palette */
      .palette {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 3px;
      }
      .swatch {
        width: 18px;
        height: 18px;
        border: 2px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        padding: 0;
        transition: border-color 0.15s, transform 0.1s;
      }
      .swatch:hover { transform: scale(1.2); }
      .swatch.active { border-color: #4af; }
      .swatch[data-color="#ffffff"] { border-color: rgba(255,255,255,0.3); }
      .swatch[data-color="#ffffff"].active { border-color: #4af; }

      /* Action buttons */
      .action-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        background: rgba(255,255,255,0.08);
        color: #ddd;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.15s;
      }
      .action-btn:hover { background: rgba(255,255,255,0.18); }
      .action-btn.confirm {
        width: auto;
        min-width: 32px;
        padding: 0 8px;
        background: rgba(255,80,80,0.6);
        color: #fff;
        font-size: 11px;
        animation: pulse-confirm 0.6s ease infinite alternate;
      }
      @keyframes pulse-confirm {
        from { background: rgba(255,80,80,0.4); }
        to   { background: rgba(255,80,80,0.7); }
      }
    `;

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    // Stop touch events from reaching the slideshow tap-zone handler
    toolbar.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    toolbar.addEventListener('touchend', (e) => { e.stopPropagation(); }, { passive: true });
    toolbar.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });

    // Collapse toggle / drag handle
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.setAttribute('data-action', 'toggle-collapse');
    collapseBtn.textContent = '≡';
    collapseBtn.title = 'Drag to move · Click to collapse';
    collapseBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#startDrag(e);
    });
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only toggle collapse if we didn't just finish a drag
      if (!this.#dragging) this.toggleCollapse();
    });
    toolbar.appendChild(collapseBtn);

    // Collapsible body
    const body = document.createElement('div');
    body.className = 'body';

    // Tool buttons
    const tools: { tool: WhiteboardTool; icon: string; title: string }[] = [
      { tool: 'pen',         icon: '✏️', title: 'Pen' },
      { tool: 'highlighter', icon: '🖍️', title: 'Highlighter' },
      { tool: 'eraser',      icon: '🧹', title: 'Eraser' },
    ];

    for (const { tool, icon, title } of tools) {
      const btn = document.createElement('button');
      btn.className = `tool-btn${tool === this.#tool ? ' active' : ''}`;
      btn.setAttribute('data-tool', tool);
      btn.textContent = icon;
      btn.title = title;
      btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setTool(tool);
      });
      body.appendChild(btn);
    }

    body.appendChild(this.#createSeparator());

    // Color palette
    const palette = document.createElement('div');
    palette.className = 'palette';
    for (const color of PALETTE_COLORS) {
      const swatch = document.createElement('button');
      swatch.className = `swatch${color === this.#color ? ' active' : ''}`;
      swatch.setAttribute('data-color', color);
      swatch.style.background = color;
      swatch.title = color;
      swatch.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setColor(color);
      });
      palette.appendChild(swatch);
    }
    body.appendChild(palette);

    body.appendChild(this.#createSeparator());

    // Hide whiteboard button
    const hideBtn = document.createElement('button');
    hideBtn.className = 'action-btn';
    hideBtn.setAttribute('data-action', 'hide');
    hideBtn.textContent = '⊘';
    hideBtn.title = 'Hide whiteboard';
    hideBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('geek:whiteboard:hide-request', {
        bubbles: true,
        composed: true,
      }));
    });
    body.appendChild(hideBtn);

    // Clear slide button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'action-btn';
    clearBtn.setAttribute('data-action', 'clear');
    clearBtn.textContent = '✕';
    clearBtn.title = 'Clear current slide';
    clearBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.#confirmPending) {
        this.#confirmPending = false;
        clearBtn.classList.remove('confirm');
        clearBtn.textContent = '✕';
        clearBtn.title = 'Clear current slide';
        this.dispatchEvent(new CustomEvent('geek:whiteboard:clear-request', {
          bubbles: true,
          composed: true,
        }));
      } else {
        this.#confirmPending = true;
        clearBtn.classList.add('confirm');
        clearBtn.textContent = 'Clear?';
        clearBtn.title = 'Click again to confirm clear';
        // Auto-cancel confirmation after 3 seconds
        setTimeout(() => {
          if (this.#confirmPending) {
            this.#confirmPending = false;
            clearBtn.classList.remove('confirm');
            clearBtn.textContent = '✕';
            clearBtn.title = 'Clear current slide';
          }
        }, 3000);
      }
    });
    body.appendChild(clearBtn);

    toolbar.appendChild(body);
    shadow.replaceChildren(style, toolbar);
  }

  #createSeparator(): HTMLDivElement {
    const sep = document.createElement('div');
    sep.className = 'separator';
    return sep;
  }

  #updateToolButtons(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    for (const btn of shadow.querySelectorAll('.tool-btn')) {
      const t = btn.getAttribute('data-tool');
      btn.classList.toggle('active', t === this.#tool);
    }
  }

  #updateColorSwatches(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    for (const swatch of shadow.querySelectorAll('.swatch')) {
      const c = swatch.getAttribute('data-color');
      swatch.classList.toggle('active', c === this.#color);
    }
  }

  #updateCollapsed(): void {
    const body = this.shadowRoot?.querySelector('.body');
    if (body) {
      body.classList.toggle('collapsed', this.#collapsed);
    }
  }

  #dispatchToolChange(): void {
    this.dispatchEvent(new CustomEvent('geek:whiteboard:tool-change', {
      bubbles: true,
      composed: true,
      detail: { tool: this.#tool, settings: TOOL_SETTINGS[this.#tool] },
    }));
  }

  #dispatchColorChange(): void {
    this.dispatchEvent(new CustomEvent('geek:whiteboard:color-change', {
      bubbles: true,
      composed: true,
      detail: { color: this.#color },
    }));
  }

  // ── Drag support ──────────────────────────────────────────

  #dragMoved = false;
  #dragHandle: HTMLElement | null = null;
  #boundDragMove = (e: Event): void => { this.#onDragMove(e as PointerEvent); };
  #boundDragEnd = (): void => { this.#endDrag(); };

  /** The shadow-host element (<geek-whiteboard>) that contains this toolbar. */
  #getParentEl(): HTMLElement | null {
    const root = this.getRootNode();
    return root instanceof ShadowRoot ? root.host as HTMLElement : null;
  }

  /** Resolve the containing element's rect for clamping drag position. */
  #getParentRect(): DOMRect {
    return this.#getParentEl()?.getBoundingClientRect()
      ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /**
   * CSS scale factor applied to the container.
   * getBoundingClientRect() returns screen-space (post-scale) coords; style.top/left
   * expect layout-space (pre-scale) values. Dividing screen deltas by this factor
   * converts them to the correct layout-space units.
   */
  #getScale(): number {
    const el = this.#getParentEl();
    if (!el || el.offsetWidth === 0) return 1;
    return el.getBoundingClientRect().width / el.offsetWidth;
  }

  #startDrag(e: PointerEvent): void {
    this.#dragMoved = false;

    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    this.#dragHandle = handle;

    // Pin to current visual position in layout coords immediately, so
    // subsequent pointermove events work against a stable coordinate system
    // (no transform: translateY(-50%) or right-edge anchor in play).
    const hostRect = this.getBoundingClientRect();
    const parentRect = this.#getParentRect();
    const scale = this.#getScale();

    this.style.right = 'auto';
    this.style.top = `${String((hostRect.top - parentRect.top) / scale)}px`;
    this.style.left = `${String((hostRect.left - parentRect.left) / scale)}px`;
    this.style.transform = 'none';

    // Drag offset: how far from the toolbar's top-left the pointer landed.
    // Stored in screen-space pixels; divided by scale in #onDragMove.
    this.#dragOffsetX = e.clientX - hostRect.left;
    this.#dragOffsetY = e.clientY - hostRect.top;

    handle.addEventListener('pointermove', this.#boundDragMove);
    handle.addEventListener('pointerup', this.#boundDragEnd);
    handle.addEventListener('pointercancel', this.#boundDragEnd);
  }

  #onDragMove(e: PointerEvent): void {
    if (!this.#dragMoved) {
      const hostRect = this.getBoundingClientRect();
      const dx = e.clientX - (hostRect.left + this.#dragOffsetX);
      const dy = e.clientY - (hostRect.top + this.#dragOffsetY);
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      this.#dragMoved = true;
      this.#dragging = true;
      this.classList.add('dragging');
    }

    const parentEl = this.#getParentEl();
    const parentRect = this.#getParentRect();
    const scale = this.#getScale();

    // Convert screen-space pointer position to layout-space toolbar position.
    let newLeft = (e.clientX - parentRect.left - this.#dragOffsetX) / scale;
    let newTop  = (e.clientY - parentRect.top  - this.#dragOffsetY) / scale;

    // Clamp inside parent using layout dimensions.
    const maxLeft = (parentEl?.offsetWidth  ?? parentRect.width)  - this.offsetWidth;
    const maxTop  = (parentEl?.offsetHeight ?? parentRect.height) - this.offsetHeight;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop  = Math.max(0, Math.min(newTop,  maxTop));

    this.style.left = `${String(newLeft)}px`;
    this.style.top  = `${String(newTop)}px`;
  }

  #endDrag(): void {
    if (this.#dragHandle) {
      this.#dragHandle.removeEventListener('pointermove', this.#boundDragMove);
      this.#dragHandle.removeEventListener('pointerup', this.#boundDragEnd);
      this.#dragHandle.removeEventListener('pointercancel', this.#boundDragEnd);
      this.#dragHandle = null;
    }

    if (this.#dragMoved) {
      // Keep #dragging true briefly so the click handler ignores the click
      requestAnimationFrame(() => {
        this.#dragging = false;
        this.classList.remove('dragging');
      });
    }
  }

  /** Reset position to the default right-edge anchor. */
  resetPosition(): void {
    this.style.right = '';
    this.style.top = '';
    this.style.left = '';
    this.style.transform = '';
  }
}
