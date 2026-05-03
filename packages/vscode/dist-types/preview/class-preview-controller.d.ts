/**
 * Live preview controller for slide class changes.
 *
 * Watches text document changes in markdown files within GeekSlides decks,
 * extracts partial class names from slide markers, fuzzy matches to valid
 * classes, and sends preview updates via Yjs.
 */
import type { ClassEntry } from '../completion/class-registry.ts';
import type { YjsClient } from '../sync/yjs-client.ts';
export interface ClassPreviewControllerDeps {
    readonly yjsClient: YjsClient;
    readonly findDeckConfig: (documentPath: string) => string | null;
    readonly getSlideForLine: (line: number) => number | undefined;
    readonly refreshSlideMap: () => Promise<unknown>;
    readonly classRegistry: readonly ClassEntry[];
}
export declare class ClassPreviewController {
    #private;
    constructor(deps: ClassPreviewControllerDeps);
    start(): void;
    stop(): void;
}
//# sourceMappingURL=class-preview-controller.d.ts.map