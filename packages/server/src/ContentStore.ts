/**
 * GeekSlides v2 — Room-scoped content store.
 *
 * Manages uploaded deck assets in per-room temp directories.
 */

import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 200 MB

export interface RoomContent {
  readonly room: string;
  readonly dir: string;
  readonly files: string[];
  readonly totalSize: number;
  readonly createdAt: number;
}

const rooms = new Map<string, RoomContent>();

function validatePath(filePath: string): string {
  const normalized = normalize(filePath).replace(/\\/g, '/');
  if (normalized.startsWith('..') || normalized.startsWith('/') || normalized.includes('/../')) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return normalized;
}

export async function storeRoomContent(
  room: string,
  files: ReadonlyArray<{ readonly path: string; readonly data: Buffer }>,
): Promise<RoomContent> {
  // Clean up previous content for room
  await deleteRoomContent(room);

  const totalSize = files.reduce((sum, f) => sum + f.data.length, 0);
  if (totalSize > MAX_UPLOAD_SIZE) {
    throw new Error(`Upload exceeds maximum size of ${String(MAX_UPLOAD_SIZE)} bytes`);
  }

  const baseDir = await mkdtemp(join(tmpdir(), 'gs-room-'));

  const filePaths: string[] = [];

  for (const file of files) {
    const safePath = validatePath(file.path);
    const fullPath = join(baseDir, safePath);
    const resolvedFull = resolve(fullPath);

    // Double-check the resolved path is still within baseDir
    if (!resolvedFull.startsWith(resolve(baseDir))) {
      throw new Error(`Path traversal detected: ${file.path}`);
    }

    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(fullPath, file.data);
    filePaths.push(safePath);
  }

  const content: RoomContent = {
    room,
    dir: baseDir,
    files: filePaths,
    totalSize,
    createdAt: Date.now(),
  };

  rooms.set(room, content);
  return content;
}

export async function getRoomFile(room: string, filePath: string): Promise<Buffer | null> {
  const content = rooms.get(room);
  if (!content) {
    return null;
  }

  let safePath: string;
  try {
    safePath = validatePath(filePath);
  } catch {
    return null;
  }

  const fullPath = join(content.dir, safePath);
  const resolvedFull = resolve(fullPath);

  if (!resolvedFull.startsWith(resolve(content.dir))) {
    return null;
  }

  try {
    return await readFile(fullPath);
  } catch {
    return null;
  }
}

export function getRoomContent(room: string): RoomContent | undefined {
  return rooms.get(room);
}

export async function deleteRoomContent(room: string): Promise<void> {
  const content = rooms.get(room);
  if (!content) {
    return;
  }

  rooms.delete(room);

  try {
    await rm(content.dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

export function listRooms(): string[] {
  return [...rooms.keys()];
}

export async function getFileStats(room: string, filePath: string): Promise<{ size: number } | null> {
  const content = rooms.get(room);
  if (!content) {
    return null;
  }

  let safePath: string;
  try {
    safePath = validatePath(filePath);
  } catch {
    return null;
  }

  const fullPath = join(content.dir, safePath);
  const resolvedFull = resolve(fullPath);

  if (!resolvedFull.startsWith(resolve(content.dir))) {
    return null;
  }

  try {
    const s = await stat(fullPath);
    return { size: s.size };
  } catch {
    return null;
  }
}
