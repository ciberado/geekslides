import { describe, expect, it } from 'vitest';
import { resolveGeekSlidesCli } from '../src/cli-resolution.ts';

describe('resolveGeekSlidesCli', () => {
  it('prefers a workspace local binary', () => {
    const cli = resolveGeekSlidesCli('/repo/deck', {
      pathExists: (path) => path === '/repo/deck/node_modules/.bin/geekslides',
    });
    expect(cli).toEqual({ command: '/repo/deck/node_modules/.bin/geekslides', args: [] });
  });

  it('falls back to a monorepo cli binary', () => {
    const cli = resolveGeekSlidesCli('/repo/packages/vscode', {
      pathExists: (path) => path === '/repo/packages/cli/bin/geekslides.cjs',
    });
    expect(cli.command).toBe(process.execPath);
    expect(cli.args).toEqual(['/repo/packages/cli/bin/geekslides.cjs']);
  });

  it('falls back to a cli next to the extension during local development', () => {
    const cli = resolveGeekSlidesCli('/tmp/external-deck', {
      extensionRoot: '/repo/packages/vscode',
      pathExists: (path) => path === '/repo/packages/cli/bin/geekslides.cjs',
    });
    expect(cli.command).toBe(process.execPath);
    expect(cli.args).toEqual(['/repo/packages/cli/bin/geekslides.cjs']);
  });

  it('falls back to the global command when no local binary exists', () => {
    expect(resolveGeekSlidesCli('/repo/deck', { pathExists: () => false })).toEqual({ command: 'geekslides', args: [] });
  });
});
