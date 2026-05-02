export async function openCreatedDeckWorkspace(
  targetFolder: { readonly fsPath: string },
  executeCommand: (
    command: string,
    ...args: unknown[]
  ) => PromiseLike<unknown>,
): Promise<void> {
  await executeCommand('vscode.openFolder', targetFolder, { forceReuseWindow: true });
}
