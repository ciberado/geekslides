import { randomUUID, randomBytes } from 'node:crypto';
import { eq, desc, count, sum } from 'drizzle-orm';
import type { HubDatabase } from '../db/index.ts';
import { users, presentations, inviteCodes } from '../db/schema.ts';

export function listUsers(
  db: HubDatabase,
  statusFilter?: 'pending' | 'approved' | 'rejected',
  limit: number = 50,
  offset: number = 0,
): Array<typeof users.$inferSelect> {
  const query = db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  if (statusFilter) {
    return query.where(eq(users.status, statusFilter)).all();
  }
  return query.all();
}

export function approveUser(db: HubDatabase, userId: string): boolean {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.status === 'approved') return false;

  db.update(users)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();
  return true;
}

export function rejectUser(db: HubDatabase, userId: string): boolean {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.status === 'rejected') return false;

  db.update(users)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();
  return true;
}

export function setUserQuota(db: HubDatabase, userId: string, quotaBytes: number): boolean {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return false;

  db.update(users)
    .set({ quotaBytes, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .run();
  return true;
}

export function generateInviteCode(db: HubDatabase, adminUserId: string): string {
  const code = randomBytes(4).toString('hex');
  db.insert(inviteCodes)
    .values({
      id: randomUUID(),
      code,
      createdBy: adminUserId,
      createdAt: new Date(),
    })
    .run();
  return code;
}

export function listInviteCodes(
  db: HubDatabase,
  adminUserId: string,
): Array<typeof inviteCodes.$inferSelect> {
  return db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.createdBy, adminUserId))
    .orderBy(desc(inviteCodes.createdAt))
    .all();
}

export function revokeInviteCode(db: HubDatabase, codeId: string): boolean {
  const code = db.select().from(inviteCodes).where(eq(inviteCodes.id, codeId)).get();
  if (!code || code.usedBy) return false;

  db.delete(inviteCodes).where(eq(inviteCodes.id, codeId)).run();
  return true;
}

export function getSystemStats(db: HubDatabase): {
  totalUsers: number;
  pendingUsers: number;
  totalPresentations: number;
  totalStorageBytes: number;
} {
  const totalUsers = db.select({ count: count() }).from(users).get()?.count ?? 0;
  const pendingUsers =
    db.select({ count: count() }).from(users).where(eq(users.status, 'pending')).get()?.count ?? 0;
  const totalPresentations = db.select({ count: count() }).from(presentations).get()?.count ?? 0;
  const totalStorageBytes =
    db.select({ total: sum(presentations.sizeBytes) }).from(presentations).get()?.total ?? 0;

  return {
    totalUsers,
    pendingUsers,
    totalPresentations,
    totalStorageBytes: Number(totalStorageBytes),
  };
}
