/**
 * GeekSlides v2 — build command.
 *
 * Produces a production static bundle:
 * 1. Runs Vite build from the CLI app root.
 * 2. Copies config.json, content markdown, images/, and CSS files from the
 *    presentation directory into dist/.
 * 3. Patches dist/index.html to default to config.json when no ?config= is set.
 */

import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { build, type InlineConfig } from 'vite';
import { DEFAULT_CONFIG } from '@geekslides/engine/headless';
import { resolveDeckConfigPath, resolveCliAppRoot } from './dev.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('build');

export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build production bundle')
    .option('--outDir <path>', 'Output directory', 'dist')
    .option('--base <url>', 'Base URL for assets', '/')
    .option('--config <path>', 'Config file path', 'config.json')
    .action(async (opts: { outDir: string; base: string; config: string }) => {
      console.log('Building production bundle...');

      const appRoot = resolveCliAppRoot();
      const outDir = resolve(process.cwd(), opts.outDir);

      const viteConfig: InlineConfig = {
        build: {
          outDir,
          emptyOutDir: true,
        },
        base: opts.base,
        configFile: false,
        root: appRoot,
      };

      await build(viteConfig);

      // --- Load deck config ---
      const configPath = resolveDeckConfigPath(opts.config);
      const configDir = dirname(configPath);

      let config = DEFAULT_CONFIG;
      try {
        const configText = await readFile(configPath, 'utf-8');
        config = { ...DEFAULT_CONFIG, ...JSON.parse(configText) as Record<string, unknown> } as typeof config;
      } catch {
        console.warn('  Warning: could not read config.json, using defaults');
      }

      // --- Copy deck assets ---
      await copyFile(configPath, join(outDir, 'config.json'));
      console.log('  Copied config.json');

      const contentPath = resolve(configDir, config.content);
      if (existsSync(contentPath)) {
        await copyFile(contentPath, join(outDir, basename(contentPath)));
        console.log(`  Copied ${basename(contentPath)}`);
      }

      const imagesDir = resolve(configDir, 'images');
      if (existsSync(imagesDir)) {
        await cp(imagesDir, join(outDir, 'images'), { recursive: true });
        console.log('  Copied images/');
      }

      for (const stylePath of config.styles) {
        const src = resolve(configDir, stylePath);
        if (existsSync(src)) {
          const dest = join(outDir, stylePath);
          await mkdir(dirname(dest), { recursive: true });
          await copyFile(src, dest);
          console.log(`  Copied ${stylePath}`);
        }
      }

      // --- Patch index.html to default to config.json ---
      const indexPath = join(outDir, 'index.html');
      try {
        let html = await readFile(indexPath, 'utf-8');
        const redirect = `<script>if(!new URLSearchParams(location.search).has('config')){` +
          `const u=new URL(location.href);u.searchParams.set('config','config.json');location.replace(u)}</script>`;
        html = html.replace('</head>', `  ${redirect}\n</head>`);
        await writeFile(indexPath, html, 'utf-8');
        console.log('  Patched index.html with config.json default');
      } catch {
        // index.html may not exist (library build mode)
      }

      console.log(`  Build complete: ${opts.outDir}/`);
      log.debug({ outDir: opts.outDir, configPath }, 'build finished');
    });
}
