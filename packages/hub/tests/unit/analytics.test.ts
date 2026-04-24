import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, insertTestUser, insertTestPresentation, type TestDatabase } from './helpers.ts';
import { recordLaunch, getLaunchCount, getPresenterStats, getTopPublicPresentations } from '../../src/server/services/analytics.ts';

describe('analytics service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    insertTestUser(db, { id: 'user-1', email: 'user@test.com', providerId: '1' });
    insertTestPresentation(db, { id: 'pres-1', ownerId: 'user-1' });
  });

  describe('recordLaunch', () => {
    it('records a launch event', () => {
      expect(() => recordLaunch(db, 'pres-1', 'user-1')).not.toThrow();
    });
  });

  describe('getLaunchCount', () => {
    it('returns 0 when no launches', () => {
      expect(getLaunchCount(db, 'pres-1')).toBe(0);
    });

    it('counts launches correctly', () => {
      recordLaunch(db, 'pres-1', 'user-1');
      recordLaunch(db, 'pres-1', 'user-1');
      recordLaunch(db, 'pres-1', 'user-1');
      expect(getLaunchCount(db, 'pres-1')).toBe(3);
    });
  });

  describe('getPresenterStats', () => {
    it('returns total launches for presenter', () => {
      recordLaunch(db, 'pres-1', 'user-1');
      recordLaunch(db, 'pres-1', 'user-1');
      const stats = getPresenterStats(db, 'user-1');
      expect(stats.totalLaunches).toBe(2);
    });

    it('returns 0 for presenter with no launches', () => {
      const stats = getPresenterStats(db, 'user-1');
      expect(stats.totalLaunches).toBe(0);
    });
  });

  describe('getTopPublicPresentations', () => {
    it('returns empty when no public presentations', () => {
      recordLaunch(db, 'pres-1', 'user-1');
      const top = getTopPublicPresentations(db);
      expect(top).toHaveLength(0);
    });

    it('returns public presentations sorted by launches', () => {
      insertTestPresentation(db, { id: 'pub-1', ownerId: 'user-1', slug: 'pub-1', visibility: 'public' });
      insertTestPresentation(db, { id: 'pub-2', ownerId: 'user-1', slug: 'pub-2', visibility: 'public' });

      recordLaunch(db, 'pub-1', 'user-1');
      recordLaunch(db, 'pub-2', 'user-1');
      recordLaunch(db, 'pub-2', 'user-1');

      const top = getTopPublicPresentations(db);
      expect(top).toHaveLength(2);
      expect(top[0]?.presentationId).toBe('pub-2');
      expect(top[0]?.launches).toBe(2);
    });
  });
});
