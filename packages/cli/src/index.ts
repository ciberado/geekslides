#!/usr/bin/env node
/**
 * GeekSlides v2 — CLI entry point.
 *
 * Commands: dev, build, pdf, create
 */

import { Command } from 'commander';
import { registerDevCommand } from './commands/dev.ts';
import { registerBuildCommand } from './commands/build.ts';
import { registerPdfCommand } from './commands/pdf.ts';
import { registerCreateCommand } from './commands/create.ts';

export const CLI_VERSION = '2.0.0-alpha.0';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('geekslides')
    .description('GeekSlides — Markdown-driven presentation engine')
    .version(CLI_VERSION);

  registerDevCommand(program);
  registerBuildCommand(program);
  registerPdfCommand(program);
  registerCreateCommand(program);

  return program;
}

// Run when executed directly via bin entry point
const entryArg = process.argv[1]?.replaceAll('\\', '/');
const isDirectRun =
  entryArg?.endsWith('/geekslides') === true ||
  entryArg?.endsWith('/packages/cli/src/index.ts') === true ||
  entryArg?.endsWith('/packages/cli/bin/geekslides.cjs') === true ||
  entryArg?.endsWith('/bin/geekslides.cjs') === true ||
  entryArg?.endsWith('/dist/index.js') === true ||
  entryArg?.endsWith('/dist/index.cjs') === true;
if (isDirectRun) {
  const program = createProgram();
  program.parse();
}
