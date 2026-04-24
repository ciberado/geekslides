import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import { getLaunchCount, getPresenterStats } from '../services/analytics.ts';
import { checkAccess } from '../services/share.ts';

export function registerAnalyticsRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
): void {
  // Per-presentation analytics (owner only)
  fastify.get(
    '/hub/api/presentations/:id/analytics',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const access = checkAccess(db, id, request.userId);
      if (access !== 'owner') {
        await reply.status(403).send({ error: 'Only the owner can view analytics' });
        return;
      }
      const launches = getLaunchCount(db, id);
      await reply.send({ launches });
    },
  );

  // Personal stats
  fastify.get(
    '/hub/api/analytics/me',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const stats = getPresenterStats(db, request.userId);
      await reply.send(stats);
    },
  );
}
