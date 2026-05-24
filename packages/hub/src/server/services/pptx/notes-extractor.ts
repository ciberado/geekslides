/**
 * PPTX speaker-notes extractor.
 *
 * Reads `ppt/notesSlides/notesSlideN.xml` for each slide and converts the
 * notes body (the placeholder with type="body" idx="1") to an HTML string.
 * Basic formatting is preserved: bold runs become <strong>, italic runs <em>.
 *
 * Slides that have no notes file, or whose notes body is empty, return undefined.
 *
 * Uses the same txml fork as process-pptx.ts, which returns a nested plain-object
 * tree rather than an array. Multiple same-tag children become an array; single
 * children are a plain object. Text content (`a:t`) is a String wrapper object.
 */

import JSZip from 'jszip';
import tXml from './txml.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxmlTree = Record<string, any>;

/** Parse XML string using the txml fork. Returns the root object. */
function parseXml(xml: string): TxmlTree {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
  return (tXml as (s: string) => TxmlTree)(xml);
}

/** Ensure a value is always an array (wraps single items, passes arrays through). */
function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Convert a single `a:p` paragraph object (txml format) to an HTML string.
 * Returns an empty string if the paragraph has no text content.
 */
function paragraphToHtml(para: TxmlTree): string {
  const runs = toArray<TxmlTree>(para['a:r'] as TxmlTree | TxmlTree[] | undefined);
  if (runs.length === 0) return '';

  const parts: string[] = [];

  for (const run of runs) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rPr = run['a:rPr'] as TxmlTree | undefined;
    // a:t is a String wrapper object — use String() to extract the text
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const text = String(run['a:t'] ?? '');
    if (!text) continue;

    const bold = rPr?.attrs?.['b'] === '1';
    const italic = rPr?.attrs?.['i'] === '1';

    let html = escapeHtml(text);
    if (italic) html = `<em>${html}</em>`;
    if (bold) html = `<strong>${html}</strong>`;
    parts.push(html);
  }

  const line = parts.join('');
  return line ? `<p>${line}</p>` : '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Extract speaker notes from a PPTX archive for each slide.
 *
 * @param arrayBuffer  The raw .pptx bytes (same buffer passed to processPptxFactory).
 * @param slideFilenames  Ordered list of slide paths, e.g. ["ppt/slides/slide1.xml", ...].
 * @returns  Array (same length as slideFilenames) of HTML strings or undefined.
 */
export async function extractPptxNotes(
  arrayBuffer: ArrayBuffer,
  slideFilenames: readonly string[],
): Promise<(string | undefined)[]> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const results: (string | undefined)[] = [];

  for (const slidePath of slideFilenames) {
    // ppt/slides/slide1.xml → ppt/slides/_rels/slide1.xml.rels
    const relsPath = slidePath.replace(
      /ppt\/slides\/(slide\d+\.xml)/,
      'ppt/slides/_rels/$1.rels',
    );

    const relsFile = zip.file(relsPath);
    if (!relsFile) { results.push(undefined); continue; }

    const relsXml = await relsFile.async('text');
    const relsTree = parseXml(relsXml);

    // Relationships may be a single object or an array
    const rels = toArray<TxmlTree>(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      relsTree['Relationships']?.['Relationship'] as TxmlTree | TxmlTree[] | undefined,
    );

    const notesRel = rels.find((r: TxmlTree) =>
      (r.attrs?.['Type'] as string | undefined)?.endsWith('/notesSlide'),
    );
    if (!notesRel) { results.push(undefined); continue; }

    // Resolve the notes file path (Target is relative to ppt/slides/)
    const target = (notesRel.attrs?.['Target'] as string) ?? '';
    const notesPath = target.startsWith('../')
      ? 'ppt/' + target.slice(3)
      : 'ppt/slides/' + target;

    const notesFile = zip.file(notesPath);
    if (!notesFile) { results.push(undefined); continue; }

    const notesXml = await notesFile.async('text');
    const notesTree = parseXml(notesXml);

    // Navigate: p:notes → p:cSld → p:spTree → p:sp[]
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const spTree = notesTree['p:notes']?.['p:cSld']?.['p:spTree'] as TxmlTree | undefined;
    if (!spTree) { results.push(undefined); continue; }

    const shapes = toArray<TxmlTree>(spTree['p:sp'] as TxmlTree | TxmlTree[] | undefined);

    // Find the body placeholder (p:ph type="body" idx="1") — the actual notes text.
    let txBody: TxmlTree | undefined;
    for (const sp of shapes) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const ph = sp['p:nvSpPr']?.['p:nvPr']?.['p:ph'] as TxmlTree | undefined;
      if (ph?.attrs?.['type'] === 'body' && ph.attrs['idx'] === '1') {
        txBody = sp['p:txBody'] as TxmlTree | undefined;
        break;
      }
    }

    if (!txBody) { results.push(undefined); continue; }

    const paragraphs = toArray<TxmlTree>(txBody['a:p'] as TxmlTree | TxmlTree[] | undefined);
    const htmlLines = paragraphs
      .map(paragraphToHtml)
      .filter(line => line.length > 0);

    results.push(htmlLines.length > 0 ? htmlLines.join('\n') : undefined);
  }

  return results;
}
