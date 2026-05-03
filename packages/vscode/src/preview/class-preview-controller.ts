/**
 * Live preview controller for slide class changes.
 *
 * Watches text document changes in markdown files within GeekSlides decks,
 * extracts partial class names from slide markers, fuzzy matches to valid
 * classes, and sends preview updates via Yjs.
 */

import * as vscode from 'vscode';
import type { ClassEntry } from '../completion/class-registry.ts';
import { getMarkerContext } from '../completion/slide-marker-context.ts';
import type { YjsClient } from '../sync/yjs-client.ts';
import { fuzzyMatchClass } from './fuzzy-matcher.ts';
import { PreviewDebouncer } from './preview-debouncer.ts';

export interface ClassPreviewControllerDeps {
  readonly yjsClient: YjsClient;
  readonly findDeckConfig: (documentPath: string) => string | null;
  readonly getSlideForLine: (line: number) => number | undefined;
  readonly refreshSlideMap: () => Promise<unknown>;
  readonly classRegistry: readonly ClassEntry[];
}

export class ClassPreviewController {
  readonly #deps: ClassPreviewControllerDeps;
  readonly #validClassNames: readonly string[];
  readonly #sendPreview: PreviewDebouncer<[slideIndex: number, className: string]>;
  readonly #sendClear: PreviewDebouncer<[]>;
  #disposables: vscode.Disposable[] = [];
  #lastPreviewSlide: number | null = null;
  #lastPreviewClass: string | null = null;

  constructor(deps: ClassPreviewControllerDeps) {
    this.#deps = deps;
    this.#validClassNames = deps.classRegistry
      .filter((c) => c.category === 'layout' || c.category === 'modifier')
      .map((c) => c.name);

    this.#sendPreview = new PreviewDebouncer((slideIndex: number, className: string) => {
      deps.yjsClient.setPreview(slideIndex, className);
      this.#lastPreviewSlide = slideIndex;
      this.#lastPreviewClass = className;
    });

    this.#sendClear = new PreviewDebouncer(() => {
      deps.yjsClient.clearPreview();
      this.#lastPreviewSlide = null;
      this.#lastPreviewClass = null;
    });
  }

  start(): void {
    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      this.#handleTextChange(event);
    });
    this.#disposables.push(disposable);

    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      this.#handleSelectionChange(event);
    });
    this.#disposables.push(selectionDisposable);
  }

  stop(): void {
    for (const disposable of this.#disposables) {
      disposable.dispose();
    }
    this.#disposables = [];
    this.#sendPreview.cancel();
    this.#sendClear.cancel();
  }

  #handleTextChange(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;

    // Only process markdown files
    if (document.languageId !== 'markdown') {
      return;
    }

    // Only process files within a deck
    const configPath = this.#deps.findDeckConfig(document.uri.fsPath);
    if (!configPath) {
      return;
    }

    // Get active editor and cursor position
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    const position = editor.selection.active;
    const line = position.line;
    const lineText = document.lineAt(line).text;

    // Extract partial class from cursor position
    const ctx = getMarkerContext(lineText, position.character);

    if (ctx.kind !== 'class') {
      // Cursor not in class context — clear any active preview
      if (this.#lastPreviewSlide !== null) {
        this.#sendClear.call();
      }
      return;
    }

    // Filter to layout-* and mod-* prefixes only
    if (!ctx.prefix.startsWith('layout-') && !ctx.prefix.startsWith('mod-')) {
      if (this.#lastPreviewSlide !== null) {
        this.#sendClear.call();
      }
      return;
    }

    // Fuzzy match to valid class
    const matchedClass = fuzzyMatchClass(ctx.prefix, this.#validClassNames);
    if (!matchedClass) {
      // No good match — clear preview
      if (this.#lastPreviewSlide !== null) {
        this.#sendClear.call();
      }
      return;
    }

    // Refresh slide map and determine slide index from cursor line
    void this.#deps.refreshSlideMap().then(() => {
      const slideIndex = this.#deps.getSlideForLine(line);
      if (slideIndex === undefined) {
        // Can't determine slide — clear preview
        if (this.#lastPreviewSlide !== null) {
          this.#sendClear.call();
        }
        return;
      }

      // Send preview update (debounced)
      // Skip if same as last preview to avoid redundant updates
      if (slideIndex !== this.#lastPreviewSlide || matchedClass !== this.#lastPreviewClass) {
        this.#sendPreview.call(slideIndex, matchedClass);
      }
    });
  }

  #handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    const document = event.textEditor.document;

    // Only process markdown files in decks
    if (document.languageId !== 'markdown') {
      return;
    }

    const configPath = this.#deps.findDeckConfig(document.uri.fsPath);
    if (!configPath) {
      return;
    }

    const position = event.selections[0]?.active;
    if (!position) {
      return;
    }

    const lineText = document.lineAt(position.line).text;
    const ctx = getMarkerContext(lineText, position.character);

    // If cursor moved outside class context, clear preview
    if (ctx.kind !== 'class') {
      if (this.#lastPreviewSlide !== null) {
        this.#sendClear.call();
      }
    }
  }
}
