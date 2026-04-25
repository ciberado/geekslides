# Use the Hub

The Hub is a community presentation platform where teams publish, discover, and launch slide decks through a browser. This guide covers running the Hub locally in dev mode, deploying it with OAuth for production, uploading your first deck, and sharing it with others.

## Quick Start (Dev Mode)

The fastest way to explore the Hub — no OAuth apps, no domain, no environment variables:

```bash
# 1. Start the GeekSlides server (needed for launching decks)
npm run dev

# 2. In a second terminal, start the Hub
npm run dev --workspace=@geekslides/hub
```

Open **http://localhost:3001/hub/** in your browser. Because no OAuth client IDs are configured, the login screen shows three built-in personas:

| Persona | Role | What you can do |
|---------|------|-----------------|
| **Alice Admin** | admin | Full access: upload, share, admin panel, invite codes |
| **Bob Presenter** | user | Upload and present decks |
| **Carol Viewer** | user | Upload and present decks |

Click any persona to sign in instantly — no redirects, no external services.

> **Tip:** Dev mode activates automatically when `NODE_ENV` is not `production` and neither `GITHUB_CLIENT_ID` nor `GOOGLE_CLIENT_ID` are set. Force it explicitly with `HUB_DEV_MODE=true`.

## Prerequisites (Production)

- A running GeekSlides server ([Deploy the Server](05-deploy-the-server.md))
- Docker and Docker Compose installed ([Use the Docker CLI](10-use-the-docker-cli.md))
- A GitHub or Google OAuth application (see below)

## Set Up OAuth Providers

The Hub uses OAuth 2.0 — no local passwords. You need at least one provider configured.

### GitHub

1. Go to **github.com → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set the **Authorization callback URL** to `https://<your-domain>/hub/api/auth/github/callback`
3. Note the **Client ID** and **Client Secret**

### Google

1. Go to **Google Cloud Console → APIs & Credentials → Create OAuth 2.0 Client ID**
2. Add `https://<your-domain>/hub/api/auth/google/callback` as an **Authorized redirect URI**
3. Note the **Client ID** and **Client Secret**

## Configure Environment Variables

Create a `.env` file or pass these variables to your Docker Compose stack:

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | If using GitHub | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | If using GitHub | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | If using Google | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | If using Google | Google OAuth client secret |
| `ADMIN_EMAIL` | Yes | Email of the first admin — auto-approved on first login |
| `JWT_SECRET` | Yes (production) | Secret for signing auth tokens |
| `COOKIE_DOMAIN` | Production | Domain for auth cookies (e.g. `example.com`) |
| `HUB_DEV_MODE` | No | Set to `true` to force dev-mode login (auto-detected otherwise) |
| `SERVER_BASE_URL` | If non-default | GeekSlides server URL (default `http://localhost:1234`) |
| `VIEWER_BASE_URL` | If non-default | Viewer SPA URL (default `http://localhost:5173`) |
| `DB_PATH` | If non-default | SQLite file path (default `./data/hub.db`) |
| `REPO_DIR` | If non-default | Git repo storage dir (default `./data/repos`) |

## Deploy with Docker Compose

The Hub runs alongside the existing GeekSlides services. Caddy routes `/hub/*` to the Hub Fastify server on port 3000.

```bash
docker compose -f docker/docker-compose.yml up -d
```

Data is persisted in a `hub-data` Docker volume containing the SQLite database and bare git repositories.

## Sign In

1. Open `https://<your-domain>/hub/` in a browser
2. Click **Sign in with GitHub** or **Sign in with Google**
3. Authorize the OAuth application

The first login matching `ADMIN_EMAIL` is automatically approved and granted admin rights. Other users land on a **Pending** page until an admin approves them or they provide a valid invite code.

## Upload a Deck

1. Click **New Presentation** on the dashboard
2. Enter a title and description
3. Choose an upload method:

| Method | When to use |
|--------|-------------|
| **Multi-file picker** | Select individual files from your file system |
| **ZIP archive** | Upload a complete deck folder as a `.zip` |
| **GitHub URL** | Import directly from a public GitHub repo |

4. The upload must include a valid `config.json` with a `content` field pointing to your markdown file

```json
{
  "title": "My Deck",
  "content": "README.md",
  "styles": ["layouts.css", "theme-default.css"]
}
```

> **Tip:** When uploading via the folder picker, the title field is automatically populated from the first `# H1` heading found in your markdown files. You can edit it before submitting.

> **Tip:** Each user has a storage quota (default 50 MB). The admin can adjust quotas per user from the admin panel.

## Launch a Presentation

Click **Present** on any deck card. The Hub:

1. Creates a room on the GeekSlides server
2. Uploads the deck files from the git repository
3. Redirects you to the viewer with a presenter token

Share the viewer URL with your audience — they get read-only access automatically.

## Share a Deck

1. Click **Share** on a deck card
2. Enter the recipient's email and choose a role:

| Role | Access |
|------|--------|
| **Viewer** | Can launch and view the deck |
| **Copresenter** | Can launch with presenter controls |

3. The recipient sees the invitation under **Shared with Me** in the navigation bar
4. They click **Accept** to add the deck to their library, or **Decline** to dismiss it

Accepted decks appear in a separate **Accepted Shares** section on the Shared with Me page, with a **Present** button that launches the deck immediately.

You can also change a deck's visibility in the **Edit** modal — see [Edit Metadata](#edit-metadata) below.

## Search for Decks

Use the search bar to find public presentations by title or description. Results show the deck owner's name and avatar.

## Admin Panel

Admins see an **Admin** link in the navigation. The panel has three tabs:

| Tab | Actions |
|-----|---------|
| **Users** | Approve or reject pending users, adjust storage quotas |
| **Invite Codes** | Generate, list, and revoke 8-character invite codes |
| **Stats** | View total users, presentations, storage used, and pending approvals |

> **Tip:** Invite codes let you pre-approve users — they skip the pending queue when they sign up with a valid code.

## Browse and Filter Your Presentations

The dashboard toolbar lets you quickly find and view your decks.

### Filter by name

Type in the **Filter presentations…** search box to narrow the list in real time. The filter uses fuzzy matching — you don't need to type the exact title. A few key characters in order is enough:

| What you type | What it matches |
|---------------|-----------------|
| `aws` | "AWS Cloud Architecture" |
| `kdd` | "Kubernetes Deep Dive" |
| `dct` | "Docker Compose Tips" |

When no decks match, a "No presentations match …" message appears.

### Switch between card and list view

Use the **⊞** and **☰** buttons on the right of the toolbar to toggle between:

| View | Best for |
|------|----------|
| **Card view** (⊞) | Browsing with titles and action buttons visible at a glance |
| **List view** (☰) | Scanning a long list compactly, with inline actions |

Both views respect the active filter.

## Edit Metadata

Click **Edit** on a deck card to open the metadata modal. You can change:

| Field | Notes |
|-------|-------|
| **Title** | Shown on the dashboard and in search results |
| **Description** | Optional. Displayed on the card and in search results |
| **Visibility** | **Private** (only you and your shares) or **Public** (visible to all users in search) |

Click **Save** to apply the changes immediately.

## Replace Files

Click **Replace Files** on a deck card to upload a new version of the entire deck. Select the updated folder — the upload must still contain a valid `config.json`. Replacements create a new git commit, so previous versions are preserved in the internal repository.

## Keep a GitHub Import Up to Date

Decks imported from GitHub show an extra action on their card for detecting and pulling in changes.

### Check for updates

Click **Check GitHub** on the card. The Hub compares the current HEAD SHA in the deck's repository against the latest commit SHA on the upstream GitHub branch:

| Result | What you see |
|--------|--------------|
| Already current | **✓ Up to date** label (clears after a few seconds) |
| New commits available | **↑ Update** button |

### Pull the update

Click **↑ Update** to re-import the deck from GitHub. The Hub:

1. Fetches the latest file tree from the GitHub API
2. Validates that a `config.json` with a `content` field is still present
3. Commits the new files to the internal git repository
4. Updates the stored SHA so the card reflects the current state

> **Tip:** The GitHub check calls the public GitHub API — no authentication token is needed for public repositories. Rate limits apply to unauthenticated requests (60/hour per IP).

## Local Development

To run the full stack locally without Docker:

```bash
# Terminal 1 — GeekSlides viewer + y-websocket server
npm run dev

# Terminal 2 — Hub (Fastify API + Lit SPA)
npm run dev --workspace=@geekslides/hub
```

The Hub starts two processes:
- **Fastify API** on `http://localhost:3000` — serves `/hub/api/*` routes
- **Vite dev server** on `http://localhost:3001` — serves the Lit SPA with HMR, proxies `/hub/api` → `:3000`

Open **http://localhost:3001/hub/** to access the Hub. Dev-mode login is available by default (see [Quick Start](#quick-start-dev-mode) above).

To test with real OAuth locally, set the callback URLs to `http://localhost:3001/hub/api/auth/<provider>/callback` and export the client ID/secret environment variables before starting.

---

← Previous: [Create a Custom Feature](14-create-a-custom-feature.md) | Back to [index →](README.md)
