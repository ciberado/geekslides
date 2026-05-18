/**
 * GeekSlides v2 — Chart processor.
 *
 * Replaces <table> elements in slides with .chart class with <geek-chart> components.
 */

import type { Processor } from '@engine/plugins/types.ts';

export const chartProcessor: Processor = (slideElement: HTMLElement): void => {
  if (!slideElement.classList.contains('chart')) return;

  const tables = slideElement.querySelectorAll('table');
  tables.forEach((table) => {
    const chart = document.createElement('geek-chart');

    // Detect chart type from slide classes
    const types = ['line', 'pie', 'doughnut', 'radar', 'bar'];
    for (const type of types) {
      if (slideElement.classList.contains(type)) {
        chart.setAttribute('type', type);
        break;
      }
    }

    // Move table inside the chart element
    chart.appendChild(table.cloneNode(true));
    table.replaceWith(chart);
  });
};
