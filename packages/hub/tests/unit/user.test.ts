import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, insertTestUser, type TestDatabase } from './helpers.ts';
import { upsertUser, getUserById, type OAuthProfile } from '../../src/server/services/user.ts';
import { inviteCodes } from '../../src/server/db/schema.ts';

describe('user service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
  });

  const githubProfile: OAuthProfile = {
    provider: 'github',
    providerId: '99999',
    email: 'alice@example.com',
    name: 'Alice',
    avatarUrl: 'https://example.com/avatar.png',
  };

  describe('upsertUser', () => {
    it('creates a new user with pending status', () => {
      const user = upsertUser(db, githubProfile, '');
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice');
      expect(user.status).toBe('pending');
      expect(user.role).toBe('user');
    });

    it('creates admin when email matches ADMIN_EMAIL', () => {
      const user = upsertUser(db, githubProfile, 'alice@example.com');
      expect(user.role).toBe('admin');
      expect(user.status).toBe('approved');
    });

    it('admin email matching is case-insensitive', () => {
      const user = upsertUser(db, githubProfile, 'ALICE@EXAMPLE.COM');
      expect(user.role).toBe('admin');
      expect(user.status).toBe('approved');
    });

    it('does not grant admin when adminEmail is empty', () => {
      const user = upsertUser(db, githubProfile, '');
      expect(user.role).toBe('user');
      expect(user.status).toBe('pending');
    });

    it('updates existing user on second login', () => {
      const first = upsertUser(db, githubProfile, '');
      const updatedProfile: OAuthProfile = {
        ...githubProfile,
        name: 'Alice Updated',
        avatarUrl: 'https://example.com/new-avatar.png',
      };
      const second = upsertUser(db, updatedProfile, '');
      expect(second.id).toBe(first.id);
      expect(second.name).toBe('Alice Updated');
      expect(second.avatarUrl).toBe('https://example.com/new-avatar.png');
    });

    it('approves user when valid invite code is provided', () => {
      const admin = insertTestUser(db, { id: 'admin-1', email: 'admin@example.com', role: 'admin' });
      db.insert(inviteCodes).values({
        id: 'inv-1',
        code: 'abc123',
        createdBy: admin.id,
        createdAt: new Date(),
      }).run();

      const user = upsertUser(db, githubProfile, '', 'abc123');
      expect(user.status).toBe('approved');
    });

    it('stays pending when invite code is already used', () => {
      const admin = insertTestUser(db, { id: 'admin-1', email: 'admin@example.com', role: 'admin' });
      db.insert(inviteCodes).values({
        id: 'inv-1',
        code: 'abc123',
        createdBy: admin.id,
        usedBy: admin.id,
        createdAt: new Date(),
      }).run();

      const user = upsertUser(db, githubProfile, '', 'abc123');
      expect(user.status).toBe('pending');
    });

    it('stays pending when invite code does not exist', () => {
      const user = upsertUser(db, githubProfile, '', 'nonexistent');
      expect(user.status).toBe('pending');
    });
  });

  describe('getUserById', () => {
    it('returns user when found', () => {
      const inserted = insertTestUser(db);
      const found = getUserById(db, inserted.id);
      expect(found).toBeDefined();
      expect(found?.email).toBe(inserted.email);
    });

    it('returns undefined when not found', () => {
      const found = getUserById(db, 'nonexistent');
      expect(found).toBeUndefined();
    });
  });
});
