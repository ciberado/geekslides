/**
 * <doodle-controls> — Interactive control panel for css-doodle elements.
 *
 * Finds the closest <css-doodle> in the same slide and provides UI controls
 * to adjust its parameters in real time: grid size, shape scale, colors, opacity, animation
 * speed, animate toggle, and pattern selection.
 *
 * Usage in markdown:
 *   <doodle-controls></doodle-controls>
 */

const STYLE = `
  :host {
    display: block;
    font: 500 13px/1.4 system-ui, sans-serif;
    color: var(--gs-color-text, #333);
    padding: 10px 14px;
    border-radius: 8px;
    background: color-mix(in oklch, var(--gs-color-surface, #fff) 92%, var(--gs-color-text, #333));
    border: 1px solid color-mix(in oklch, var(--gs-color-surface, #fff) 80%, var(--gs-color-text, #333));
    max-width: 360px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .row:last-child {
    margin-bottom: 0;
  }

  label {
    min-width: 60px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }

  input[type="range"] {
    flex: 1;
    min-width: 80px;
    accent-color: var(--gs-color-accent, #3b55a0);
  }

  input[type="color"] {
    width: 28px;
    height: 28px;
    border: 1px solid color-mix(in oklch, var(--gs-color-surface, #fff) 60%, var(--gs-color-text, #333));
    border-radius: 4px;
    padding: 1px;
    cursor: pointer;
    background: transparent;
  }

  select {
    flex: 1;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid color-mix(in oklch, var(--gs-color-surface, #fff) 60%, var(--gs-color-text, #333));
    background: var(--gs-color-surface, #fff);
    color: var(--gs-color-text, #333);
    font: inherit;
    font-size: 12px;
  }

  .value {
    min-width: 28px;
    text-align: right;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .toggle input[type="checkbox"] {
    accent-color: var(--gs-color-accent, #3b55a0);
  }

  .config {
    display: grid;
    gap: 6px;
    margin-top: 8px;
  }

  .config label {
    min-width: 0;
  }

  .config textarea {
    width: 100%;
    min-height: 52px;
    resize: vertical;
    border-radius: 4px;
    border: 1px solid color-mix(in oklch, var(--gs-color-surface, #fff) 60%, var(--gs-color-text, #333));
    background: var(--gs-color-surface, #fff);
    color: var(--gs-color-text, #333);
    font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    padding: 6px 8px;
    box-sizing: border-box;
  }

  @media print {
    :host { display: none; }
  }
`;

class DoodleControls extends HTMLElement {
  #doodle = null;
  #cancelWait = null;
  #patternName = '';
  #grid = '8';
  #shape = 100;
  #animate = false;
  #speed = 1;
  #opacity = 1;
  #nohole = false;
  #seed = '';
  #customColors = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const { waitForProcessedElement } = window.__geekslides ?? {};
    if (waitForProcessedElement) {
      this.#cancelWait = waitForProcessedElement('css-doodle', this, (doodle) => {
        this.#cancelWait = null;
        this.#initFromDoodle(doodle);
        this.#render();
      });
    } else {
      // Fallback for environments where __geekslides isn't available yet.
      this.#findDoodle();
      if (this.#doodle) this.#render();
    }
  }

  disconnectedCallback() {
    this.#cancelWait?.();
    this.#cancelWait = null;
  }

  #initFromDoodle(doodle) {
    this.#doodle = doodle;
    this.#patternName = doodle.dataset.pattern ?? 'triangles';
    this.#grid = doodle.dataset.grid ?? '8';
    this.#shape = this.#parseShapePercent(doodle.dataset.shape);
    this.#animate = doodle.dataset.animate !== undefined;
    this.#speed = parseFloat(doodle.dataset.speed ?? '1');
    this.#opacity = parseFloat(doodle.dataset.opacity ?? '1');
    this.#nohole = doodle.dataset.nohole !== undefined;
    this.#seed = doodle.dataset.seed ?? '';
    if (doodle.dataset.colors) {
      this.#customColors = doodle.dataset.colors.split('|');
    }
  }

  #parseShapePercent(raw) {
    if (!raw) return 100;
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return 100;
    return Math.max(25, Math.min(300, parsed));
  }

  #shapeAdjustedGrid() {
    const scalePart = (part) => {
      const n = parseInt(part, 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      const scaled = Math.round((n * 100) / this.#shape);
      return Math.max(1, Math.min(200, scaled));
    };
    const lower = this.#grid.toLowerCase();
    if (lower.includes('x')) {
      const [colsRaw, rowsRaw] = lower.split('x');
      if (!colsRaw || !rowsRaw) return this.#grid;
      const cols = scalePart(colsRaw);
      const rows = scalePart(rowsRaw);
      if (cols === null || rows === null) return this.#grid;
      return `${String(cols)}x${String(rows)}`;
    }
    const single = scalePart(this.#grid);
    return single === null ? this.#grid : String(single);
  }

  #findDoodle() {
    // Walk up to the slide content section, then find the css-doodle element
    const content = this.closest('section.content') ?? this.closest('[class*="content"]');
    const doodle = content?.querySelector('css-doodle') ?? null;
    if (doodle) this.#initFromDoodle(doodle);
  }

  #render() {
    if (!this.#doodle) {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><div style="opacity:0.5;font-size:12px;">No css-doodle found in this slide.</div>`;
      return;
    }

    const { patternRegistry } = window.__geekslides ?? {};
    const patterns = patternRegistry ? patternRegistry.list() : [];

    const patternOptions = patterns
      .map((p) => `<option value="${p.name}" ${p.name === this.#patternName ? 'selected' : ''}>${p.name}</option>`)
      .join('');

    // Determine current colors for the pickers (use 3 pickers for simplicity)
    const colors = this.#customColors ?? ['#3b55a0', '#6b80c4', '#a0b0dd'];
    const c1 = colors[0] ?? '#3b55a0';
    const c2 = colors[1] ?? '#6b80c4';
    const c3 = colors[2] ?? '#a0b0dd';

    // Parse grid value (might be NxM)
    const gridNum = parseInt(this.#grid, 10) || 8;

    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>

      <div class="row">
        <label>Pattern</label>
        <select id="pattern">${patternOptions}</select>
      </div>

      <div class="row">
        <label>Grid</label>
        <input type="range" id="grid" min="2" max="40" value="${String(gridNum)}" step="1">
        <span class="value" id="grid-val">${String(gridNum)}</span>
      </div>

      <div class="row">
        <label>Shape</label>
        <input type="range" id="shape" min="25" max="300" value="${String(this.#shape)}" step="1">
        <span class="value" id="shape-val">${String(this.#shape)}%</span>
      </div>

      <div class="row">
        <label>Opacity</label>
        <input type="range" id="opacity" min="0.05" max="1" value="${String(this.#opacity)}" step="0.05">
        <span class="value" id="opacity-val">${this.#opacity.toFixed(2)}</span>
      </div>

      <div class="row">
        <label>Speed</label>
        <input type="range" id="speed" min="0.1" max="5" value="${String(this.#speed)}" step="0.1">
        <span class="value" id="speed-val">${this.#speed.toFixed(1)}</span>
      </div>

      <div class="row">
        <label>Colors</label>
        <input type="color" id="c1" value="${c1}">
        <input type="color" id="c2" value="${c2}">
        <input type="color" id="c3" value="${c3}">
      </div>

      <div class="row">
        <label class="toggle">
          <input type="checkbox" id="animate" ${this.#animate ? 'checked' : ''}>
          Animate
        </label>
        <label class="toggle">
          <input type="checkbox" id="nohole" ${this.#nohole ? 'checked' : ''}>
          No holes
        </label>
      </div>

      <div class="config">
        <label for="config-text">Config</label>
        <textarea id="config-text" readonly></textarea>
      </div>
    `;

    // Wire up event listeners
    this.shadowRoot.getElementById('pattern').addEventListener('change', (e) => {
      this.#patternName = e.target.value;
      this.#updateDoodle();
    });

    this.shadowRoot.getElementById('grid').addEventListener('input', (e) => {
      this.#grid = e.target.value;
      this.shadowRoot.getElementById('grid-val').textContent = e.target.value;
      this.#updateDoodle();
    });

    this.shadowRoot.getElementById('shape').addEventListener('input', (e) => {
      this.#shape = parseInt(e.target.value, 10) || 100;
      this.shadowRoot.getElementById('shape-val').textContent = `${String(this.#shape)}%`;
      this.#updateDoodle();
    });

    this.shadowRoot.getElementById('opacity').addEventListener('input', (e) => {
      this.#opacity = parseFloat(e.target.value);
      this.shadowRoot.getElementById('opacity-val').textContent = this.#opacity.toFixed(2);
      this.#doodle.style.opacity = String(this.#opacity);
      this.#doodle.dataset.opacity = String(this.#opacity);
      this.#syncConfigText();
    });

    this.shadowRoot.getElementById('speed').addEventListener('input', (e) => {
      this.#speed = parseFloat(e.target.value);
      this.shadowRoot.getElementById('speed-val').textContent = this.#speed.toFixed(1);
      this.#updateDoodle();
    });

    for (const id of ['c1', 'c2', 'c3']) {
      this.shadowRoot.getElementById(id).addEventListener('input', () => {
        this.#customColors = [
          this.shadowRoot.getElementById('c1').value,
          this.shadowRoot.getElementById('c2').value,
          this.shadowRoot.getElementById('c3').value,
        ];
        this.#updateDoodle();
      });
    }

    this.shadowRoot.getElementById('animate').addEventListener('change', (e) => {
      this.#animate = e.target.checked;
      this.#updateDoodle();
    });

    this.shadowRoot.getElementById('nohole').addEventListener('change', (e) => {
      this.#nohole = e.target.checked;
      this.#updateDoodle();
    });

    this.#syncConfigText();
  }

  #pendingUpdate = false;

  #updateDoodle() {
    if (!this.#doodle || this.#pendingUpdate) return;
    this.#pendingUpdate = true;
    requestAnimationFrame(() => {
      this.#pendingUpdate = false;
      this.#applyUpdate();
    });
  }

  #applyUpdate() {
    if (!this.#doodle) return;

    const { patternRegistry, buildColorVars } = window.__geekslides ?? {};
    if (!patternRegistry || !buildColorVars) {
      console.warn('[doodle-controls] window.__geekslides not available');
      return;
    }

    const pattern = patternRegistry.get(this.#patternName);
    if (!pattern) {
      console.warn(`[doodle-controls] Pattern not found: ${this.#patternName}`);
      return;
    }

    // Build color references for the pattern
    const THEME_COLOR_COUNT = 5;
    const colorRefs = Array.from({ length: THEME_COLOR_COUNT }, (_, i) => `var(--doodle-c${String(i + 1)})`);

    const patternConfig = {
      grid: this.#shapeAdjustedGrid(),
      colors: colorRefs,
      animate: this.#animate,
      speed: this.#speed,
      seed: this.#seed || undefined,
    };

    const cssContent = pattern.generate(patternConfig);
    const colorVars = buildColorVars(this.#customColors, this.#nohole);

    const fullCSS = `
      :host {
        ${colorVars}
      }
      ${cssContent}
    `;

    // Update the css-doodle element
    this.#doodle.update(fullCSS);

    // Update data attributes to reflect current state
    this.#doodle.dataset.pattern = this.#patternName;
    this.#doodle.dataset.grid = this.#grid;
    if (this.#shape === 100) {
      delete this.#doodle.dataset.shape;
    } else {
      this.#doodle.dataset.shape = String(this.#shape);
    }
    this.#doodle.dataset.speed = String(this.#speed);
    this.#doodle.dataset.opacity = String(this.#opacity);
    if (this.#seed) {
      this.#doodle.dataset.seed = this.#seed;
    }

    if (this.#animate) {
      this.#doodle.dataset.animate = '';
    } else {
      delete this.#doodle.dataset.animate;
    }

    if (this.#nohole) {
      this.#doodle.dataset.nohole = '';
    } else {
      delete this.#doodle.dataset.nohole;
    }

    this.#syncConfigText();
  }

  #buildConfigText() {
    const parts = [
      this.#patternName,
      `grid=${this.#grid}`,
      `shape=${String(this.#shape)}`,
      `opacity=${this.#opacity.toFixed(2)}`,
      `speed=${this.#speed.toFixed(1)}`,
    ];
    if (this.#animate) parts.push('animate');
    if (this.#nohole) parts.push('nohole');
    if (this.#seed) parts.push(`seed=${this.#seed}`);
    if (this.#customColors && this.#customColors.length > 0) {
      parts.push(`colors=${this.#customColors.join('|')}`);
    }
    return parts.join(',');
  }

  #syncConfigText() {
    const out = this.shadowRoot?.getElementById('config-text');
    if (out) out.value = this.#buildConfigText();
  }
}

if (!customElements.get('doodle-controls')) {
  customElements.define('doodle-controls', DoodleControls);
}

// Backward/forward compatibility: allow singular tag too.
// A subclass is required because the CustomElementRegistry forbids registering
// the same constructor under more than one name.
if (!customElements.get('doodle-control')) {
  customElements.define('doodle-control', class extends DoodleControls {});
}
