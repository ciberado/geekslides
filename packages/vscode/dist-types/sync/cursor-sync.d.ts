export interface CursorSyncDependencies {
    readonly deckContentPath: string;
    readonly debounceMs: number;
    readonly refreshSlideMap: () => Promise<unknown>;
    readonly getSlideForLine: (line: number) => number | undefined;
    readonly getLineForSlide: (slideIndex: number) => number | undefined;
    readonly setSlide: (slideIndex: number, partial?: number) => void;
    readonly onRemoteSlideChange: (listener: (slideIndex: number) => void) => () => void;
    readonly moveCursorToLine: (line: number) => void;
    readonly now?: () => number;
    readonly setTimeoutFn?: typeof setTimeout;
    readonly clearTimeoutFn?: typeof clearTimeout;
}
export declare class CursorSyncController {
    #private;
    constructor(deps: CursorSyncDependencies);
    start(): void;
    stop(): void;
    toggle(): boolean;
    onSelectionChange(documentPath: string, line: number): void;
}
//# sourceMappingURL=cursor-sync.d.ts.map