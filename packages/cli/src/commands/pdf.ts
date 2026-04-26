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
import { captureSlideScreenshots } from './pdf-capture.ts';
import {
  buildSlidesPdfHtml,
  buildDetailsPdfHtml,
  buildNotesPdfHtml,
  buildBookPdfHtml,
} from './pdf-templates.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('pdf');

// Re-export for backward compatibility (used by tests)
export { buildDetailsPdfHtml } from './pdf-templates.ts';

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
  deckDir = '',
  bookImageWidth = 25,
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
      html = buildBookPdfHtml(slides, title, deckDir, bookImageWidth);
      viewport = { width: mmToPx(170), height: mmToPx(252) }; // A4 portrait, 20mm/25mm margin
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
    .option('--book-image-width <percent>', 'Width of floated images in book format (0 to disable)', '25')
    .option('--no-cleanup', 'Keep temporary files')
    .action(async (opts: {
      format: string;
      all?: boolean;
      output?: string;
      content?: string;
      config: string;
      detailsLayout: string;
      bookImageWidth: string;
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
      // config.content is now string[], but --content CLI flag is a single path.
      const contentPaths: string[] = opts.content != null
        ? [resolvePdfInputPath(opts.content, configDir)]
        : (Array.isArray(config.content) ? config.content : [config.content])
            .map((p: string) => resolvePdfInputPath(p, configDir));
      let markdown: string;
      try {
        const parts = await Promise.all(contentPaths.map((p) => readFile(p, 'utf-8')));
        markdown = parts.join('\n');
      } catch {
        console.error(`Could not read content file(s): ${contentPaths.join(', ')}`);
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
        log.debug('chromium launched');
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
        log.debug({ url }, 'ephemeral vite server started');

        console.log('  Capturing slide screenshots...');
        const screenshotPaths = await captureSlideScreenshots(url, slides, tmpDir, browser);
        console.log(`  Captured ${String(screenshotPaths.length)} slides`);

        const bookImageWidth = Math.max(0, parseInt(opts.bookImageWidth, 10) || 25);

        if (opts.all) {
          // --- All formats, screenshots reused ---
          const base = opts.output?.replace(/\.pdf$/i, '') ?? join('.tmp', 'slides');
          await generatePdf(slides, 'slides',         config.title, screenshotPaths, tmpDir, `${base}.pdf`,                   'horizontal', browser);
          await generatePdf(slides, 'slides-notes',   config.title, screenshotPaths, tmpDir, `${base}-notes.pdf`,             'horizontal', browser);
          await generatePdf(slides, 'slides-details', config.title, screenshotPaths, tmpDir, `${base}-details-landscape.pdf`, 'horizontal', browser);
          await generatePdf(slides, 'slides-details', config.title, screenshotPaths, tmpDir, `${base}-details-vertical.pdf`,  'vertical',   browser);
          await generatePdf(slides, 'book',           config.title, screenshotPaths, tmpDir, `${base}-book.pdf`,              'horizontal', browser, configDir, bookImageWidth);
        } else {
          const format = opts.format as TemplateName;
          const detailsLayout = opts.detailsLayout as DetailsLayout;

          // --- Primary PDF ---
          const primaryOutput = opts.output ?? join('.tmp', `${format}.pdf`);
          const primaryOk = await generatePdf(
            slides, format, config.title, screenshotPaths, tmpDir, primaryOutput, detailsLayout, browser, configDir, bookImageWidth,
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
