/**
 * GeekSlides v2 — Whiteboard Feature.
 *
 * Encapsulates all whiteboard setup, toolbar wiring, auto-activation,
 * sync bridging, and command registration as a self-contained Feature.
 *
 * Replaces the ~120 lines of imperative glue code in main.js.
 */

import type { Feature, FeatureContext } from '../types.ts';
import type { Whiteboard } from '../../components/Whiteboard.ts';
import type { WhiteboardToolbar } from '../../components/WhiteboardToolbar.ts';
import { WhiteboardSync } from '../../sync/WhiteboardSync.ts';

export const whiteboardFeature: Feature = {
  id: 'whiteboard',
  label: 'Drawing whiteboard overlay',

  activate(ctx: FeatureContext): () => void {
    const isReadonly = ctx.role === 'viewer';
    const syncManager = ctx.syncManager;

    // --- Create whiteboard component ---
    const whiteboard = document.createElement('geek-whiteboard') as Whiteboard;
    if (isReadonly) {
      whiteboard.setAttribute('readonly', '');
    }
    ctx.container.appendChild(whiteboard);
    whiteboard.slideIndex = ctx.slideshow.currentSlide;

    // --- Create toolbar (presenter only) ---
    let wbToolbar: WhiteboardToolbar | null = null;
    if (!isReadonly) {
      wbToolbar = document.createElement('geek-whiteboard-toolbar') as WhiteboardToolbar;
      whiteboard.shadowRoot?.appendChild(wbToolbar);

      // Tool changes → update whiteboard drawing settings
      wbToolbar.addEventListener('geek:whiteboard:tool-change', ((e: CustomEvent) => {
        const { settings } = e.detail as { settings: { compositeOp: GlobalCompositeOperation; width: number; alpha: number } };
        whiteboard.setCompositeOp(settings.compositeOp);
        whiteboard.setWidth(settings.width);
        whiteboard.setAlpha(settings.alpha);
      }) as EventListener);

      wbToolbar.addEventListener('geek:whiteboard:color-change', ((e: CustomEvent) => {
        whiteboard.setColor((e.detail as { color: string }).color);
      }) as EventListener);

      wbToolbar.addEventListener('geek:whiteboard:hide-request', () => {
        whiteboard.toggleCanvas();
        if (syncManager) syncManager.publishWhiteboardVisible(whiteboard.isVisible);
      });

      wbToolbar.addEventListener('geek:whiteboard:clear-request', () => {
        whiteboard.clear();
        if (syncManager) syncManager.clearStrokes(whiteboard.slideIndex);
      });

      wbToolbar.addEventListener('geek:whiteboard:collapsed-change', ((e: CustomEvent) => {
        whiteboard.setToolbarCollapsed((e.detail as { collapsed: boolean }).collapsed);
      }) as EventListener);
    }

    // --- Slide navigation tracking ---
    const unsubSlideEnter = ctx.on('slide:enter', ({ slideIndex }) => {
      whiteboard.slideIndex = slideIndex;
    });

    // --- Auto-activate whiteboard on pointer drag (presenter only) ---
    let pointerCleanup: (() => void) | null = null;
    if (!isReadonly) {
      // The container is mounted inside gs-container (or is gs-container's child).
      const gsContainer = ctx.container.parentElement;
      if (gsContainer) {
        let pointerStartedOnSlide = false;

        const onPointerDown = (e: PointerEvent): void => {
          if (e.button !== 0) return;
          if (e.composedPath().some((el) => (el as Element).tagName === 'GEEK-WHITEBOARD')) return;
          pointerStartedOnSlide = true;
          e.preventDefault();
        };

        const onPointerMove = (e: PointerEvent): void => {
          if (!pointerStartedOnSlide) return;
          if (e.buttons === 0) { pointerStartedOnSlide = false; return; }
          if (!whiteboard.isVisible && !whiteboard.userDismissed && !whiteboard.toolbarCollapsed) {
            whiteboard.setActive(true);
            whiteboard.beginStroke(e);
          }
        };

        const onPointerUp = (): void => { pointerStartedOnSlide = false; };

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

    // --- Sync bridge ---
    let wbSync: WhiteboardSync | null = null;
    if (syncManager) {
      wbSync = new WhiteboardSync(syncManager);
      wbSync.activate();

      // Replay existing strokes (late-joining clients)
      for (const stroke of syncManager.getStrokes()) {
        whiteboard.drawRemoteStroke(stroke);
      }
    }

    // --- Register commands (presenter only) ---
    if (!isReadonly) {
      ctx.commands.register({
        name: 'whiteboard', label: 'Toggle whiteboard',
        execute: () => {
          whiteboard.toggle();
          if (syncManager) syncManager.publishWhiteboardVisible(whiteboard.isVisible);
        },
        category: 'whiteboard',
      });
      ctx.commands.register({
        name: 'whiteboard-clear', label: 'Clear whiteboard on current slide',
        execute: () => {
          whiteboard.clear();
          if (syncManager) syncManager.clearStrokes(whiteboard.slideIndex);
        },
        category: 'whiteboard',
      });

      if (wbToolbar) {
        const toolbar = wbToolbar;
        ctx.commands.register({
          name: 'wb-toolbar', label: 'Toggle whiteboard toolbar',
          execute: () => { toolbar.toggleCollapse(); },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-hide', label: 'Hide whiteboard toolbar',
          execute: () => { toolbar.hide(); },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-show', label: 'Show whiteboard toolbar',
          execute: () => { toolbar.show(); },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-pen', label: 'Switch to pen tool',
          execute: () => { toolbar.setTool('pen'); },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-highlighter', label: 'Switch to highlighter tool',
          execute: () => { toolbar.setTool('highlighter'); },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-eraser', label: 'Switch to eraser tool',
          execute: () => { toolbar.setTool('eraser'); },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-color', label: 'Set drawing color (usage: wb-color #ff0000)',
          execute: (args) => {
            const color = args?.[0];
            if (!color) {
              ctx.output.show('✗ Usage: wb-color <hex-color>');
              return;
            }
            toolbar.setColor(color);
            whiteboard.setColor(color);
          },
          category: 'whiteboard',
        });
      }
    }

    // --- Return cleanup ---
    return () => {
      unsubSlideEnter();
      pointerCleanup?.();
      wbSync?.deactivate();
      whiteboard.remove();
    };
  },
};
