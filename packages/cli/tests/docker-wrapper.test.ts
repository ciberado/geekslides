import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const ENTRYPOINT = resolve(__dirname, '..', '..', '..', 'docker', 'cli-entrypoint.sh');

async function runEntrypoint(env: Record<string, string> = {}): Promise<string> {
  const { stdout } = await execFileAsync('/bin/sh', [ENTRYPOINT], {
    env: { ...process.env, ...env },
  });
  return stdout;
}

describe('cli-entrypoint.sh wrapper script generation', () => {
  it('outputs a shell script when stdout is piped (no arguments)', async () => {
    const output = await runEntrypoint();
    expect(output).toMatch(/^#!/);
    expect(output).toContain('#!/bin/sh');
  });

  it('outputs help text when stdout is a terminal (no arguments)', async () => {
    // Use `script` to allocate a PTY so -t 1 is true inside the entrypoint
    const { stdout } = await execFileAsync('script', ['-qec', `/bin/sh ${ENTRYPOINT}`, '/dev/null'], {
      env: { ...process.env },
    });
    expect(stdout).toContain('GeekSlides CLI (Docker)');
    expect(stdout).toContain('Install the wrapper script');
    expect(stdout).toContain('docker run --rm');
    expect(stdout).not.toContain('#!/bin/sh');
  });

  it('references the default Docker image name', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('ciberado/geekslides-cli:latest');
  });

  it('uses GEEKSLIDES_IMAGE env var when set', async () => {
    const output = await runEntrypoint({ GEEKSLIDES_IMAGE: 'myregistry/cli:v1' });
    expect(output).toContain('myregistry/cli:v1');
    expect(output).not.toContain('ciberado/geekslides-cli:latest');
  });

  it('uses default port 3000', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('GEEKSLIDES_PORT:-3000');
  });

  it('uses GEEKSLIDES_PORT env var when set', async () => {
    const output = await runEntrypoint({ GEEKSLIDES_PORT: '8080' });
    expect(output).toContain('GEEKSLIDES_PORT:-8080');
  });

  it('mounts $PWD as the deck directory by default', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('GEEKSLIDES_DIR:-$PWD');
    expect(output).toContain('-v ${DECK_DIR}:/deck');
  });

  it('adds port mapping for the dev command', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('-p ${PORT}:${PORT}');
  });

  it('passes --host 0.0.0.0 for the dev command', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('--host 0.0.0.0');
  });

  it('adds -it flag when terminal is detected', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('-t 0');
    expect(output).toContain('-it');
  });

  it('always uses --rm flag', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('--rm');
  });

  it('produces a syntactically valid shell script', async () => {
    const output = await runEntrypoint();
    const dir = await mkdtemp(join(tmpdir(), 'geekslides-wrapper-'));
    const scriptPath = join(dir, 'wrapper.sh');
    try {
      await writeFile(scriptPath, output, 'utf-8');
      const { stderr } = await execFileAsync('/bin/sh', ['-n', scriptPath]);
      expect(stderr).toBe('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('includes usage documentation in comments', async () => {
    const output = await runEntrypoint();
    expect(output).toContain('Usage:');
    expect(output).toContain('dev');
    expect(output).toContain('build');
    expect(output).toContain('pdf');
    expect(output).toContain('create');
  });
});
