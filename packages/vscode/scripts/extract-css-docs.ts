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
}

/**
 * Extract all /** ... *\/ comment blocks that precede .layout-* selectors.
 */
function extractLayoutComments(cssContent: string): Array<{ comment: string; selector: string }> {
  const results: Array<{ comment: string; selector: string }> = [];

  // Match /** ... */ followed by section.content.layout-*
  const pattern = /\/\*\*([\s\S]*?)\*\/\s*section\.content\.(layout-[a-z-]+)\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cssContent)) !== null) {
    results.push({
      comment: match[1] ?? '',
      selector: match[2] ?? '',
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

  return { name: layout, detail, markdown, structure, usage };
}

/**
 * Generate TypeScript code for class registry.
 */
function generateTypeScript(layouts: ParsedLayout[]): string {
  const entries = layouts.map((layout) => {
    const usage = layout.usage ? `\n\n${layout.usage}` : '';
    const doc = `**Markdown:**
\`\`\`md
${layout.markdown}
\`\`\`

**Structure:**
\`\`\`
${layout.structure}
\`\`\`${usage}`;

    return `  {
    name: '${layout.name}',
    category: 'layout' as const,
    detail: '${layout.detail.replace(/'/g, "\\'")}',
    documentation: \`${doc.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
  }`;
  });

  return `// Auto-generated from layouts.css by scripts/extract-css-docs.ts
// DO NOT EDIT MANUALLY - changes will be overwritten on next build

import type { ClassEntry } from './class-registry.js';

export const LAYOUT_ENTRIES: readonly ClassEntry[] = [
${entries.join(',\n')},
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
    console.log(`[extract-css-docs] Found ${blocks.length} layout comment blocks`);

    const layouts = blocks.map(({ comment, selector }) => {
      try {
        return parseComment(comment, selector);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse layout ${selector}: ${message}`);
      }
    });

    // Validate no duplicates
    const names = new Set<string>();
    for (const layout of layouts) {
      if (names.has(layout.name)) {
        throw new Error(`Duplicate layout name: ${layout.name}`);
      }
      names.add(layout.name);
    }

    console.log(`[extract-css-docs] Parsed ${layouts.length} layouts successfully`);

    // Generate TypeScript
    const tsCode = generateTypeScript(layouts);
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
