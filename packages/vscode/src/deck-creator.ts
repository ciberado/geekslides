import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { resolveGeekSlidesCli, type CliCommand } from './cli-resolution.ts';

type SpawnResult = Promise<void>;

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: 'pipe';
  },
  ) => {
  readonly stdout?: NodeJS.ReadableStream | null;
  readonly stderr?: NodeJS.ReadableStream | null;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number | null) => void): void;
};

async function runProcess(
  command: string,
  args: readonly string[],
  cwd: string,
  spawnProcess: SpawnProcess,
): SpawnResult {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawnProcess(command, args, {
      cwd,
      env: process.env,
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      rejectPromise(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(stderr.trim() || `Process exited with code ${String(code)}`));
    });
  });
}

export async function createDeck(
  workspaceRoot: string,
  targetDir: string,
  title: string,
  options?: {
    resolveCli?: (workspaceRoot: string) => CliCommand;
    spawnProcess?: SpawnProcess;
  },
): Promise<string> {
  const cli = (options?.resolveCli ?? resolveGeekSlidesCli)(workspaceRoot);
  const spawnProcess = options?.spawnProcess ?? spawn;
  const args = [...cli.args, 'create', '--title', title, '--dir', targetDir];

  await runProcess(cli.command, args, workspaceRoot, spawnProcess);
  return resolve(targetDir, 'README.md');
}
