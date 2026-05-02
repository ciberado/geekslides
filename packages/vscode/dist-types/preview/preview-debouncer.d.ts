/**
 * Debounce wrapper for preview updates.
 *
 * Prevents excessive updates during rapid typing by delaying execution
 * until a quiet period (150ms by default).
 */
export interface DebouncerOptions {
    readonly delay?: number;
    readonly setTimeoutFn?: typeof setTimeout;
    readonly clearTimeoutFn?: typeof clearTimeout;
}
export declare class PreviewDebouncer<T extends unknown[]> {
    #private;
    constructor(fn: (...args: T) => void, options?: DebouncerOptions);
    /**
     * Schedule the function to run after the delay.
     * Cancels any previous pending call.
     */
    call(...args: T): void;
    /**
     * Cancel any pending execution.
     */
    cancel(): void;
    /**
     * Returns true if there's a pending execution.
     */
    get pending(): boolean;
}
//# sourceMappingURL=preview-debouncer.d.ts.map