export interface CliCommand {
    readonly command: string;
    readonly args: readonly string[];
}
interface ResolveCliOptions {
    readonly extensionRoot?: string;
    readonly pathExists?: (path: string) => boolean;
}
export declare function resolveGeekSlidesCli(workspaceRoot: string, options?: ResolveCliOptions): CliCommand;
export {};
//# sourceMappingURL=cli-resolution.d.ts.map