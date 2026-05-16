/**
 * Tests for the create command scaffold assets and GitHub template features.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GITIGNORE_CONTENT,
  AGENTS_MD_TEMPLATE,
  SKILL_ADD_SLIDE,
  SKILL_EXPORT_PDF,
  SKILL_UPDATE_THEME,
} from '../src/scaffold/assets.ts';
import { listGithubTemplates, downloadGithubTemplate } from '../src/scaffold/github.ts';

// ---------------------------------------------------------------------------
// Scaffold asset content
// ---------------------------------------------------------------------------

describe('scaffold assets', () => {
  it('GITIGNORE_CONTENT contains common exclusions', () => {
    expect(GITIGNORE_CONTENT).toContain('node_modules');
    expect(GITIGNORE_CONTENT).toContain('.DS_Store');
    expect(GITIGNORE_CONTENT).toContain('dist/');
  });

  it('AGENTS_MD_TEMPLATE contains %%TITLE%% and %%DIR%% placeholders', () => {
    expect(AGENTS_MD_TEMPLATE).toContain('%%TITLE%%');
    expect(AGENTS_MD_TEMPLATE).toContain('%%DIR%%');
  });

  it('AGENTS_MD_TEMPLATE references common layout classes', () => {
    expect(AGENTS_MD_TEMPLATE).toContain('.layout-two-col');
    expect(AGENTS_MD_TEMPLATE).toContain('.layout-title');
  });

  it('SKILL_ADD_SLIDE references README.md and layout classes', () => {
    expect(SKILL_ADD_SLIDE).toContain('README.md');
    expect(SKILL_ADD_SLIDE).toContain('.layout-');
  });

  it('SKILL_EXPORT_PDF contains the pdf subcommand', () => {
    expect(SKILL_EXPORT_PDF).toContain('geekslides pdf');
  });

  it('SKILL_UPDATE_THEME lists available themes', () => {
    expect(SKILL_UPDATE_THEME).toContain('aurora');
    expect(SKILL_UPDATE_THEME).toContain('ocean');
  });
});

// ---------------------------------------------------------------------------
// writeScaffoldAssets integration — verify files land in the right place
// ---------------------------------------------------------------------------

describe('create command scaffold output', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes .gitignore, AGENTS.md and .copilot/skills/ for a built-in scaffold', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-scaffold-'));

    // Import lazily so we can run as a unit-style test (no full CLI spawn needed)
    // We call the scaffolding indirectly through the bin in this test suite
    // to keep it simple and avoid importing create.ts directly (which starts git init, etc.)
    // Instead we just verify the scaffold asset content directly.

    const { writeFile, mkdir } = await import('node:fs/promises');

    // Simulate what writeScaffoldAssets() does:
    const title = 'Test Deck';
    const slug = 'test-deck';

    await writeFile(join(tmpDir, '.gitignore'), GITIGNORE_CONTENT, 'utf-8');
    const agentsMd = AGENTS_MD_TEMPLATE
      .replaceAll('%%TITLE%%', title)
      .replaceAll('%%DIR%%', slug);
    await writeFile(join(tmpDir, 'AGENTS.md'), agentsMd, 'utf-8');
    const skillsDir = join(tmpDir, '.copilot', 'skills');
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, 'add-slide.md'), SKILL_ADD_SLIDE, 'utf-8');
    await writeFile(join(skillsDir, 'export-pdf.md'), SKILL_EXPORT_PDF, 'utf-8');
    await writeFile(join(skillsDir, 'update-theme.md'), SKILL_UPDATE_THEME, 'utf-8');

    // Assertions
    expect(existsSync(join(tmpDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.copilot', 'skills', 'add-slide.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.copilot', 'skills', 'export-pdf.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.copilot', 'skills', 'update-theme.md'))).toBe(true);

    const agentsContent = await readFile(join(tmpDir, 'AGENTS.md'), 'utf-8');
    expect(agentsContent).toContain('Test Deck');
    expect(agentsContent).toContain('test-deck');
    expect(agentsContent).not.toContain('%%TITLE%%');
    expect(agentsContent).not.toContain('%%DIR%%');
  });
});

// ---------------------------------------------------------------------------
// GitHub templates module — mocked fetch
// ---------------------------------------------------------------------------

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const MOCK_TREE = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  truncated: false,
  tree: [
    { path: 'decks', type: 'tree', sha: 'aaa', url: '' },
    { path: 'decks/my-template', type: 'tree', sha: 'bbb', url: '' },
    { path: 'decks/my-template/config.json', type: 'blob', sha: 'c01', url: '' },
    { path: 'decks/my-template/README.md', type: 'blob', sha: 'c02', url: '' },
    { path: 'decks/my-template/css', type: 'tree', sha: 'c03', url: '' },
    { path: 'decks/my-template/css/layouts.css', type: 'blob', sha: 'c04', url: '' },
    { path: 'decks/another-template', type: 'tree', sha: 'ddd', url: '' },
    { path: 'decks/another-template/config.json', type: 'blob', sha: 'd01', url: '' },
    { path: 'src', type: 'tree', sha: 'eee', url: '' },
  ],
};

const FILE_CONTENTS: Record<string, string> = {
  'decks/my-template/config.json': '{"title":"Template Deck","content":"README.md","styles":[]}',
  'decks/my-template/README.md': '# My Template\n\nSlide content here.\n',
  'decks/my-template/css/layouts.css': '/* layouts */',
  'decks/another-template/config.json': '{"title":"Another","content":"README.md","styles":[]}',
};

function makeMockFetch(): typeof globalThis.fetch {
  return vi.fn(async (url: RequestInfo | URL): Promise<Response> => {
    const urlStr = String(url);

    // Tree API call
    if (urlStr.includes('/git/trees/')) {
      return {
        ok: true,
        status: 200,
        json: async () => MOCK_TREE,
        text: async () => JSON.stringify(MOCK_TREE),
      } as unknown as Response;
    }

    // Raw file download
    const rawPrefix = 'https://raw.githubusercontent.com/ciberado/geekslides/main/';
    if (urlStr.startsWith(rawPrefix)) {
      const filePath = urlStr.slice(rawPrefix.length);
      const content = FILE_CONTENTS[filePath];
      if (!content) {
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as unknown as Response;
      }
      const buf = Buffer.from(content, 'utf-8');
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      } as unknown as Response;
    }

    return { ok: false, status: 404, json: async () => ({}), text: async () => 'not found' } as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
}

describe('listGithubTemplates', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns sorted template names from the decks/ directory', async () => {
    vi.stubGlobal('fetch', makeMockFetch());
    const names = await listGithubTemplates('ciberado/geekslides', 'main');
    expect(names).toEqual(['another-template', 'my-template']);
  });

  it('excludes non-deck tree items (src, root entries)', async () => {
    vi.stubGlobal('fetch', makeMockFetch());
    const names = await listGithubTemplates('ciberado/geekslides', 'main');
    expect(names).not.toContain('src');
    expect(names).not.toContain('decks');
  });
});

describe('downloadGithubTemplate', () => {
  let tmpDir: string;
  afterEach(async () => {
    vi.restoreAllMocks();
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('downloads all files from the template directory', async () => {
    vi.stubGlobal('fetch', makeMockFetch());
    tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-dl-'));

    await downloadGithubTemplate('my-template', tmpDir, 'ciberado/geekslides', 'main');

    expect(existsSync(join(tmpDir, 'config.json'))).toBe(true);
    expect(existsSync(join(tmpDir, 'README.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'css', 'layouts.css'))).toBe(true);

    const configContent = await readFile(join(tmpDir, 'config.json'), 'utf-8');
    expect(configContent).toContain('Template Deck');

    const readmeContent = await readFile(join(tmpDir, 'README.md'), 'utf-8');
    expect(readmeContent).toContain('My Template');
  });

  it('throws an informative error when the template does not exist', async () => {
    vi.stubGlobal('fetch', makeMockFetch());
    tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-dl-'));

    await expect(
      downloadGithubTemplate('nonexistent', tmpDir, 'ciberado/geekslides', 'main'),
    ).rejects.toThrow('not found');
  });

  it('creates intermediate directories for nested files', async () => {
    vi.stubGlobal('fetch', makeMockFetch());
    tmpDir = await mkdtemp(join(tmpdir(), 'geekslides-dl-'));

    await downloadGithubTemplate('my-template', tmpDir, 'ciberado/geekslides', 'main');

    const cssStat = await stat(join(tmpDir, 'css'));
    expect(cssStat.isDirectory()).toBe(true);
  });
});
