import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import type { HubServerOptions } from '../config.ts';
import {
  createPresentation,
  listPresentations,
  getPresentationById,
  updatePresentationMetadata,
  updatePresentationFiles,
  refreshFromGitHub,
  deletePresentation,
  generateSlug,
} from '../services/presentation.ts';
import { validateDeckFiles, extractZip, importFromGitHub, fetchGitHubLatestSha } from '../services/upload.ts';
import { checkAccess } from '../services/share.ts';
import type { RepoFile } from '../services/git.ts';

export function registerPresentationRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
  options: HubServerOptions,
): void {
  // Create presentation (multi-file, zip, or GitHub import)
  fastify.post(
    '/hub/api/presentations',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const contentType = request.headers['content-type'] ?? '';

      let files: RepoFile[];
      let title: string;
      let githubUrl: string | undefined;
      let githubSha: string | undefined;

      if (contentType.includes('application/json')) {
        // GitHub import
        const body = request.body as { githubUrl?: string; title?: string };
        if (!body.githubUrl) {
          await reply.status(400).send({ error: 'Missing githubUrl' });
          return;
        }
        githubUrl = body.githubUrl;
        title = body.title ?? 'Imported presentation';
        try {
          const result = await importFromGitHub(body.githubUrl);
          files = result.files;
          githubSha = result.sha;
        } catch (err) {
          await reply.status(400).send({
            error: err instanceof Error ? err.message : 'GitHub import failed',
          });
          return;
        }
      } else if (contentType.includes('multipart/form-data')) {
        // Multi-file or zip upload
        const parts = request.parts();
        const uploaded: RepoFile[] = [];
        title = 'Untitled';

        for await (const part of parts) {
          if (part.type === 'field' && part.fieldname === 'title') {
            title = String(part.value);
          } else if (part.type === 'file') {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(Buffer.from(chunk as ArrayBuffer));
            }
            const data = Buffer.concat(chunks);

            // Decode URI-encoded filename (client encodes to preserve
            // directory paths that busboy/multipart would strip).
            const filename = decodeURIComponent(part.filename || part.fieldname);

            if (filename.endsWith('.zip')) {
              // Zip upload
              const extracted = extractZip(data);
              uploaded.push(...extracted);
            } else {
              // Multi-file or directory upload — use filename as path
              uploaded.push({ path: filename, data });
            }
          }
        }
        // Strip common root directory (e.g. "my-deck/" from webkitdirectory uploads)
        if (uploaded.length > 0 && uploaded.every((f) => f.path.includes('/'))) {
          const paths = uploaded.map((f) => f.path);
          const firstSlash = paths[0]?.indexOf('/') ?? -1;
          if (firstSlash !== -1) {
            const prefix = paths[0]?.slice(0, firstSlash + 1) ?? '';
            if (prefix.length > 0 && paths.every((p) => p.startsWith(prefix))) {
              for (const file of uploaded) {
                (file as { path: string }).path = file.path.slice(prefix.length);
              }
            }
          }
        }
        files = uploaded;
      } else {
        await reply.status(415).send({ error: 'Unsupported content type' });
        return;
      }

      const validation = validateDeckFiles(files);
      if (!validation.valid) {
        await reply.status(400).send({ error: validation.error });
        return;
      }

      try {
        const slug = generateSlug(title);
        const presentation = await createPresentation(db, {
          userId: request.userId,
          title,
          slug,
          files: validation.files,
          repoDir: options.repoDir,
          ...(githubUrl !== undefined ? { githubUrl } : {}),
          ...(githubSha !== undefined ? { githubSha } : {}),
        });
        await reply.status(201).send(presentation);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Creation failed';
        const status = message === 'Quota exceeded' ? 413 : 500;
        await reply.status(status).send({ error: message });
      }
    },
  );

  // List own presentations
  fastify.get(
    '/hub/api/presentations',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string };
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Number(query.offset) || 0;
      const items = listPresentations(db, request.userId, limit, offset);
      await reply.send({ items, limit, offset });
    },
  );

  // Get single presentation
  fastify.get(
    '/hub/api/presentations/:id',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const access = checkAccess(db, id, request.userId);
      if (!access) {
        await reply.status(404).send({ error: 'Not found' });
        return;
      }
      const pres = getPresentationById(db, id);
      await reply.send({ ...pres, access });
    },
  );

  // Update metadata
  fastify.patch(
    '/hub/api/presentations/:id',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        title?: string;
        description?: string;
        visibility?: 'private' | 'public';
      };
      const updated = updatePresentationMetadata(db, id, request.userId, body);
      if (!updated) {
        await reply.status(404).send({ error: 'Not found or access denied' });
        return;
      }
      await reply.send(updated);
    },
  );

  // Re-upload files (new version)
  fastify.put(
    '/hub/api/presentations/:id/files',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parts = request.parts();
      const uploaded: RepoFile[] = [];

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(Buffer.from(chunk as ArrayBuffer));
          }
          const data = Buffer.concat(chunks);
          // Decode URI-encoded filename (client encodes to preserve
          // directory paths that busboy/multipart would strip).
          const filename = decodeURIComponent(part.filename || part.fieldname);

          if (filename.endsWith('.zip')) {
            uploaded.push(...extractZip(data));
          } else {
            uploaded.push({ path: filename, data });
          }
        }
      }

      // Strip common root directory (e.g. "my-deck/" from webkitdirectory uploads)
      if (uploaded.length > 0 && uploaded.every((f) => f.path.includes('/'))) {
        const paths = uploaded.map((f) => f.path);
        const firstSlash = paths[0]?.indexOf('/') ?? -1;
        if (firstSlash !== -1) {
          const prefix = paths[0]?.slice(0, firstSlash + 1) ?? '';
          if (prefix.length > 0 && paths.every((p) => p.startsWith(prefix))) {
            for (const file of uploaded) {
              (file as { path: string }).path = file.path.slice(prefix.length);
            }
          }
        }
      }

      const validation = validateDeckFiles(uploaded);
      if (!validation.valid) {
        await reply.status(400).send({ error: validation.error });
        return;
      }

      try {
        const updated = await updatePresentationFiles(
          db, id, request.userId, validation.files, options.repoDir,
        );
        await reply.send(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Update failed';
        const status = message === 'Quota exceeded' ? 413 : 500;
        await reply.status(status).send({ error: message });
      }
    },
  );

  // Delete presentation
  fastify.delete(
    '/hub/api/presentations/:id',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deletePresentation(db, id, request.userId, options.repoDir);
      if (!deleted) {
        await reply.status(404).send({ error: 'Not found or access denied' });
        return;
      }
      await reply.status(204).send();
    },
  );

  // Check if GitHub import has a newer commit available
  fastify.get(
    '/hub/api/presentations/:id/github-check',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const pres = getPresentationById(db, id);
      if (!pres || pres.ownerId !== request.userId) {
        await reply.status(404).send({ error: 'Not found' });
        return;
      }
      if (!pres.githubUrl) {
        await reply.status(400).send({ error: 'Not a GitHub import' });
        return;
      }
      try {
        const latestSha = await fetchGitHubLatestSha(pres.githubUrl);
        await reply.send({
          currentSha: pres.githubSha,
          latestSha,
          hasUpdate: latestSha !== null && latestSha !== pres.githubSha,
        });
      } catch (err) {
        await reply.status(502).send({ error: err instanceof Error ? err.message : 'GitHub check failed' });
      }
    },
  );

  // Re-import files from GitHub (refresh)
  fastify.post(
    '/hub/api/presentations/:id/github-refresh',
    { preHandler: [fastify.requireApproved] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const pres = getPresentationById(db, id);
      if (!pres || pres.ownerId !== request.userId) {
        await reply.status(404).send({ error: 'Not found' });
        return;
      }
      if (!pres.githubUrl) {
        await reply.status(400).send({ error: 'Not a GitHub import' });
        return;
      }
      try {
        const result = await importFromGitHub(pres.githubUrl);
        const validation = validateDeckFiles(result.files);
        if (!validation.valid) {
          await reply.status(422).send({ error: validation.error });
          return;
        }
        const updated = await refreshFromGitHub(db, id, request.userId, validation.files, result.sha, options.repoDir);
        await reply.send(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Refresh failed';
        const status = message === 'Quota exceeded' ? 413 : 502;
        await reply.status(status).send({ error: message });
      }
    },
  );
}
