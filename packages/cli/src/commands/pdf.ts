/**
 * GeekSlides v2 — pdf command.
 *
 * Generates PDF via PrintRenderer + WeasyPrint.
 */

import type { Command } from 'commander';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse, renderPrint, DEFAULT_CONFIG, type TemplateName } from '@geekslides/engine/headless';

const execFileAsync = promisify(execFile);

const VALID_FORMATS: TemplateName[] = ['slides', 'slides-notes', 'book'];

export function registerPdfCommand(program: Command): void {
  program
    .command('pdf')
    .description('Generate PDF from presentation')
    .option('--format <type>', 'Output format: slides, slides-notes, or book', 'slides')
    .option('--output <path>', 'Output PDF path')
    .option('--content <path>', 'Markdown content file', 'README.md')
    .option('--config <path>', 'Config file path', 'config.json')
    .option('--no-cleanup', 'Keep temporary HTML file')
    .action(async (opts: { format: string; output?: string; content: string; config: string; cleanup: boolean }) => {
      const format = opts.format as TemplateName;
      if (!VALID_FORMATS.includes(format)) {
        console.error(`Invalid format: ${opts.format}. Use: ${VALID_FORMATS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      // Load config
      let config = DEFAULT_CONFIG;
      try {
        const configText = await readFile(opts.config, 'utf-8');
        const raw = JSON.parse(configText) as Record<string, unknown>;
        config = { ...DEFAULT_CONFIG, ...raw } as typeof config;
      } catch {
        console.log('  Using default config (no config.json found)');
      }

      // Load markdown
      const contentPath = opts.content;
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

      // Render HTML
      const html = renderPrint(slides, format, config);

      // Write temp HTML
      const tmpPath = join(tmpdir(), `geekslides-${Date.now().toString(36)}.html`);
      await writeFile(tmpPath, html, 'utf-8');

      // Output path
      const outputPath = opts.output ?? `${format}.pdf`;

      // Invoke WeasyPrint
      try {
        await execFileAsync('weasyprint', [tmpPath, outputPath]);
        console.log(`  PDF generated: ${outputPath}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('ENOENT')) {
          console.error('WeasyPrint not found. Install it:');
          console.error('  macOS:  brew install weasyprint');
          console.error('  Linux:  apt install weasyprint');
          console.error('  pip:    pip install weasyprint');
        } else {
          console.error('WeasyPrint failed:', message);
        }
        process.exitCode = 1;
      } finally {
        if (opts.cleanup) {
          await unlink(tmpPath).catch(() => {});
        } else {
          console.log(`  Temp HTML: ${tmpPath}`);
        }
      }
    });
}
