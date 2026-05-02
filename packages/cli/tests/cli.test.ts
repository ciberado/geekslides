import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile as fsReadFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLI_VERSION } from '../src/index.ts';
import {
  buildDeckDevUrl,
  getDeckRedirectTarget,
  resolveCliAppRoot,
  resolveDeckConfigPath,
  toBrowserServedPath,
} from '../src/commands/dev.ts';
import {
  buildDetailsPdfHtml,
  loadAuthorStyles,
  resolvePdfInputPath,
} from '../src/commands/pdf.ts';
import type { SlideData } from '@geekslides/engine/headless';

const DETAILS_TEST_SLIDES: SlideData[] = [
  {
    id: 'intro',
    html: '<h1>Intro</h1>',
    notesHtml: undefined,
    detailsHtml: undefined,
    rawCss: undefined,
    classes: [],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 0,
  },
  {
    id: 'middle',
    html: '<h2>Middle</h2>',
    notesHtml: undefined,
    detailsHtml: '<p>Extra context</p>',
    rawCss: undefined,
    classes: [],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 0,
  },
  {
    id: 'end',
    html: '<h1>End</h1>',
    notesHtml: undefined,
    detailsHtml: undefined,
    rawCss: undefined,
    classes: [],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 0,
  },
];

describe('cli', () => {
  it('exports version', () => {
    expect(CLI_VERSION).toBe('2.0.0-alpha.0');
  });

  it('resolves relative config paths from the current working directory', () => {
    expect(resolveDeckConfigPath('config.json', '/talks/aws-deck')).toBe('/talks/aws-deck/config.json');
  });

  it('uses the packaged cli app as the vite root', () => {
    expect(resolveCliAppRoot()).toBe('/workspaces/geekslides/packages/cli/app');
  });

  it('maps in-repo deck configs to root-relative browser paths', () => {
    expect(toBrowserServedPath('/workspaces/geekslides/decks/demo/config.json', '/workspaces/geekslides'))
      .toBe('/decks/demo/config.json');
  });

  it('maps external deck configs to /@fs browser paths', () => {
    expect(toBrowserServedPath('/tmp/demo-talk/config.json', '/workspaces/geekslides'))
      .toBe('/@fs/tmp/demo-talk/config.json');
  });

  it('never produces double slashes in /@fs paths', () => {
    // Linux-style absolute paths
    expect(toBrowserServedPath('/home/user/talks/config.json', '/workspaces/geekslides'))
      .toBe('/@fs/home/user/talks/config.json');
    expect(toBrowserServedPath('/home/user/talks/config.json', '/workspaces/geekslides'))
      .toMatch(/^\/@fs\/[^/]/);

    // Root-level paths
    expect(toBrowserServedPath('/config.json', '/workspaces/geekslides'))
      .toBe('/@fs/config.json');
  });

  it('/@fs paths are valid Vite serve URLs (start with /@fs/ followed by non-slash)', () => {
    const paths = [
      '/tmp/demo-talk/config.json',
      '/home/javi/projects/my-talk/config.json',
      '/opt/talks/config.json',
    ];
    for (const p of paths) {
      const result = toBrowserServedPath(p, '/workspaces/geekslides');
      expect(result).toMatch(/^\/@fs\/[^/]/);
      expect(result).not.toContain('//');
    }
  });

  it('builds presentation and speaker urls for a chosen deck config', () => {
    expect(buildDeckDevUrl('http://localhost:5173', '/@fs/tmp/demo-talk/config.json'))
      .toBe('http://localhost:5173/?config=%2F%40fs%2Ftmp%2Fdemo-talk%2Fconfig.json');

    expect(buildDeckDevUrl('http://localhost:5173', '/@fs/tmp/demo-talk/config.json', true))
      .toBe('http://localhost:5173/?config=%2F%40fs%2Ftmp%2Fdemo-talk%2Fconfig.json&view=speaker');
  });

  it('redirects root html requests to the configured deck when no config is present', () => {
    expect(getDeckRedirectTarget('/?view=speaker', '/@fs//tmp/demo-talk/config.json'))
      .toBe('/?view=speaker&config=%2F%40fs%2F%2Ftmp%2Fdemo-talk%2Fconfig.json');
  });

  it('does not redirect when a config is already present', () => {
    expect(getDeckRedirectTarget('/?config=decks/demo/config.json', '/@fs//tmp/demo-talk/config.json'))
      .toBeNull();
  });

  it('resolves pdf inputs relative to the config directory', () => {
    expect(resolvePdfInputPath('README.md', '/talks/aws-deck')).toBe('/talks/aws-deck/README.md');
    expect(resolvePdfInputPath('/tmp/talk.md', '/talks/aws-deck')).toBe('/tmp/talk.md');
  });

  it('loads author styles from files listed in config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geekslides-cli-test-'));

    try {
      await writeFile(join(dir, 'local.css'), 'h1 { color: rebeccapurple; }', 'utf-8');
      await writeFile(join(dir, 'theme.css'), 'p { color: #333; }', 'utf-8');

      const css = await loadAuthorStyles(['local.css', 'theme.css'], dir);

      expect(css).toContain('h1 { color: rebeccapurple; }');
      expect(css).toContain('p { color: #333; }');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps horizontal hero slides out of thumbnail sizing rules in details pdf html', () => {
    const html = buildDetailsPdfHtml(
      ['/tmp/slide-0.png', '/tmp/slide-1.png', '/tmp/slide-2.png'],
      DETAILS_TEST_SLIDES,
      'horizontal',
    );

    const heroPages = html.match(/class="page hero horizontal"/g) ?? [];
    expect(heroPages).toHaveLength(2);
    expect(html).toContain('.page.horizontal.no-details:not(.hero) .thumb { flex-shrink: 0; width: 140mm; }');
    expect(html).toContain('.page.horizontal.has-details .thumb img { width: 140mm; height: 78.75mm; object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }');
    expect(html).not.toContain('.page.horizontal .thumb img { width: 140mm; height: 78.75mm; object-fit: contain; border: 1px solid #ccc; border-radius: 3px; }');
  });
});

// ---------------------------------------------------------------------------
// Built bundle integrity — guard against pino/thread-stream being inlined
// ---------------------------------------------------------------------------

const DIST_CJS = resolve(fileURLToPath(import.meta.url), '..', '..', 'dist', 'index.cjs');
const BIN_CJS = resolve(fileURLToPath(import.meta.url), '..', '..', 'bin', 'geekslides.cjs');
const BUNDLE_EXISTS = existsSync(DIST_CJS);

describe.skipIf(!BUNDLE_EXISTS)('CLI bundle integrity (dist/index.cjs)', () => {
  it('resolves pino as an external require(), not inlined', async () => {
    const bundle = await fsReadFile(DIST_CJS, 'utf8');
    // If pino were inlined, its internal path join(__dirname, 'worker.js') would
    // resolve to dist/lib/worker.js at runtime — which does not exist — and the
    // CLI would crash with MODULE_NOT_FOUND on startup.
    // The fix is --external:pino in the esbuild command, which turns all pino
    // imports into require("pino") calls resolved from node_modules at runtime.
    expect(bundle).toMatch(/require\(["']pino["']\)/);
  });

  it('resolves pino-pretty as an external require(), not inlined', async () => {
    const bundle = await fsReadFile(DIST_CJS, 'utf8');
    // pino-pretty is referenced by pino as a transport string ("pino-pretty"),
    // not as a direct require() call. The important guarantee is that its source
    // is NOT inlined — confirmed by the absence of its distinctive export name.
    expect(bundle).not.toContain('prettifyMessage');
  });

  it('does not contain pino worker path that would break at runtime', async () => {
    const bundle = await fsReadFile(DIST_CJS, 'utf8');
    // This string appears in pino's source when it constructs the worker path.
    // Its presence in the bundle means pino was inlined and __dirname will
    // resolve to the bundle's directory, not node_modules/pino/lib/.
    expect(bundle).not.toContain('pino-worker');
  });

  it('binary loads without MODULE_NOT_FOUND error', () => {
    const result = spawnSync(process.execPath, [DIST_CJS, '--version'], {
      timeout: 10_000,
      encoding: 'utf8',
      env: { ...process.env, GEEKSLIDES_LOG: 'silent' },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    // stderr should not contain the worker path or MODULE_NOT_FOUND
    expect(result.stderr).not.toContain('dist/lib/worker.js');
    expect(result.stderr).not.toContain('MODULE_NOT_FOUND');
  });

  it('bin/geekslides.cjs runs the bundled CLI when launched with node', () => {
    const result = spawnSync(process.execPath, [BIN_CJS, '--version'], {
      timeout: 10_000,
      encoding: 'utf8',
      env: { ...process.env, GEEKSLIDES_LOG: 'silent' },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(CLI_VERSION);
  });

  it('bin/geekslides.cjs can scaffold a deck when launched with node', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'geekslides-bin-create-'));

    try {
      const result = spawnSync(
        process.execPath,
        [BIN_CJS, 'create', '--title', 'Bin Deck', '--dir', dir, '--no-git'],
        {
          timeout: 10_000,
          encoding: 'utf8',
          env: { ...process.env, GEEKSLIDES_LOG: 'silent' },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(existsSync(join(dir, 'config.json'))).toBe(true);
      expect(existsSync(join(dir, 'README.md'))).toBe(true);
      expect(existsSync(join(dir, 'css', 'layouts.css'))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
