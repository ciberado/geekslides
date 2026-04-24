import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, insertTestUser, insertTestPresentation, type TestDatabase } from './helpers.ts';
import {
  createShare,
  respondToShare,
  revokeShare,
  listSharesForPresentation,
  listSharedWithMe,
  checkAccess,
} from '../../src/server/services/share.ts';

describe('share service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    insertTestUser(db, { id: 'owner', email: 'owner@example.com', providerId: '100' });
    insertTestUser(db, { id: 'viewer', email: 'viewer@example.com', providerId: '200' });
    insertTestPresentation(db, { id: 'pres-1', ownerId: 'owner' });
  });

  describe('createShare', () => {
    it('creates a pending share', () => {
      const result = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      expect('id' in result).toBe(true);
      if ('id' in result) {
        expect(result.status).toBe('pending');
        expect(result.role).toBe('viewer');
      }
    });

    it('returns error when presentation not found', () => {
      const result = createShare(db, 'nonexistent', 'owner', 'viewer@example.com', 'viewer');
      expect('error' in result).toBe(true);
    });

    it('returns error when sharing with yourself', () => {
      const result = createShare(db, 'pres-1', 'owner', 'owner@example.com', 'viewer');
      expect('error' in result).toBe(true);
    });

    it('returns error when target user not found', () => {
      const result = createShare(db, 'pres-1', 'owner', 'nobody@example.com', 'viewer');
      expect('error' in result).toBe(true);
    });

    it('returns error when share already exists', () => {
      createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      const dup = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      expect('error' in dup).toBe(true);
    });

    it('supports copresenter role', () => {
      const result = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'copresenter');
      expect('id' in result).toBe(true);
      if ('id' in result) {
        expect(result.role).toBe('copresenter');
      }
    });
  });

  describe('respondToShare', () => {
    it('accepts a pending share', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        const result = respondToShare(db, share.id, 'viewer', true);
        expect(result).toBe(true);
      }
    });

    it('rejects a pending share', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        const result = respondToShare(db, share.id, 'viewer', false);
        expect(result).toBe(true);
      }
    });

    it('returns false for wrong user', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        const result = respondToShare(db, share.id, 'owner', true);
        expect(result).toBe(false);
      }
    });

    it('returns false for already responded share', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        respondToShare(db, share.id, 'viewer', true);
        const result = respondToShare(db, share.id, 'viewer', true);
        expect(result).toBe(false);
      }
    });
  });

  describe('revokeShare', () => {
    it('revokes an existing share', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        const result = revokeShare(db, share.id, 'owner');
        expect(result).toBe(true);
      }
    });

    it('returns false for non-owner', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        const result = revokeShare(db, share.id, 'viewer');
        expect(result).toBe(false);
      }
    });
  });

  describe('listSharesForPresentation', () => {
    it('lists shares for owner', () => {
      createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      const shares = listSharesForPresentation(db, 'pres-1', 'owner');
      expect(shares).toHaveLength(1);
    });

    it('returns empty for non-owner', () => {
      createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      const shares = listSharesForPresentation(db, 'pres-1', 'viewer');
      expect(shares).toHaveLength(0);
    });
  });

  describe('listSharedWithMe', () => {
    it('lists accepted shares', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        respondToShare(db, share.id, 'viewer', true);
      }
      const results = listSharedWithMe(db, 'viewer');
      expect(results).toHaveLength(1);
      expect(results[0]?.presentation.title).toBe('Test Deck');
    });

    it('does not list pending shares', () => {
      createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      const results = listSharedWithMe(db, 'viewer');
      expect(results).toHaveLength(0);
    });
  });

  describe('checkAccess', () => {
    it('returns owner for presentation owner', () => {
      expect(checkAccess(db, 'pres-1', 'owner')).toBe('owner');
    });

    it('returns viewer for accepted viewer share', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      if ('id' in share) {
        respondToShare(db, share.id, 'viewer', true);
      }
      expect(checkAccess(db, 'pres-1', 'viewer')).toBe('viewer');
    });

    it('returns copresenter for accepted copresenter share', () => {
      const share = createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'copresenter');
      if ('id' in share) {
        respondToShare(db, share.id, 'viewer', true);
      }
      expect(checkAccess(db, 'pres-1', 'viewer')).toBe('copresenter');
    });

    it('returns public for public presentation and unknown user', () => {
      insertTestUser(db, { id: 'stranger', email: 'stranger@example.com', providerId: '300' });
      insertTestPresentation(db, { id: 'pub-pres', ownerId: 'owner', slug: 'public-deck', visibility: 'public' });
      expect(checkAccess(db, 'pub-pres', 'stranger')).toBe('public');
    });

    it('returns null for private presentation and unknown user', () => {
      insertTestUser(db, { id: 'stranger', email: 'stranger@example.com', providerId: '300' });
      expect(checkAccess(db, 'pres-1', 'stranger')).toBe(null);
    });

    it('returns null for nonexistent presentation', () => {
      expect(checkAccess(db, 'nonexistent', 'owner')).toBe(null);
    });

    it('returns null for pending share (not yet accepted)', () => {
      createShare(db, 'pres-1', 'owner', 'viewer@example.com', 'viewer');
      expect(checkAccess(db, 'pres-1', 'viewer')).toBe(null);
    });
  });
});
