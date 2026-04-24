import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, insertTestUser, insertTestPresentation, type TestDatabase } from './helpers.ts';
import { searchPublicPresentations } from '../../src/server/services/search.ts';

describe('search service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    insertTestUser(db, { id: 'user-1', email: 'user@test.com', providerId: '1' });
  });

  describe('searchPublicPresentations', () => {
    it('returns empty for empty query', () => {
      const results = searchPublicPresentations(db, '');
      expect(results).toHaveLength(0);
    });

    it('returns empty for whitespace-only query', () => {
      const results = searchPublicPresentations(db, '   ');
      expect(results).toHaveLength(0);
    });

    it('strips quotes from query to prevent injection', () => {
      // Should not throw
      const results = searchPublicPresentations(db, "'; DROP TABLE users; --");
      expect(results).toHaveLength(0);
    });

    it('finds public presentations matching title', () => {
      insertTestPresentation(db, {
        id: 'pub-1',
        ownerId: 'user-1',
        slug: 'kubernetes-intro',
        title: 'Introduction to Kubernetes',
        visibility: 'public',
      });
      insertTestPresentation(db, {
        id: 'priv-1',
        ownerId: 'user-1',
        slug: 'secret-deck',
        title: 'Secret Presentation',
        visibility: 'private',
      });

      const results = searchPublicPresentations(db, 'Kubernetes');
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('Introduction to Kubernetes');
    });

    it('does not return private presentations', () => {
      insertTestPresentation(db, {
        id: 'priv-1',
        ownerId: 'user-1',
        slug: 'private-deck',
        title: 'Private Kubernetes Talk',
        visibility: 'private',
      });

      const results = searchPublicPresentations(db, 'Kubernetes');
      expect(results).toHaveLength(0);
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        insertTestPresentation(db, {
          id: `pub-${String(i)}`,
          ownerId: 'user-1',
          slug: `docker-talk-${String(i)}`,
          title: `Docker Talk ${String(i)}`,
          visibility: 'public',
          updatedAt: new Date(Date.now() + i * 1000),
        });
      }

      const results = searchPublicPresentations(db, 'Docker', 2, 0);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });
});
