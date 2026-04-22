/**
 * Verify that the generated TypeScript string exports match
 * the canonical CSS source files.
 *
 * If this test fails, run:  npm run sync-templates
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { layoutsCss } from '../src/templates/layouts-css.ts';
import { themeDefaultCss } from '../src/templates/theme-default-css.ts';

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'templates');

describe('CSS template sync', () => {
  it('layouts-css.ts matches layouts.css', async () => {
    const source = await readFile(join(templatesDir, 'layouts.css'), 'utf-8');
    expect(layoutsCss).toBe(source);
  });

  it('theme-default-css.ts matches theme-default.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-default.css'), 'utf-8');
    expect(themeDefaultCss).toBe(source);
  });
});
