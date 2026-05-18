/**
 * GeekSlides Whiteboard Plugin Bundle — Entry point.
 *
 * Exports: whiteboard feature.
 * Runtime dependency: WhiteboardSync (received from PluginAPI).
 */

import type { PluginAPI, PluginExports, PluginActivate, Feature, FeatureContext } from '../sdk/types.ts';

/** Minimal interface for the <geek-whiteboard> custom element. */
interface Whiteboard extends HTMLElement {
  slideIndex: number;
  isVisible: boolean;
  userDismissed: boolean;
  toolbarCollapsed: boolean;
  toolbar: WhiteboardToolbar | null;
  toggle(): void;
  clear(): void;
  setActive(active: boolean): void;
  setColor(color: string): void;
  beginStroke(e: PointerEvent): void;
  drawRemoteStroke(stroke: { points: Array<{ x: number; y: number }>; color: string; width: number; slideIndex: number }): void;
}

interface WhiteboardToolbar {
  hide(): void;
  show(): void;
  toggleVisibility(): void;
  setTool(tool: string): void;
  setColor(color: string): void;
}

/**
 * Creates the whiteboard feature with an injected WhiteboardSync constructor.
 */
function createWhiteboardFeature(api: PluginAPI): Feature {
  const { WhiteboardSync } = api;

  return {
    id: 'whiteboard',
    label: 'Drawing whiteboard overlay',

    activate(ctx: FeatureContext): () => void {
      const isReadonly = ctx.role === 'viewer';
      const syncManager = ctx.syncManager;

      const whiteboard = document.createElement('geek-whiteboard') as unknown as Whiteboard;
      if (isReadonly) {
        whiteboard.setAttribute('readonly', '');
      }
      ctx.container.appendChild(whiteboard as unknown as Node);
      whiteboard.slideIndex = ctx.slideshow.currentSlide;

      const onHide = (e: Event): void => {
        const { visible } = (e as CustomEvent<{ visible: boolean }>).detail;
        if (syncManager) (syncManager as { publishWhiteboardVisible(v: boolean): void }).publishWhiteboardVisible(visible);
      };
      const onClear = (e: Event): void => {
        const { slideIndex } = (e as CustomEvent<{ slideIndex: number }>).detail;
        if (syncManager) (syncManager as { clearStrokes(i: number): void }).clearStrokes(slideIndex);
      };
      if (!isReadonly) {
        (whiteboard as unknown as EventTarget).addEventListener('geek:whiteboard:hide', onHide);
        (whiteboard as unknown as EventTarget).addEventListener('geek:whiteboard:clear', onClear);
      }

      const unsubSlideEnter = ctx.on('slide:enter', ({ slideIndex }) => {
        whiteboard.slideIndex = slideIndex;
      });

      // Auto-activate whiteboard on pointer drag (presenter only)
      let pointerCleanup: (() => void) | null = null;
      if (!isReadonly) {
        const gsContainer = ctx.container.closest<HTMLElement>('.gs-container') ?? ctx.container.parentElement;
        if (gsContainer) {
          let pointerStartedOnSlide = false;
          let pointerStartX = 0;
          let pointerStartY = 0;
          let pointerStartedOnInteractive = false;
          const DRAG_THRESHOLD_PX = 6;

          const isInteractiveElement = (el: Element): boolean =>
            el instanceof HTMLElement &&
            (
              el.isContentEditable ||
              el.matches('input, textarea, select, option, button, label, a, summary, details')
            );

          const eventStartedOnInteractive = (e: PointerEvent): boolean =>
            e.composedPath().some((node) => node instanceof Element && isInteractiveElement(node));

          const onPointerDown = (e: PointerEvent): void => {
            if (e.button !== 0) return;
            if (ctx.slideshow.mode !== 'present') return;
            if (e.composedPath().some((el) => (el as Element).tagName === 'GEEK-WHITEBOARD')) return;
            pointerStartedOnInteractive = eventStartedOnInteractive(e);
            if (pointerStartedOnInteractive) {
              pointerStartedOnSlide = false;
              return;
            }
            pointerStartedOnSlide = true;
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
          };

          const onPointerMove = (e: PointerEvent): void => {
            if (!pointerStartedOnSlide) return;
            if (pointerStartedOnInteractive) return;
            if (ctx.slideshow.mode !== 'present') { pointerStartedOnSlide = false; return; }
            if (e.buttons === 0) { pointerStartedOnSlide = false; return; }
            const movedX = Math.abs(e.clientX - pointerStartX);
            const movedY = Math.abs(e.clientY - pointerStartY);
            if (movedX < DRAG_THRESHOLD_PX && movedY < DRAG_THRESHOLD_PX) return;
            if (!whiteboard.isVisible && !whiteboard.userDismissed && !whiteboard.toolbarCollapsed) {
              e.preventDefault();
              whiteboard.setActive(true);
              whiteboard.beginStroke(e);
              pointerStartedOnSlide = false;
            }
          };

          const onPointerUp = (): void => {
            pointerStartedOnSlide = false;
            pointerStartedOnInteractive = false;
          };

          gsContainer.addEventListener('pointerdown', onPointerDown as EventListener);
          gsContainer.addEventListener('pointermove', onPointerMove as EventListener);
          gsContainer.addEventListener('pointerup', onPointerUp);

          pointerCleanup = () => {
            gsContainer.removeEventListener('pointerdown', onPointerDown as EventListener);
            gsContainer.removeEventListener('pointermove', onPointerMove as EventListener);
            gsContainer.removeEventListener('pointerup', onPointerUp);
          };
        }
      }

      // Sync bridge
      let wbSync: { activate(): void; deactivate(): void } | null = null;
      if (syncManager) {
        wbSync = new WhiteboardSync(syncManager as unknown as EventTarget);
        wbSync.activate();

        for (const stroke of (syncManager as { getStrokes(): unknown[] }).getStrokes()) {
          whiteboard.drawRemoteStroke(stroke as { points: Array<{ x: number; y: number }>; color: string; width: number; slideIndex: number });
        }
      }

      // Register commands (presenter only)
      if (!isReadonly) {
        ctx.commands.register({
          name: 'whiteboard', label: 'Toggle whiteboard',
          execute: () => {
            whiteboard.toggle();
            if (syncManager) (syncManager as { publishWhiteboardVisible(v: boolean): void }).publishWhiteboardVisible(whiteboard.isVisible);
          },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'whiteboard-clear', label: 'Clear whiteboard on current slide',
          execute: () => {
            whiteboard.clear();
            if (syncManager) (syncManager as { clearStrokes(i: number): void }).clearStrokes(whiteboard.slideIndex);
          },
          category: 'whiteboard',
        });

        const toolbar = whiteboard.toolbar;
        if (toolbar) {
          toolbar.hide();
          ctx.commands.register({ name: 'wb-toolbar', label: 'Hide/show whiteboard toolbar', execute: () => { toolbar.toggleVisibility(); }, category: 'whiteboard' });
          ctx.commands.register({ name: 'wb-hide', label: 'Hide whiteboard toolbar', execute: () => { toolbar.hide(); }, category: 'whiteboard' });
          ctx.commands.register({ name: 'wb-show', label: 'Show whiteboard toolbar', execute: () => { toolbar.show(); }, category: 'whiteboard' });
          ctx.commands.register({ name: 'wb-pen', label: 'Switch to pen tool', execute: () => { toolbar.setTool('pen'); }, category: 'whiteboard' });
          ctx.commands.register({ name: 'wb-highlighter', label: 'Switch to highlighter tool', execute: () => { toolbar.setTool('highlighter'); }, category: 'whiteboard' });
          ctx.commands.register({ name: 'wb-eraser', label: 'Switch to eraser tool', execute: () => { toolbar.setTool('eraser'); }, category: 'whiteboard' });
          ctx.commands.register({
            name: 'wb-color', label: 'Set drawing color (usage: wb-color #ff0000)',
            execute: (args) => {
              const color = args?.[0];
              if (!color) { ctx.output.show('✗ Usage: wb-color <hex-color>'); return; }
              toolbar.setColor(color);
              whiteboard.setColor(color);
            },
            category: 'whiteboard',
          });
        }
      }

      return () => {
        unsubSlideEnter();
        if (!isReadonly) {
          (whiteboard as unknown as EventTarget).removeEventListener('geek:whiteboard:hide', onHide);
          (whiteboard as unknown as EventTarget).removeEventListener('geek:whiteboard:clear', onClear);
        }
        pointerCleanup?.();
        wbSync?.deactivate();
        (whiteboard as unknown as HTMLElement).remove();
      };
    },
  };
}

export const activate: PluginActivate = (api: PluginAPI): PluginExports => ({
  features: {
    'whiteboard': createWhiteboardFeature(api),
  },
});
