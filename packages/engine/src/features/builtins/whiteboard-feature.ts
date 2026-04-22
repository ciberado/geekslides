/**
 * GeekSlides v2 — Whiteboard Feature.
 *
 * Encapsulates whiteboard setup, auto-activation, sync bridging, and
 * command registration as a self-contained Feature.
 *
 * The toolbar is owned by the <geek-whiteboard> component itself and created
 * automatically in presenter (non-readonly) mode. This feature only handles
 * the sync layer and keyboard commands that need external context.
 */

import type { Feature, FeatureContext } from '../types.ts';
import type { Whiteboard } from '../../components/Whiteboard.ts';
import { WhiteboardSync } from '../../sync/WhiteboardSync.ts';

export const whiteboardFeature: Feature = {
  id: 'whiteboard',
  label: 'Drawing whiteboard overlay',

  activate(ctx: FeatureContext): () => void {
    const isReadonly = ctx.role === 'viewer';
    const syncManager = ctx.syncManager;

    // --- Create whiteboard component ---
    // The toolbar is created internally by <geek-whiteboard> when readonly is absent.
    const whiteboard = document.createElement('geek-whiteboard') as Whiteboard;
    if (isReadonly) {
      whiteboard.setAttribute('readonly', '');
    }
    ctx.container.appendChild(whiteboard);
    whiteboard.slideIndex = ctx.slideshow.currentSlide;

    // --- Sync bridge: intercept toolbar-emitted composed events ---
    // <geek-whiteboard> re-emits hide-request and clear-request as composed
    // events so we can publish visibility/clear state to the sync layer.
    const onHide = (e: Event): void => {
      const { visible } = (e as CustomEvent<{ visible: boolean }>).detail;
      if (syncManager) syncManager.publishWhiteboardVisible(visible);
    };
    const onClear = (e: Event): void => {
      const { slideIndex } = (e as CustomEvent<{ slideIndex: number }>).detail;
      if (syncManager) syncManager.clearStrokes(slideIndex);
    };
    if (!isReadonly) {
      whiteboard.addEventListener('geek:whiteboard:hide', onHide);
      whiteboard.addEventListener('geek:whiteboard:clear', onClear);
    }

    // --- Slide navigation tracking ---
    const unsubSlideEnter = ctx.on('slide:enter', ({ slideIndex }) => {
      whiteboard.slideIndex = slideIndex;
    });

    // --- Auto-activate whiteboard on pointer drag (presenter only) ---
    let pointerCleanup: (() => void) | null = null;
    if (!isReadonly) {
      // ctx.container is a feature wrapper div inside .gs-features inside .gs-container.
      // Pointer events from slide content bubble to .gs-container (not .gs-features),
      // so we must listen on .gs-container to catch drags that originate on slide elements.
      const gsContainer = ctx.container.closest<HTMLElement>('.gs-container') ?? ctx.container.parentElement;
      if (gsContainer) {
        let pointerStartedOnSlide = false;

        const onPointerDown = (e: PointerEvent): void => {
          if (e.button !== 0) return;
          if (ctx.slideshow.mode !== 'present') return;
          if (e.composedPath().some((el) => (el as Element).tagName === 'GEEK-WHITEBOARD')) return;
          pointerStartedOnSlide = true;
          e.preventDefault();
        };

        const onPointerMove = (e: PointerEvent): void => {
          if (!pointerStartedOnSlide) return;
          if (ctx.slideshow.mode !== 'present') { pointerStartedOnSlide = false; return; }
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

      const toolbar = whiteboard.toolbar;
      if (toolbar) {
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
      if (!isReadonly) {
        whiteboard.removeEventListener('geek:whiteboard:hide', onHide);
        whiteboard.removeEventListener('geek:whiteboard:clear', onClear);
      }
      pointerCleanup?.();
      wbSync?.deactivate();
      whiteboard.remove();
    };
  },
};
