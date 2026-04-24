import { sql } from 'drizzle-orm';
import type { HubDatabase } from '../db/index.ts';

export interface SearchResult {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly ownerName: string;
  readonly ownerAvatarUrl: string | null;
}

export function searchPublicPresentations(
  db: HubDatabase,
  query: string,
  limit: number = 20,
  offset: number = 0,
): SearchResult[] {
  if (!query.trim()) return [];

  const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!sanitizedQuery) return [];

  // Quote each word for FTS5 safety
  const ftsQuery = sanitizedQuery.split(/\s+/).map((w) => `"${w}"`).join(' ');

  const results = db.all<{
    id: string;
    title: string;
    description: string;
    slug: string;
    owner_name: string;
    owner_avatar_url: string | null;
  }>(sql`
    SELECT p.id, p.title, p.description, p.slug,
           u.name as owner_name, u.avatar_url as owner_avatar_url
    FROM presentations p
    INNER JOIN users u ON p.owner_id = u.id
    WHERE p.visibility = 'public'
      AND p.id IN (
        SELECT p2.id FROM presentations p2
        INNER JOIN presentations_fts fts ON p2.rowid = fts.rowid
        WHERE presentations_fts MATCH ${ftsQuery}
      )
    ORDER BY p.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    slug: r.slug,
    ownerName: r.owner_name,
    ownerAvatarUrl: r.owner_avatar_url,
  }));
}
