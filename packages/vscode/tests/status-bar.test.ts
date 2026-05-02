import { describe, expect, it } from 'vitest';
import { getStatusBarPresentation } from '../src/status-bar.ts';

describe('status bar presentation', () => {
  it('renders stopped state', () => {
    expect(getStatusBarPresentation({ status: 'stopped' })).toEqual({
      text: '$(server) GeekSlides: Stopped',
      tooltip: 'Start the GeekSlides dev server',
      command: 'geekslides.startServer',
    });
  });

  it('renders running state with port', () => {
    expect(getStatusBarPresentation({ status: 'running', port: 5173 })).toEqual({
      text: '$(server) GeekSlides: :5173',
      tooltip: 'Stop the GeekSlides dev server',
      command: 'geekslides.stopServer',
    });
  });
});
