/**
 * Convert a .pptx buffer into GeekSlides deck files using an internal fork of
 * pptx2html's process_pptx.js converter.
 *
 * Output: config.json + slides.html + pptx.css
 *   - slides.html: one <section> per slide (section includes inline style for
 *     size and background from the PPTX)
 *   - pptx.css: shared layout CSS (pptxCss + per-deck globalCSS from theme)
 *   - config.json: { title, content: "slides.html", styles: ["pptx.css"],
 *                    aspectRatio: "W/H" }
 *
 * Charts are rendered server-side to inline SVG via D3 + jsdom.
 * Numeric bullets are resolved server-side via jsdom.
 * Images are embedded as base64 data URIs by the converter.
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import processPptxFactoryUntyped from './pptx/process-pptx.ts';
import { pptxCss } from './pptx/pptx-css.ts';
import { renderChart, type ChartSeries } from './pptx/chart-renderer.ts';
import { resolveNumericBullets } from './pptx/bullet-numbering.ts';
import { JSDOM } from 'jsdom';

import type { RepoFile } from './git.ts';

export interface PptxConvertResult {
  readonly files: readonly RepoFile[];
  readonly extractedTitle: string | null;
}

// ─── message types emitted by process_pptx.js ────────────────────────────────

interface SlideMsg    { type: 'slide';    data: string }
interface GlobalCSSMsg{ type: 'globalCSS'; data: string }
interface SlideSizeMsg{ type: 'slideSize'; data: { width: number; height: number } }
interface DoneMsg     { type: 'Done'; data: { time: number; charts: ChartEntry[] } }
interface ErrorMsg    { type: 'ERROR'; data: string }
interface ChartEntry  { type: 'createChart'; data: { chartID: string; chartType: string; chartData: ChartSeries[] } }
type PptxMsg = SlideMsg | GlobalCSSMsg | SlideSizeMsg | DoneMsg | ErrorMsg | { type: string; data: unknown };

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Convert a .pptx buffer into GeekSlides deck files.
 *
 * @param pptxBuffer  Raw .pptx file bytes.
 * @param userTitle   Optional title override; if absent, extracted from slide 1.
 */
export async function convertPptx(
  pptxBuffer: Buffer,
  userTitle?: string,
): Promise<PptxConvertResult> {
  // Buffer may share the underlying ArrayBuffer with other Node.js pool Buffers.
  const arrayBuffer = pptxBuffer.buffer.slice(
    pptxBuffer.byteOffset,
    pptxBuffer.byteOffset + pptxBuffer.byteLength,
  ) as ArrayBuffer;

  const slides: string[] = [];
  let globalCSS = '';
  let slideSize = { width: 960, height: 540 };
  let chartEntries: ChartEntry[] = [];

  await new Promise<void>((resolve, reject) => {
    // Cast to known signature — process-pptx.ts is an untyped JS fork
    const processPptxFactory = processPptxFactoryUntyped as (
      setOnMessage: (handler: (msg: { type: string; data: unknown }) => void) => void,
      postMessage: (msg: PptxMsg) => void,
    ) => void;

    // TS can't track closure-mutated variables, so we use a container object.
    const sender: { send: ((msg: { type: string; data: unknown }) => void) | null } = { send: null };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    processPptxFactory(
      (handler: (msg: { type: string; data: unknown }) => void) => { sender.send = handler; },
      (msg: PptxMsg) => {
        switch (msg.type) {
          case 'slide':     slides.push((msg as SlideMsg).data);            break;
          case 'globalCSS': globalCSS = (msg as GlobalCSSMsg).data;         break;
          case 'slideSize': slideSize = (msg as SlideSizeMsg).data;         break;
          case 'Done':      chartEntries = (msg as DoneMsg).data.charts;    resolve(); break;
          case 'ERROR':     reject(new Error((msg as ErrorMsg).data));       break;
        }
      },
    );

    if (sender.send === null) { reject(new Error('processPptx did not call setOnMessage')); return; }
    sender.send({ type: 'processPPTX', data: arrayBuffer });
  });

  // Post-process each slide: replace chart placeholders, resolve bullets
  const processedSlides = await Promise.all(
    slides.map((html) => postProcessSlide(html, chartEntries)),
  );

  // Extract title from slide 1 via largest font-size heuristic
  const extractedTitle = processedSlides[0] !== undefined
    ? extractLargestText(processedSlides[0])
    : null;
  const title = userTitle ?? extractedTitle ?? 'Untitled';

  // Derive aspect ratio from actual PPTX slide dimensions
  const gcd = greatestCommonDivisor(Math.round(slideSize.width), Math.round(slideSize.height));
  const aspectRatio = `${Math.round(slideSize.width) / gcd}/${Math.round(slideSize.height) / gcd}`;

  // Build files
  const slidesHtml = processedSlides.join('\n');
  const fullCss = `${pptxCss}\n/* deck theme */\n${globalCSS}`;
  const configJson = JSON.stringify(
    { title, content: 'slides.html', styles: ['pptx.css'], aspectRatio },
    null,
    2,
  );

  const files: RepoFile[] = [
    { path: 'config.json',  data: Buffer.from(configJson, 'utf8') },
    { path: 'slides.html',  data: Buffer.from(slidesHtml, 'utf8') },
    { path: 'pptx.css',     data: Buffer.from(fullCss,   'utf8') },
  ];

  return { files, extractedTitle };
}

// ─── slide post-processing ───────────────────────────────────────────────────

async function postProcessSlide(slideHtml: string, charts: ChartEntry[]): Promise<string> {
  // Use a single jsdom pass for both chart injection and bullet resolution.
  const dom = new JSDOM(`<div id="root">${slideHtml}</div>`);
  const { document } = dom.window;
  const root = document.getElementById('root');
  if (root === null) return slideHtml;

  // Chart injection: find placeholder divs and replace with rendered SVG
  for (const { data: { chartID, chartType, chartData } } of charts) {
    const placeholder = root.querySelector(`[id='${chartID}']`) as HTMLElement | null;
    if (placeholder === null) continue;

    const w = parseFloat(placeholder.style.width) || 400;
    const h = parseFloat(placeholder.style.height) || 300;
    const svgHtml = renderChart(chartType, chartData, w, h);

    if (svgHtml !== null) {
      // Wrap SVG in a div that preserves the placeholder's position/size
      const wrapper = document.createElement('div');
      wrapper.setAttribute('style', placeholder.getAttribute('style') ?? '');
      wrapper.innerHTML = svgHtml;
      placeholder.replaceWith(wrapper);
    }
    // If null (unsupported type), leave the placeholder div as-is
  }

  const withCharts = root.innerHTML;

  // Bullet numbering: port of setNumericBullets from pptx2html/main.js
  return resolveNumericBullets(withCharts);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Find the text node closest after the largest font-size declaration.
 * Used as a heuristic to extract a title from slide 1.
 */
function extractLargestText(html: string): string | null {
  const re = /font-size:\s*(\d+(?:\.\d+)?)p[xt]/gi;
  let bestSize = 0;
  let bestIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const size = parseFloat(m[1] ?? '0');
    if (size > bestSize) { bestSize = size; bestIndex = m.index + m[0].length; }
  }
  if (bestIndex === -1) return null;
  const textMatch = html.slice(bestIndex).match(/>([^<]{2,})</);
  const text = (textMatch?.[1] ?? '').trim();
  return text.length > 0 ? text : null;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}
