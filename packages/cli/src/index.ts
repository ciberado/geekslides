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
const isDirectRun =
  process.argv[1]?.endsWith('/geekslides') ||
  process.argv[1]?.endsWith('/geekslides/packages/cli/src/index.ts');
if (isDirectRun) {
  const program = createProgram();
  program.parse();
}
