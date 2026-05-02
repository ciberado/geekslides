import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface DeckMetadata {
  readonly configPath: string;
  readonly contentPath: string;
  readonly room: string;
}

export function findNearestDeckConfig(
  startPath: string | undefined,
  workspaceRoots: readonly string[],
  pathExists: (path: string) => boolean = existsSync,
): string | null {
  const candidates = startPath ? [dirname(startPath), ...workspaceRoots] : [...workspaceRoots];
  const resolvedRoots = workspaceRoots.map((root) => resolve(root));

  for (const candidate of candidates) {
    let currentDir = resolve(candidate);
    while (resolvedRoots.some((root) => currentDir.startsWith(root))) {
      const configPath = resolve(currentDir, 'config.json');
      if (pathExists(configPath)) {
        return configPath;
      }

      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  for (const root of workspaceRoots) {
    const configPath = resolve(root, 'config.json');
    if (pathExists(configPath)) {
      return configPath;
    }
  }

  return null;
}

export async function loadDeckMetadata(
  configPath: string,
  readText: (path: string, encoding: 'utf8') => Promise<string> = readFile,
): Promise<DeckMetadata> {
  const rawText = await readText(configPath, 'utf8');
  const parsed: unknown = JSON.parse(rawText);
  const raw = typeof parsed === 'object' && parsed !== null
    ? parsed as Record<string, unknown>
    : {};
  const configDir = dirname(configPath);
  const rawContent = raw['content'];
  const contentItems: readonly unknown[] = Array.isArray(rawContent)
    ? Array.from(rawContent, (item: unknown) => item)
    : [];
  const contentEntry = contentItems[0] ?? rawContent;
  const contentPath = resolve(
    configDir,
    typeof contentEntry === 'string' && contentEntry.length > 0 ? contentEntry : 'README.md',
  );

  const rawSync = typeof raw['sync'] === 'object' && raw['sync'] !== null
    ? raw['sync'] as Record<string, unknown>
    : {};

  return {
    configPath,
    contentPath,
    room: typeof rawSync['room'] === 'string' && rawSync['room'].length > 0
      ? rawSync['room']
      : 'default',
  };
}
