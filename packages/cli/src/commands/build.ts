/**
 * GeekSlides v2 — build command.
 *
 * Produces a production static bundle.
 */

import type { Command } from 'commander';
import { build, type InlineConfig } from 'vite';

export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build production bundle')
    .option('--outDir <path>', 'Output directory', 'dist')
    .option('--base <url>', 'Base URL for assets', '/')
    .option('--config <path>', 'Config file path', 'config.json')
    .action(async (opts: { outDir: string; base: string; config: string }) => {
      console.log('Building production bundle...');

      const viteConfig: InlineConfig = {
        build: {
          outDir: opts.outDir,
        },
        base: opts.base,
        configFile: false,
        root: process.cwd(),
      };

      await build(viteConfig);

      console.log(`  Build complete: ${opts.outDir}/`);
    });
}
