/**
 * GeekSlides v2 — pdf command.
 *
 * Generates PDF via PrintRenderer + WeasyPrint.
 * Always produces two PDFs: the primary format + a slides-details version.
 */

import type { Command } from 'commander';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse, renderPrint, DEFAULT_CONFIG, type TemplateName, type DetailsLayout } from '@geekslides/engine/headless';

const execFileAsync = promisify(execFile);

const VALID_FORMATS: TemplateName[] = ['slides', 'slides-notes', 'slides-details', 'book'];
const VALID_LAYOUTS: DetailsLayout[] = ['horizontal', 'vertical'];

export function resolvePdfInputPath(inputPath: string, baseDir: string): string {
  return inputPath.startsWith('/') ? inputPath : resolve(baseDir, inputPath);
}

export function createTempHtmlPath(contentPath: string, timestamp: number = Date.now()): string {
  return join(dirname(contentPath), `.geekslides-print-${timestamp.toString(36)}.html`);
}

export async function loadAuthorStyles(stylePaths: readonly string[], baseDir: string): Promise<string> {
  const cssChunks = await Promise.all(stylePaths.map(async (stylePath) => {
    const resolvedPath = resolvePdfInputPath(stylePath, baseDir);
    return await readFile(resolvedPath, 'utf-8');
  }));

  return cssChunks.join('\n');
}

async function invokeWeasyPrint(htmlPath: string, outputPath: string, baseDir: string): Promise<void> {
  await execFileAsync('weasyprint', ['-O', 'none', '-u', baseDir, htmlPath, outputPath]);
}

async function generatePdf(
  slides: readonly import('@geekslides/engine/headless').SlideData[],
  format: TemplateName,
  config: import('@geekslides/engine/headless').GeekSlidesConfig,
  options: import('@geekslides/engine/headless').PrintOptions | undefined,
  contentPath: string,
  baseDir: string,
  outputPath: string,
  cleanup: boolean,
): Promise<boolean> {
  const html = renderPrint([...slides], format, config, options);
  const tmpPath = createTempHtmlPath(contentPath);
  await writeFile(tmpPath, html, 'utf-8');

  try {
    await invokeWeasyPrint(tmpPath, outputPath, baseDir);
    console.log(`  PDF generated: ${outputPath}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ENOENT')) {
      console.error('WeasyPrint not found. Install it:');
      console.error('  macOS:  brew install weasyprint');
      console.error('  Linux:  apt install weasyprint');
      console.error('  pip:    pip install weasyprint');
    } else {
      console.error(`WeasyPrint failed (${format}):`, message);
    }
    process.exitCode = 1;
    return false;
  } finally {
    if (cleanup) {
      await unlink(tmpPath).catch(() => {});
    } else {
      console.log(`  Temp HTML: ${tmpPath}`);
    }
  }
}

export function registerPdfCommand(program: Command): void {
  program
    .command('pdf')
    .description('Generate PDF from presentation (produces slides + slides-details)')
    .option('--format <type>', 'Output format: slides, slides-notes, slides-details, or book', 'slides')
    .option('--output <path>', 'Output PDF path for primary format')
    .option('--content <path>', 'Markdown content file')
    .option('--config <path>', 'Config file path', 'config.json')
    .option('--details-layout <layout>', 'Details layout: horizontal or vertical', 'horizontal')
    .option('--no-cleanup', 'Keep temporary HTML files')
    .action(async (opts: { format: string; output?: string; content?: string; config: string; detailsLayout: string; cleanup: boolean }) => {
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

      // Load markdown
      const contentPath = resolvePdfInputPath(opts.content ?? config.content, configDir);
      let markdown: string;
      try {
        markdown = await readFile(contentPath, 'utf-8');
      } catch {
        console.error(`Could not read content file: ${contentPath}`);
        process.exitCode = 1;
        return;
      }

      // Parse slides
      const slides = parse(markdown);
      if (slides.length === 0) {
        console.error('No slides found in content');
        process.exitCode = 1;
        return;
      }

      let authorCss = '';
      try {
        authorCss = await loadAuthorStyles(config.styles, configDir);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Could not read stylesheet file: ${message}`);
        process.exitCode = 1;
        return;
      }

      const printOptions = authorCss.length > 0 ? { extraCss: authorCss } : undefined;
      const baseDir = dirname(contentPath);

      // --- Primary PDF ---
      const primaryOutput = opts.output ?? `${format}.pdf`;
      const primaryOk = await generatePdf(slides, format, config, printOptions, contentPath, baseDir, primaryOutput, opts.cleanup);
      if (!primaryOk) return;

      // --- Details PDF (automatic second output) ---
      if (format !== 'slides-details') {
        const detailsOutput = primaryOutput.replace(/\.pdf$/i, '-details.pdf');
        const detailsOptions = { ...printOptions, detailsLayout };
        await generatePdf(slides, 'slides-details', config, detailsOptions, contentPath, baseDir, detailsOutput, opts.cleanup);
      }
    });
}
