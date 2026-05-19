export interface ServerStatusState {
    readonly status: 'stopped' | 'starting' | 'running';
    readonly port: number | undefined;
}
export interface StatusBarPresentation {
    readonly text: string;
    readonly tooltip: string;
    readonly command: 'geekslides.startServer' | 'geekslides.stopServer';
}
export declare function getStatusBarPresentation(state: ServerStatusState): StatusBarPresentation;
//# sourceMappingURL=status-bar.d.ts.map