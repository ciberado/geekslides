// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { chartProcessor } from '../../../../plugins/chart/chart-processor.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';

describe('chart-processor', () => {
  it('replaces tables with <geek-chart> in .chart slides', () => {
    const el = document.createElement('div');
    el.classList.add('chart');
    el.innerHTML = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';

    const ctx = { slideIndex: 0, slideCount: 1, config: DEFAULT_CONFIG, slideshow: el };
    chartProcessor(el, ctx);

    expect(el.querySelector('geek-chart')).not.toBeNull();
    expect(el.querySelector(':scope > table')).toBeNull(); // table moved inside <geek-chart>
    expect(el.querySelector('geek-chart table')).not.toBeNull();
  });

  it('detects chart type from CSS class', () => {
    const el = document.createElement('div');
    el.classList.add('chart', 'line');
    el.innerHTML = '<table><tr><th>A</th></tr><tr><td>1</td></tr></table>';

    const ctx = { slideIndex: 0, slideCount: 1, config: DEFAULT_CONFIG, slideshow: el };
    chartProcessor(el, ctx);

    const chart = el.querySelector('geek-chart');
    expect(chart?.getAttribute('type')).toBe('line');
  });

  it('ignores slides without .chart class', () => {
    const el = document.createElement('div');
    el.innerHTML = '<table><tr><td>data</td></tr></table>';

    const ctx = { slideIndex: 0, slideCount: 1, config: DEFAULT_CONFIG, slideshow: el };
    chartProcessor(el, ctx);

    expect(el.querySelector('geek-chart')).toBeNull();
    expect(el.querySelector('table')).not.toBeNull();
  });
});
