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
import { themeAuroraCss } from '../src/templates/theme-aurora-css.ts';
import { themeSolarizedCss } from '../src/templates/theme-solarized-css.ts';
import { themeOceanCss } from '../src/templates/theme-ocean-css.ts';
import { themeForestCss } from '../src/templates/theme-forest-css.ts';
import { themeSunsetCss } from '../src/templates/theme-sunset-css.ts';
import { themeNordicCss } from '../src/templates/theme-nordic-css.ts';
import { themeCrimsonCss } from '../src/templates/theme-crimson-css.ts';
import { themeMonochromeCss } from '../src/templates/theme-monochrome-css.ts';
import { themeCandyCss } from '../src/templates/theme-candy-css.ts';
import { themeVolcanoCss } from '../src/templates/theme-volcano-css.ts';
import { THEMES, THEME_NAMES, findTheme } from '../src/templates/themes.ts';

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

  it('theme-aurora-css.ts matches theme-aurora.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-aurora.css'), 'utf-8');
    expect(themeAuroraCss).toBe(source);
  });

  it('theme-solarized-css.ts matches theme-solarized.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-solarized.css'), 'utf-8');
    expect(themeSolarizedCss).toBe(source);
  });

  it('theme-ocean-css.ts matches theme-ocean.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-ocean.css'), 'utf-8');
    expect(themeOceanCss).toBe(source);
  });

  it('theme-forest-css.ts matches theme-forest.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-forest.css'), 'utf-8');
    expect(themeForestCss).toBe(source);
  });

  it('theme-sunset-css.ts matches theme-sunset.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-sunset.css'), 'utf-8');
    expect(themeSunsetCss).toBe(source);
  });

  it('theme-nordic-css.ts matches theme-nordic.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-nordic.css'), 'utf-8');
    expect(themeNordicCss).toBe(source);
  });

  it('theme-crimson-css.ts matches theme-crimson.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-crimson.css'), 'utf-8');
    expect(themeCrimsonCss).toBe(source);
  });

  it('theme-monochrome-css.ts matches theme-monochrome.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-monochrome.css'), 'utf-8');
    expect(themeMonochromeCss).toBe(source);
  });

  it('theme-candy-css.ts matches theme-candy.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-candy.css'), 'utf-8');
    expect(themeCandyCss).toBe(source);
  });

  it('theme-volcano-css.ts matches theme-volcano.css', async () => {
    const source = await readFile(join(templatesDir, 'theme-volcano.css'), 'utf-8');
    expect(themeVolcanoCss).toBe(source);
  });
});

describe('Theme registry', () => {
  it('exports 11 themes (default + 10 built-in)', () => {
    expect(THEMES).toHaveLength(11);
  });

  it('THEME_NAMES includes all expected theme names', () => {
    const expected = [
      'default', 'aurora', 'solarized', 'ocean', 'forest',
      'sunset', 'nordic', 'crimson', 'monochrome', 'candy', 'volcano',
    ];
    expect(THEME_NAMES).toEqual(expected);
  });

  it('findTheme returns the correct theme info', () => {
    const aurora = findTheme('aurora');
    expect(aurora).toBeDefined();
    expect(aurora?.label).toBe('Aurora');
    expect(aurora?.dark).toBe(true);
    expect(aurora?.css).toBe(themeAuroraCss);
  });

  it('findTheme returns undefined for unknown themes', () => {
    expect(findTheme('nonexistent')).toBeUndefined();
  });

  it('every theme has a non-empty css string', () => {
    for (const theme of THEMES) {
      expect(theme.css.length).toBeGreaterThan(100);
    }
  });

  it('every theme css contains :host selector', () => {
    for (const theme of THEMES) {
      expect(theme.css).toContain(':host');
    }
  });

  it('every theme css defines --gs-color-accent', () => {
    for (const theme of THEMES) {
      expect(theme.css).toContain('--gs-color-accent');
    }
  });
});
