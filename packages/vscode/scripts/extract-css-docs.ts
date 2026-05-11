#!/usr/bin/env node
/**
 * CSS Documentation Extractor
 *
 * Parses structured comments from layouts.css and generates TypeScript registry.
 * Run during VSCode extension build to keep autocomplete docs in sync with CSS.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ParsedLayout {
  name: string;
  detail: string;
  markdown: string;
  structure: string;
  usage?: string;
  hasTransform: boolean;
}

interface ParsedModifier {
  name: string;
  detail: string;
  usage?: string;
  parentLayout: string;
}

/**
 * Find the closing brace for a layout block starting at given position.
 */
function findLayoutBlockEnd(cssContent: string, startIndex: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIndex; i < cssContent.length; i++) {
    const char = cssContent[i];
    if (char === '{') {
      depth++;
      foundOpen = true;
    } else if (char === '}') {
      depth--;
      if (foundOpen && depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Extract nested modifiers from within a layout block.
 */
function extractNestedModifiers(
  cssContent: string,
  layoutName: string,
  layoutStartIndex: number
): ParsedModifier[] {
  const modifiers: ParsedModifier[] = [];

  // Find the layout block boundaries
  const blockEnd = findLayoutBlockEnd(cssContent, layoutStartIndex);
  if (blockEnd === -1) {
    return modifiers;
  }

  const blockContent = cssContent.substring(layoutStartIndex, blockEnd);

  // Match /** ... */ followed by &.mod-*
  const pattern = /\/\*\*([\s\S]*?)\*\/\s*&\.(mod-[a-z0-9-]+)\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(blockContent)) !== null) {
    const comment = match[1] ?? '';
    const selector = match[2] ?? '';

    try {
      const modifier = parseModifierComment(comment, selector, layoutName);
      modifiers.push(modifier);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[extract-css-docs] Warning: ${message}`);
    }
  }

  return modifiers;
}

/**
 * Extract all /** ... *\/ comment blocks that precede .layout-* selectors.
 */
function extractLayoutComments(cssContent: string): Array<{ comment: string; selector: string; startIndex: number }> {
  const results: Array<{ comment: string; selector: string; startIndex: number }> = [];

  // Match /** ... */ followed by section.content.layout-*
  const pattern = /\/\*\*([\s\S]*?)\*\/\s*section\.content\.(layout-[a-z-]+)\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cssContent)) !== null) {
    results.push({
      comment: match[1] ?? '',
      selector: match[2] ?? '',
      startIndex: match.index + match[0].length - 1, // Position of opening {
    });
  }

  return results;
}

/**
 * Parse structured comment into layout metadata.
 */
function parseComment(comment: string, selector: string): ParsedLayout {
  // Remove leading ' * ' from each line
  const lines = comment
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, ''))
    .filter((line) => line.trim().length > 0);

  const tags: Record<string, string[]> = {};
  let currentTag: string | null = null;

  for (const line of lines) {
    const tagMatch = /^@([a-z]+)\s*(.*)/.exec(line);
    if (tagMatch) {
      currentTag = tagMatch[1] ?? '';
      const rest = tagMatch[2] ?? '';
      tags[currentTag] = rest.trim() ? [rest] : [];
    } else if (currentTag) {
      tags[currentTag]?.push(line);
    }
  }

  // Validate required tags
  const layout = tags['layout']?.[0];
  const detail = tags['detail']?.join(' ').trim();
  const markdown = tags['markdown']?.join('\n').trim();
  const structure = tags['structure']?.join('\n').trim();
  const usage = tags['usage']?.join('\n').trim();
  const transformDesc = tags['transform']?.join(' ').trim();
  const hasTransform = transformDesc !== undefined && transformDesc.length > 0;

  if (!layout) {
    throw new Error(`Missing @layout tag for selector: ${selector}`);
  }
  if (layout !== selector) {
    throw new Error(`@layout "${layout}" doesn't match selector "${selector}"`);
  }
  if (!detail) {
    throw new Error(`Missing @detail tag for layout: ${layout}`);
  }
  if (!markdown) {
    throw new Error(`Missing @markdown tag for layout: ${layout}`);
  }
  if (!structure) {
    throw new Error(`Missing @structure tag for layout: ${layout}`);
  }

  return { name: layout, detail, markdown, structure, usage, hasTransform };
}

/**
 * Parse modifier comment into metadata.
 */
function parseModifierComment(comment: string, selector: string, parentLayout: string): ParsedModifier {
  // Remove leading ' * ' from each line
  const lines = comment
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, ''))
    .filter((line) => line.trim().length > 0);

  const tags: Record<string, string[]> = {};
  let currentTag: string | null = null;

  for (const line of lines) {
    const tagMatch = /^@([a-z]+)\s*(.*)/.exec(line);
    if (tagMatch) {
      currentTag = tagMatch[1] ?? '';
      const rest = tagMatch[2] ?? '';
      tags[currentTag] = rest.trim() ? [rest] : [];
    } else if (currentTag) {
      tags[currentTag]?.push(line);
    }
  }

  // Validate required tags
  const modifier = tags['modifier']?.[0];
  const detail = tags['detail']?.join(' ').trim();
  const usage = tags['usage']?.join('\n').trim();

  if (!modifier) {
    throw new Error(`Missing @modifier tag for selector: ${selector} in layout: ${parentLayout}`);
  }
  if (modifier !== selector) {
    throw new Error(`@modifier "${modifier}" doesn't match selector "${selector}" in layout: ${parentLayout}`);
  }
  if (!detail) {
    throw new Error(`Missing @detail tag for modifier: ${modifier} in layout: ${parentLayout}`);
  }

  return { name: modifier, detail, usage, parentLayout };
}

/**
 * Generate TypeScript code for class registry.
 */
function generateTypeScript(layouts: ParsedLayout[], modifiers: ParsedModifier[]): string {
  const layoutEntries = layouts.map((layout) => {
    const usage = layout.usage ? `\n\n${layout.usage}` : '';
    const transformNote = layout.hasTransform ? '\n\n⚡ **DOM transform** — this layout restructures the slide HTML after markdown rendering.' : '';
    const doc = `**Markdown:**
\`\`\`md
${layout.markdown}
\`\`\`

**Structure:**
\`\`\`
${layout.structure}
\`\`\`${usage}${transformNote}`;

    const hasTransformField = layout.hasTransform ? '\n    hasTransform: true,' : '';
    return `  {
    name: '${layout.name}',
    category: 'layout' as const,
    detail: '${layout.detail.replace(/'/g, "\\'")}',
    documentation: \`${doc.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,${hasTransformField}
  }`;
  });

  const modifierEntries = modifiers.map((modifier) => {
    const usage = modifier.usage ? `\n${modifier.usage}` : '';
    const doc = `Combine with parent layout: [](.${modifier.parentLayout}.${modifier.name}#id)${usage}`;

    return `  {
    name: '${modifier.name}',
    category: 'modifier' as const,
    detail: '${modifier.detail.replace(/'/g, "\\'")}',
    documentation: \`${doc.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
  }`;
  });

  return `// Auto-generated from layouts.css by scripts/extract-css-docs.ts
// DO NOT EDIT MANUALLY - changes will be overwritten on next build

import type { ClassEntry } from './class-registry.js';

export const LAYOUT_ENTRIES: readonly ClassEntry[] = [
${layoutEntries.join(',\n')},
] as const;

export const LAYOUT_MODIFIER_ENTRIES: readonly ClassEntry[] = [
${modifierEntries.join(',\n')},
] as const;
`;
}

/**
 * Main entry point.
 */
function main(): void {
  try {
    // Read layouts.css from packages/cli/src/templates
    // scripts/ → packages/vscode/ → packages/ → cli/
    const layoutsCssPath = join(__dirname, '../../cli/src/templates/layouts.css');
    console.log(`[extract-css-docs] Looking for: ${layoutsCssPath}`);
    const cssContent = readFileSync(layoutsCssPath, 'utf-8');

    console.log('[extract-css-docs] Reading layouts.css...');

    // Extract and parse comments
    const blocks = extractLayoutComments(cssContent);
    console.log(`[extract-css-docs] Found ${blocks.length.toString()} layout comment blocks`);

    const layouts: ParsedLayout[] = [];
    const allModifiers: ParsedModifier[] = [];

    for (const { comment, selector, startIndex } of blocks) {
      try {
        // Parse layout
        const layout = parseComment(comment, selector);
        layouts.push(layout);

        // Extract nested modifiers from this layout block
        const modifiers = extractNestedModifiers(cssContent, layout.name, startIndex);
        allModifiers.push(...modifiers);

        if (modifiers.length > 0) {
          console.log(`[extract-css-docs] Found ${modifiers.length.toString()} modifiers in ${layout.name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse layout ${selector}: ${message}`);
      }
    }

    // Validate no duplicates
    const layoutNames = new Set<string>();
    for (const layout of layouts) {
      if (layoutNames.has(layout.name)) {
        throw new Error(`Duplicate layout name: ${layout.name}`);
      }
      layoutNames.add(layout.name);
    }

    const modifierNames = new Set<string>();
    for (const modifier of allModifiers) {
      const key = `${modifier.parentLayout}::${modifier.name}`;
      if (modifierNames.has(key)) {
        throw new Error(`Duplicate modifier: ${modifier.name} in layout: ${modifier.parentLayout}`);
      }
      modifierNames.add(key);
    }

    console.log(`[extract-css-docs] Parsed ${layouts.length.toString()} layouts successfully`);
    console.log(`[extract-css-docs] Parsed ${allModifiers.length.toString()} modifiers successfully`);

    // Generate TypeScript
    const tsCode = generateTypeScript(layouts, allModifiers);
    const outputPath = join(__dirname, '../src/completion/class-registry-generated.ts');
    writeFileSync(outputPath, tsCode, 'utf-8');

    console.log(`[extract-css-docs] Generated ${outputPath}`);
    console.log('[extract-css-docs] ✓ Done');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[extract-css-docs] ✗ Error: ${message}`);
    process.exit(1);
  }
}

main();
