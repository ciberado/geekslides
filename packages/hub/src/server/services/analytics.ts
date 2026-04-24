import { randomUUID } from 'node:crypto';
import { eq, desc, count, sql } from 'drizzle-orm';
import type { HubDatabase } from '../db/index.ts';
import { analyticsEvents, presentations } from '../db/schema.ts';

export function recordLaunch(db: HubDatabase, presentationId: string, userId: string): void {
  db.insert(analyticsEvents)
    .values({
      id: randomUUID(),
      presentationId,
      userId,
      event: 'launch',
      createdAt: new Date(),
    })
    .run();
}

export function getLaunchCount(db: HubDatabase, presentationId: string): number {
  const result = db
    .select({ count: count() })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.presentationId, presentationId))
    .get();
  return result?.count ?? 0;
}

export function getPresenterStats(
  db: HubDatabase,
  userId: string,
): { totalLaunches: number } {
  const result = db
    .select({ count: count() })
    .from(analyticsEvents)
    .innerJoin(presentations, eq(analyticsEvents.presentationId, presentations.id))
    .where(eq(presentations.ownerId, userId))
    .get();
  return { totalLaunches: result?.count ?? 0 };
}

export function getTopPublicPresentations(
  db: HubDatabase,
  limit: number = 10,
): Array<{ presentationId: string; title: string; launches: number }> {
  const results = db
    .select({
      presentationId: analyticsEvents.presentationId,
      title: presentations.title,
      launches: count(),
    })
    .from(analyticsEvents)
    .innerJoin(presentations, eq(analyticsEvents.presentationId, presentations.id))
    .where(eq(presentations.visibility, 'public'))
    .groupBy(analyticsEvents.presentationId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .all();

  return results;
}
