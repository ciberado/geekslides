import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type { HubDatabase } from '../db/index.ts';
import { users, inviteCodes } from '../db/schema.ts';

export interface OAuthProfile {
  readonly provider: 'github' | 'google';
  readonly providerId: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly provider: 'github' | 'google';
  readonly providerId: string;
  readonly role: 'user' | 'admin';
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly quotaBytes: number;
  readonly usedBytes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function upsertUser(
  db: HubDatabase,
  profile: OAuthProfile,
  adminEmail: string,
  inviteCode?: string,
): UserRow {
  const existing = db
    .select()
    .from(users)
    .where(and(eq(users.provider, profile.provider), eq(users.providerId, profile.providerId)))
    .get();

  if (existing) {
    const now = new Date();
    db.update(users)
      .set({ name: profile.name, avatarUrl: profile.avatarUrl, updatedAt: now })
      .where(eq(users.id, existing.id))
      .run();
    return { ...existing, name: profile.name, avatarUrl: profile.avatarUrl, updatedAt: now };
  }

  const isAdmin = profile.email.toLowerCase() === adminEmail.toLowerCase() && adminEmail !== '';
  let status: 'pending' | 'approved' | 'rejected' = 'pending';

  if (isAdmin) {
    status = 'approved';
  } else if (inviteCode) {
    const code = db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, inviteCode))
      .get();
    if (code && !code.usedBy) {
      status = 'approved';
    }
  }

  const now = new Date();
  const id = randomUUID();
  const newUser = {
    id,
    email: profile.email.toLowerCase(),
    name: profile.name,
    avatarUrl: profile.avatarUrl ?? null,
    provider: profile.provider,
    providerId: profile.providerId,
    role: isAdmin ? ('admin' as const) : ('user' as const),
    status,
    quotaBytes: 52_428_800,
    usedBytes: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(users).values(newUser).run();

  if (inviteCode && status === 'approved') {
    db.update(inviteCodes)
      .set({ usedBy: id, usedAt: now })
      .where(eq(inviteCodes.code, inviteCode))
      .run();
  }

  return newUser;
}

export function getUserById(db: HubDatabase, id: string): UserRow | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}
