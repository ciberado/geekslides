import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { resolveGeekSlidesCli, type CliCommand } from './cli-resolution.ts';

export interface ServerOutputSink {
  appendLine(message: string): void;
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

    const child = this.#spawnProcess(cli.command, args, {
      cwd: dirname(options.configPath),
      env: process.env,
      stdio: 'pipe',
    });

    this.#child = child;
    this.#setState({
      status: 'starting',
      configPath: options.configPath,
      port: undefined,
      wsPort: undefined,
      presentationUrl: undefined,
      speakerUrl: undefined,
      wsUrl: undefined,
    });

    this.#attachStream(child.stdout);
    this.#attachStream(child.stderr);

    return await new Promise<ServerState>((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        this.#events.off('state', handleState);
        rejectPromise(new Error('Timed out waiting for the GeekSlides dev server to start.'));
      }, 15_000);

      const handleState = (state: ServerState): void => {
        if (state.status === 'running') {
          clearTimeout(timeout);
          this.#events.off('state', handleState);
          resolvePromise(state);
        }
      };

      child.once('exit', () => {
        clearTimeout(timeout);
        this.#events.off('state', handleState);
        this.#child = null;
        this.#setState({
          status: 'stopped',
          configPath: undefined,
          port: undefined,
          wsPort: undefined,
          presentationUrl: undefined,
          speakerUrl: undefined,
          wsUrl: undefined,
        });
        rejectPromise(new Error('GeekSlides dev server exited before it finished starting.'));
      });

      this.#events.on('state', handleState);
    });
  }

  stop(): void {
    this.#child?.kill('SIGTERM');
  }

  #attachStream(stream: NodeJS.ReadableStream | null | undefined): void {
    if (!stream) {
      return;
    }

    let buffer = '';
    stream.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        this.#handleOutputLine(line);
      }
    });
  }

  #handleOutputLine(line: string): void {
    this.#output?.appendLine(line);

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
}
