import { randomUUID } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import type { HubDatabase } from '../db/index.ts';
import { shares, users, presentations } from '../db/schema.ts';

export interface ShareRow {
  readonly id: string;
  readonly presentationId: string;
  readonly userId: string;
  readonly role: 'viewer' | 'copresenter';
  readonly status: 'pending' | 'accepted' | 'rejected';
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly respondedAt: Date | null;
}

export function createShare(
  db: HubDatabase,
  presentationId: string,
  ownerUserId: string,
  targetEmail: string,
  role: 'viewer' | 'copresenter',
): ShareRow | { error: string } {
  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, presentationId), eq(presentations.ownerId, ownerUserId)))
    .get();
  if (!pres) return { error: 'Presentation not found or access denied' };

  const targetUser = db.select().from(users).where(eq(users.email, targetEmail.toLowerCase())).get();
  if (!targetUser) return { error: 'User not found' };
  if (targetUser.id === ownerUserId) return { error: 'Cannot share with yourself' };

  const existing = db
    .select()
    .from(shares)
    .where(and(eq(shares.presentationId, presentationId), eq(shares.userId, targetUser.id)))
    .get();
  if (existing) return { error: 'Share already exists for this user' };

  const now = new Date();
  const id = randomUUID();
  const row = {
    id,
    presentationId,
    userId: targetUser.id,
    role,
    status: 'pending' as const,
    createdBy: ownerUserId,
    createdAt: now,
    respondedAt: null,
  };

  db.insert(shares).values(row).run();
  return row;
}

export function respondToShare(
  db: HubDatabase,
  shareId: string,
  userId: string,
  accept: boolean,
): boolean {
  const share = db
    .select()
    .from(shares)
    .where(and(eq(shares.id, shareId), eq(shares.userId, userId)))
    .get();
  if (!share || share.status !== 'pending') return false;

  const now = new Date();
  db.update(shares)
    .set({ status: accept ? 'accepted' : 'rejected', respondedAt: now })
    .where(eq(shares.id, shareId))
    .run();
  return true;
}

export function revokeShare(db: HubDatabase, shareId: string, ownerUserId: string): boolean {
  const share = db.select().from(shares).where(eq(shares.id, shareId)).get();
  if (!share) return false;

  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, share.presentationId), eq(presentations.ownerId, ownerUserId)))
    .get();
  if (!pres) return false;

  db.delete(shares).where(eq(shares.id, shareId)).run();
  return true;
}

export function listSharesForPresentation(
  db: HubDatabase,
  presentationId: string,
  ownerUserId: string,
): ShareRow[] {
  const pres = db
    .select()
    .from(presentations)
    .where(and(eq(presentations.id, presentationId), eq(presentations.ownerId, ownerUserId)))
    .get();
  if (!pres) return [];

  return db
    .select()
    .from(shares)
    .where(eq(shares.presentationId, presentationId))
    .orderBy(desc(shares.createdAt))
    .all();
}

export function listSharedWithMe(
  db: HubDatabase,
  userId: string,
  limit: number = 20,
  offset: number = 0,
): Array<ShareRow & { presentation: { id: string; title: string; slug: string } }> {
  const rows = db
    .select({
      share: shares,
      presentation: {
        id: presentations.id,
        title: presentations.title,
        slug: presentations.slug,
      },
    })
    .from(shares)
    .innerJoin(presentations, eq(shares.presentationId, presentations.id))
    .where(and(eq(shares.userId, userId), eq(shares.status, 'accepted')))
    .orderBy(desc(shares.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map((r) => ({ ...r.share, presentation: r.presentation }));
}

export type AccessRole = 'owner' | 'copresenter' | 'viewer' | 'public' | null;

export function checkAccess(
  db: HubDatabase,
  presentationId: string,
  userId: string,
): AccessRole {
  const pres = db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .get();
  if (!pres) return null;

  if (pres.ownerId === userId) return 'owner';

  const share = db
    .select()
    .from(shares)
    .where(
      and(
        eq(shares.presentationId, presentationId),
        eq(shares.userId, userId),
        eq(shares.status, 'accepted'),
      ),
    )
    .get();
  if (share) return share.role;

  if (pres.visibility === 'public') return 'public';

  return null;
}
