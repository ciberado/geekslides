import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface CliCommand {
  readonly command: string;
  readonly args: readonly string[];
}

interface ResolveCliOptions {
  readonly extensionRoot?: string;
  readonly pathExists?: (path: string) => boolean;
}

function findMonorepoBinary(
  startDir: string,
  pathExists: (path: string) => boolean,
): string | undefined {
  let currentDir = startDir;
  while (currentDir !== dirname(currentDir)) {
    const monorepoBinary = resolve(currentDir, 'packages', 'cli', 'bin', 'geekslides.cjs');
    if (pathExists(monorepoBinary)) {
      return monorepoBinary;
    }
    currentDir = dirname(currentDir);
  }

  return undefined;
}

export function resolveGeekSlidesCli(
  workspaceRoot: string,
  options?: ResolveCliOptions,
): CliCommand {
  const pathExists = options?.pathExists ?? existsSync;
  const localBinary = resolve(workspaceRoot, 'node_modules', '.bin', 'geekslides');
  if (pathExists(localBinary)) {
    return { command: localBinary, args: [] };
  }

  const monorepoBinary = findMonorepoBinary(workspaceRoot, pathExists)
    ?? (options?.extensionRoot ? findMonorepoBinary(options.extensionRoot, pathExists) : undefined);
  if (monorepoBinary) {
    return { command: process.execPath, args: [monorepoBinary] };
  }

  return { command: 'geekslides', args: [] };
}
