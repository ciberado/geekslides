/**
 * VS Code CompletionItemProvider for GeekSlides slide markers.
 *
 * Offers context-aware completions inside `[]()` empty-link syntax in
 * markdown files that belong to a GeekSlides deck (detected by config.json).
 */

import * as vscode from 'vscode';
import { BUILTIN_CLASSES, type ClassEntry } from './class-registry.ts';
import { extractClassesFromDeck } from './css-class-extractor.ts';
import { getMarkerContext } from './slide-marker-context.ts';
import { scanSlideIds } from './slide-id-helper.ts';

export interface SlideClassProviderDeps {
  readonly findDeckConfig: (documentPath: string) => string | null;
}

export class SlideClassCompletionProvider implements vscode.CompletionItemProvider {
  readonly #deps: SlideClassProviderDeps;
  readonly #builtinNames: ReadonlySet<string>;

  constructor(deps: SlideClassProviderDeps) {
    this.#deps = deps;
    this.#builtinNames = new Set(BUILTIN_CLASSES.map((c) => c.name));
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | undefined> {
    const configPath = this.#deps.findDeckConfig(document.uri.fsPath);
    if (!configPath) {
      return undefined;
    }

    const lineText = document.lineAt(position.line).text;
    const ctx = getMarkerContext(lineText, position.character);

    switch (ctx.kind) {
      case 'none':
        return undefined;
      case 'class':
        return await this.#completeClasses(ctx.prefix, configPath);
      case 'function':
        return this.#completeFunctions(ctx.prefix);
      case 'id':
        return this.#completeIds(ctx.prefix, document);
    }

    return undefined;
  }

  async #completeClasses(prefix: string, configPath: string): Promise<vscode.CompletionItem[]> {
    const allClasses = [...BUILTIN_CLASSES];

    try {
      const deckClasses = await extractClassesFromDeck(configPath, this.#builtinNames);
      allClasses.push(...deckClasses);
    } catch {
      // Deck CSS parsing failed — fall back to built-in only
    }

    return allClasses
      .filter((entry) => entry.category !== 'function')
      .filter((entry) => entry.name.startsWith(prefix))
      .map((entry, index) => this.#toCompletionItem(entry, index));
  }

  #completeFunctions(prefix: string): vscode.CompletionItem[] {
    return BUILTIN_CLASSES
      .filter((entry) => entry.category === 'function')
      .filter((entry) => entry.name.startsWith(prefix))
      .map((entry, index) => this.#toCompletionItem(entry, index));
  }

  #completeIds(prefix: string, document: vscode.TextDocument): vscode.CompletionItem[] {
    const scan = scanSlideIds(document.getText());
    const items: vscode.CompletionItem[] = [];

    // Show existing IDs as reference (with warning if duplicate)
    const shownIds = new Set<string>();
    for (const id of scan.ids) {
      if (shownIds.has(id)) continue;
      shownIds.add(id);

      if (!id.startsWith(prefix)) continue;

      const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Reference);
      if (scan.duplicates.has(id)) {
        item.detail = '⚠ Duplicate ID';
        item.documentation = new vscode.MarkdownString(
          `The ID \`${id}\` is already used on another slide. Choose a unique ID.`,
        );
      } else {
        item.detail = 'Existing slide ID';
      }
      items.push(item);
    }

    return items;
  }

  #toCompletionItem(entry: ClassEntry, sortIndex: number): vscode.CompletionItem {
    const kind = entry.category === 'function'
      ? vscode.CompletionItemKind.Function
      : vscode.CompletionItemKind.Value;

    const item = new vscode.CompletionItem(entry.name, kind);
    item.detail = entry.detail;
    item.documentation = new vscode.MarkdownString(entry.documentation);
    item.sortText = String(sortIndex).padStart(3, '0');

    if (entry.insertText) {
      item.insertText = new vscode.SnippetString(entry.insertText);
    }

    return item;
  }
}
