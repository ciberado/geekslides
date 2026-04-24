import fs from 'node:fs';
import path from 'node:path';
import git from 'isomorphic-git';

export interface GitCommitInfo {
  readonly sha: string;
  readonly message: string;
  readonly timestamp: number;
}

export interface RepoFile {
  readonly path: string;
  readonly data: Buffer;
}

export async function initRepo(repoPath: string): Promise<void> {
  await fs.promises.mkdir(repoPath, { recursive: true });
  await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
}

export async function commitFiles(
  repoPath: string,
  files: readonly RepoFile[],
  message: string,
): Promise<string> {
  for (const file of files) {
    const filePath = path.join(repoPath, file.path);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, file.data);
  }

  // Remove files that are no longer in the set
  const tracked = await listTrackedFiles(repoPath);
  const newPaths = new Set(files.map((f) => f.path));
  for (const trackedPath of tracked) {
    if (!newPaths.has(trackedPath)) {
      const filePath = path.join(repoPath, trackedPath);
      await fs.promises.rm(filePath, { force: true });
      await git.remove({ fs, dir: repoPath, filepath: trackedPath });
    }
  }

  for (const file of files) {
    await git.add({ fs, dir: repoPath, filepath: file.path });
  }

  const sha = await git.commit({
    fs,
    dir: repoPath,
    message,
    author: { name: 'GeekSlides Hub', email: 'hub@geekslides.local' },
  });

  return sha;
}

export async function checkoutFiles(repoPath: string): Promise<RepoFile[]> {
  const filePaths = await listTrackedFiles(repoPath);
  const results: RepoFile[] = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(repoPath, filePath);
    try {
      const data = await fs.promises.readFile(fullPath);
      results.push({ path: filePath, data });
    } catch {
      // File may have been deleted
    }
  }

  return results;
}

async function listTrackedFiles(repoPath: string): Promise<string[]> {
  try {
    const matrix = await git.statusMatrix({ fs, dir: repoPath });
    return matrix
      .filter(([, head]) => head === 1)
      .map(([filepath]) => filepath);
  } catch {
    return [];
  }
}

export async function getLog(repoPath: string, depth: number = 50): Promise<GitCommitInfo[]> {
  try {
    const commits = await git.log({ fs, dir: repoPath, depth });
    return commits.map((c) => ({
      sha: c.oid,
      message: c.commit.message,
      timestamp: c.commit.author.timestamp * 1000,
    }));
  } catch {
    return [];
  }
}

export function repoSize(repoPath: string): number {
  let total = 0;
  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git') walk(full);
      } else {
        total += fs.statSync(full).size;
      }
    }
  }
  try {
    walk(repoPath);
  } catch {
    // repo may not exist yet
  }
  return total;
}
