import { sql } from 'drizzle-orm';
import type { HubDatabase } from './index.ts';

export function migrate(db: HubDatabase): void {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      provider TEXT NOT NULL CHECK(provider IN ('github', 'google')),
      provider_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      quota_bytes INTEGER NOT NULL DEFAULT 52428800,
      used_bytes INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider
    ON users(provider, provider_id)
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id),
      used_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL,
      used_at INTEGER
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS presentations (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'public')),
      size_bytes INTEGER NOT NULL DEFAULT 0,
      github_url TEXT,
      github_sha TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_presentations_owner_slug
    ON presentations(owner_id, slug)
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer', 'copresenter')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      responded_at INTEGER
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      event TEXT NOT NULL CHECK(event IN ('launch')),
      created_at INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS presentations_fts USING fts5(
      title, description, content='presentations', content_rowid='rowid'
    )
  `);

  db.run(sql`
    CREATE TRIGGER IF NOT EXISTS presentations_ai AFTER INSERT ON presentations BEGIN
      INSERT INTO presentations_fts(rowid, title, description)
      VALUES (new.rowid, new.title, new.description);
    END
  `);

  db.run(sql`
    CREATE TRIGGER IF NOT EXISTS presentations_ad AFTER DELETE ON presentations BEGIN
      INSERT INTO presentations_fts(presentations_fts, rowid, title, description)
      VALUES ('delete', old.rowid, old.title, old.description);
    END
  `);

  db.run(sql`
    CREATE TRIGGER IF NOT EXISTS presentations_au AFTER UPDATE ON presentations BEGIN
      INSERT INTO presentations_fts(presentations_fts, rowid, title, description)
      VALUES ('delete', old.rowid, old.title, old.description);
      INSERT INTO presentations_fts(rowid, title, description)
      VALUES (new.rowid, new.title, new.description);
    END
  `);
}
