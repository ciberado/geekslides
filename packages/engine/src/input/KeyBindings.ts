/**
 * GeekSlides v2 — Key Bindings.
 *
 * Two-mode state machine: normal / terminal.
 * Navigation keys (arrows, space, etc.) are direct — no prefix needed.
 * Pressing `t` opens the terminal command prompt for all other actions.
 */

import type { CommandSystem } from './CommandSystem.ts';

type KeyMode = 'normal' | 'terminal';

const DIRECT_BINDINGS: Record<string, string> = {
  'ArrowRight': 'next',
  'ArrowDown': 'next',
  ' ': 'next',
  'PageDown': 'next',
  'ArrowLeft': 'prev',
  'ArrowUp': 'prev',
  'PageUp': 'prev',
  'Home': 'go-first',
  'End': 'go-last',
};

export class KeyBindings {
  #commandSystem: CommandSystem;
  #mode: KeyMode = 'normal';
  #target: EventTarget;
  #onTerminalOpen: (() => void) | null = null;

  constructor(commandSystem: CommandSystem, target: EventTarget = document) {
    this.#commandSystem = commandSystem;
    this.#target = target;
  }

  /**
   * Start listening for keyboard events.
   */
  activate(): void {
    this.#target.addEventListener('keydown', this.#handleKeydown);
  }

  /**
   * Stop listening for keyboard events.
   */
  deactivate(): void {
    this.#target.removeEventListener('keydown', this.#handleKeydown);
  }

  /**
   * Set callback for when terminal should open.
   */
  onTerminalOpen(callback: () => void): void {
    this.#onTerminalOpen = callback;
  }

  /**
   * Notify that terminal has closed — return to normal mode.
   */
  closeTerminal(): void {
    this.#mode = 'normal';
  }

  get mode(): KeyMode {
    return this.#mode;
  }

  #handleKeydown = (e: Event): void => {
    const event = e as KeyboardEvent;

    // In terminal mode, all keys go to the terminal prompt
    if (this.#mode === 'terminal') {
      return;
    }

    // Ignore events from input elements
    const target = event.target as HTMLElement | null;
    if (target && 'tagName' in target) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }
    }

    // Check for terminal activation
    if (event.key === 't') {
      event.preventDefault();
      this.#mode = 'terminal';
      this.#onTerminalOpen?.();
      this.#target.dispatchEvent(new CustomEvent('geek:terminal:open', { bubbles: true }));
      return;
    }

    // Direct navigation bindings
    const command = DIRECT_BINDINGS[event.key];
    if (command) {
      event.preventDefault();
      this.#commandSystem.execute(command);
    }
  };
}
