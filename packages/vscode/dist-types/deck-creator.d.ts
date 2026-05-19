import { type CliCommand } from './cli-resolution.ts';
type SpawnProcess = (command: string, args: readonly string[], options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: 'pipe';
}) => {
    readonly stdout?: NodeJS.ReadableStream | null;
    readonly stderr?: NodeJS.ReadableStream | null;
    on(event: 'error', listener: (error: Error) => void): void;
    on(event: 'exit', listener: (code: number | null) => void): void;
};
export declare function createDeck(workspaceRoot: string, targetDir: string, title: string, options?: {
    resolveCli?: (workspaceRoot: string) => CliCommand;
    spawnProcess?: SpawnProcess;
}): Promise<string>;
export {};
//# sourceMappingURL=deck-creator.d.ts.map