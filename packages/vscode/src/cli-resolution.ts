import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface CliCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export function resolveGeekSlidesCli(
  workspaceRoot: string,
  pathExists: (path: string) => boolean = existsSync,
): CliCommand {
  const localBinary = resolve(workspaceRoot, 'node_modules', '.bin', 'geekslides');
  if (pathExists(localBinary)) {
    return { command: localBinary, args: [] };
  }

  let currentDir = workspaceRoot;
  while (currentDir !== dirname(currentDir)) {
    const monorepoBinary = resolve(currentDir, 'packages', 'cli', 'bin', 'geekslides.cjs');
    if (pathExists(monorepoBinary)) {
      return { command: process.execPath, args: [monorepoBinary] };
    }
    currentDir = dirname(currentDir);
  }

  return { command: 'geekslides', args: [] };
}
