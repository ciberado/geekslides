import type { FastifyInstance } from 'fastify';
import type { HubDatabase } from '../db/index.ts';
import { upsertUser, getUserById, type OAuthProfile } from '../services/user.ts';
import type { HubServerOptions } from '../config.ts';

interface GitHubUser {
  readonly id: number;
  readonly login: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly avatar_url: string;
}

interface GitHubEmail {
  readonly email: string;
  readonly primary: boolean;
  readonly verified: boolean;
}

interface GoogleTokenInfo {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly picture: string;
}

interface OAuthState {
  readonly invite?: string;
  readonly nonce: string;
}

async function fetchGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!userRes.ok) throw new Error('GitHub user API failed');
  const user = (await userRes.json()) as GitHubUser;

  let email = user.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as GitHubEmail[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? emails[0]?.email ?? null;
    }
  }

  if (!email) throw new Error('No email found on GitHub account');

  return {
    provider: 'github',
    providerId: String(user.id),
    email,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Google userinfo API failed');
  const info = (await res.json()) as GoogleTokenInfo;

  return {
    provider: 'google',
    providerId: info.sub,
    email: info.email,
    name: info.name,
    avatarUrl: info.picture,
  };
}

function issueTokens(
  fastify: FastifyInstance,
  user: { id: string; role: string; status: string },
): { accessToken: string; refreshToken: string } {
  const accessToken = fastify.jwt.sign(
    { sub: user.id, role: user.role, status: user.status },
    { expiresIn: '15m' },
  );
  const refreshToken = fastify.jwt.sign(
    { sub: user.id, type: 'refresh' },
    { expiresIn: '7d' },
  );
  return { accessToken, refreshToken };
}

function setCookies(
  reply: { setCookie: (name: string, value: string, options: Record<string, unknown>) => typeof reply },
  accessToken: string,
  refreshToken: string,
  cookieDomain: string,
): void {
  const secure = cookieDomain !== 'localhost';
  reply.setCookie('hub_access', accessToken, {
    path: '/hub',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 15 * 60,
    domain: cookieDomain === 'localhost' ? undefined : cookieDomain,
  });
  reply.setCookie('hub_refresh', refreshToken, {
    path: '/hub/api/auth',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    domain: cookieDomain === 'localhost' ? undefined : cookieDomain,
  });
}

export function registerAuthRoutes(
  fastify: FastifyInstance,
  db: HubDatabase,
  options: HubServerOptions,
): void {
  // GitHub OAuth
  fastify.get('/hub/api/auth/github', async (request, reply) => {
    const invite = (request.query as Record<string, string | undefined>)['invite'] ?? '';
    const nonce = crypto.randomUUID();
    const state = Buffer.from(JSON.stringify({ invite, nonce } satisfies OAuthState)).toString('base64url');
    const params = new URLSearchParams({
      client_id: options.githubClientId,
      redirect_uri: `${options.viewerBaseUrl}/hub/api/auth/github/callback`,
      scope: 'user:email',
      state,
    });
    await reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  fastify.get('/hub/api/auth/github/callback', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const code = query['code'];
    const stateParam = query['state'] ?? '';

    if (!code) {
      await reply.status(400).send({ error: 'Missing code parameter' });
      return;
    }

    let state: OAuthState;
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) as OAuthState;
    } catch {
      await reply.status(400).send({ error: 'Invalid state parameter' });
      return;
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: options.githubClientId,
        client_secret: options.githubClientSecret,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      await reply.status(401).send({ error: 'GitHub token exchange failed' });
      return;
    }

    const profile = await fetchGitHubProfile(tokenData.access_token);
    const user = upsertUser(db, profile, options.adminEmail, state.invite || undefined);

    const tokens = issueTokens(fastify, user);
    setCookies(reply, tokens.accessToken, tokens.refreshToken, options.cookieDomain);

    const redirectPath = user.status === 'approved' ? '/hub/' : '/hub/pending';
    await reply.redirect(redirectPath);
  });

  // Google OAuth
  fastify.get('/hub/api/auth/google', async (request, reply) => {
    const invite = (request.query as Record<string, string | undefined>)['invite'] ?? '';
    const nonce = crypto.randomUUID();
    const state = Buffer.from(JSON.stringify({ invite, nonce } satisfies OAuthState)).toString('base64url');
    const params = new URLSearchParams({
      client_id: options.googleClientId,
      redirect_uri: `${options.viewerBaseUrl}/hub/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    await reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  fastify.get('/hub/api/auth/google/callback', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const code = query['code'];
    const stateParam = query['state'] ?? '';

    if (!code) {
      await reply.status(400).send({ error: 'Missing code parameter' });
      return;
    }

    let state: OAuthState;
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) as OAuthState;
    } catch {
      await reply.status(400).send({ error: 'Invalid state parameter' });
      return;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: options.googleClientId,
        client_secret: options.googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${options.viewerBaseUrl}/hub/api/auth/google/callback`,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      await reply.status(401).send({ error: 'Google token exchange failed' });
      return;
    }

    const profile = await fetchGoogleProfile(tokenData.access_token);
    const user = upsertUser(db, profile, options.adminEmail, state.invite || undefined);

    const tokens = issueTokens(fastify, user);
    setCookies(reply, tokens.accessToken, tokens.refreshToken, options.cookieDomain);

    const redirectPath = user.status === 'approved' ? '/hub/' : '/hub/pending';
    await reply.redirect(redirectPath);
  });

  // Refresh token
  fastify.post('/hub/api/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies['hub_refresh'];
    if (!refreshToken) {
      await reply.status(401).send({ error: 'No refresh token' });
      return;
    }

    try {
      const payload = fastify.jwt.verify<{ sub: string; type: string }>(refreshToken);
      if (payload.type !== 'refresh') {
        await reply.status(401).send({ error: 'Invalid token type' });
        return;
      }

      const user = getUserById(db, payload.sub);
      if (!user) {
        await reply.status(401).send({ error: 'User not found' });
        return;
      }

      const tokens = issueTokens(fastify, user);
      setCookies(reply, tokens.accessToken, tokens.refreshToken, options.cookieDomain);
      await reply.send({ ok: true });
    } catch {
      await reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Logout
  fastify.post('/hub/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('hub_access', { path: '/hub' });
    reply.clearCookie('hub_refresh', { path: '/hub/api/auth' });
    await reply.send({ ok: true });
  });

  // Me
  fastify.get('/hub/api/auth/me', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const user = getUserById(db, request.userId);
    if (!user) {
      await reply.status(404).send({ error: 'User not found' });
      return;
    }
    await reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      quotaBytes: user.quotaBytes,
      usedBytes: user.usedBytes,
    });
  });
}
