import { describe, expect, it, vi } from 'vitest';
import { openCreatedDeckWorkspace } from '../src/workspace-opener.ts';

describe('openCreatedDeckWorkspace', () => {
  it('reuses the current window and opens the created deck folder', async () => {
    const targetFolder = { fsPath: '/repo/new-deck' } as const;
    const executeCommand = vi.fn().mockResolvedValue(undefined);

    await openCreatedDeckWorkspace(targetFolder as never, executeCommand);

    expect(executeCommand).toHaveBeenCalledWith(
      'vscode.openFolder',
      targetFolder,
      { forceReuseWindow: true },
    );
  });
});
