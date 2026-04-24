import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/server/db/schema.ts';
import { migrate } from '../../src/server/db/migrate.ts';

export type TestDatabase = BetterSQLite3Database<typeof schema>;

export function createTestDatabase(): TestDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db);
  return db;
}

export function insertTestUser(
  db: TestDatabase,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
): typeof schema.users.$inferSelect {
  const now = new Date();
  const defaults = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    provider: 'github' as const,
    providerId: '12345',
    role: 'user' as const,
    status: 'approved' as const,
    quotaBytes: 52_428_800,
    usedBytes: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  db.insert(schema.users).values(defaults).run();
  return defaults;
}

export function insertTestPresentation(
  db: TestDatabase,
  overrides: Partial<typeof schema.presentations.$inferInsert> = {},
): typeof schema.presentations.$inferSelect {
  const now = new Date();
  const defaults = {
    id: 'pres-1',
    ownerId: 'user-1',
    title: 'Test Deck',
    description: '',
    slug: 'test-deck',
    visibility: 'private' as const,
    sizeBytes: 1000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  db.insert(schema.presentations).values(defaults).run();
  return defaults;
}
