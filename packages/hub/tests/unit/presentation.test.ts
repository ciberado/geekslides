import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, insertTestUser, insertTestPresentation, type TestDatabase } from './helpers.ts';
import {
  generateSlug,
  ensureUniqueSlug,
  updatePresentationMetadata,
  listPresentations,
  getPresentationById,
} from '../../src/server/services/presentation.ts';

describe('presentation service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    insertTestUser(db);
  });

  describe('generateSlug', () => {
    it('converts title to kebab-case', () => {
      expect(generateSlug('My Great Presentation')).toBe('my-great-presentation');
    });

    it('strips special characters', () => {
      expect(generateSlug('Hello! @World #2024')).toBe('hello-world-2024');
    });

    it('collapses multiple dashes', () => {
      expect(generateSlug('too   many   spaces')).toBe('too-many-spaces');
    });

    it('trims leading and trailing dashes', () => {
      expect(generateSlug('---hello---')).toBe('hello');
    });

    it('truncates to 60 characters', () => {
      const long = 'a'.repeat(100);
      expect(generateSlug(long).length).toBeLessThanOrEqual(60);
    });
  });

  describe('ensureUniqueSlug', () => {
    it('returns original slug when no conflict', () => {
      expect(ensureUniqueSlug(db, 'user-1', 'my-deck')).toBe('my-deck');
    });

    it('appends counter when slug exists', () => {
      insertTestPresentation(db, { slug: 'my-deck' });
      expect(ensureUniqueSlug(db, 'user-1', 'my-deck')).toBe('my-deck-1');
    });

    it('increments counter for multiple conflicts', () => {
      insertTestPresentation(db, { id: 'p1', slug: 'my-deck' });
      insertTestPresentation(db, { id: 'p2', slug: 'my-deck-1' });
      expect(ensureUniqueSlug(db, 'user-1', 'my-deck')).toBe('my-deck-2');
    });
  });

  describe('updatePresentationMetadata', () => {
    it('updates title', () => {
      insertTestPresentation(db);
      const result = updatePresentationMetadata(db, 'pres-1', 'user-1', { title: 'New Title' });
      expect(result?.title).toBe('New Title');
    });

    it('updates visibility', () => {
      insertTestPresentation(db);
      const result = updatePresentationMetadata(db, 'pres-1', 'user-1', { visibility: 'public' });
      expect(result?.visibility).toBe('public');
    });

    it('returns undefined for wrong owner', () => {
      insertTestPresentation(db);
      const result = updatePresentationMetadata(db, 'pres-1', 'other-user', { title: 'Hack' });
      expect(result).toBeUndefined();
    });

    it('returns undefined for nonexistent presentation', () => {
      const result = updatePresentationMetadata(db, 'nonexistent', 'user-1', { title: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('listPresentations', () => {
    it('returns presentations for user', () => {
      insertTestPresentation(db, { id: 'p1', slug: 'deck-1' });
      insertTestPresentation(db, { id: 'p2', slug: 'deck-2' });
      const results = listPresentations(db, 'user-1');
      expect(results).toHaveLength(2);
    });

    it('does not return other users presentations', () => {
      insertTestUser(db, { id: 'user-2', email: 'other@example.com', providerId: '54321' });
      insertTestPresentation(db, { id: 'p1', ownerId: 'user-2', slug: 'other-deck' });
      const results = listPresentations(db, 'user-1');
      expect(results).toHaveLength(0);
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        insertTestPresentation(db, {
          id: `p${String(i)}`,
          slug: `deck-${String(i)}`,
          updatedAt: new Date(Date.now() + i * 1000),
        });
      }
      const results = listPresentations(db, 'user-1', 2, 1);
      expect(results).toHaveLength(2);
    });
  });

  describe('getPresentationById', () => {
    it('returns presentation when found', () => {
      insertTestPresentation(db);
      const found = getPresentationById(db, 'pres-1');
      expect(found).toBeDefined();
      expect(found?.title).toBe('Test Deck');
    });

    it('returns undefined when not found', () => {
      expect(getPresentationById(db, 'nonexistent')).toBeUndefined();
    });
  });
});
