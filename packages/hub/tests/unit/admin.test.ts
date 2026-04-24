import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase, insertTestUser, insertTestPresentation, type TestDatabase } from './helpers.ts';
import {
  listUsers,
  approveUser,
  rejectUser,
  setUserQuota,
  generateInviteCode,
  listInviteCodes,
  revokeInviteCode,
  getSystemStats,
} from '../../src/server/services/admin.ts';
import { inviteCodes } from '../../src/server/db/schema.ts';

describe('admin service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
  });

  describe('listUsers', () => {
    it('lists all users', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1' });
      insertTestUser(db, { id: 'u2', email: 'b@test.com', providerId: '2', status: 'pending' });
      const all = listUsers(db);
      expect(all).toHaveLength(2);
    });

    it('filters by status', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1', status: 'approved' });
      insertTestUser(db, { id: 'u2', email: 'b@test.com', providerId: '2', status: 'pending' });
      const pending = listUsers(db, 'pending');
      expect(pending).toHaveLength(1);
      expect(pending[0]?.status).toBe('pending');
    });
  });

  describe('approveUser', () => {
    it('approves a pending user', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1', status: 'pending' });
      expect(approveUser(db, 'u1')).toBe(true);
    });

    it('returns false for already approved user', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1', status: 'approved' });
      expect(approveUser(db, 'u1')).toBe(false);
    });

    it('returns false for nonexistent user', () => {
      expect(approveUser(db, 'nonexistent')).toBe(false);
    });
  });

  describe('rejectUser', () => {
    it('rejects a pending user', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1', status: 'pending' });
      expect(rejectUser(db, 'u1')).toBe(true);
    });

    it('returns false for already rejected user', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1', status: 'rejected' });
      expect(rejectUser(db, 'u1')).toBe(false);
    });
  });

  describe('setUserQuota', () => {
    it('sets user quota', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1' });
      expect(setUserQuota(db, 'u1', 100_000_000)).toBe(true);
    });

    it('returns false for nonexistent user', () => {
      expect(setUserQuota(db, 'nonexistent', 100)).toBe(false);
    });
  });

  describe('invite codes', () => {
    it('generates an invite code', () => {
      insertTestUser(db, { id: 'admin-1', email: 'admin@test.com', providerId: '1', role: 'admin' });
      const code = generateInviteCode(db, 'admin-1');
      expect(code).toHaveLength(8);
      expect(/^[0-9a-f]{8}$/.test(code)).toBe(true);
    });

    it('lists invite codes for admin', () => {
      insertTestUser(db, { id: 'admin-1', email: 'admin@test.com', providerId: '1', role: 'admin' });
      generateInviteCode(db, 'admin-1');
      generateInviteCode(db, 'admin-1');
      const codes = listInviteCodes(db, 'admin-1');
      expect(codes).toHaveLength(2);
    });

    it('revokes an unused code', () => {
      insertTestUser(db, { id: 'admin-1', email: 'admin@test.com', providerId: '1', role: 'admin' });
      generateInviteCode(db, 'admin-1');
      const codes = listInviteCodes(db, 'admin-1');
      expect(codes[0]).toBeDefined();
      expect(revokeInviteCode(db, codes[0]!.id)).toBe(true);
    });

    it('cannot revoke a used code', () => {
      insertTestUser(db, { id: 'admin-1', email: 'admin@test.com', providerId: '1', role: 'admin' });
      generateInviteCode(db, 'admin-1');
      const codes = listInviteCodes(db, 'admin-1');
      // Simulate usage
      db.update(inviteCodes).set({ usedBy: 'admin-1', usedAt: new Date() }).where(eq(inviteCodes.id, codes[0]!.id)).run();
      expect(revokeInviteCode(db, codes[0]!.id)).toBe(false);
    });
  });

  describe('getSystemStats', () => {
    it('returns zeroes for empty database', () => {
      const stats = getSystemStats(db);
      expect(stats.totalUsers).toBe(0);
      expect(stats.pendingUsers).toBe(0);
      expect(stats.totalPresentations).toBe(0);
      expect(stats.totalStorageBytes).toBe(0);
    });

    it('counts users and presentations', () => {
      insertTestUser(db, { id: 'u1', email: 'a@test.com', providerId: '1', status: 'approved' });
      insertTestUser(db, { id: 'u2', email: 'b@test.com', providerId: '2', status: 'pending' });
      insertTestPresentation(db, { id: 'p1', ownerId: 'u1', slug: 'deck-1', sizeBytes: 5000 });
      insertTestPresentation(db, { id: 'p2', ownerId: 'u1', slug: 'deck-2', sizeBytes: 3000 });

      const stats = getSystemStats(db);
      expect(stats.totalUsers).toBe(2);
      expect(stats.pendingUsers).toBe(1);
      expect(stats.totalPresentations).toBe(2);
      expect(stats.totalStorageBytes).toBe(8000);
    });
  });
});
