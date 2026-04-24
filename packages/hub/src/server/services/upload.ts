import AdmZip from 'adm-zip';
import type { RepoFile } from './git.ts';

const FORBIDDEN_PATH_PATTERNS = /(?:^|[/\\])\.\.(?:[/\\]|$)/;
const MAX_FILENAME_LENGTH = 255;

export interface UploadValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly files: RepoFile[];
}

function sanitizePath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (FORBIDDEN_PATH_PATTERNS.test(normalized)) return null;
  if (normalized.length === 0 || normalized.length > MAX_FILENAME_LENGTH) return null;
  if (normalized.startsWith('.git/') || normalized === '.git') return null;
  return normalized;
}

export function validateDeckFiles(files: readonly RepoFile[]): UploadValidationResult {
  const sanitized: RepoFile[] = [];

  for (const file of files) {
    const safePath = sanitizePath(file.path);
    if (!safePath) {
      return { valid: false, error: `Invalid file path: ${file.path}`, files: [] };
    }
    sanitized.push({ path: safePath, data: file.data });
  }

  const hasConfig = sanitized.some((f) => f.path === 'config.json');
  if (!hasConfig) {
    return { valid: false, error: 'Missing config.json', files: [] };
  }

  const configFile = sanitized.find((f) => f.path === 'config.json');
  if (configFile) {
    try {
      const config = JSON.parse(configFile.data.toString('utf-8')) as Record<string, unknown>;
      if (typeof config['content'] !== 'string' || config['content'].length === 0) {
        return { valid: false, error: 'config.json must have a "content" field', files: [] };
      }
      const contentPath = sanitizePath(config['content']);
      if (!contentPath) {
        return { valid: false, error: 'Invalid content path in config.json', files: [] };
      }
      const hasContent = sanitized.some((f) => f.path === contentPath);
      if (!hasContent) {
        return { valid: false, error: `Content file "${contentPath}" not found in upload`, files: [] };
      }
    } catch {
      return { valid: false, error: 'Invalid JSON in config.json', files: [] };
    }
  }

  return { valid: true, files: sanitized };
}

export function extractZip(zipBuffer: Buffer): RepoFile[] {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const files: RepoFile[] = [];

  // Detect common root directory
  const paths = entries.filter((e) => !e.isDirectory).map((e) => e.entryName);
  const commonPrefix = findCommonPrefix(paths);

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    let entryPath = entry.entryName;
    if (commonPrefix) {
      entryPath = entryPath.slice(commonPrefix.length);
    }
    const safePath = sanitizePath(entryPath);
    if (!safePath) continue;

    const data = entry.getData();
    files.push({ path: safePath, data });
  }

  return files;
}

function findCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const firstSlash = paths[0]?.indexOf('/') ?? -1;
  if (firstSlash === -1) return '';
  const prefix = paths[0]?.slice(0, firstSlash + 1) ?? '';
  if (paths.every((p) => p.startsWith(prefix))) return prefix;
  return '';
}

export async function importFromGitHub(githubUrl: string): Promise<RepoFile[]> {
  const match = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?$/i.exec(githubUrl);
  if (!match) throw new Error('Invalid GitHub repository URL');

  const [, owner, repo, branch, subpath] = match;
  if (!owner || !repo) throw new Error('Invalid GitHub repository URL');
  const ref = branch ?? 'main';

  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

  // Try to get the tree recursively
  const treeRes = await fetch(`${apiBase}/git/trees/${ref}?recursive=1`, {
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'GeekSlides-Hub' },
  });

  if (!treeRes.ok) {
    throw new Error(`GitHub API error: ${String(treeRes.status)} — could not access ${owner}/${repo}`);
  }

  const treeData = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string; url: string; size?: number }>;
  };

  const prefix = subpath ? `${subpath}/` : '';
  const blobs = treeData.tree.filter(
    (item) => item.type === 'blob' && item.path.startsWith(prefix),
  );

  const files: RepoFile[] = [];
  for (const blob of blobs) {
    const relativePath = prefix ? blob.path.slice(prefix.length) : blob.path;
    const safePath = sanitizePath(relativePath);
    if (!safePath) continue;

    const blobRes = await fetch(blob.url, {
      headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'GeekSlides-Hub' },
    });
    if (!blobRes.ok) continue;

    const blobData = (await blobRes.json()) as { content: string; encoding: string };
    if (blobData.encoding === 'base64') {
      files.push({ path: safePath, data: Buffer.from(blobData.content, 'base64') });
    }
  }

  return files;
}
