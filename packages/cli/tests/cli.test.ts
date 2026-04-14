import { describe, it, expect } from 'vitest';
import { CLI_VERSION } from '../src/index.ts';
import {
  buildDeckDevUrl,
  getDeckRedirectTarget,
  resolveCliAppRoot,
  resolveDeckConfigPath,
  toBrowserServedPath,
} from '../src/commands/dev.ts';

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
      .toBe('/@fs//tmp/demo-talk/config.json');
  });

  it('builds presentation and speaker urls for a chosen deck config', () => {
    expect(buildDeckDevUrl('http://localhost:5173', '/@fs//tmp/demo-talk/config.json'))
      .toBe('http://localhost:5173/?config=%2F%40fs%2F%2Ftmp%2Fdemo-talk%2Fconfig.json');

    expect(buildDeckDevUrl('http://localhost:5173', '/@fs//tmp/demo-talk/config.json', true))
      .toBe('http://localhost:5173/?config=%2F%40fs%2F%2Ftmp%2Fdemo-talk%2Fconfig.json&view=speaker');
  });

  it('redirects root html requests to the configured deck when no config is present', () => {
    expect(getDeckRedirectTarget('/?view=speaker', '/@fs//tmp/demo-talk/config.json'))
      .toBe('/?view=speaker&config=%2F%40fs%2F%2Ftmp%2Fdemo-talk%2Fconfig.json');
  });

  it('does not redirect when a config is already present', () => {
    expect(getDeckRedirectTarget('/?config=decks/demo/config.json', '/@fs//tmp/demo-talk/config.json'))
      .toBeNull();
  });
});
