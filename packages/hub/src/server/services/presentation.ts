import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { eq, and, desc } from 'drizzle-orm';
import type { HubDatabase } from '../db/index.ts';
import { presentations, users } from '../db/schema.ts';
import { initRepo, commitFiles, checkoutFiles, repoSize, type RepoFile } from './git.ts';

export interface CreatePresentationInput {
  readonly userId: string;
  readonly title: string;
  readonly slug: string;
  readonly files: readonly RepoFile[];
  readonly repoDir: string;
}

export interface PresentationRow {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly visibility: 'private' | 'public';
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function ensureUniqueSlug(db: HubDatabase, ownerId: string, baseSlug: string): string {
  let slug = baseSlug;
  let counter = 1;
  while (
    db
      .select()
      .from(presentations)
      .where(and(eq(presentations.ownerId, ownerId), eq(presentations.slug, slug)))
      .get()
  ) {
    slug = `${baseSlug}-${String(counter)}`;
    counter++;
  }
  return slug;
}

export async function createPresentation(
  db: HubDatabase,
  input: CreatePresentationInput,
): Promise<PresentationRow> {
  const user = db.select().from(users).where(eq(users.id, input.userId)).get();
  if (!user) throw new Error('User not found');

  const totalFileSize = input.files.reduce((sum, f) => sum + f.data.length, 0);
  if (user.usedBytes + totalFileSize > user.quotaBytes) {
    throw new Error('Quota exceeded');
  }

  const slug = ensureUniqueSlug(db, input.userId, input.slug);
  const repoPath = path.join(input.repoDir, input.userId, slug);

  await initRepo(repoPath);
  await commitFiles(repoPath, input.files, 'Initial upload');

  const size = repoSize(repoPath);
  const now = new Date();
  const id = randomUUID();

  const row = {
    id,
    ownerId: input.userId,
    title: input.title,
    description: '',
    slug,
    visibility: 'private' as const,
    sizeBytes: size,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(presentations).values(row).run();
  db.update(users)
    .set({ usedBytes: user.usedBytes + size, updatedAt: now })
    .where(eq(users.id, input.userId))
    .run();

  return row;
}

export async function updatePresentationFiles(
  db: HubDatabase,
  presentationId: string,
  userId: string,
  files: readonly RepoFile[],
  repoDir: string,
): Promise<PresentationRow> {
  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, presentationId), eq(presentations.ownerId, userId)))
    .get();
  if (!pres) throw new Error('Presentation not found or access denied');

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error('User not found');

  const repoPath = path.join(repoDir, userId, pres.slug);
  const oldSize = pres.sizeBytes;

  await commitFiles(repoPath, files, 'Update files');
  const newSize = repoSize(repoPath);

  const sizeDiff = newSize - oldSize;
  if (user.usedBytes + sizeDiff > user.quotaBytes) {
    throw new Error('Quota exceeded');
  }

  const now = new Date();
  db.update(presentations)
    .set({ sizeBytes: newSize, updatedAt: now })
    .where(eq(presentations.id, presentationId))
    .run();

  db.update(users)
    .set({ usedBytes: user.usedBytes + sizeDiff, updatedAt: now })
    .where(eq(users.id, userId))
    .run();

  return { ...pres, sizeBytes: newSize, updatedAt: now };
}

export function updatePresentationMetadata(
  db: HubDatabase,
  presentationId: string,
  userId: string,
  data: { title?: string; description?: string; visibility?: 'private' | 'public' },
): PresentationRow | undefined {
  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, presentationId), eq(presentations.ownerId, userId)))
    .get();
  if (!pres) return undefined;

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.title !== undefined) updates['title'] = data.title;
  if (data.description !== undefined) updates['description'] = data.description;
  if (data.visibility !== undefined) updates['visibility'] = data.visibility;

  db.update(presentations)
    .set(updates)
    .where(eq(presentations.id, presentationId))
    .run();

  return {
    ...pres,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
    updatedAt: now,
  };
}

export async function deletePresentation(
  db: HubDatabase,
  presentationId: string,
  userId: string,
  repoDir: string,
): Promise<boolean> {
  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, presentationId), eq(presentations.ownerId, userId)))
    .get();
  if (!pres) return false;

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return false;

  const repoPath = path.join(repoDir, userId, pres.slug);
  await fs.promises.rm(repoPath, { recursive: true, force: true });

  db.delete(presentations).where(eq(presentations.id, presentationId)).run();

  const newUsed = Math.max(0, user.usedBytes - pres.sizeBytes);
  db.update(users)
    .set({ usedBytes: newUsed, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();

  return true;
}

export function listPresentations(
  db: HubDatabase,
  userId: string,
  limit: number = 20,
  offset: number = 0,
): PresentationRow[] {
  return db
    .select()
    .from(presentations)
    .where(eq(presentations.ownerId, userId))
    .orderBy(desc(presentations.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();
}

export function getPresentationById(
  db: HubDatabase,
  presentationId: string,
): PresentationRow | undefined {
  return db.select().from(presentations).where(eq(presentations.id, presentationId)).get();
}

export async function getPresentationFiles(
  db: HubDatabase,
  presentationId: string,
  userId: string,
  repoDir: string,
): Promise<RepoFile[]> {
  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, presentationId), eq(presentations.ownerId, userId)))
    .get();
  if (!pres) return [];

  const repoPath = path.join(repoDir, userId, pres.slug);
  return checkoutFiles(repoPath);
}
