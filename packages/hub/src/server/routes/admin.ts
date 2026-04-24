import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import {
  listUsers,
  approveUser,
  rejectUser,
  setUserQuota,
  generateInviteCode,
  listInviteCodes,
  revokeInviteCode,
  getSystemStats,
} from '../services/admin.ts';

export function registerAdminRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
): void {
  // List users
  fastify.get(
    '/hub/api/admin/users',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const query = request.query as { status?: string; limit?: string; offset?: string };
      const statusFilter = (['pending', 'approved', 'rejected'] as const).find(
        (s) => s === query.status,
      );
      const limit = Math.min(Number(query.limit) || 50, 200);
      const offset = Number(query.offset) || 0;
      const items = listUsers(db, statusFilter, limit, offset);
      await reply.send({ items, limit, offset });
    },
  );

  // Approve user
  fastify.post(
    '/hub/api/admin/users/:id/approve',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const approved = approveUser(db, id);
      if (!approved) {
        await reply.status(404).send({ error: 'User not found or already approved' });
        return;
      }
      await reply.send({ ok: true });
    },
  );

  // Reject user
  fastify.post(
    '/hub/api/admin/users/:id/reject',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rejected = rejectUser(db, id);
      if (!rejected) {
        await reply.status(404).send({ error: 'User not found or already rejected' });
        return;
      }
      await reply.send({ ok: true });
    },
  );

  // Set user quota
  fastify.patch(
    '/hub/api/admin/users/:id/quota',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { quotaBytes: number };
      if (typeof body.quotaBytes !== 'number' || body.quotaBytes < 0) {
        await reply.status(400).send({ error: 'Invalid quotaBytes' });
        return;
      }
      const updated = setUserQuota(db, id, body.quotaBytes);
      if (!updated) {
        await reply.status(404).send({ error: 'User not found' });
        return;
      }
      await reply.send({ ok: true });
    },
  );

  // Generate invite code
  fastify.post(
    '/hub/api/admin/invite-codes',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const code = generateInviteCode(db, request.userId);
      await reply.status(201).send({ code });
    },
  );

  // List invite codes
  fastify.get(
    '/hub/api/admin/invite-codes',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const items = listInviteCodes(db, request.userId);
      await reply.send({ items });
    },
  );

  // Revoke invite code
  fastify.delete(
    '/hub/api/admin/invite-codes/:id',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const revoked = revokeInviteCode(db, id);
      if (!revoked) {
        await reply.status(404).send({ error: 'Code not found or already used' });
        return;
      }
      await reply.status(204).send();
    },
  );

  // System stats
  fastify.get(
    '/hub/api/admin/stats',
    { preHandler: [fastify.requireAdmin] },
    async (_request, reply) => {
      const stats = getSystemStats(db);
      await reply.send(stats);
    },
  );
}
