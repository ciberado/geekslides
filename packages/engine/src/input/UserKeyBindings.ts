/**
 * GeekSlides v2 — User Key Bindings.
 *
 * Manages user-configured keyboard shortcuts stored in localStorage.
 * Supports key combinations (Ctrl+K, Shift+F, etc.), cycling through
 * multiple commands on the same key, and export/import of configurations.
 */

import type { CommandSystem } from './CommandSystem.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('user-keybindings');

const STORAGE_KEY = 'geekslides:keybindings';

export interface KeyBindingEntry {
  /** Normalized key descriptor (e.g. "Ctrl+Shift+K") */
  readonly key: string;
  /** Command names bound to this key (cycled in order) */
  readonly commands: string[];
}

export type KeyBindingsConfig = Record<string, string[]>;

/**
 * Normalize a KeyboardEvent into a canonical key descriptor string.
 * Modifier order: Ctrl > Alt > Shift > Meta.
 */
export function normalizeKeyDescriptor(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey && event.key !== '?') parts.push('Shift');
  if (event.metaKey) parts.push('Meta');

  let key = event.key;
  // Normalize single-char keys to uppercase for consistency
  if (key.length === 1 && /[a-z]/.test(key)) {
    key = key.toUpperCase();
  }
  // Don't add modifier keys themselves
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return '';
  }
  parts.push(key);
  return parts.join('+');
}

/**
 * Parse a key descriptor string for display purposes.
 */
export function formatKeyForDisplay(key: string): string {
  return key
    .replace('Ctrl', '⌃')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace('Meta', '⌘')
    .replace(/\+/g, '');
}

export class UserKeyBindings {
  #config: KeyBindingsConfig = {};
  #cycleCursors = new Map<string, number>();
  #commandSystem: CommandSystem;

  constructor(commandSystem: CommandSystem) {
    this.#commandSystem = commandSystem;
    this.#load();
  }

  /**
   * Try to execute a user-bound command for the given key event.
   * Returns the executed command name, or null if no binding matched.
   */
  execute(event: KeyboardEvent): string | null {
    const key = normalizeKeyDescriptor(event);
    if (!key) return null;

    const commands = this.#config[key];
    if (!commands || commands.length === 0) return null;

    // Filter to only currently-registered commands
    const available = commands.filter((name) => this.#commandSystem.has(name));
    if (available.length === 0) return null;

    // Cycling logic
    const cursor = this.#cycleCursors.get(key) ?? 0;
    const index = cursor % available.length;
    const commandName = available[index] as string;

    // Advance cursor (wraps naturally via modulo on next press)
    this.#cycleCursors.set(key, cursor + 1);

    // Execute
    this.#commandSystem.execute(commandName);
    log.debug({ key, commandName, index }, 'user keybinding executed');
    return commandName;
  }

  /**
   * Check if a key descriptor has any user bindings.
   */
  has(key: string): boolean {
    const commands = this.#config[key];
    return commands !== undefined && commands.length > 0;
  }

  /**
   * Bind a command to a key. Appends to the cycle list if already bound.
   */
  bind(key: string, commandName: string): void {
    const existing = this.#config[key];
    if (existing) {
      if (!existing.includes(commandName)) {
        existing.push(commandName);
      }
    } else {
      this.#config[key] = [commandName];
    }
    this.#save();
    log.debug({ key, commandName }, 'binding added');
  }

  /**
   * Remove a specific command from a key's cycle list.
   * If no commandName given, removes all bindings for that key.
   */
  unbind(key: string, commandName?: string): void {
    if (!commandName) {
      delete this.#config[key];
    } else {
      const existing = this.#config[key];
      if (existing) {
        const filtered = existing.filter((n) => n !== commandName);
        if (filtered.length === 0) {
          delete this.#config[key];
        } else {
          this.#config[key] = filtered;
        }
      }
    }
    this.#cycleCursors.delete(key);
    this.#save();
    log.debug({ key, commandName }, 'binding removed');
  }

  /**
   * Get the full binding configuration.
   */
  getConfig(): KeyBindingsConfig {
    return { ...this.#config };
  }

  /**
   * Get all bindings as an array of entries, filtered to currently available commands.
   */
  getActiveBindings(): KeyBindingEntry[] {
    const entries: KeyBindingEntry[] = [];
    for (const [key, commands] of Object.entries(this.#config)) {
      const available = commands.filter((name) => this.#commandSystem.has(name));
      if (available.length > 0) {
        entries.push({ key, commands: available });
      }
    }
    return entries;
  }

  /**
   * Get the key bound to a specific command (first match).
   */
  getKeyForCommand(commandName: string): string | undefined {
    for (const [key, commands] of Object.entries(this.#config)) {
      if (commands.includes(commandName)) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Export configuration as a JSON string.
   */
  exportConfig(): string {
    return JSON.stringify(this.#config, null, 2);
  }

  /**
   * Import configuration from a JSON string. Merges with existing or replaces.
   */
  importConfig(json: string, replace = true): void {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Invalid keybindings config: must be an object');
      }
      const config = parsed as Record<string, unknown>;
      const validated: KeyBindingsConfig = {};
      for (const [key, value] of Object.entries(config)) {
        if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
          validated[key] = value as string[];
        }
      }
      if (replace) {
        this.#config = validated;
      } else {
        for (const [key, commands] of Object.entries(validated)) {
          const existing = this.#config[key] ?? [];
          for (const cmd of commands) {
            if (!existing.includes(cmd)) {
              existing.push(cmd);
            }
          }
          this.#config[key] = existing;
        }
      }
      this.#save();
      log.debug('config imported');
    } catch (err) {
      log.warn({ err }, 'failed to import keybindings config');
      throw err;
    }
  }

  #load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          this.#config = parsed as KeyBindingsConfig;
        }
      }
    } catch {
      log.warn('failed to load keybindings from localStorage');
    }
  }

  #save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#config));
    } catch {
      log.warn('failed to save keybindings to localStorage');
    }
  }
}
