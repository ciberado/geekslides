/**
 * Render a pptx2html chart data object to an inline SVG string using D3 v7.
 * Returns null for unsupported chart types or on error — never throws.
 *
 * Chart data shape from pptx2html extractChartData():
 *   Most charts: { key: string; values: {x: number; y: number}[]; xlabels: {[idx:string]: string} }[]
 *   Scatter:     number[][] (unsupported — returns null)
 */

import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

export interface ChartSeries {
  readonly key: string;
  readonly values: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  readonly xlabels: Readonly<Record<string, string>>;
}

/**
 * Render a chart from pptx2html chart data to an SVG string.
 * The SVG is sized to match the placeholder div's dimensions.
 */
export function renderChart(
  chartType: string,
  chartData: unknown,
  width: number,
  height: number,
): string | null {
  try {
    const series = chartData as ChartSeries[];
    if (!Array.isArray(series) || series.length === 0) return null;
    switch (chartType) {
      case 'barChart':
        return renderBarChart(series, width, height);
      case 'lineChart':
        return renderLineChart(series, width, height);
      case 'areaChart':
        return renderAreaChart(series, width, height);
      case 'pieChart':
      case 'pie3DChart':
        return renderPieChart(series, width, height);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 20, right: 20, bottom: 40, left: 45 };

function makeSvg(
  width: number,
  height: number,
): { svg: d3.Selection<SVGSVGElement, unknown, null, undefined>; dom: JSDOM } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const body = d3.select(dom.window.document.body as unknown as SVGSVGElement);
  const svg = (body.append('svg') as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>)
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height);
  return { svg, dom };
}

function getSvgString(dom: JSDOM): string {
  return dom.window.document.querySelector('svg')?.outerHTML ?? '';
}

/** Build a flat rows array and ordered x-labels from chart series. */
function flattenSeries(series: ChartSeries[]): {
  rows: Array<{ name: string; group: string; value: number }>;
  names: string[];
  groups: string[];
} {
  const rows: Array<{ name: string; group: string; value: number }> = [];
  const nameSet = new Set<string>();
  const groups = series.map((s) => s.key);

  for (const s of series) {
    for (const pt of s.values) {
      const name = s.xlabels[String(pt.x)] ?? String(pt.x);
      nameSet.add(name);
      rows.push({ name, group: s.key, value: pt.y });
    }
  }
  return { rows, names: [...nameSet], groups };
}

// ─── chart types ─────────────────────────────────────────────────────────────

function renderBarChart(series: ChartSeries[], width: number, height: number): string {
  const iw = width - MARGIN.left - MARGIN.right;
  const ih = height - MARGIN.top - MARGIN.bottom;
  const { rows, names, groups } = flattenSeries(series);
  const { svg, dom } = makeSvg(width, height);
  const g = svg.append('g').attr('transform', `translate(${String(MARGIN.left)},${String(MARGIN.top)})`);

  const color = d3.scaleOrdinal<string>(d3.schemeTableau10).domain(groups);
  const x0 = d3.scaleBand().domain(names).rangeRound([0, iw]).paddingInner(0.15);
  const x1 = d3.scaleBand().domain(groups).rangeRound([0, x0.bandwidth()]).padding(0.05);
  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, (d) => d.value) ?? 1])
    .nice()
    .rangeRound([ih, 0]);

  const grouped = d3.group(rows, (d) => d.name);
  g.append('g')
    .selectAll('g')
    .data([...grouped])
    .join('g')
    .attr('transform', ([name]) => `translate(${String(x0(name) ?? 0)},0)`)
    .selectAll('rect')
    .data(([, pts]) => pts)
    .join('rect')
    .attr('x', (d) => x1(d.group) ?? 0)
    .attr('y', (d) => y(d.value))
    .attr('width', x1.bandwidth())
    .attr('height', (d) => ih - y(d.value))
    .attr('fill', (d) => color(d.group));

  g.append('g').attr('transform', `translate(0,${String(ih)})`).call(d3.axisBottom(x0).tickSizeOuter(0));
  g.append('g').call(d3.axisLeft(y).ticks(5));
  return getSvgString(dom);
}

function renderLineChart(series: ChartSeries[], width: number, height: number): string {
  const iw = width - MARGIN.left - MARGIN.right;
  const ih = height - MARGIN.top - MARGIN.bottom;
  const { rows, names, groups } = flattenSeries(series);
  const { svg, dom } = makeSvg(width, height);
  const g = svg.append('g').attr('transform', `translate(${String(MARGIN.left)},${String(MARGIN.top)})`);

  const color = d3.scaleOrdinal<string>(d3.schemeTableau10).domain(groups);
  const x = d3.scalePoint().domain(names).range([0, iw]).padding(0.5);
  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, (d) => d.value) ?? 1])
    .nice()
    .range([ih, 0]);
  const line = d3.line<{ name: string; group: string; value: number }>()
    .x((d) => x(d.name) ?? 0)
    .y((d) => y(d.value));

  for (const grp of groups) {
    const pts = rows.filter((d) => d.group === grp);
    g.append('path')
      .datum(pts)
      .attr('fill', 'none')
      .attr('stroke', color(grp))
      .attr('stroke-width', 2)
      .attr('d', line);
  }
  g.append('g').attr('transform', `translate(0,${String(ih)})`).call(d3.axisBottom(x).tickSizeOuter(0));
  g.append('g').call(d3.axisLeft(y).ticks(5));
  return getSvgString(dom);
}

function renderAreaChart(series: ChartSeries[], width: number, height: number): string {
  const iw = width - MARGIN.left - MARGIN.right;
  const ih = height - MARGIN.top - MARGIN.bottom;
  const { rows, names, groups } = flattenSeries(series);
  const { svg, dom } = makeSvg(width, height);
  const g = svg.append('g').attr('transform', `translate(${String(MARGIN.left)},${String(MARGIN.top)})`);

  const color = d3.scaleOrdinal<string>(d3.schemeTableau10).domain(groups);
  const x = d3.scalePoint().domain(names).range([0, iw]).padding(0.5);
  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, (d) => d.value) ?? 1])
    .nice()
    .range([ih, 0]);
  const area = d3.area<{ name: string; group: string; value: number }>()
    .x((d) => x(d.name) ?? 0)
    .y0(ih)
    .y1((d) => y(d.value));

  for (const grp of groups) {
    const pts = rows.filter((d) => d.group === grp);
    g.append('path')
      .datum(pts)
      .attr('fill', color(grp))
      .attr('fill-opacity', 0.5)
      .attr('stroke', color(grp))
      .attr('stroke-width', 1.5)
      .attr('d', area);
  }
  g.append('g').attr('transform', `translate(0,${String(ih)})`).call(d3.axisBottom(x).tickSizeOuter(0));
  g.append('g').call(d3.axisLeft(y).ticks(5));
  return getSvgString(dom);
}

function renderPieChart(series: ChartSeries[], width: number, height: number): string {
  const { rows, groups } = flattenSeries(series);
  const { svg, dom } = makeSvg(width, height);
  const radius = Math.min(width, height) / 2 - 20;

  const g = svg.append('g').attr('transform', `translate(${String(width / 2)},${String(height / 2)})`);
  const color = d3.scaleOrdinal<string>(d3.schemeTableau10).domain(groups);
  const pie = d3.pie<{ name: string; group: string; value: number }>().value((d) => d.value);
  const arc = d3.arc<d3.PieArcDatum<{ name: string; group: string; value: number }>>()
    .innerRadius(0)
    .outerRadius(radius);

  g.selectAll('path')
    .data(pie(rows))
    .join('path')
    .attr('d', arc)
    .attr('fill', (d) => color(d.data.group))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1);

  return getSvgString(dom);
}
