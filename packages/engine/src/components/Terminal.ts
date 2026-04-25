/**
 * GeekSlides v2 — <geek-terminal> Web Component.
 *
 * Minimal command-line prompt anchored at the bottom of the viewport.
 * Toggled by pressing Escape, dismissed after command execution.
 * Supports tab-completion, command history, a `help` built-in, and drag-to-resize.
 */

import type { CommandSystem } from '../input/CommandSystem.ts';

export class Terminal extends HTMLElement {
  #commandSystem: CommandSystem | null = null;
  #history: string[] = [];
  #historyIndex = -1;
  #input: HTMLInputElement | null = null;
  #output: HTMLElement | null = null;
  #dragStartY = 0;
  #dragStartHeight = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.#render();
    this.style.display = 'none';
  }

  /**
   * Bind the command system for execution and tab-completion.
   */
  setCommandSystem(commandSystem: CommandSystem): void {
    this.#commandSystem = commandSystem;
    commandSystem.register({
      name: 'help',
      label: 'Show available commands',
      category: 'terminal',
      execute: () => { this.#showHelp(); },
    });
  }

  /**
   * Show the terminal and focus the input.
   */
  open(): void {
    this.style.display = 'block';
    this.#historyIndex = -1;

    if (this.#output) {
      this.#output.textContent = '';
    }
    if (this.#input) {
      this.#input.value = '';
      // Use setTimeout to ensure the element is visible before focusing
      setTimeout(() => this.#input?.focus(), 0);
    }
  }

  /**
   * Hide the terminal and dispatch close event.
   */
  close(): void {
    this.style.display = 'none';
    if (this.#input) {
      this.#input.value = '';
    }
    this.dispatchEvent(new CustomEvent('geek:terminal:close', { bubbles: true }));
  }

  /**
   * Toggle the terminal open or closed.
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  get isOpen(): boolean {
    return this.style.display !== 'none';
  }

  /**
   * Set the output message (for programmatic display of command results).
   * @param message The message to display (plain text or HTML)
   * @param isError Whether this is an error message (uses red color)
   */
  setOutput(message: string, isError: boolean = false, options?: { persist?: boolean }): void {
    if (!this.#output) return;
    const className = isError ? 'error' : 'success';
    this.#output.innerHTML = `<span class="${className}">${this.#escapeHtml(message)}</span>`;
    if (options?.persist && this.style.display === 'none') {
      this.style.display = 'block';
    }
  }

  /**
   * Set the output to a success message with an embedded clickable link.
   * Uses DOM manipulation (not innerHTML) so the URL cannot inject markup.
   */
  setOutputLink(prefix: string, linkUrl: string, options?: { persist?: boolean }): void {
    if (!this.#output) return;
    const span = document.createElement('span');
    span.className = 'success';
    span.appendChild(document.createTextNode(prefix));
    const anchor = document.createElement('a');
    anchor.href = linkUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = linkUrl;
    span.appendChild(anchor);
    this.#output.replaceChildren(span);
    if (options?.persist && this.style.display === 'none') {
      this.style.display = 'block';
    }
  }


  #render(): void {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 10000;
        font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
        font-size: 16px;
        min-height: 52px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .terminal {
        background: rgba(30, 30, 30, 0.92);
        backdrop-filter: blur(8px);
        padding: 8px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
      }

      .resize-handle {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        cursor: ns-resize;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .resize-handle::after {
        content: '';
        width: 40px;
        height: 3px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.25);
      }

      .resize-handle:hover::after {
        background: rgba(255, 255, 255, 0.5);
      }

      .prompt-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .prompt-char {
        color: #8be9fd;
        font-weight: bold;
        user-select: none;
      }

      input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #f8f8f2;
        font-family: inherit;
        font-size: inherit;
        caret-color: #8be9fd;
      }

      input::placeholder {
        color: rgba(248, 248, 242, 0.3);
      }

      .output {
        color: #a0a0a0;
        min-height: 0;
        flex: 1;
        overflow-y: auto;
        white-space: pre-wrap;
        line-height: 1.4;
      }

      .output:empty {
        display: none;
      }

      .output .cmd-name {
        color: #8be9fd;
      }

      .output .cmd-label {
        color: #f8f8f2;
      }

      .output .category {
        color: #ff79c6;
        font-weight: bold;
        margin-top: 4px;
      }

      .output .error {
        color: #ff5555;
      }

      .output .success {
        color: #50fa7b;
      }

      .output a {
        color: #8be9fd;
        text-decoration: underline;
        cursor: pointer;
        word-break: break-all;
      }
      .output a:hover {
        color: #cdfaff;
      }

      /* Mobile: larger targets */
      @media (max-width: 768px) {
        :host {
          font-size: 18px;
        }

        .terminal {
          padding: 12px 16px;
        }

        input {
          padding: 8px 0;
        }
      }
    `;

    const container = document.createElement('div');
    container.classList.add('terminal');

    const resizeHandle = document.createElement('div');
    resizeHandle.classList.add('resize-handle');
    resizeHandle.setAttribute('aria-hidden', 'true');
    resizeHandle.addEventListener('pointerdown', this.#onResizePointerdown);

    const promptRow = document.createElement('div');
    promptRow.classList.add('prompt-row');

    const promptChar = document.createElement('span');
    promptChar.classList.add('prompt-char');
    promptChar.textContent = '>';

    this.#input = document.createElement('input');
    this.#input.type = 'text';
    this.#input.placeholder = 'type a command (help for list)';
    this.#input.autocomplete = 'off';
    this.#input.spellcheck = false;
    this.#input.setAttribute('role', 'combobox');
    this.#input.setAttribute('aria-label', 'Command input');
    this.#input.setAttribute('aria-autocomplete', 'list');
    this.#input.addEventListener('keydown', this.#onInputKeydown);

    promptRow.appendChild(promptChar);
    promptRow.appendChild(this.#input);

    this.#output = document.createElement('div');
    this.#output.classList.add('output');

    container.appendChild(resizeHandle);
    container.appendChild(promptRow);
    container.appendChild(this.#output);

    shadow.replaceChildren(style, container);
  }

  #onResizePointerdown = (e: PointerEvent): void => {
    e.preventDefault();
    this.#dragStartY = e.clientY;
    this.#dragStartHeight = this.getBoundingClientRect().height;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', this.#onResizePointermove);
    handle.addEventListener('pointerup', this.#onResizePointerup, { once: true });
  };

  #onResizePointermove = (e: PointerEvent): void => {
    const delta = this.#dragStartY - e.clientY;
    const newHeight = Math.max(52, this.#dragStartHeight + delta);
    this.style.height = `${String(newHeight)}px`;
  };

  #onResizePointerup = (e: PointerEvent): void => {
    const handle = e.currentTarget as HTMLElement;
    handle.removeEventListener('pointermove', this.#onResizePointermove);
  };

  #onInputKeydown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this.#executeInput();
        break;
      case 'Tab':
        e.preventDefault();
        this.#tabComplete();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.#navigateHistory(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.#navigateHistory(1);
        break;
    }
  };

  #executeInput(): void {
    const input = this.#input;
    const output = this.#output;
    if (!input || !output || !this.#commandSystem) return;

    const raw = input.value.trim();
    if (!raw) {
      this.close();
      return;
    }

    // Add to history
    if (this.#history[this.#history.length - 1] !== raw) {
      this.#history.push(raw);
    }

    // Parse command and arguments
    const parts = raw.split(/\s+/);
    const cmdName = parts[0] ?? '';
    const args = parts.slice(1);

    // Look up command
    const cmd = this.#commandSystem.all().find((c) => c.name === cmdName);
    if (cmd) {
      // Clear output before executing, so we know if the command sets it
      output.innerHTML = '';
      cmd.execute(args);
      // Help output needs time to read — don't auto-dismiss
      if (cmdName === 'help') {
        input.value = '';
        return;
      }
      // Only print default message if output wasn't set by the command
      if (!output.innerHTML) {
        output.innerHTML = `<span class="success">${cmdName}: done</span>`;
      }
    } else {
      output.innerHTML = `<span class="error">unknown command: ${this.#escapeHtml(cmdName)}</span>`;
    }

    input.value = '';
  }

  #showHelp(): void {
    const output = this.#output;
    if (!output || !this.#commandSystem) return;

    const commands = this.#commandSystem.all();

    // Group by category
    const groups = new Map<string, typeof commands>();
    for (const cmd of commands) {
      const cat = cmd.category ?? 'general';
      const list = groups.get(cat) ?? [];
      list.push(cmd);
      groups.set(cat, list);
    }

    let html = '';
    for (const [category, cmds] of groups) {
      html += `<div class="category">${this.#escapeHtml(category)}</div>`;
      for (const cmd of cmds) {
        html += `  <span class="cmd-name">${this.#escapeHtml(cmd.name)}</span>`;
        html += `  <span class="cmd-label">— ${this.#escapeHtml(cmd.label)}</span>\n`;
      }
    }

    output.innerHTML = html;
  }

  #tabComplete(): void {
    const input = this.#input;
    if (!input || !this.#commandSystem) return;

    const partial = input.value.trim().toLowerCase();
    if (!partial) return;

    const matches = this.#commandSystem.all()
      .filter((c) => c.name.startsWith(partial))
      .map((c) => c.name);

    if (matches.length === 1) {
      input.value = matches[0] ?? '';
    } else if (matches.length > 1 && this.#output) {
      this.#output.textContent = matches.join('  ');
    }
  }

  #navigateHistory(direction: number): void {
    const input = this.#input;
    if (!input || this.#history.length === 0) return;

    if (this.#historyIndex === -1) {
      this.#historyIndex = this.#history.length;
    }

    this.#historyIndex += direction;
    this.#historyIndex = Math.max(0, Math.min(this.#historyIndex, this.#history.length));

    if (this.#historyIndex === this.#history.length) {
      input.value = '';
    } else {
      input.value = this.#history[this.#historyIndex] ?? '';
    }
  }

  #escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
