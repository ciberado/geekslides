export interface SlideMapEntry {
    readonly slideIndex: number;
    readonly sourceLineStart: number;
    readonly sourceLineEnd: number;
    readonly id: string;
}
export declare class SlideMapClient {
    #private;
    constructor(fetchImpl?: typeof fetch);
    get entries(): readonly SlideMapEntry[];
    refresh(baseUrl: string): Promise<readonly SlideMapEntry[]>;
    getSlideForLine(line: number): number | undefined;
    getLineForSlide(slideIndex: number): number | undefined;
}
//# sourceMappingURL=slide-map-client.d.ts.map