# Hub — Community Presentation Platform

## Overview

`@geekslides/hub` is a **management-plane** package (no y-websocket integration). It provides
a community platform where users register via OAuth, upload presentations (stored as git repos),
share them, and launch them into the existing `@geekslides/server` runtime for live viewing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Hub Architecture                         │
│                                                              │
│  Browser (Lit SPA)          Hub Server (Fastify)             │
│  ├── /hub/                  ├── OAuth2 (GitHub, Google)      │
│  ├── Dashboard              ├── JWT in httpOnly cookies      │
│  ├── Shared with Me         ├── SQLite + Drizzle ORM         │
│  ├── Search                 ├── isomorphic-git repos         │
│  ├── Admin Panel            └── REST API (/hub/api/*)        │
│  └── Login / Pending                  │                      │
│                                       │ launch               │
│                                       ▼                      │
│                              @geekslides/server              │
│                              ├── POST /api/rooms/:room/share │
│                              └── POST /api/rooms/:room/content│
└─────────────────────────────────────────────────────────────┘
```

### Package Boundaries

- **Hub ↔ Server**: Hub calls server REST API at launch time only. No shared code.
- **Hub ↔ Engine**: None. Hub is management-plane; engine is presentation-plane.
- **Hub ↔ CLI**: None. They are independent entry points.

## Data Model

```
users ──< presentations ──< shares
  │              │
  │              └──< analytics_events
  └──< invite_codes
```

- **users**: OAuth identity, role (user/admin), status (pending/approved/rejected), quota
- **presentations**: metadata, slug, visibility, size tracking, FK to owner; `github_url` and `github_sha` (nullable) for GitHub-imported decks
- **shares**: per-presentation access grants with role (viewer/copresenter) and status (pending/accepted/rejected)
- **analytics_events**: launch tracking
- **invite_codes**: admin-generated codes that auto-approve new users

## Storage

- **SQLite** with WAL mode + Drizzle ORM. Single-file DB at `$DB_PATH` (default `./data/hub.db`).
- **FTS5** virtual table on presentations for full-text search.
- **Git repos** on filesystem at `$REPO_DIR/<userId>/<slug>/` via isomorphic-git.

## Authentication Flow

1. User clicks "Sign in with GitHub/Google" → redirect to OAuth provider
2. Provider callback → upsert user in DB → issue JWT access token (15min) + refresh token (7d) as httpOnly cookies
3. If `ADMIN_EMAIL` matches the user email, auto-approve + set admin role
4. If invite code provided and valid, auto-approve
5. Otherwise user stays in `pending` status until admin approves

### Dev Mode

When `devMode` is enabled, two extra routes are registered and the login page shows
three built-in personas (Alice Admin, Bob Presenter, Carol Viewer). Clicking a persona
calls `POST /hub/api/auth/dev-login` to upsert the mock user and issue JWT cookies
directly — no external OAuth provider involved.

Dev mode activates automatically when **both** conditions are true:
- `NODE_ENV` is **not** `production`
- Neither `GITHUB_CLIENT_ID` nor `GOOGLE_CLIENT_ID` is set

It can also be forced with `HUB_DEV_MODE=true`.

## Launch Flow

1. User clicks "Launch" on a presentation
2. Hub calls `POST /api/rooms/:room/share` on `@geekslides/server` to create a room token
3. Hub checks out files from git repo
4. Hub uploads files via `POST /api/rooms/:room/content` (multipart)
5. Returns viewer URL with embedded share token

## Client SPA

The Lit 3 SPA lives in `packages/hub/src/client/`. It is built by Vite (`vite.client.config.ts`) into `dist/client/`, which Fastify serves as static files. In dev mode, a Vite dev server runs on `:3001` and proxies `/hub/api` to Fastify on `:3000`.

### Pages

| Component | File | Route | Purpose |
|-----------|------|-------|---------|
| `hub-dashboard-page` | `pages/dashboard-page.ts` | `/hub/` | Own presentations: upload, filter, launch, share, edit, replace, GitHub sync |
| `hub-shared-page` | `pages/shared-page.ts` | `/hub/shared` | Pending invitations (accept/decline) and accepted shares (launch) |
| `hub-search-page` | `pages/search-page.ts` | `/hub/search` | Full-text search across public presentations |
| `hub-admin-page` | `pages/admin-page.ts` | `/hub/admin` | User management, invite codes, system stats |
| `hub-login-page` | `pages/login-page.ts` | `/hub/login` | OAuth provider buttons or dev-mode persona picker |
| `hub-pending-page` | `pages/pending-page.ts` | `/hub/pending` | Awaiting admin approval |

The root `hub-app` component (`main.ts`) handles routing by reading `window.location.pathname` and switching the active page via an `AppView` discriminant. Navigation links update the URL and re-render.

### Dashboard Features

`dashboard-page.ts` is the most complex component. Key capabilities:

**Fuzzy filter** — A search input above the presentation list filters cards in real time using character-sequence matching (`utils/fuzzy.ts`). Typing `kdd` matches "Kubernetes Deep Dive"; `aws` matches "AWS Cloud Architecture". A "No presentations match …" message is shown when the filter eliminates all results.

**Layout toggle** — Two icon buttons (⊞ card / ☰ list) switch between:
- **Card view**: `<div class="card">` grid — title, visibility badge, size, and action buttons in a card. Default.
- **List view**: compact `<div class="list-row">` rows — title + badge + size on one line, action buttons on the right.

Both views honour the active filter. The choice is held in `@state() _layout` (session-scoped, not persisted).

**Per-card actions**:

| Button | Behaviour |
|--------|----------|
| **Present** | Calls `launchPresentation()` → opens viewer URL, shows share-URL modal |
| **Edit** | Opens metadata modal (title, description, visibility) |
| **Replace Files** / **Replace** | Opens replace modal; accepts folder picker |
| **Check GitHub** / **↑ Update** | (GitHub imports only) Checks upstream SHA; if new commits, offers one-click re-import |
| **Delete** | Confirm-gated delete |

**GitHub check/refresh** — GitHub-imported decks store `githubUrl` and `githubSha`. The dashboard calls `GET /:id/github-check` to compare the stored SHA against the upstream HEAD. Result is cached in `_githubStatus: Map<id, GitHubCheckResult | 'checking' | 'refreshing' | 'error'>` per card. If `hasUpdate` is true, an **↑ Update** button calls `POST /:id/github-refresh`.

### Shared with Me Page

`shared-page.ts` fetches `GET /hub/api/shares/shared-with-me` and splits results into two sections:
- **Pending invitations** — Accept / Decline buttons call `POST /hub/api/shares/:id/respond`.
- **Accepted shares** — Present button launches the shared deck.

Empty state shown when neither section has entries.

### Client Utilities

`utils/fuzzy.ts` — pure function `fuzzyMatch(text, query): boolean`. Character-sequence algorithm: iterates query characters and advances a pointer through the text string. Case-insensitive. Tested in `packages/hub/tests/unit/fuzzy.test.ts`.

`services/api.ts` — `ApiClient` class wrapping all hub API endpoints with automatic token refresh (intercepts 401, calls `/auth/refresh`, retries). Key types: `Presentation`, `SharedPresentation`, `GitHubCheckResult`, `LaunchResult`.

## Upload Formats

- **Multi-file picker**: Individual files from browser file input
- **ZIP archive**: Extracted server-side with common prefix detection (adm-zip)
- **GitHub URL**: Fetches tree via GitHub API, downloads blobs. Stores the resolved HEAD SHA (`github_sha`) alongside the URL for update detection.

All uploads are validated: must include `config.json` with a `content` field pointing to an existing file. Path traversal is rejected.

## Security

- JWT tokens in httpOnly secure cookies (no localStorage)
- CSRF prevention via SameSite=Lax cookies
- File path sanitization (no `..`, no `.git`, length limits)
- FTS5 query sanitization (alphanumeric only + quoted tokens)
- Admin-gated registration (pending by default)
- Quota enforcement per user (default 50MB)

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/hub/api/auth/dev-users` | — | List dev personas (dev mode only) |
| POST | `/hub/api/auth/dev-login` | — | Authenticate as dev persona (dev mode only) |
| GET | `/hub/api/auth/:provider` | — | OAuth redirect |
| GET | `/hub/api/auth/:provider/callback` | — | OAuth callback |
| POST | `/hub/api/auth/refresh` | cookie | Refresh access token |
| POST | `/hub/api/auth/logout` | cookie | Clear auth cookies |
| GET | `/hub/api/auth/me` | token | Current user profile |
| GET | `/hub/api/presentations` | approved | List own presentations |
| POST | `/hub/api/presentations` | approved | Create presentation |
| GET | `/hub/api/presentations/:id` | approved | Get presentation |
| PATCH | `/hub/api/presentations/:id` | approved | Update metadata |
| PUT | `/hub/api/presentations/:id/files` | approved | Update files |
| DELETE | `/hub/api/presentations/:id` | approved | Delete presentation |
| POST | `/hub/api/presentations/:id/launch` | approved | Launch to server |
| GET | `/hub/api/presentations/:id/github-check` | approved | Compare stored SHA vs upstream HEAD |
| POST | `/hub/api/presentations/:id/github-refresh` | approved | Re-import latest files from GitHub |
| POST | `/hub/api/shares` | approved | Create share |
| GET | `/hub/api/shares/:presentationId` | approved | List shares |
| DELETE | `/hub/api/shares/:id` | approved | Revoke share |
| POST | `/hub/api/shares/:id/respond` | approved | Accept/reject share |
| GET | `/hub/api/shares/shared-with-me` | approved | List received shares |
| GET | `/hub/api/search` | approved | Search public presentations |
| GET | `/hub/api/admin/users` | admin | List users |
| POST | `/hub/api/admin/users/:id/approve` | admin | Approve user |
| POST | `/hub/api/admin/users/:id/reject` | admin | Reject user |
| PATCH | `/hub/api/admin/users/:id/quota` | admin | Set quota |
| POST | `/hub/api/admin/invite-codes` | admin | Generate invite code |
| GET | `/hub/api/admin/invite-codes` | admin | List invite codes |
| DELETE | `/hub/api/admin/invite-codes/:id` | admin | Revoke invite code |
| GET | `/hub/api/admin/stats` | admin | System statistics |
| GET | `/hub/api/analytics/:id` | approved | Presentation analytics |
| GET | `/hub/api/analytics/me` | approved | Personal stats |

## Docker

Standalone `Dockerfile.hub` with 3-stage build (client → server → runtime).
Uses `better-sqlite3` native module. Persists data via `/data` volume.
Integrates into the main docker-compose with Caddy reverse proxy at `/hub/*`.

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP listen port |
| `HOST` | 0.0.0.0 | Bind address |
| `DB_PATH` | ./data/hub.db | SQLite database file |
| `REPO_DIR` | ./data/repos | Git repositories root |
| `SERVER_BASE_URL` | http://localhost:1234 | @geekslides/server URL |
| `VIEWER_BASE_URL` | http://localhost:5173 | Viewer/SPA URL |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth secret |
| `ADMIN_EMAIL` | — | Auto-admin email |
| `JWT_SECRET` | — | JWT signing secret |
| `COOKIE_DOMAIN` | localhost | Cookie domain |
| `HUB_DEV_MODE` | (auto) | Force dev-mode login; auto-enabled when no OAuth secrets and not production |
