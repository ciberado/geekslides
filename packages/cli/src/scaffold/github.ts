/**
 * GitHub template fetching for the `geekslides create --template` command.
 *
 * Templates live in the `decks/` directory of the upstream repository
 * (default: ciberado/geekslides on GitHub). The module uses the GitHub
 * REST API to enumerate available templates and to download individual
 * files, streaming raw content from raw.githubusercontent.com.
 *
 * Authentication: set the GITHUB_TOKEN environment variable to raise the
 * unauthenticated rate limit (60 req/hr) to 5 000 req/hr.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const DEFAULT_REPO = 'ciberado/geekslides';
export const DEFAULT_REF = 'main';

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';

// ---- GitHub API types (trimmed to what we actually use) ------------------

type GithubTreeItem = {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  url: string;
};

type GithubTreeResponse = {
  sha: string;
  url: string;
  tree: GithubTreeItem[];
  truncated: boolean;
};

// --------------------------------------------------------------------------

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'geekslides-cli',
  };
  const token = process.env['GITHUB_TOKEN'];
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchTree(repo: string, ref: string): Promise<GithubTreeResponse> {
  const url = `${GITHUB_API}/repos/${repo}/git/trees/${ref}?recursive=1`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GitHub API error ${String(res.status)} fetching tree for ${repo}@${ref}: ${body}`,
    );
  }
  return res.json() as Promise<GithubTreeResponse>;
}

/**
 * List the names of deck templates available in the upstream repository.
 * Each name corresponds to a sub-directory of `decks/` in that repo.
 */
export async function listGithubTemplates(
  repo = DEFAULT_REPO,
  ref = DEFAULT_REF,
): Promise<string[]> {
  const data = await fetchTree(repo, ref);
  return data.tree
    .filter(item => item.type === 'tree' && /^decks\/[^/]+$/.test(item.path))
    .map(item => item.path.slice('decks/'.length))
    .sort();
}

/**
 * Download all files from `decks/<name>/` in the upstream repository into
 * `targetDir`, preserving the directory structure relative to the template root.
 *
 * Throws if the template is not found or the network request fails.
 */
export async function downloadGithubTemplate(
  name: string,
  targetDir: string,
  repo = DEFAULT_REPO,
  ref = DEFAULT_REF,
): Promise<void> {
  const data = await fetchTree(repo, ref);

  const prefix = `decks/${name}/`;
  const blobs = data.tree.filter(
    item => item.type === 'blob' && item.path.startsWith(prefix),
  );

  if (blobs.length === 0) {
    const available = data.tree
      .filter(item => item.type === 'tree' && /^decks\/[^/]+$/.test(item.path))
      .map(item => item.path.slice('decks/'.length))
      .join(', ');
    throw new Error(
      `Template "${name}" not found in ${repo}. Available: ${available || '(none)'}`,
    );
  }

  await Promise.all(
    blobs.map(async blob => {
      const relPath = blob.path.slice(prefix.length);
      const rawUrl = `${GITHUB_RAW}/${repo}/${ref}/${blob.path}`;
      const destPath = join(targetDir, relPath);

      await mkdir(dirname(destPath), { recursive: true });

      const res = await fetch(rawUrl, { headers: buildHeaders() });
      if (!res.ok) {
        throw new Error(
          `Failed to download ${blob.path}: HTTP ${String(res.status)}`,
        );
      }
      const buf = await res.arrayBuffer();
      await writeFile(destPath, Buffer.from(buf));
    }),
  );
}
