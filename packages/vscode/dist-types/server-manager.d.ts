import { EventEmitter } from 'node:events';
import { type CliCommand } from './cli-resolution.ts';
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
type SpawnProcess = (command: string, args: readonly string[], options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: 'pipe';
}) => ChildProcessLike;
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
export declare class ServerManager {
    #private;
    constructor(options?: {
        spawnProcess?: SpawnProcess;
        resolveCli?: (workspaceRoot: string) => CliCommand;
        output?: ServerOutputSink;
    });
    getState(): ServerState;
    onStateChange(listener: (state: ServerState) => void): () => void;
    start(options: StartServerOptions): Promise<ServerState>;
    stop(): void;
}
export {};
//# sourceMappingURL=server-manager.d.ts.map