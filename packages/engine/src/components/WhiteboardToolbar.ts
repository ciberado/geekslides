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
  '#000000', '#ffffff', '#ff0000', '#0066ff',
  '#00aa00', '#ffcc00', '#ff6600', '#9933cc',
  '#ff66aa', '#00cccc', '#8b4513', '#66ff00',
  '#000080', '#800000', '#008080', '#888888',
] as const;

export class WhiteboardToolbar extends HTMLElement {
  #collapsed = false;
  #hidden = false;
  #tool: WhiteboardTool = 'pen';
  #color = '#ff0000';
  #confirmPending = false;

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
        width: 32px;
        height: 28px;
        border: none;
        background: transparent;
        color: #ccc;
        font-size: 16px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      .collapse-btn:hover { background: rgba(255,255,255,0.15); }

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
      .action-btn.confirm { background: rgba(255,80,80,0.5); color: #fff; }
    `;

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    // Collapse toggle
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.setAttribute('data-action', 'toggle-collapse');
    collapseBtn.textContent = '≡';
    collapseBtn.title = 'Toggle toolbar';
    collapseBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
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
        clearBtn.textContent = '?';
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
}
