import path from 'node:path';
import type { HubDatabase } from '../db/index.ts';
import { checkAccess } from './share.ts';
import { getPresentationById } from './presentation.ts';
import { checkoutFiles } from './git.ts';
import { createRoom, uploadContent, type ServerRoomTokens } from './server-client.ts';
import { recordLaunch } from './analytics.ts';

export interface LaunchResult {
  readonly url: string;
  readonly shareUrl: string;
  readonly room: string;
  readonly role: 'presenter' | 'viewer';
}

export async function launchPresentation(
  db: HubDatabase,
  presentationId: string,
  userId: string,
  repoDir: string,
  serverBaseUrl: string,
): Promise<LaunchResult | { error: string }> {
  const access = checkAccess(db, presentationId, userId);
  if (!access) return { error: 'Access denied' };

  const pres = getPresentationById(db, presentationId);
  if (!pres) return { error: 'Presentation not found' };

  const room = `hub-${presentationId.slice(0, 8)}-${String(Date.now())}`;

  let roomTokens: ServerRoomTokens;
  try {
    roomTokens = await createRoom(serverBaseUrl, room);
  } catch (err) {
    return { error: `Failed to create room: ${err instanceof Error ? err.message : String(err)}` };
  }

  const repoPath = path.join(repoDir, pres.ownerId, pres.slug);
  const files = await checkoutFiles(repoPath);

  try {
    await uploadContent(serverBaseUrl, room, files);
  } catch (err) {
    return { error: `Failed to upload content: ${err instanceof Error ? err.message : String(err)}` };
  }

  const isPresenter = access === 'owner' || access === 'copresenter';
  const token = isPresenter ? roomTokens.presenterToken : roomTokens.viewerToken;
  const tokenParam = isPresenter ? 'token' : 'vtoken';

  // Use relative path so the viewer's dev proxy (/api → server) handles the request,
  // which works both on localhost and through tunneled environments (Codespaces, etc.)
  const configPath = `/api/rooms/${encodeURIComponent(room)}/content/config.json`;
  // Path-only URLs — resolved by the browser against the current origin.
  // Works in dev (hub Vite proxies to viewer on :5173) and production (Caddy same-domain).
  const url = `/?config=${encodeURIComponent(configPath)}&room=${encodeURIComponent(room)}&${tokenParam}=${token}`;
  const shareUrl = `/?config=${encodeURIComponent(configPath)}&room=${encodeURIComponent(room)}&vtoken=${roomTokens.viewerToken}`;

  recordLaunch(db, presentationId, userId);

  return { url, shareUrl, room, role: isPresenter ? 'presenter' : 'viewer' };
}
