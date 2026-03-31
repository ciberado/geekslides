/**
 * GeekSlides v2 — Key Bindings.
 *
 * Three-mode state machine: normal → prefix → palette.
 * Navigation keys (arrows, space, etc.) are direct — no prefix needed.
 * Non-navigation commands use Ctrl+B prefix (tmux-style).
 */

import type { CommandSystem } from './CommandSystem.ts';

type KeyMode = 'normal' | 'prefix' | 'palette';

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

const PREFIX_BINDINGS: Record<string, string> = {
  's': 'toggle-speaker',
  'o': 'toggle-overview',
  'w': 'toggle-whiteboard',
  'c': 'clear-whiteboard',
  'f': 'toggle-fullscreen',
  'y': 'toggle-sync',
  'p': 'toggle-follow',
  't': 'toggle-toolbar',
  'g': 'go-to-slide',
  '?': 'show-help',
};

const PREFIX_TIMEOUT_MS = 1500;

export class KeyBindings {
  #commandSystem: CommandSystem;
  #mode: KeyMode = 'normal';
  #prefixTimer: ReturnType<typeof setTimeout> | null = null;
  #target: EventTarget;
  #onPaletteOpen: (() => void) | null = null;

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
   * Set callback for when palette mode is entered.
   */
  onPaletteOpen(callback: () => void): void {
    this.#onPaletteOpen = callback;
  }

  /**
   * Notify that palette mode has closed.
   */
  closePalette(): void {
    this.#mode = 'normal';
  }

  get mode(): KeyMode {
    return this.#mode;
  }

  #handleKeydown = (e: Event): void => {
    const event = e as KeyboardEvent;

    // Ignore events from input elements
    const target = event.target as HTMLElement | null;
    if (target && 'tagName' in target) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }
    }

    switch (this.#mode) {
      case 'normal':
        this.#handleNormal(event);
        break;
      case 'prefix':
        this.#handlePrefix(event);
        break;
      case 'palette':
        // Palette handles its own keys
        break;
    }
  };

  #handleNormal(event: KeyboardEvent): void {
    // Check for Ctrl+B prefix activation
    if (event.ctrlKey && event.key === 'b') {
      event.preventDefault();
      this.#enterPrefix();
      return;
    }

    // Check for palette activation
    if (event.key === ':') {
      event.preventDefault();
      this.#mode = 'palette';
      this.#onPaletteOpen?.();
      return;
    }

    // Direct navigation bindings
    const command = DIRECT_BINDINGS[event.key];
    if (command) {
      event.preventDefault();
      this.#commandSystem.execute(command);
    }
  }

  #handlePrefix(event: KeyboardEvent): void {
    event.preventDefault();
    this.#clearPrefixTimer();

    const command = PREFIX_BINDINGS[event.key];
    if (command) {
      this.#commandSystem.execute(command);
    }

    this.#exitPrefix();
  }

  #enterPrefix(): void {
    this.#mode = 'prefix';
    this.#prefixTimer = setTimeout(() => {
      this.#exitPrefix();
    }, PREFIX_TIMEOUT_MS);

    this.#target.dispatchEvent(new CustomEvent('geek:prefix:active', { bubbles: true }));
  }

  #exitPrefix(): void {
    this.#clearPrefixTimer();
    this.#mode = 'normal';
    this.#target.dispatchEvent(new CustomEvent('geek:prefix:inactive', { bubbles: true }));
  }

  #clearPrefixTimer(): void {
    if (this.#prefixTimer !== null) {
      clearTimeout(this.#prefixTimer);
      this.#prefixTimer = null;
    }
  }
}
