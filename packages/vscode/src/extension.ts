import { dirname } from 'node:path';
import * as vscode from 'vscode';
import { openDeckInBrowser } from './browser-opener.ts';
import { createDeck } from './deck-creator.ts';
import { findNearestDeckConfig, loadDeckMetadata } from './deck-config.ts';
import { ServerManager } from './server-manager.ts';
import { getStatusBarPresentation } from './status-bar.ts';
import { CursorSyncController } from './sync/cursor-sync.ts';
import { SlideMapClient } from './sync/slide-map-client.ts';
import { YjsClient } from './sync/yjs-client.ts';

function getWorkspaceRoots(): string[] {
  return vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
}

function resolveActiveDeckConfig(): string {
  const activePath = vscode.window.activeTextEditor?.document.uri.fsPath;
  const configPath = findNearestDeckConfig(activePath, getWorkspaceRoots());
  if (!configPath) {
    throw new Error('No GeekSlides config.json found in the active workspace.');
  }
  return configPath;
}

function getSettings(): { debounceMs: number; autoStartServer: boolean; defaultPort: number; wsPort: number } {
  const config = vscode.workspace.getConfiguration('geekslides');
  return {
    debounceMs: config.get('debounceMs', 300),
    autoStartServer: config.get('autoStartServer', false),
    defaultPort: config.get('defaultPort', 5173),
    wsPort: config.get('wsPort', 1234),
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('GeekSlides');
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  const serverManager = new ServerManager({
    output: {
      appendLine: (message) => {
        output.appendLine(message);
      },
    },
  });
  let cursorSync: CursorSyncController | null = null;
  let selectionDisposable: vscode.Disposable | null = null;
  let yjsClient: YjsClient | null = null;

  const updateStatusBar = (): void => {
    const presentation = getStatusBarPresentation(serverManager.getState());
    statusBar.text = presentation.text;
    statusBar.tooltip = presentation.tooltip;
    statusBar.command = presentation.command;
    statusBar.show();
  };

  const disposeCursorSync = (): void => {
    selectionDisposable?.dispose();
    selectionDisposable = null;
    cursorSync?.stop();
    cursorSync = null;
    yjsClient?.disconnect();
    yjsClient = null;
  };

  const enableCursorSync = async (configPath: string): Promise<void> => {
    disposeCursorSync();

    const metadata = await loadDeckMetadata(configPath);
    const state = serverManager.getState();
    if (!state.presentationUrl) {
      return;
    }

    const slideMapClient = new SlideMapClient();
    yjsClient = new YjsClient();
    yjsClient.connect(state.wsUrl ?? `ws://localhost:${String(getSettings().wsPort)}`, metadata.room);

    const baseUrl = new URL(state.presentationUrl).origin;
    cursorSync = new CursorSyncController({
      deckContentPath: metadata.contentPath,
      debounceMs: getSettings().debounceMs,
      refreshSlideMap: async () => {
        await slideMapClient.refresh(baseUrl);
      },
      getSlideForLine: (line) => slideMapClient.getSlideForLine(line),
      getLineForSlide: (slideIndex) => slideMapClient.getLineForSlide(slideIndex),
      setSlide: (slideIndex, partial) => {
        yjsClient?.setSlide(slideIndex, partial);
      },
      onRemoteSlideChange: (listener) => yjsClient?.onSlideChange((slideIndex) => {
        listener(slideIndex);
      }) ?? (() => {}),
      moveCursorToLine: (line) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.fsPath !== metadata.contentPath) {
          return;
        }
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      },
    });
    cursorSync.start();

    selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      const line = event.selections[0]?.active.line;
      if (line !== undefined) {
        cursorSync?.onSelectionChange(event.textEditor.document.uri.fsPath, line);
      }
    });
  };

  const startServerCommand = vscode.commands.registerCommand('geekslides.startServer', async () => {
    try {
      const configPath = resolveActiveDeckConfig();
      const workspaceRoot = dirname(configPath);
      const settings = getSettings();
      await serverManager.start({
        workspaceRoot,
        configPath,
        port: settings.defaultPort,
        wsPort: settings.wsPort,
      });
      await enableCursorSync(configPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(message);
    }
  });

  const stopServerCommand = vscode.commands.registerCommand('geekslides.stopServer', () => {
    serverManager.stop();
    disposeCursorSync();
  });

  const openInBrowserCommand = vscode.commands.registerCommand('geekslides.openInBrowser', async () => {
    const opened = await openDeckInBrowser(
      serverManager.getState().presentationUrl,
      async (url) => await vscode.env.openExternal(vscode.Uri.parse(url)),
    );
    if (!opened) {
      void vscode.window.showErrorMessage('GeekSlides dev server is not running.');
    }
  });

  const createDeckCommand = vscode.commands.registerCommand('geekslides.createDeck', async () => {
    const title = await vscode.window.showInputBox({
      prompt: 'Deck title',
      placeHolder: 'My GeekSlides Deck',
    });
    if (!title) {
      return;
    }

    const folderSelection = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Create Deck Here',
    });
    const targetDir = folderSelection?.[0]?.fsPath;
    if (!targetDir) {
      return;
    }

    try {
      const workspaceRoot = getWorkspaceRoots()[0] ?? targetDir;
      const readmePath = await createDeck(workspaceRoot, targetDir, title);
      const document = await vscode.workspace.openTextDocument(readmePath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(message);
    }
  });

  const toggleCursorSyncCommand = vscode.commands.registerCommand('geekslides.toggleCursorSync', () => {
    if (!cursorSync) {
      void vscode.window.showInformationMessage('Start the GeekSlides dev server first.');
      return;
    }

    const enabled = cursorSync.toggle();
    void vscode.window.showInformationMessage(
      enabled ? 'GeekSlides cursor sync enabled.' : 'GeekSlides cursor sync disabled.',
    );
  });

  const unsubscribeState = serverManager.onStateChange(() => {
    updateStatusBar();
  });

  context.subscriptions.push(
    output,
    statusBar,
    startServerCommand,
    stopServerCommand,
    openInBrowserCommand,
    createDeckCommand,
    toggleCursorSyncCommand,
    new vscode.Disposable(() => {
      unsubscribeState();
    }),
    new vscode.Disposable(() => {
      disposeCursorSync();
    }),
  );

  updateStatusBar();

  if (getSettings().autoStartServer) {
    void vscode.commands.executeCommand('geekslides.startServer');
  }
}

export function deactivate(): void {}
