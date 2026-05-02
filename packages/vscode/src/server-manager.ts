import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { resolveGeekSlidesCli, type CliCommand } from './cli-resolution.ts';

export interface ServerOutputSink {
  appendLine(message: string): void;
  show?(preserveFocus?: boolean): void;
}

interface ChildProcessLike extends EventEmitter {
  readonly stdout?: NodeJS.ReadableStream | null;
  readonly stderr?: NodeJS.ReadableStream | null;
  readonly pid?: number | undefined;
  kill(signal?: NodeJS.Signals | number): boolean;
}

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: 'pipe';
  },
) => ChildProcessLike;

export interface StartServerOptions {
  readonly workspaceRoot: string;
  readonly configPath: string;
  readonly port: number;
  readonly wsPort: number;
}

export interface ServerState {
  readonly status: 'stopped' | 'starting' | 'running';
  readonly configPath: string | undefined;
  readonly port: number | undefined;
  readonly wsPort: number | undefined;
  readonly presentationUrl: string | undefined;
  readonly speakerUrl: string | undefined;
  readonly wsUrl: string | undefined;
}

export class ServerManager {
  #state: ServerState = {
    status: 'stopped',
    configPath: undefined,
    port: undefined,
    wsPort: undefined,
    presentationUrl: undefined,
    speakerUrl: undefined,
    wsUrl: undefined,
  };
  #child: ChildProcessLike | null = null;
  #recentOutput: string[] = [];
  readonly #events = new EventEmitter();
  readonly #spawnProcess: SpawnProcess;
  readonly #resolveCli: (workspaceRoot: string) => CliCommand;
  readonly #output: ServerOutputSink | undefined;

  constructor(options?: {
    spawnProcess?: SpawnProcess;
    resolveCli?: (workspaceRoot: string) => CliCommand;
    output?: ServerOutputSink;
  }) {
    this.#spawnProcess = options?.spawnProcess ?? ((command, args, spawnOptions) => (
      spawn(command, args, spawnOptions)
    ));
    this.#resolveCli = options?.resolveCli ?? resolveGeekSlidesCli;
    this.#output = options?.output;
  }

  getState(): ServerState {
    return this.#state;
  }

  onStateChange(listener: (state: ServerState) => void): () => void {
    this.#events.on('state', listener);
    return () => {
      this.#events.off('state', listener);
    };
  }

  async start(options: StartServerOptions): Promise<ServerState> {
    if (this.#child) {
      this.stop();
    }

    const cli = this.#resolveCli(options.workspaceRoot);
    const args = [
      ...cli.args,
      'dev',
      '--config',
      options.configPath,
      '--port',
      String(options.port),
      '--ws-port',
      String(options.wsPort),
    ];
    const env = {
      ...process.env,
      GEEKSLIDES_LOG: process.env['GEEKSLIDES_LOG'] ?? 'debug',
    };

    this.#trace(`Starting GeekSlides dev server`);
    this.#trace(`  workspaceRoot: ${options.workspaceRoot}`);
    this.#trace(`  configPath: ${options.configPath}`);
    this.#trace(`  cwd: ${dirname(options.configPath)}`);
    this.#trace(`  command: ${cli.command}`);
    this.#trace(`  args: ${JSON.stringify(args)}`);
    this.#trace(`  GEEKSLIDES_LOG: ${env['GEEKSLIDES_LOG'] || 'unset'}`);

    const child = this.#spawnProcess(cli.command, args, {
      cwd: dirname(options.configPath),
      env,
      stdio: 'pipe',
    });

    this.#child = child;
    this.#trace(`  pid: ${String(child.pid ?? 'unknown')}`);
    this.#setState({
      status: 'starting',
      configPath: options.configPath,
      port: undefined,
      wsPort: undefined,
      presentationUrl: undefined,
      speakerUrl: undefined,
      wsUrl: undefined,
    });

    this.#attachStream('stdout', child.stdout);
    this.#attachStream('stderr', child.stderr);

    return await new Promise<ServerState>((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        this.#events.off('state', handleState);
        rejectPromise(new Error(this.#buildStartupError(
          'Timed out waiting for the GeekSlides dev server to start.',
        )));
      }, 15_000);

      const handleState = (state: ServerState): void => {
        if (state.status === 'running') {
          clearTimeout(timeout);
          this.#events.off('state', handleState);
          resolvePromise(state);
        }
      };

      child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timeout);
        this.#events.off('state', handleState);
        this.#child = null;
        this.#trace(`Process exited during startup (code=${String(code)}, signal=${String(signal)})`);
        this.#setState({
          status: 'stopped',
          configPath: undefined,
          port: undefined,
          wsPort: undefined,
          presentationUrl: undefined,
          speakerUrl: undefined,
          wsUrl: undefined,
        });
        rejectPromise(new Error(this.#buildStartupError(
          `GeekSlides dev server exited before it finished starting (code=${String(code)}, signal=${String(signal)}).`,
        )));
      });

      child.once('error', (error: Error) => {
        clearTimeout(timeout);
        this.#events.off('state', handleState);
        this.#child = null;
        this.#trace(`Process error during startup: ${error.message}`);
        this.#setState({
          status: 'stopped',
          configPath: undefined,
          port: undefined,
          wsPort: undefined,
          presentationUrl: undefined,
          speakerUrl: undefined,
          wsUrl: undefined,
        });
        rejectPromise(new Error(this.#buildStartupError(
          `Failed to start GeekSlides dev server: ${error.message}`,
        )));
      });

      this.#events.on('state', handleState);
    });
  }

  stop(): void {
    this.#child?.kill('SIGTERM');
  }

  #attachStream(source: 'stdout' | 'stderr', stream: NodeJS.ReadableStream | null | undefined): void {
    if (!stream) {
      return;
    }

    let buffer = '';
    stream.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        this.#handleOutputLine(source, line);
      }
    });
  }

  #handleOutputLine(source: 'stdout' | 'stderr', line: string): void {
    this.#trace(`[${source}] ${line}`);

    const presentationMatch = /^ {2}Presentation:\s+(https?:\/\/\S+)/.exec(line);
    if (presentationMatch?.[1]) {
      const presentationUrl = presentationMatch[1];
      const parsed = new URL(presentationUrl);
      this.#setState({
        ...this.#state,
        status: 'running',
        presentationUrl,
        port: Number(parsed.port),
      });
      return;
    }

    const speakerMatch = /^ {2}Speaker view:\s+(https?:\/\/\S+)/.exec(line);
    if (speakerMatch?.[1]) {
      this.#setState({
        ...this.#state,
        speakerUrl: speakerMatch[1],
      });
      return;
    }

    const wsMatch = /^ {2}Sync server running on (ws:\/\/\S+)/.exec(line);
    if (wsMatch?.[1]) {
      const wsUrl = wsMatch[1];
      const parsed = new URL(wsUrl);
      this.#setState({
        ...this.#state,
        wsUrl,
        wsPort: Number(parsed.port),
      });
    }
  }

  #setState(state: ServerState): void {
    this.#state = state;
    this.#events.emit('state', state);
  }

  #trace(message: string): void {
    this.#output?.appendLine(message);
    this.#recentOutput.push(message);
    if (this.#recentOutput.length > 40) {
      this.#recentOutput.shift();
    }
  }

  #buildStartupError(summary: string): string {
    const tail = this.#recentOutput.length > 0
      ? `\n\nRecent output:\n${this.#recentOutput.slice(-12).join('\n')}`
      : '';
    return `${summary}${tail}`;
  }
}
