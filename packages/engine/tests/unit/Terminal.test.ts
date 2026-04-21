// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Terminal } from '../../src/components/Terminal.ts';
import { CommandSystem } from '../../src/input/CommandSystem.ts';

// Register the custom element for testing
if (!customElements.get('geek-terminal')) {
  customElements.define('geek-terminal', Terminal);
}

describe('Terminal', () => {
  let terminal: Terminal;
  let cs: CommandSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    cs = new CommandSystem();
    cs.register({ name: 'next', label: 'Next slide', execute: vi.fn(), category: 'navigation' });
    cs.register({ name: 'prev', label: 'Previous slide', execute: vi.fn(), category: 'navigation' });
    cs.register({ name: 'fullscreen', label: 'Toggle fullscreen', execute: vi.fn(), category: 'view' });

    terminal = document.createElement('geek-terminal') as Terminal;
    terminal.setCommandSystem(cs);
    document.body.appendChild(terminal);
  });

  afterEach(() => {
    terminal.remove();
    vi.useRealTimers();
  });

  it('starts hidden', () => {
    expect(terminal.isOpen).toBe(false);
    expect(terminal.style.display).toBe('none');
  });

  it('open() shows the terminal', () => {
    terminal.open();
    expect(terminal.isOpen).toBe(true);
    expect(terminal.style.display).toBe('block');
  });

  it('close() hides and dispatches event', () => {
    const closeSpy = vi.fn();
    terminal.addEventListener('geek:terminal:close', closeSpy);

    terminal.open();
    terminal.close();

    expect(terminal.isOpen).toBe(false);
    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('executes a known command on Enter', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    expect(input).toBeTruthy();

    if (input) {
      input.value = 'next';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // Command should have been executed
      const nextCmd = cs.all().find((c) => c.name === 'next');
      expect(nextCmd?.execute).toHaveBeenCalledOnce();
    }
  });

  it('shows error for unknown command', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    const output = terminal.shadowRoot?.querySelector('.output');
    expect(input).toBeTruthy();

    if (input) {
      input.value = 'nonexistent';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(output?.innerHTML).toContain('unknown command');
    }
  });

  it('Escape closes the terminal', () => {
    const closeSpy = vi.fn();
    terminal.addEventListener('geek:terminal:close', closeSpy);

    terminal.open();
    const input = terminal.shadowRoot?.querySelector('input');
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }

    expect(terminal.isOpen).toBe(false);
    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('help shows all commands grouped by category', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    const output = terminal.shadowRoot?.querySelector('.output');
    if (input) {
      input.value = 'help';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(output?.innerHTML).toContain('navigation');
      expect(output?.innerHTML).toContain('next');
      expect(output?.innerHTML).toContain('fullscreen');
    }
  });

  it('Tab completes from matching commands', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    if (input) {
      input.value = 'fu';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(input.value).toBe('fullscreen');
    }
  });

  it('auto-dismisses after command execution', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    if (input) {
      input.value = 'next';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }

    expect(terminal.isOpen).toBe(true); // Still open for feedback

    vi.advanceTimersByTime(1200);
    expect(terminal.isOpen).toBe(false); // Auto-dismissed
  });

  it('help does not auto-dismiss', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    if (input) {
      input.value = 'help';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }

    vi.advanceTimersByTime(1200);
    expect(terminal.isOpen).toBe(true); // help should stay open
  });

  it('does not have a built-in goto handler', () => {
    terminal.open();

    const input = terminal.shadowRoot?.querySelector('input');
    const output = terminal.shadowRoot?.querySelector('.output');
    if (input) {
      input.value = 'goto 1';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // Without a registered 'goto' command, it should be unknown
      expect(output?.innerHTML).toContain('unknown command');
    }
  });

  describe('setOutputLink', () => {
    it('renders a clickable anchor with the given URL', () => {
      terminal.open();
      terminal.setOutputLink('Share link: ', 'https://example.com/?room=test&readonly', { persist: true });

      const output = terminal.shadowRoot?.querySelector('.output');
      const anchor = output?.querySelector('a');
      expect(anchor).toBeTruthy();
      expect(anchor?.href).toBe('https://example.com/?room=test&readonly');
      expect(anchor?.textContent).toBe('https://example.com/?room=test&readonly');
      expect(anchor?.target).toBe('_blank');
      expect(anchor?.rel).toContain('noopener');
    });

    it('renders the prefix as plain text (not as HTML)', () => {
      terminal.open();
      terminal.setOutputLink('<b>Bold</b>: ', 'https://example.com/');

      const output = terminal.shadowRoot?.querySelector('.output');
      // The bold tag must be escaped, not rendered as markup
      expect(output?.innerHTML).toContain('&lt;b&gt;');
      expect(output?.querySelector('b')).toBeNull();
    });

    it('with persist:true re-opens the terminal if closed', () => {
      terminal.close();
      expect(terminal.isOpen).toBe(false);

      terminal.setOutputLink('✓ Share link: ', 'https://example.com/', { persist: true });
      expect(terminal.isOpen).toBe(true);
    });

    it('without persist auto-dismisses', () => {
      terminal.open();
      terminal.setOutputLink('Link: ', 'https://example.com/');

      vi.advanceTimersByTime(1200);
      expect(terminal.isOpen).toBe(false);
    });
  });
});
