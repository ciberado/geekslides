/**
 * <doodle-controls> — Interactive control panel for css-doodle elements.
 *
 * Finds the closest <css-doodle> in the same slide and provides UI controls
 * to adjust its parameters in real time: grid size, colors, opacity, animation
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

  @media print {
    :host { display: none; }
  }
`;

class DoodleControls extends HTMLElement {
  #doodle = null;
  #patternName = '';
  #grid = '8';
  #animate = false;
  #speed = 1;
  #opacity = 1;
  #nohole = false;
  #customColors = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Defer to next frame so css-doodle processor has time to create elements
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.#findDoodle();
        this.#render();
      });
    });
  }

  #findDoodle() {
    // Walk up to the slide content section, then find the css-doodle element
    const content = this.closest('section.content') ?? this.closest('[class*="content"]');
    if (content) {
      this.#doodle = content.querySelector('css-doodle');
    }

    if (!this.#doodle) return;

    // Read current config from data attributes set by the processor
    this.#patternName = this.#doodle.dataset.pattern ?? 'triangles';
    this.#grid = this.#doodle.dataset.grid ?? '8';
    this.#animate = this.#doodle.dataset.animate !== undefined;
    this.#speed = parseFloat(this.#doodle.dataset.speed ?? '1');
    this.#opacity = parseFloat(this.#doodle.dataset.opacity ?? '1');
    this.#nohole = this.#doodle.dataset.nohole !== undefined;

    if (this.#doodle.dataset.colors) {
      this.#customColors = this.#doodle.dataset.colors.split('|');
    }
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

    this.shadowRoot.getElementById('opacity').addEventListener('input', (e) => {
      this.#opacity = parseFloat(e.target.value);
      this.shadowRoot.getElementById('opacity-val').textContent = this.#opacity.toFixed(2);
      this.#doodle.style.opacity = String(this.#opacity);
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
  }

  #updateDoodle() {
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
      grid: this.#grid,
      colors: colorRefs,
      animate: this.#animate,
      speed: this.#speed,
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
    this.#doodle.dataset.speed = String(this.#speed);
    this.#doodle.dataset.opacity = String(this.#opacity);

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
  }
}

customElements.define('doodle-controls', DoodleControls);
