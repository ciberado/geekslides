/**
 * GeekSlides v2 — Command System.
 *
 * Central registry for named commands. All input paths (keyboard, touch,
 * toolbar, palette) route through CommandSystem.execute().
 */

export interface Command {
  readonly name: string;
  readonly label: string;
  readonly execute: () => void;
  readonly category?: string;
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
   * Execute a command by name.
   */
  execute(name: string): void {
    const cmd = this.#commands.get(name);
    if (!cmd) {
      console.warn(`[geekslides] Unknown command: ${name}`);
      return;
    }
    cmd.execute();
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
}
