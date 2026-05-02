/**
 * VS Code CompletionItemProvider for GeekSlides slide markers.
 *
 * Offers context-aware completions inside `[]()` empty-link syntax in
 * markdown files that belong to a GeekSlides deck (detected by config.json).
 */
import * as vscode from 'vscode';
export interface SlideClassProviderDeps {
    readonly findDeckConfig: (documentPath: string) => string | null;
}
export declare class SlideClassCompletionProvider implements vscode.CompletionItemProvider {
    #private;
    constructor(deps: SlideClassProviderDeps);
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[] | undefined>;
}
//# sourceMappingURL=slide-class-provider.d.ts.map