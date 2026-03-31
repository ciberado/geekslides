/**
 * GeekSlides v2 — <geek-chart> Web Component.
 *
 * Converts tabular data into Chart.js visualizations.
 */

import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export class ChartSlide extends HTMLElement {
  #chart: Chart | null = null;

  static get observedAttributes(): string[] {
    return ['type'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
  }

  disconnectedCallback(): void {
    this.#chart?.destroy();
    this.#chart = null;
  }

  get chartType(): string {
    return this.getAttribute('type') ?? 'bar';
  }

  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; width: 100%; height: 100%; }
      canvas { width: 100% !important; height: 100% !important; }
    `;

    const canvas = document.createElement('canvas');
    shadow.replaceChildren(style, canvas);

    const data = this.#parseTable();
    if (!data) return;

    this.#chart = new Chart(canvas, {
      type: this.chartType as 'bar' | 'line' | 'pie' | 'doughnut' | 'radar',
      data: {
        labels: data.labels,
        datasets: data.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  #parseTable(): { labels: string[]; datasets: { label: string; data: number[] }[] } | null {
    // Look for table HTML in the light DOM
    const table = this.querySelector('table');
    if (!table) return null;

    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) return null;

    // First row is headers (labels)
    const headerCells = rows[0]?.querySelectorAll('th, td');
    if (!headerCells) return null;

    const labels: string[] = [];
    for (let i = 1; i < headerCells.length; i++) {
      labels.push(headerCells[i]?.textContent.trim() ?? '');
    }

    // Subsequent rows are datasets
    const datasets: { label: string; data: number[] }[] = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r]?.querySelectorAll('td');
      if (!cells) continue;

      const label = cells[0]?.textContent.trim() ?? '';
      const data: number[] = [];
      for (let c = 1; c < cells.length; c++) {
        data.push(Number(cells[c]?.textContent.trim() ?? '0'));
      }
      datasets.push({ label, data });
    }

    return { labels, datasets };
  }
}
