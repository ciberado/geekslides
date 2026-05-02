import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { ServerManager } from '../src/server-manager.ts';

class MockChild extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  readonly pid = 4242;
  kill = vi.fn(() => true);
}

describe('ServerManager', () => {
  it('spawns the resolved cli command and parses server output', async () => {
    const child = new MockChild();
    const spawnProcess = vi.fn(() => child);
    const output = { appendLine: vi.fn() };
    const manager = new ServerManager({
      spawnProcess,
      output,
      resolveCli: () => ({ command: 'geekslides', args: ['--local'] }),
    });

    const startPromise = manager.start({
      workspaceRoot: '/repo/deck',
      configPath: '/repo/deck/config.json',
      port: 5173,
      wsPort: 1234,
    });

    child.stdout.emit('data', '  Sync server running on ws://localhost:1234\n');
    child.stdout.emit('data', '  Presentation:  http://localhost:5173/?config=%2Fdeck%2Fconfig.json\n');
    child.stdout.emit('data', '  Speaker view:  http://localhost:5173/?config=%2Fdeck%2Fconfig.json&view=speaker\n');

    await startPromise;

    expect(spawnProcess).toHaveBeenCalledWith(
      'geekslides',
      ['--local', 'dev', '--config', '/repo/deck/config.json', '--port', '5173', '--ws-port', '1234'],
      expect.objectContaining({
        cwd: '/repo/deck',
        env: expect.objectContaining({ GEEKSLIDES_LOG: 'debug' }),
      }),
    );
    expect(output.appendLine).toHaveBeenCalledWith('  command: geekslides');
    expect(output.appendLine).toHaveBeenCalledWith('  args: ["--local","dev","--config","/repo/deck/config.json","--port","5173","--ws-port","1234"]');
    expect(output.appendLine).toHaveBeenCalledWith('  pid: 4242');
    expect(output.appendLine).toHaveBeenCalledWith('[stdout]   Presentation:  http://localhost:5173/?config=%2Fdeck%2Fconfig.json');
    expect(manager.getState()).toEqual(expect.objectContaining({
      status: 'running',
      configPath: '/repo/deck/config.json',
      port: 5173,
      wsPort: 1234,
      wsUrl: 'ws://localhost:1234',
      presentationUrl: 'http://localhost:5173/?config=%2Fdeck%2Fconfig.json',
      speakerUrl: 'http://localhost:5173/?config=%2Fdeck%2Fconfig.json&view=speaker',
    }));
  });

  it('stops the child process', async () => {
    const child = new MockChild();
    const manager = new ServerManager({
      spawnProcess: vi.fn(() => child),
      resolveCli: () => ({ command: 'geekslides', args: [] }),
    });

    const startPromise = manager.start({
      workspaceRoot: '/repo/deck',
      configPath: '/repo/deck/config.json',
      port: 5173,
      wsPort: 1234,
    });
    child.stdout.emit('data', '  Presentation:  http://localhost:5173/?config=%2Fdeck%2Fconfig.json\n');
    await startPromise;
    manager.stop();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('surfaces spawn errors while starting', async () => {
    const child = new MockChild();
    const output = { appendLine: vi.fn() };
    const manager = new ServerManager({
      spawnProcess: vi.fn(() => child),
      output,
      resolveCli: () => ({ command: 'geekslides', args: [] }),
    });

    const startPromise = manager.start({
      workspaceRoot: '/repo/deck',
      configPath: '/repo/deck/config.json',
      port: 5173,
      wsPort: 1234,
    });

    child.stderr.emit('data', 'debug line before failure\n');
    child.emit('error', new Error('spawn geekslides ENOENT'));

    await expect(startPromise).rejects.toThrow('Failed to start GeekSlides dev server: spawn geekslides ENOENT');
    await expect(startPromise).rejects.toThrow('Recent output:');
    await expect(startPromise).rejects.toThrow('[stderr] debug line before failure');
    expect(manager.getState().status).toBe('stopped');
    expect(output.appendLine).toHaveBeenCalledWith('Process error during startup: spawn geekslides ENOENT');
  });

  it('surfaces exit code and recent output when startup exits early', async () => {
    const child = new MockChild();
    const manager = new ServerManager({
      spawnProcess: vi.fn(() => child),
      resolveCli: () => ({ command: 'geekslides', args: [] }),
    });

    const startPromise = manager.start({
      workspaceRoot: '/repo/deck',
      configPath: '/repo/deck/config.json',
      port: 5173,
      wsPort: 1234,
    });

    child.stderr.emit('data', 'startup failure details\n');
    child.emit('exit', 1, null);

    await expect(startPromise).rejects.toThrow(
      'GeekSlides dev server exited before it finished starting (code=1, signal=null).',
    );
    await expect(startPromise).rejects.toThrow('[stderr] startup failure details');
  });
});
