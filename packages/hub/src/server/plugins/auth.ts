import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

interface JwtPayload {
  readonly sub: string;
  readonly role: 'user' | 'admin';
  readonly status: 'pending' | 'approved' | 'rejected';
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userRole: 'user' | 'admin';
    userStatus: 'pending' | 'approved' | 'rejected';
  }
}

function authPlugin(fastify: FastifyInstance): void {
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userRole', 'user');
  fastify.decorateRequest('userStatus', 'pending');

  fastify.decorate('requireAuth', async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies['hub_access'];
    if (!token) {
      await reply.status(401).send({ error: 'Authentication required' });
      return;
    }
    try {
      const payload = fastify.jwt.verify<JwtPayload>(token);
      request.userId = payload.sub;
      request.userRole = payload.role;
      request.userStatus = payload.status;
    } catch {
      await reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  fastify.decorate('requireApproved', async function requireApproved(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    await fastify.requireAuth(request, reply);
    if (reply.sent) return;
    if (request.userStatus !== 'approved') {
      await reply.status(403).send({ error: 'Account not yet approved' });
    }
  });

  fastify.decorate('requireAdmin', async function requireAdmin(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    await fastify.requireAuth(request, reply);
    if (reply.sent) return;
    if (request.userRole !== 'admin') {
      await reply.status(403).send({ error: 'Admin access required' });
    }
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireApproved: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin, { name: 'hub-auth' });
