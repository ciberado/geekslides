/**
 * GeekSlides v2 — Command System.
 *
 * Central registry for named commands. All input paths (keyboard, touch,
 * toolbar, palette) route through CommandSystem.execute().
 */

import { createLogger } from '../logging.ts';

const log = createLogger('commands');

export interface Command {
  readonly name: string;
  readonly label: string;
  readonly execute: (args?: string[]) => void;
  readonly category?: string;
  /** When true, this command requires arguments and cannot be bound to a key. */
  readonly hasArgs?: boolean;
  /** When false, this command is excluded from the keybinding panel (e.g. output-only commands). Defaults to true. */
  readonly bindable?: boolean;
}

export class CommandSystem {
  #commands = new Map<string, Command>();

  /**
   * Register a command.
   */
  register(command: Command): void {
    this.#commands.set(command.name, command);
  }

  /**
   * Unregister a command by name.
   */
  unregister(name: string): void {
    this.#commands.delete(name);
  }

  /**
   * Unregister all commands belonging to a specific category.
   */
  unregisterByCategory(category: string): void {
    for (const [name, cmd] of this.#commands) {
      if (cmd.category === category) {
        this.#commands.delete(name);
      }
    }
  }

  /**
   * Execute a command by name.
   */
  execute(name: string, args?: string[]): void {
    const cmd = this.#commands.get(name);
    if (!cmd) {
      log.warn({ name }, 'unknown command');
      return;
    }
    log.debug({ name, args }, 'command executed');
    cmd.execute(args);
  }

  /**
   * Search commands by label or name (case-insensitive).
   */
  search(query: string): Command[] {
    const q = query.toLowerCase();
    return this.all().filter(
      (cmd) => cmd.label.toLowerCase().includes(q) || cmd.name.toLowerCase().includes(q),
    );
  }

  /**
   * Return all registered commands.
   */
  all(): Command[] {
    return [...this.#commands.values()];
  }

  /**
   * Return all commands that can be bound to keys (no required arguments, bindable not false).
   */
  bindable(): Command[] {
    return this.all().filter((cmd) => !cmd.hasArgs && cmd.bindable !== false);
  }

  /**
   * Check whether a command with the given name is currently registered.
   */
  has(name: string): boolean {
    return this.#commands.has(name);
  }
}
