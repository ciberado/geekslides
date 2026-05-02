import * as Y from 'yjs';
interface ProviderLike {
    destroy(): void;
}
type ProviderFactory = (serverUrl: string, room: string, doc: Y.Doc) => ProviderLike;
export declare class YjsClient {
    #private;
    constructor(options?: {
        doc?: Y.Doc;
        providerFactory?: ProviderFactory;
    });
    connect(serverUrl: string, room: string): void;
    disconnect(): void;
    setSlide(slide: number, partial?: number): void;
    setPreview(slideIndex: number, className: string): void;
    clearPreview(): void;
    onSlideChange(listener: (slide: number, partial: number) => void): () => void;
}
export {};
//# sourceMappingURL=yjs-client.d.ts.map