import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import { searchPublicPresentations } from '../services/search.ts';

export function registerSearchRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
): void {
  fastify.get(
    '/hub/api/search',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const query = request.query as { q?: string; limit?: string; offset?: string };
      const q = query.q ?? '';
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Number(query.offset) || 0;

      if (!q.trim()) {
        await reply.send({ items: [], limit, offset });
        return;
      }

      const items = searchPublicPresentations(db, q, limit, offset);
      await reply.send({ items, limit, offset });
    },
  );
}
