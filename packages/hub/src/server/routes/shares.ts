import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import {
  createShare,
  respondToShare,
  revokeShare,
  listSharesForPresentation,
  listSharedWithMe,
} from '../services/share.ts';

export function registerShareRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
): void {
  // Create share invitation
  fastify.post(
    '/hub/api/presentations/:id/shares',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { email: string; role?: 'viewer' | 'copresenter' };

      if (!body.email) {
        await reply.status(400).send({ error: 'Missing email' });
        return;
      }

      const result = createShare(db, id, request.userId, body.email, body.role ?? 'viewer');
      if ('error' in result) {
        await reply.status(400).send({ error: result.error });
        return;
      }
      await reply.status(201).send(result);
    },
  );

  // List shares for a presentation (owner only)
  fastify.get(
    '/hub/api/presentations/:id/shares',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const items = listSharesForPresentation(db, id, request.userId);
      await reply.send({ items });
    },
  );

  // Revoke share (owner)
  fastify.delete(
    '/hub/api/shares/:shareId',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      const revoked = revokeShare(db, shareId, request.userId);
      if (!revoked) {
        await reply.status(404).send({ error: 'Share not found or access denied' });
        return;
      }
      await reply.status(204).send();
    },
  );

  // Accept share invitation
  fastify.post(
    '/hub/api/shares/:shareId/accept',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      const accepted = respondToShare(db, shareId, request.userId, true);
      if (!accepted) {
        await reply.status(404).send({ error: 'Share not found or already responded' });
        return;
      }
      await reply.send({ ok: true });
    },
  );

  // Reject share invitation
  fastify.post(
    '/hub/api/shares/:shareId/reject',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      const rejected = respondToShare(db, shareId, request.userId, false);
      if (!rejected) {
        await reply.status(404).send({ error: 'Share not found or already responded' });
        return;
      }
      await reply.send({ ok: true });
    },
  );

  // List shares with me
  fastify.get(
    '/hub/api/shared-with-me',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string };
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Number(query.offset) || 0;
      const items = listSharedWithMe(db, request.userId, limit, offset);
      await reply.send({ items, limit, offset });
    },
  );
}
