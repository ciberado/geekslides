export interface DeckMetadata {
    readonly configPath: string;
    readonly contentPath: string;
    readonly room: string;
}
export declare function findNearestDeckConfig(startPath: string | undefined, workspaceRoots: readonly string[], pathExists?: (path: string) => boolean): string | null;
export declare function loadDeckMetadata(configPath: string, readText?: (path: string, encoding: 'utf8') => Promise<string>): Promise<DeckMetadata>;
//# sourceMappingURL=deck-config.d.ts.map