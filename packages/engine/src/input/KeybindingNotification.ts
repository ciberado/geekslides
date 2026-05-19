/**
 * GeekSlides v2 — Keybinding Notification.
 *
 * A subtle top-right toast that appears for ~2.5 seconds when a command
 * is executed via a keyboard shortcut, so the user understands the effect.
 */

const DISPLAY_DURATION_MS = 2500;
const ANIMATION_DURATION_MS = 300;

export class KeybindingNotification {
  #container: HTMLElement;
  #currentTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(shadowRoot: ShadowRoot) {
    this.#container = document.createElement('div');
    this.#container.classList.add('gs-keybinding-toast');
    shadowRoot.appendChild(this.#container);
  }

  /**
   * Show a notification for an executed command.
   */
  show(commandLabel: string, key: string): void {
    // Cancel any existing notification
    if (this.#currentTimeout !== undefined) {
      clearTimeout(this.#currentTimeout);
    }

    this.#container.textContent = '';
    const keyBadge = document.createElement('span');
    keyBadge.classList.add('gs-keybinding-toast-key');
    keyBadge.textContent = key;

    const label = document.createElement('span');
    label.classList.add('gs-keybinding-toast-label');
    label.textContent = commandLabel;

    this.#container.appendChild(keyBadge);
    this.#container.appendChild(label);

    // Trigger enter animation
    this.#container.classList.remove('gs-keybinding-toast-exit');
    this.#container.classList.add('gs-keybinding-toast-enter');

    this.#currentTimeout = setTimeout(() => {
      this.#container.classList.remove('gs-keybinding-toast-enter');
      this.#container.classList.add('gs-keybinding-toast-exit');
      this.#currentTimeout = setTimeout(() => {
        this.#container.classList.remove('gs-keybinding-toast-exit');
        this.#container.textContent = '';
      }, ANIMATION_DURATION_MS);
    }, DISPLAY_DURATION_MS);
  }

  /**
   * Returns CSS rules for the notification component.
   */
  static styles(): string {
    return `
      .gs-keybinding-toast {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 300;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(148, 163, 184, 0.2);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        font-family: system-ui, sans-serif;
        font-size: 0.85rem;
        color: #e5eefb;
        pointer-events: none;
        opacity: 0;
        transform: translateX(20px);
        transition: opacity ${ANIMATION_DURATION_MS}ms ease, transform ${ANIMATION_DURATION_MS}ms ease;
      }

      .gs-keybinding-toast-enter {
        opacity: 1;
        transform: translateX(0);
      }

      .gs-keybinding-toast-exit {
        opacity: 0;
        transform: translateX(20px);
      }

      .gs-keybinding-toast-key {
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(125, 211, 252, 0.15);
        border: 1px solid rgba(125, 211, 252, 0.3);
        color: #7dd3fc;
      }

      .gs-keybinding-toast-label {
        color: #cbd5e1;
      }
    `;
  }
}
