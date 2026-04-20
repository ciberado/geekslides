/**
 * GeekSlides v2 — create command.
 *
 * Scaffolds a new presentation repository.
 */

import type { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../logging.ts';

const log = createLogger('create');

const execFileAsync = promisify(execFile);

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new presentation')
    .requiredOption('--title <string>', 'Presentation title')
    .option('--dir <path>', 'Target directory (default: slugified title)')
    .option('--no-git', 'Skip git init')
    .action(async (opts: { title: string; dir?: string; git: boolean }) => {
      const slug = opts.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const dir = opts.dir ?? slug;

      console.log(`Creating presentation: ${opts.title}`);

      await mkdir(join(dir, 'images'), { recursive: true });
      await mkdir(join(dir, 'css'), { recursive: true });

      // config.json
      const config = {
        title: opts.title,
        content: 'README.md',
        styles: ['css/local.css'],
        aspectRatio: '16/9',
      };
      await writeFile(join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');

      // README.md
      const readme = `[](#title)

## ${opts.title}

---

[](#agenda)

## Agenda

- Topic 1
- Topic 2
- Topic 3

---

[](#topic-1)

## Topic 1

Your content here.

::: Notes
Speaker notes go here.
:::
`;
      await writeFile(join(dir, 'README.md'), readme, 'utf-8');

      // local.css
      const css = `/* ${opts.title} — custom styles */
:root {
  --gs-font-family: system-ui, sans-serif;
  --gs-font-size: 1.5rem;
  --gs-heading-color: #333;
  --gs-link-color: #4a9eff;
  --gs-code-background: #f5f5f5;
}
`;
      await writeFile(join(dir, 'css', 'local.css'), css, 'utf-8');

      // images/.gitkeep
      await writeFile(join(dir, 'images', '.gitkeep'), '', 'utf-8');

      // Git init
      if (opts.git) {
        try {
          await execFileAsync('git', ['init', dir]);
          console.log('  Git repository initialized');
        } catch {
          console.log('  Git init skipped (git not available)');
        }
      }

      console.log(`  Created: ${dir}/`);
      console.log('  Files: config.json, README.md, css/local.css, images/');
      log.debug({ dir, title: opts.title }, 'presentation scaffolded');
    });
}
