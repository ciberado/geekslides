import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import type { HubServerOptions } from '../config.ts';
import { launchPresentation } from '../services/launch.ts';

export function registerLaunchRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
  options: HubServerOptions,
): void {
  fastify.post(
    '/hub/api/presentations/:id/launch',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await launchPresentation(
        db,
        id,
        request.userId,
        options.repoDir,
        options.serverBaseUrl,
        options.viewerBaseUrl,
      );

      if ('error' in result) {
        await reply.status(400).send({ error: result.error });
        return;
      }

      await reply.send(result);
    },
  );
}
