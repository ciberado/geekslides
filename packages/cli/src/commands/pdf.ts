/**
 * GeekSlides v2 — pdf command.
 *
 * Screenshot-based PDF generation:
 * 1. Starts an ephemeral Vite dev server for the deck.
 * 2. Opens Chromium at the presentation viewport (1920×1080).
 * 3. Navigates to each slide, reveals all partials, screenshots to temp dir.
 * 4. Assembles PDFs from the captured images:
 *    - slides: one screenshot per landscape page (254mm × 143mm).
 *    - slides-details: slide thumbnail + details HTML on A4 pages.
 *    - slides-notes: slide thumbnail + notes HTML on A4 pages.
 *    - book: flowing A4 pages assembled from slide images + notes.
 */

import type { Command } from 'commander';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { createServer, type InlineConfig, type ViteDevServer } from 'vite';
import { parse, DEFAULT_CONFIG, type TemplateName, type DetailsLayout, type SlideData } from '@geekslides/engine/headless';
import { geekSlidesHmr } from '@geekslides/engine/hmr';
import {
  resolveCliAppRoot,
  resolveDeckConfigPath,
  toBrowserServedPath,
  buildDeckDevUrl,
  getDeckRedirectTarget,
} from './dev.ts';

const VALID_FORMATS: TemplateName[] = ['slides', 'slides-notes', 'slides-details', 'book'];
const VALID_LAYOUTS: DetailsLayout[] = ['horizontal', 'vertical'];

/* ---------- helpers ---------------------------------------------------- */

export function resolvePdfInputPath(inputPath: string, baseDir: string): string {
  return inputPath.startsWith('/') ? inputPath : resolve(baseDir, inputPath);
}

export async function loadAuthorStyles(stylePaths: readonly string[], baseDir: string): Promise<string> {
  const cssChunks = await Promise.all(stylePaths.map(async (stylePath) => {
    const resolvedPath = resolvePdfInputPath(stylePath, baseDir);
    return await readFile(resolvedPath, 'utf-8');
  }));
  return cssChunks.join('\n');
}

/* ---------- ephemeral Vite server -------------------------------------- */

async function startEphemeralServer(deckConfigPath: string): Promise<{ server: ViteDevServer; url: string }> {
  const appRoot = resolveCliAppRoot();
  const deckDir = dirname(deckConfigPath);
  const browserConfigPath = toBrowserServedPath(deckConfigPath, appRoot);

  const viteConfig: InlineConfig = {
    plugins: [geekSlidesHmr()],
    server: {
      port: 0, // let OS pick a free port
      fs: { allow: [appRoot, deckDir] },
    },
    configFile: false,
    root: appRoot,
    logLevel: 'silent',
  };

  const server = await createServer(viteConfig);

  server.middlewares.use((req, res, next) => {
    const redirectTarget = getDeckRedirectTarget(req.url ?? '/', browserConfigPath);
    if (!redirectTarget) { next(); return; }
    res.statusCode = 302;
    res.setHeader('Location', redirectTarget);
    res.end();
  });

  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const presentationUrl = buildDeckDevUrl(`http://localhost:${String(port)}`, browserConfigPath);

  return { server, url: presentationUrl };
}

/* ---------- screenshot capture ----------------------------------------- */

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

async function captureSlideScreenshots(
  presentationUrl: string,
  slides: readonly SlideData[],
  tmpDir: string,
  browser: Browser,
): Promise<string[]> {
  const page = await browser.newPage();
  await page.setViewportSize({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT });
  await page.goto(presentationUrl, { waitUntil: 'networkidle' });

  // Wait for slides to load
  await page.waitForFunction(() => {
    const ss = document.querySelector('geek-slideshow');
    return ss && (ss as Record<string, unknown>).slideCount! > 0;
  }, { timeout: 15_000 });

  // Wait for all stylesheets (including @import Google Fonts) and fonts to finish loading
  await page.evaluate(async () => {
    // Wait for all stylesheets in <head> to load (catches hoisted @import font rules)
    const linkPromises = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => {
        if (el instanceof HTMLLinkElement && !el.sheet) {
          return new Promise<void>((resolve) => {
            el.addEventListener('load', () => resolve(), { once: true });
            el.addEventListener('error', () => resolve(), { once: true });
          });
        }
        return Promise.resolve();
      });
    await Promise.all(linkPromises);
    await document.fonts.ready;
  });

  // Disable slide transitions so screenshots are instant
  await page.evaluate(() => {
    const ss = document.querySelector('geek-slideshow');
    const container = ss?.shadowRoot?.querySelector<HTMLElement>('.gs-container');
    if (container) {
      container.style.setProperty('--gs-transition-duration', '0s');
    }
  });

  const paths: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const partialCount = slides[i].partialCount;

    // Navigate to slide and reveal all partials
    await page.evaluate(
      ({ idx, pc }: { idx: number; pc: number }) => {
        const ss = document.querySelector('geek-slideshow') as any;
        ss.goTo(idx, pc);
      },
      { idx: i, pc: partialCount },
    );

    // Wait for all images in the active slide to finish loading
    await page.evaluate(async () => {
      const ss = document.querySelector('geek-slideshow');
      const slideEls = ss?.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      for (const slide of slideEls) {
        if (!slide.hasAttribute('active')) continue;
        const imgs = slide.shadowRoot?.querySelectorAll('img') ?? [];
        await Promise.all(
          Array.from(imgs).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
                }),
          ),
        );
      }
      await document.fonts.ready;
    });

    const imgPath = join(tmpDir, `slide-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: imgPath, type: 'png' });
    paths.push(imgPath);
  }

  await page.close();
  return paths;
}

/* ---------- PDF assembly: slides --------------------------------------- */

function buildSlidesPdfHtml(screenshotPaths: string[]): string {
  const imgs = screenshotPaths
    .map((p) => `<div class="page"><img src="${pathToFileURL(p).href}"></div>`)
    .join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: 508mm 285.75mm; margin: 0; }
* { margin: 0; padding: 0; }
.page { page-break-after: always; width: 508mm; height: 285.75mm; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.page img { display: block; width: 100%; height: 100%; object-fit: contain; }
</style></head><body>${imgs}</body></html>`;
}

/* ---------- PDF assembly: slides-details ------------------------------- */

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildDetailsPdfHtml(
  screenshotPaths: string[],
  slides: readonly SlideData[],
  layout: DetailsLayout,
): string {
  const isHorizontal = layout === 'horizontal';
  const lastIdx = slides.length - 1;
  const pages = slides.map((slide, i) => {
    const imgSrc = pathToFileURL(screenshotPaths[i]).href;
    const hasDetails = Boolean(slide.detailsHtml);
    const isHero = !hasDetails && (i === 0 || i === lastIdx);
    const detailsClass = isHero ? 'hero' : (hasDetails ? 'has-details' : 'no-details');
    const layoutClass = isHorizontal ? 'horizontal' : 'vertical';
    const details = hasDetails
      ? `<div class="details"><div class="details-inner">${slide.detailsHtml}</div></div>`
      : '';
    return `<div class="page ${detailsClass} ${layoutClass}"><div class="thumb"><img src="${imgSrc}"></div>${details}</div>`;
  }).join('\n');

  const pageSize = isHorizontal ? 'A4 landscape' : 'A4';
  const pageMargin = isHorizontal ? '10mm' : '15mm';
  const usableW = isHorizontal ? '277mm' : '180mm';
  const usableH = isHorizontal ? '190mm' : '267mm';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: ${pageSize}; margin: ${pageMargin}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 12pt; line-height: 1.5; color: #333; }
.page { page-break-after: always; page-break-inside: avoid;
  height: ${usableH}; display: flex; overflow: hidden; }
.page:last-child { page-break-after: auto; }

/* Hero slides (first/last without details): full-page centred, 16:9 preserved */
.page.hero { align-items: center; justify-content: center; }
.page.hero .thumb { width: 100%; }
.page.hero .thumb img { width: 100%; height: auto; border: none; border-radius: 0; }

/* No details: slide at top (vertical) or left-aligned + vertically centred (horizontal) */
.page.no-details:not(.hero) { flex-direction: column; align-items: stretch; }
.page.horizontal.no-details:not(.hero) { flex-direction: row; align-items: center; }
.page.no-details:not(.hero) .thumb { width: 100%; }
.page.no-details:not(.hero) .thumb img { object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }
.page.horizontal.no-details:not(.hero) .thumb { flex-shrink: 0; width: 140mm; }
.page.horizontal.no-details:not(.hero) .thumb img { width: 140mm; height: 78.75mm; }

/* Horizontal layout (landscape page: slide left, details right, both vertically centred) */
.page.horizontal.has-details { flex-direction: row; align-items: center; gap: 6mm; }
.page.horizontal.has-details .thumb { flex-shrink: 0; width: 140mm; }
.page.horizontal.has-details .thumb img { width: 140mm; height: 78.75mm; object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }
.page.horizontal.has-details .details { flex: 1; min-width: 0; overflow: hidden; }

/* Vertical layout (portrait page: slide at top, details below) */
.page.vertical:not(.hero) { flex-direction: column; align-items: stretch; gap: 5mm; }
.page.vertical:not(.hero) .thumb { flex-shrink: 0; width: ${usableW}; }
.page.vertical:not(.hero) .thumb img { width: ${usableW}; object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }
.page.vertical .details { flex: 1; min-width: 0; overflow: hidden; }

.details-inner { font-size: 12pt; line-height: 1.5; }
.details-inner h1 { font-size: 16pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner h2 { font-size: 14pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner h3 { font-size: 13pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner h4 { font-size: 12pt; font-weight: 600; margin: 0 0 0.3em; }
.details-inner p { margin: 0 0 0.3em; }
.details-inner p:last-child { margin-bottom: 0; }
.details-inner ul, .details-inner ol { margin: 0.2em 0; padding-left: 1.2em; }
.details-inner li { margin-bottom: 0.1em; }
.details-inner code { font-family: ui-monospace, monospace; font-size: 0.85em; background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 3px; }
.details-inner a { color: #4a9eff; text-decoration: none; }
</style></head><body>${pages}</body></html>`;
}

/* ---------- PDF assembly: slides-notes --------------------------------- */

function buildNotesPdfHtml(
  screenshotPaths: string[],
  slides: readonly SlideData[],
): string {
  const pages = slides.map((slide, i) => {
    const imgSrc = pathToFileURL(screenshotPaths[i]).href;
    const notes = slide.notesHtml
      ? `<aside class="notes">${slide.notesHtml}</aside>`
      : '';
    return `<div class="page"><div class="thumb"><img src="${imgSrc}"></div>${notes}</div>`;
  }).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 20mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 9pt; line-height: 1.5; color: #444; }
.page { page-break-after: always; page-break-inside: avoid; }
.page:last-child { page-break-after: auto; }
.thumb img { width: 170mm; height: 95.6mm; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 5mm; }
.notes { font-size: 9pt; line-height: 1.5; padding: 3mm 0; border-top: 2px solid #4a9eff; }
</style></head><body>${pages}</body></html>`;
}

/* ---------- PDF assembly: book ----------------------------------------- */

function buildBookPdfHtml(
  screenshotPaths: string[],
  slides: readonly SlideData[],
  title: string,
): string {
  const pages = slides.map((slide, i) => {
    const imgSrc = pathToFileURL(screenshotPaths[i]).href;
    const isChapter = slide.html.trimStart().startsWith('<h1');
    const chapterClass = isChapter ? ' book-chapter' : '';
    const notes = slide.notesHtml
      ? `<div class="book-notes">${slide.notesHtml}</div>`
      : '';
    return `<section class="book-slide${chapterClass}"><div class="thumb"><img src="${imgSrc}"></div>${notes}</section>`;
  }).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 11pt; line-height: 1.5; color: #222;
  background: #f5f5f5; }
h1.book-title { font-size: 24pt; padding: 25mm 25mm 1rem; }
.book-slide { page-break-inside: avoid; padding: 8mm 25mm; }
.book-chapter { page-break-before: always; }
.book-chapter:first-of-type { page-break-before: auto; }
.thumb img { width: 100%; height: auto; margin-bottom: 0.5rem; }
.book-notes { line-height: 1.7; }
.book-notes ul, .book-notes ol { padding-left: 1.5em; margin: 0.3em 0; }
.book-notes li { margin-bottom: 0.15em; }
.book-notes ul ul, .book-notes ol ol, .book-notes ul ol, .book-notes ol ul { padding-left: 1.5em; margin: 0.1em 0; }
.book-notes p { margin: 0 0 0.4em; }
.book-notes code { font-family: ui-monospace, monospace; font-size: 0.85em; background: #e8e8e8; padding: 0.1em 0.3em; border-radius: 3px; }
.book-notes strong { font-weight: 600; }
</style></head><body><h1 class="book-title">${escapeHtml(title)}</h1>${pages}</body></html>`;
}

/* ---------- generate a PDF from assembled HTML ------------------------- */

/** Convert mm to pixels at 96 dpi. */
function mmToPx(mm: number): number {
  return Math.ceil(mm * 96 / 25.4);
}

async function htmlToPdf(
  html: string,
  tmpDir: string,
  outputPath: string,
  browser: Browser,
  viewport?: { width: number; height: number },
): Promise<boolean> {
  const tmpHtml = join(tmpDir, `assemble-${Date.now().toString(36)}.html`);
  await writeFile(tmpHtml, html, 'utf-8');

  try {
    await mkdir(dirname(outputPath), { recursive: true });
    const page = await browser.newPage({
      ...(viewport ? { viewport } : {}),
    });
    await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outputPath,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.close();
    console.log(`  PDF generated: ${outputPath}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`PDF generation failed: ${message}`);
    process.exitCode = 1;
    return false;
  }
}

/* ---------- main generation pipeline ----------------------------------- */

async function generatePdf(
  slides: readonly SlideData[],
  format: TemplateName,
  title: string,
  screenshotPaths: string[],
  tmpDir: string,
  outputPath: string,
  detailsLayout: DetailsLayout,
  browser: Browser,
): Promise<boolean> {
  let html: string;
  let viewport: { width: number; height: number } | undefined;

  switch (format) {
    case 'slides':
      html = buildSlidesPdfHtml(screenshotPaths);
      viewport = { width: 1920, height: 1080 };
      break;
    case 'slides-details': {
      html = buildDetailsPdfHtml(screenshotPaths, slides, detailsLayout);
      const isH = detailsLayout === 'horizontal';
      // Match viewport to @page content area (page minus margins) at 96 dpi
      viewport = isH
        ? { width: mmToPx(277), height: mmToPx(190) }   // A4 landscape, 10mm margin
        : { width: mmToPx(180), height: mmToPx(267) };   // A4 portrait, 15mm margin
      break;
    }
    case 'slides-notes':
      html = buildNotesPdfHtml(screenshotPaths, slides);
      viewport = { width: mmToPx(170), height: mmToPx(257) }; // A4, 20mm margin
      break;
    case 'book':
      html = buildBookPdfHtml(screenshotPaths, slides, title);
      viewport = { width: mmToPx(210), height: mmToPx(297) }; // A4, 0 margin
      break;
  }

  return htmlToPdf(html, tmpDir, outputPath, browser, viewport);
}

/* ---------- command registration --------------------------------------- */

export function registerPdfCommand(program: Command): void {
  program
    .command('pdf')
    .description('Generate PDF from presentation. Use --all to produce every format in one pass.')
    .option('--format <type>', `Output format: ${VALID_FORMATS.join(', ')}`, 'slides')
    .option('--all', 'Generate all formats (slides, notes, details-h, details-v, book) in one pass')
    .option('--output <path>', 'Output PDF path (used as base name for --all)')
    .option('--content <path>', 'Markdown content file')
    .option('--config <path>', 'Config file path', 'config.json')
    .option('--details-layout <layout>', 'Details layout for single run: horizontal or vertical', 'horizontal')
    .option('--no-cleanup', 'Keep temporary files')
    .action(async (opts: {
      format: string;
      all?: boolean;
      output?: string;
      content?: string;
      config: string;
      detailsLayout: string;
      cleanup: boolean;
    }) => {
      if (!opts.all) {
        const format = opts.format as TemplateName;
        if (!VALID_FORMATS.includes(format)) {
          console.error(`Invalid format: ${opts.format}. Use: ${VALID_FORMATS.join(', ')}`);
          process.exitCode = 1;
          return;
        }

        const detailsLayout = opts.detailsLayout as DetailsLayout;
        if (!VALID_LAYOUTS.includes(detailsLayout)) {
          console.error(`Invalid details layout: ${opts.detailsLayout}. Use: ${VALID_LAYOUTS.join(', ')}`);
          process.exitCode = 1;
          return;
        }
      }

      // Load config
      let config = DEFAULT_CONFIG;
      const configPath = resolve(process.cwd(), opts.config);
      const configDir = dirname(configPath);
      try {
        const configText = await readFile(configPath, 'utf-8');
        const raw = JSON.parse(configText) as Record<string, unknown>;
        config = { ...DEFAULT_CONFIG, ...raw } as typeof config;
      } catch {
        console.log('  Using default config (no config.json found)');
      }

      // Load markdown (for slide data: details, notes, partial counts)
      const contentPath = resolvePdfInputPath(opts.content ?? config.content, configDir);
      let markdown: string;
      try {
        markdown = await readFile(contentPath, 'utf-8');
      } catch {
        console.error(`Could not read content file: ${contentPath}`);
        process.exitCode = 1;
        return;
      }

      const slides = parse(markdown);
      if (slides.length === 0) {
        console.error('No slides found in content');
        process.exitCode = 1;
        return;
      }

      // Launch browser
      let browser: Browser;
      try {
        browser = await chromium.launch();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Could not launch Chromium. Install Playwright browsers:');
        console.error('  npx playwright install chromium');
        console.error(`Error: ${message}`);
        process.exitCode = 1;
        return;
      }

      // Start ephemeral Vite server
      let vite: ViteDevServer | null = null;
      const tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-pdf-'));

      try {
        const deckConfigPath = resolveDeckConfigPath(opts.config);
        const { server, url } = await startEphemeralServer(deckConfigPath);
        vite = server;

        console.log('  Capturing slide screenshots...');
        const screenshotPaths = await captureSlideScreenshots(url, slides, tmpDir, browser);
        console.log(`  Captured ${String(screenshotPaths.length)} slides`);

        if (opts.all) {
          // --- All formats, screenshots reused ---
          const base = opts.output?.replace(/\.pdf$/i, '') ?? join('.tmp', 'slides');
          await generatePdf(slides, 'slides',         config.title, screenshotPaths, tmpDir, `${base}.pdf`,                   'horizontal', browser);
          await generatePdf(slides, 'slides-notes',   config.title, screenshotPaths, tmpDir, `${base}-notes.pdf`,             'horizontal', browser);
          await generatePdf(slides, 'slides-details', config.title, screenshotPaths, tmpDir, `${base}-details-landscape.pdf`, 'horizontal', browser);
          await generatePdf(slides, 'slides-details', config.title, screenshotPaths, tmpDir, `${base}-details-vertical.pdf`,  'vertical',   browser);
          await generatePdf(slides, 'book',           config.title, screenshotPaths, tmpDir, `${base}-book.pdf`,              'horizontal', browser);
        } else {
          const format = opts.format as TemplateName;
          const detailsLayout = opts.detailsLayout as DetailsLayout;

          // --- Primary PDF ---
          const primaryOutput = opts.output ?? join('.tmp', `${format}.pdf`);
          const primaryOk = await generatePdf(
            slides, format, config.title, screenshotPaths, tmpDir, primaryOutput, detailsLayout, browser,
          );
          if (!primaryOk) return;

          // --- Details PDF (automatic second output) ---
          if (format !== 'slides-details') {
            const detailsOutput = primaryOutput.replace(/\.pdf$/i, '-details.pdf');
            await generatePdf(
              slides, 'slides-details', config.title, screenshotPaths, tmpDir, detailsOutput, detailsLayout, browser,
            );
          }
        }
      } finally {
        await browser.close();
        if (vite) await vite.close();
        if (opts.cleanup) {
          await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        } else {
          console.log(`  Temp dir: ${tmpDir}`);
        }
      }
    });
}
