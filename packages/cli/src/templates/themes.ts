/**
 * GeekSlides v2 — Built-in theme registry.
 *
 * Maps theme names to their CSS strings and metadata.
 * Used by the `create` command (--theme) and the runtime `theme` command.
 */

import { themeDefaultCss } from './theme-default-css.ts';
import { themeAuroraCss } from './theme-aurora-css.ts';
import { themeSolarizedCss } from './theme-solarized-css.ts';
import { themeOceanCss } from './theme-ocean-css.ts';
import { themeForestCss } from './theme-forest-css.ts';
import { themeSunsetCss } from './theme-sunset-css.ts';
import { themeNordicCss } from './theme-nordic-css.ts';
import { themeCrimsonCss } from './theme-crimson-css.ts';
import { themeMonochromeCss } from './theme-monochrome-css.ts';
import { themeCandyCss } from './theme-candy-css.ts';
import { themeVolcanoCss } from './theme-volcano-css.ts';

export interface ThemeInfo {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly dark: boolean;
  readonly css: string;
}

export const THEMES: readonly ThemeInfo[] = [
  {
    name: 'default',
    label: 'Default',
    description: 'Clean neutral palette with blue accent (system-ui font)',
    dark: false,
    css: themeDefaultCss,
  },
  {
    name: 'aurora',
    label: 'Aurora',
    description: 'Deep-space dark with electric-cyan accents (Exo 2 font)',
    dark: true,
    css: themeAuroraCss,
  },
  {
    name: 'solarized',
    label: 'Solarized',
    description: 'Warm Solarized Light palette with amber accents (Source Serif 4)',
    dark: false,
    css: themeSolarizedCss,
  },
  {
    name: 'ocean',
    label: 'Ocean',
    description: 'Deep-blue ocean palette with teal accents (Nunito font)',
    dark: false,
    css: themeOceanCss,
  },
  {
    name: 'forest',
    label: 'Forest',
    description: 'Earthy warm-cream with forest-green accents (Playfair Display)',
    dark: false,
    css: themeForestCss,
  },
  {
    name: 'sunset',
    label: 'Sunset',
    description: 'Warm ivory with vivid coral/orange accents (Raleway font)',
    dark: false,
    css: themeSunsetCss,
  },
  {
    name: 'nordic',
    label: 'Nordic',
    description: 'Cool Scandinavian grey with nordic-blue accents (DM Sans font)',
    dark: false,
    css: themeNordicCss,
  },
  {
    name: 'crimson',
    label: 'Crimson',
    description: 'Parchment cream with deep burgundy accents (Cormorant Garamond)',
    dark: false,
    css: themeCrimsonCss,
  },
  {
    name: 'monochrome',
    label: 'Monochrome',
    description: 'Pure black-and-white, typography-driven (Space Grotesk font)',
    dark: false,
    css: themeMonochromeCss,
  },
  {
    name: 'candy',
    label: 'Candy',
    description: 'Soft lavender with vivid violet accents (Poppins font)',
    dark: false,
    css: themeCandyCss,
  },
  {
    name: 'volcano',
    label: 'Volcano',
    description: 'Near-black with fiery orange-red accents (Oswald + Open Sans)',
    dark: true,
    css: themeVolcanoCss,
  },
] as const;

export const THEME_NAMES: string[] = THEMES.map((t) => t.name);

/**
 * Look up a theme by name. Returns undefined for unknown themes.
 */
export function findTheme(name: string): ThemeInfo | undefined {
  return THEMES.find((t) => t.name === name);
}
