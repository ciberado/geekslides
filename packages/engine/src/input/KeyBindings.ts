/**
 * GeekSlides v2 — Key Bindings.
 *
 * Two-mode state machine: normal / terminal.
 * Navigation keys (arrows, space, etc.) are direct — no prefix needed.
 * Pressing `Escape` toggles the terminal command prompt for all other actions.
 * User-configured bindings are checked after direct bindings and support cycling.
 */

import type { CommandSystem } from './CommandSystem.ts';
import type { UserKeyBindings } from './UserKeyBindings.ts';
import type { KeybindingNotification } from './KeybindingNotification.ts';
import { normalizeKeyDescriptor } from './UserKeyBindings.ts';

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

/** Keys that cannot be rebound by users. */
const RESERVED_KEYS = new Set([
  'ArrowRight', 'ArrowDown', ' ', 'PageDown',
  'ArrowLeft', 'ArrowUp', 'PageUp',
  'Home', 'End', 'Escape', '?',
]);

export class KeyBindings {
  #commandSystem: CommandSystem;
  #userBindings: UserKeyBindings | null = null;
  #notification: KeybindingNotification | null = null;
  #panelIsOpen: (() => boolean) | null = null;
  #mode: KeyMode = 'normal';
  #target: EventTarget;
  #onTerminalToggle: (() => void) | null = null;
  #onShortcutsToggle: (() => void) | null = null;

  constructor(commandSystem: CommandSystem, target: EventTarget = document) {
    this.#commandSystem = commandSystem;
    this.#target = target;
  }

  /**
   * Set the user key bindings manager for custom shortcuts.
   */
  setUserBindings(userBindings: UserKeyBindings): void {
    this.#userBindings = userBindings;
  }

  /**
   * Set the notification component for showing command feedback.
   */
  setNotification(notification: KeybindingNotification): void {
    this.#notification = notification;
  }

  /**
   * Set a function that returns whether the shortcuts panel is currently open.
   */
  setPanelIsOpen(fn: () => boolean): void {
    this.#panelIsOpen = fn;
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
   * Set callback for when terminal should toggle open/closed.
   */
  onTerminalToggle(callback: () => void): void {
    this.#onTerminalToggle = callback;
  }

  /**
   * Set callback for when shortcuts overlay should toggle.
   */
  onShortcutsToggle(callback: () => void): void {
    this.#onShortcutsToggle = callback;
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

    // Escape: close panel if open, otherwise toggle terminal
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.#panelIsOpen?.()) {
        this.#onShortcutsToggle?.();
        return;
      }
      this.#mode = this.#mode === 'terminal' ? 'normal' : 'terminal';
      this.#onTerminalToggle?.();
      return;
    }

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

    // Check for shortcuts overlay toggle
    if (event.key === '?') {
      event.preventDefault();
      this.#onShortcutsToggle?.();
      return;
    }

    // Direct navigation bindings (reserved, not rebindable)
    const directCommand = DIRECT_BINDINGS[event.key];
    if (directCommand && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      this.#commandSystem.execute(directCommand);
      return;
    }

    // User-configured bindings
    if (this.#userBindings) {
      const executedName = this.#userBindings.execute(event);
      if (executedName) {
        event.preventDefault();
        if (this.#notification) {
          const cmd = this.#commandSystem.all().find((c) => c.name === executedName);
          const label = cmd?.label ?? executedName;
          const keyDesc = normalizeKeyDescriptor(event);
          this.#notification.show(label, keyDesc);
        }
      }
    }
  };
}

