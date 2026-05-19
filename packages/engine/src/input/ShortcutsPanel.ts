/**
 * GeekSlides v2 — Shortcuts Panel.
 *
 * Interactive overlay panel that replaces the static help screen.
 * Shows navigation shortcuts (read-only) and user-configurable bindings
 * with key-capture mode, export/import, and live filtering.
 */

import type { CommandSystem, Command } from './CommandSystem.ts';
import type { UserKeyBindings } from './UserKeyBindings.ts';
import { normalizeKeyDescriptor } from './UserKeyBindings.ts';

export class ShortcutsPanel {
  #overlay: HTMLElement;
  #commandSystem: CommandSystem;
  #userBindings: UserKeyBindings;
  #capturingRow: HTMLElement | null = null;
  #capturingCommand: string | null = null;
  #keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    shadowRoot: ShadowRoot,
    commandSystem: CommandSystem,
    userBindings: UserKeyBindings,
  ) {
    this.#commandSystem = commandSystem;
    this.#userBindings = userBindings;

    this.#overlay = document.createElement('div');
    this.#overlay.classList.add('gs-shortcuts-overlay');
    this.#overlay.addEventListener('click', (e) => {
      if (e.target === this.#overlay) this.close();
    });
    this.#overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !this.#capturingRow) this.close();
    });

    shadowRoot.appendChild(this.#overlay);
  }

  get isOpen(): boolean {
    return this.#overlay.hasAttribute('open');
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.#render();
    this.#overlay.setAttribute('open', '');
  }

  close(): void {
    this.#cancelCapture();
    this.#overlay.removeAttribute('open');
  }

  #render(): void {
    const bindableCommands = this.#commandSystem.bindable()
      .filter((cmd) => cmd.category !== 'navigation');

    // Build cycle color map: keys with multiple commands get a shared color
    const cycleColorMap = this.#buildCycleColorMap();

    const panel = document.createElement('div');
    panel.classList.add('gs-shortcuts-panel');

    // Header
    const header = document.createElement('div');
    header.classList.add('gs-shortcuts-header');
    header.innerHTML = `
      <h2>Keyboard Shortcuts</h2>
      <p class="gs-shortcuts-subtitle">Press a key slot to assign a shortcut</p>
    `;
    panel.appendChild(header);

    // Navigation section (read-only)
    const navSection = document.createElement('section');
    navSection.innerHTML = `
      <h3 class="gs-shortcuts-section-title">Navigation</h3>
      <dl class="gs-shortcuts-dl">
        <dt>→ ↓ Space</dt><dd>Next slide / partial</dd>
        <dt>← ↑</dt><dd>Previous slide / partial</dd>
        <dt>Home</dt><dd>First slide</dd>
        <dt>End</dt><dd>Last slide</dd>
        <dt>Esc</dt><dd>Toggle command terminal</dd>
        <dt>?</dt><dd>Toggle this panel</dd>
      </dl>
    `;
    panel.appendChild(navSection);

    // Group bindable commands by category
    if (bindableCommands.length > 0) {
      const groups = new Map<string, typeof bindableCommands>();
      for (const cmd of bindableCommands) {
        const cat = cmd.category ?? 'other';
        const list = groups.get(cat);
        if (list) {
          list.push(cmd);
        } else {
          groups.set(cat, [cmd]);
        }
      }

      const customSection = document.createElement('section');
      const sectionTitle = document.createElement('h3');
      sectionTitle.classList.add('gs-shortcuts-section-title');
      sectionTitle.textContent = 'Custom Bindings';
      customSection.appendChild(sectionTitle);

      // Multi-column container
      const columnsContainer = document.createElement('div');
      columnsContainer.classList.add('gs-shortcuts-columns');

      for (const [category, cmds] of groups) {
        const group = document.createElement('div');
        group.classList.add('gs-shortcuts-group');

        const groupTitle = document.createElement('div');
        groupTitle.classList.add('gs-shortcuts-group-title');
        groupTitle.textContent = category;
        group.appendChild(groupTitle);

        const list = document.createElement('div');
        list.classList.add('gs-shortcuts-bindings');
        for (const cmd of cmds) {
          const row = this.#createBindingRow(cmd, cycleColorMap);
          list.appendChild(row);
        }
        group.appendChild(list);
        columnsContainer.appendChild(group);
      }

      customSection.appendChild(columnsContainer);
      panel.appendChild(customSection);
    }

    // Export/Import buttons
    const actions = document.createElement('div');
    actions.classList.add('gs-shortcuts-actions');

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.classList.add('gs-shortcuts-btn');
    exportBtn.textContent = '⬇ Export';
    exportBtn.addEventListener('click', () => this.#handleExport());

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.classList.add('gs-shortcuts-btn');
    importBtn.textContent = '⬆ Import';
    importBtn.addEventListener('click', () => this.#handleImport());

    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    panel.appendChild(actions);

    // Hint
    const hint = document.createElement('div');
    hint.classList.add('gs-shortcuts-hint');
    hint.innerHTML = 'Press <strong>?</strong> or <strong>Esc</strong> to close';
    panel.appendChild(hint);

    this.#overlay.textContent = '';
    this.#overlay.appendChild(panel);
  }

  #createBindingRow(cmd: Command, cycleColorMap: Map<string, string>): HTMLElement {
    const row = document.createElement('div');
    row.classList.add('gs-shortcuts-row');
    row.dataset.command = cmd.name;

    const label = document.createElement('span');
    label.classList.add('gs-shortcuts-row-label');
    label.textContent = cmd.label;

    const keySlot = document.createElement('button');
    keySlot.type = 'button';
    keySlot.classList.add('gs-shortcuts-row-key');
    const boundKey = this.#userBindings.getKeyForCommand(cmd.name);
    keySlot.textContent = boundKey ?? '—';
    if (!boundKey) {
      keySlot.classList.add('gs-shortcuts-row-key-empty');
    } else {
      // Apply cycle color if this key has multiple commands
      const color = cycleColorMap.get(cmd.name);
      if (color) {
        keySlot.style.borderColor = color;
        keySlot.style.background = `${color}18`;
        keySlot.style.color = color;
      }
    }

    keySlot.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#startCapture(row, cmd.name, keySlot);
    });

    // Remove button (only shown when bound)
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.classList.add('gs-shortcuts-row-remove');
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove binding';
    if (!boundKey) removeBtn.style.visibility = 'hidden';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (boundKey) {
        this.#userBindings.unbind(boundKey, cmd.name);
        this.#render();
      }
    });

    row.appendChild(label);
    row.appendChild(keySlot);
    row.appendChild(removeBtn);
    return row;
  }

  #startCapture(row: HTMLElement, commandName: string, keySlot: HTMLElement): void {
    this.#cancelCapture();
    this.#capturingRow = row;
    this.#capturingCommand = commandName;
    row.classList.add('gs-shortcuts-row-capturing');
    keySlot.textContent = '…';
    keySlot.classList.add('gs-shortcuts-row-key-capturing');

    this.#keydownHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        this.#cancelCapture();
        this.#render();
        return;
      }

      const descriptor = normalizeKeyDescriptor(e);
      if (!descriptor) return; // Just a modifier press

      // Remove previous binding for this command
      const oldKey = this.#userBindings.getKeyForCommand(commandName);
      if (oldKey) {
        this.#userBindings.unbind(oldKey, commandName);
      }

      // Bind new key
      this.#userBindings.bind(descriptor, commandName);
      this.#cancelCapture();
      this.#render();
    };

    document.addEventListener('keydown', this.#keydownHandler, true);
  }

  #cancelCapture(): void {
    if (this.#keydownHandler) {
      document.removeEventListener('keydown', this.#keydownHandler, true);
      this.#keydownHandler = null;
    }
    if (this.#capturingRow) {
      this.#capturingRow.classList.remove('gs-shortcuts-row-capturing');
      this.#capturingRow = null;
    }
    this.#capturingCommand = null;
  }

  #handleExport(): void {
    const json = this.#userBindings.exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geekslides-keybindings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  #handleImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.#userBindings.importConfig(reader.result as string, true);
          this.#render();
        } catch {
          // Silently ignore invalid files
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  /** Assign colors to commands that share a key (cycle groups). */
  #buildCycleColorMap(): Map<string, string> {
    const CYCLE_COLORS = [
      '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
      '#60a5fa', '#fb923c', '#2dd4bf', '#e879f9',
    ];
    const colorMap = new Map<string, string>();
    const activeBindings = this.#userBindings.getActiveBindings();
    let colorIndex = 0;

    for (const entry of activeBindings) {
      if (entry.commands.length > 1) {
        const color = CYCLE_COLORS[colorIndex % CYCLE_COLORS.length] as string;
        colorIndex++;
        for (const cmdName of entry.commands) {
          colorMap.set(cmdName, color);
        }
      }
    }
    return colorMap;
  }

  /**
   * Returns CSS for the shortcuts panel.
   */
  static styles(): string {
    return `
      .gs-shortcuts-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(6px);
        justify-content: center;
        align-items: center;
        font-family: system-ui, sans-serif;
        color: #e5eefb;
      }

      .gs-shortcuts-overlay[open] {
        display: flex;
      }

      .gs-shortcuts-panel {
        max-width: 820px;
        width: 92%;
        max-height: 85vh;
        overflow-y: auto;
        padding: 2rem 2.5rem;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.97);
        border: 1px solid rgba(148, 163, 184, 0.15);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      }

      .gs-shortcuts-header h2 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #f1f5f9;
      }

      .gs-shortcuts-subtitle {
        margin: 0.3rem 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .gs-shortcuts-section-title {
        margin: 1.5rem 0 0.8rem;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #7dd3fc;
      }

      .gs-shortcuts-dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.35rem 1.2rem;
        margin: 0;
        font-size: 0.9rem;
      }

      .gs-shortcuts-dl dt {
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        color: #8be9fd;
        text-align: right;
        font-size: 0.85rem;
      }

      .gs-shortcuts-dl dd {
        margin: 0;
        color: #94a3b8;
      }

      .gs-shortcuts-columns {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 0.5rem 1.5rem;
      }

      .gs-shortcuts-group {
        min-width: 0;
      }

      .gs-shortcuts-group-title {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #475569;
        padding: 6px 12px 4px;
        margin-bottom: 2px;
      }

      .gs-shortcuts-bindings {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .gs-shortcuts-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 12px;
        align-items: center;
        padding: 8px 12px;
        border-radius: 8px;
        transition: background 0.15s ease;
      }

      .gs-shortcuts-row:hover {
        background: rgba(148, 163, 184, 0.06);
      }

      .gs-shortcuts-row-capturing {
        background: rgba(125, 211, 252, 0.08) !important;
        outline: 1px solid rgba(125, 211, 252, 0.3);
      }

      .gs-shortcuts-row-label {
        font-size: 0.88rem;
        color: #cbd5e1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .gs-shortcuts-row-key {
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        font-size: 0.78rem;
        padding: 4px 10px;
        min-width: 48px;
        text-align: center;
        border-radius: 6px;
        background: rgba(125, 211, 252, 0.1);
        border: 1px solid rgba(125, 211, 252, 0.25);
        color: #7dd3fc;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gs-shortcuts-row-key:hover {
        background: rgba(125, 211, 252, 0.18);
        border-color: rgba(125, 211, 252, 0.4);
      }

      .gs-shortcuts-row-key-empty {
        color: #475569;
        border-color: rgba(71, 85, 105, 0.4);
        background: rgba(71, 85, 105, 0.08);
      }

      .gs-shortcuts-row-key-empty:hover {
        color: #64748b;
        border-color: rgba(100, 116, 139, 0.5);
        background: rgba(71, 85, 105, 0.15);
      }

      .gs-shortcuts-row-key-capturing {
        animation: gs-pulse 1s ease infinite;
        background: rgba(125, 211, 252, 0.2);
        color: #e5eefb;
      }

      @keyframes gs-pulse {
        0%, 100% { border-color: rgba(125, 211, 252, 0.5); }
        50% { border-color: rgba(125, 211, 252, 0.15); }
      }

      .gs-shortcuts-row-remove {
        background: transparent;
        border: none;
        color: #475569;
        font-size: 0.75rem;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .gs-shortcuts-row-remove:hover {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }

      .gs-shortcuts-actions {
        display: flex;
        gap: 8px;
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(148, 163, 184, 0.1);
      }

      .gs-shortcuts-btn {
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(148, 163, 184, 0.06);
        color: #94a3b8;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .gs-shortcuts-btn:hover {
        background: rgba(148, 163, 184, 0.12);
        color: #e5eefb;
        border-color: rgba(148, 163, 184, 0.3);
      }

      .gs-shortcuts-hint {
        margin-top: 1.2rem;
        text-align: center;
        font-size: 0.75rem;
        color: #475569;
      }

      .gs-shortcuts-hint strong {
        color: #64748b;
      }
    `;
  }
}
