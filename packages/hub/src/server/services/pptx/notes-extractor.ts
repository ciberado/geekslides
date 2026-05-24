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

interface TxmlText {
  readonly valueOf: () => string;
}

type TxmlAttrs = Readonly<Record<string, string | number>>;
type TxmlValue = string | TxmlText | TxmlNode | TxmlNode[] | TxmlAttrs;

interface TxmlNode {
  readonly [key: string]: TxmlValue | undefined;
  readonly attrs?: TxmlAttrs;
}

/** Parse XML string using the txml fork. Returns the root object. */
function parseXml(xml: string): TxmlNode {
  return (tXml as (input: string) => TxmlNode)(xml);
}

function isTxmlText(value: TxmlValue | undefined): value is TxmlText {
  return value instanceof String;
}

function isTxmlNode(value: TxmlValue | undefined): value is TxmlNode {
  return typeof value === 'object' && !Array.isArray(value) && !isTxmlText(value);
}

function getChild(node: TxmlNode | undefined, key: string): TxmlNode | undefined {
  const value = node?.[key];
  return isTxmlNode(value) ? value : undefined;
}

function getChildren(node: TxmlNode | undefined, key: string): TxmlNode[] {
  const value = node?.[key];
  if (Array.isArray(value)) {
    const children: TxmlNode[] = [];
    for (const child of value) {
      if (isTxmlNode(child)) children.push(child);
    }
    return children;
  }
  return isTxmlNode(value) ? [value] : [];
}

function getAttr(node: TxmlNode | undefined, key: string): string | undefined {
  const value = node?.attrs?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getText(value: TxmlValue | undefined): string {
  if (typeof value === 'string') return value;
  return isTxmlText(value) ? value.valueOf() : '';
}

/**
 * Convert a single `a:p` paragraph object (txml format) to an HTML string.
 * Returns an empty string if the paragraph has no text content.
 */
function paragraphToHtml(para: TxmlNode): string {
  const runs = getChildren(para, 'a:r');
  if (runs.length === 0) return '';

  const parts: string[] = [];

  for (const run of runs) {
    const rPr = getChild(run, 'a:rPr');
    // a:t is a String wrapper object — convert it explicitly to primitive text
    const text = getText(run['a:t']);
    if (!text) continue;

    const bold = getAttr(rPr, 'b') === '1';
    const italic = getAttr(rPr, 'i') === '1';

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
    const rels = getChildren(getChild(relsTree, 'Relationships'), 'Relationship');

    const notesRel = rels.find((relationship) => getAttr(relationship, 'Type')?.endsWith('/notesSlide') ?? false);
    if (!notesRel) { results.push(undefined); continue; }

    // Resolve the notes file path (Target is relative to ppt/slides/)
    const target = getAttr(notesRel, 'Target') ?? '';
    const notesPath = target.startsWith('../')
      ? 'ppt/' + target.slice(3)
      : 'ppt/slides/' + target;

    const notesFile = zip.file(notesPath);
    if (!notesFile) { results.push(undefined); continue; }

    const notesXml = await notesFile.async('text');
    const notesTree = parseXml(notesXml);
    const spTree = getChild(getChild(getChild(notesTree, 'p:notes'), 'p:cSld'), 'p:spTree');
    if (!spTree) { results.push(undefined); continue; }

    const shapes = getChildren(spTree, 'p:sp');

    // Find the body placeholder (p:ph type="body" idx="1") — the actual notes text.
    let txBody: TxmlNode | undefined;
    for (const sp of shapes) {
      const ph = getChild(getChild(getChild(sp, 'p:nvSpPr'), 'p:nvPr'), 'p:ph');
      if (getAttr(ph, 'type') === 'body' && getAttr(ph, 'idx') === '1') {
        txBody = getChild(sp, 'p:txBody');
        break;
      }
    }

    if (!txBody) { results.push(undefined); continue; }

    const htmlLines = getChildren(txBody, 'a:p')
      .map(paragraphToHtml)
      .filter((line) => line.length > 0);

    results.push(htmlLines.length > 0 ? htmlLines.join('\n') : undefined);
  }

  return results;
}
