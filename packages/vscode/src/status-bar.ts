export interface ServerStatusState {
  readonly status: 'stopped' | 'starting' | 'running';
  readonly port: number | undefined;
}

export interface StatusBarPresentation {
  readonly text: string;
  readonly tooltip: string;
  readonly command: 'geekslides.startServer' | 'geekslides.stopServer';
}

export function getStatusBarPresentation(state: ServerStatusState): StatusBarPresentation {
  if (state.status === 'running' && state.port !== undefined) {
    return {
      text: `$(server) GeekSlides: :${String(state.port)}`,
      tooltip: 'Stop the GeekSlides dev server',
      command: 'geekslides.stopServer',
    };
  }

  if (state.status === 'starting') {
    return {
      text: '$(loading~spin) GeekSlides: Starting',
      tooltip: 'GeekSlides dev server is starting',
      command: 'geekslides.stopServer',
    };
  }

  return {
    text: '$(server) GeekSlides: Stopped',
    tooltip: 'Start the GeekSlides dev server',
    command: 'geekslides.startServer',
  };
}
