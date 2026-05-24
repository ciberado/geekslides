/**
 * GeekSlides Whiteboard Plugin Bundle — Entry point.
 *
 * Exports: whiteboard feature.
 * Uses EventBridge + feature-scoped Yjs sync (no legacy WhiteboardSync dependency).
 */

import type { PluginExports, PluginActivate, Feature, FeatureContext, FeatureSyncAPI, EventBridgeInstance } from '../sdk/types.ts';

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

interface WhiteboardStroke {
  readonly id: string;
  readonly slideIndex: number;
  readonly points: readonly [number, number][];
  readonly color: string;
  readonly width: number;
  readonly clientId: string;
  readonly compositeOp?: string;
  readonly alpha?: number;
}

/**
 * Clear strokes for a specific slide from the shared array.
 */
function clearStrokesForSlide(sync: FeatureSyncAPI, slideIndex: number): void {
  const arr = sync.getSharedArray();
  // Iterate in reverse to safely delete by index
  for (let i = arr.length - 1; i >= 0; i--) {
    const item = arr.get(i) as WhiteboardStroke | undefined;
    if (item?.slideIndex === slideIndex) {
      arr.delete(i, 1);
    }
  }
}

/**
 * Clear all strokes from the shared array.
 */
function clearAllStrokes(sync: FeatureSyncAPI): void {
  const arr = sync.getSharedArray();
  if (arr.length > 0) {
    arr.delete(0, arr.length);
  }
}

/**
 * Set up Yjs observers for remote sync → local DOM events.
 * Returns a cleanup function to detach all observers.
 */
function setupSyncObservers(sync: FeatureSyncAPI, eventTarget: EventTarget, eventNamespace = 'whiteboard'): () => void {
  const sharedArray = sync.getSharedArray();
  const ephemeralMap = sync.getEphemeralMap();
  const sharedMap = sync.getSharedMap();

  // Remote stroke additions and deletions
  const arrayObserver = (event: { transaction: { local: boolean }; changes: { added: Set<{ content: { getContent(): unknown[] } }>; deleted: Set<{ content: { getContent(): unknown[] } }> } }): void => {
    if (event.transaction.local) return;

    for (const item of event.changes.added) {
      const content = item.content.getContent();
      for (const stroke of content) {
        eventTarget.dispatchEvent(new CustomEvent(`geek:${eventNamespace}:remote-stroke`, {
          bubbles: true,
          detail: stroke,
        }));
      }
    }

    if (event.changes.deleted.size > 0) {
      const clearedSlides = new Set<number>();
      for (const item of event.changes.deleted) {
        const content = item.content.getContent() as WhiteboardStroke[];
        for (const stroke of content) {
          clearedSlides.add(stroke.slideIndex);
        }
      }
      // Get remaining strokes for affected slides
      const allStrokes: WhiteboardStroke[] = [];
      for (let i = 0; i < sharedArray.length; i++) {
        allStrokes.push(sharedArray.get(i) as WhiteboardStroke);
      }
      for (const slideIndex of clearedSlides) {
        eventTarget.dispatchEvent(new CustomEvent(`geek:${eventNamespace}:remote-clear`, {
          bubbles: true,
          detail: {
            slideIndex,
            remaining: allStrokes.filter((s) => s.slideIndex === slideIndex),
          },
        }));
      }
    }
  };

  // Remote ephemeral (live stroke progress)
  const ephemeralObserver = (event: { transaction: { local: boolean }; changes: { keys: Map<string, { action: string }> } }): void => {
    if (event.transaction.local) return;

    for (const [clientId, change] of event.changes.keys) {
      if (change.action === 'delete') continue;
      const stroke = ephemeralMap.get(clientId);
      if (!stroke) continue;
      eventTarget.dispatchEvent(new CustomEvent(`geek:${eventNamespace}:remote-stroke-progress`, {
        bubbles: true,
        detail: stroke,
      }));
    }
  };

  // Remote visibility changes
  const mapObserver = (event: { transaction: { local: boolean }; keysChanged: Set<string> }): void => {
    if (event.transaction.local) return;
    if (event.keysChanged.has('visible')) {
      const visible = sharedMap.get('visible') as boolean | undefined;
      if (visible !== undefined) {
        eventTarget.dispatchEvent(new CustomEvent(`geek:${eventNamespace}:remote-visibility`, {
          bubbles: true,
          detail: { visible },
        }));
      }
    }
  };

  sharedArray.observe(arrayObserver);
  ephemeralMap.observe(ephemeralObserver);
  sharedMap.observe(mapObserver);

  return () => {
    sharedArray.unobserve(arrayObserver);
    ephemeralMap.unobserve(ephemeralObserver);
    sharedMap.unobserve(mapObserver);
  };
}

/**
 * Creates the whiteboard feature using feature-scoped sync via EventBridge.
 */
function createWhiteboardFeature(): Feature {
  return {
    id: 'whiteboard',
    label: 'Drawing whiteboard overlay',

    activate(ctx: FeatureContext): () => void {
      const isReadonly = ctx.role === 'viewer';
      const sync = ctx.sync;

      const whiteboard = document.createElement('geek-whiteboard') as unknown as Whiteboard;
      if (isReadonly) {
        whiteboard.setAttribute('readonly', '');
      }
      ctx.container.appendChild(whiteboard as unknown as Node);
      whiteboard.slideIndex = ctx.slideshow.currentSlide;

      // Sync: local → remote via EventBridge + manual handlers
      let eventBridge: EventBridgeInstance | null = null;
      let observerCleanup: (() => void) | null = null;

      const onHide = (e: Event): void => {
        const { visible } = (e as CustomEvent<{ visible: boolean }>).detail;
        if (sync) sync.getSharedMap().set('visible', visible);
      };
      const onClear = (e: Event): void => {
        const { slideIndex } = (e as CustomEvent<{ slideIndex: number }>).detail;
        if (sync && !sync.readonly) clearStrokesForSlide(sync, slideIndex);
      };
      if (!isReadonly) {
        (whiteboard as unknown as EventTarget).addEventListener('geek:whiteboard:hide', onHide);
        (whiteboard as unknown as EventTarget).addEventListener('geek:whiteboard:clear', onClear);
      }

      if (sync) {
        // EventBridge: forward completed strokes to array, progress to ephemeral
        eventBridge = sync.createEventBridge({
          actions: [
            {
              event: 'geek:whiteboard:stroke',
              target: 'array',
              transform: (detail: unknown) => {
                // Also clear ephemeral live stroke on finalization
                sync.getEphemeralMap().delete('_self');
                return detail;
              },
            },
            { event: 'geek:whiteboard:stroke-progress', target: 'ephemeral' },
          ],
        });
        eventBridge.activate();

        // Set up remote → local observers
        observerCleanup = setupSyncObservers(sync, document);

        // Replay existing strokes
        const arr = sync.getSharedArray();
        for (let i = 0; i < arr.length; i++) {
          whiteboard.drawRemoteStroke(arr.get(i) as { points: Array<{ x: number; y: number }>; color: string; width: number; slideIndex: number });
        }

        // Replay current visibility state
        const visible = sync.getSharedMap().get('visible') as boolean | undefined;
        if (visible !== undefined) {
          document.dispatchEvent(new CustomEvent('geek:whiteboard:remote-visibility', {
            bubbles: true,
            detail: { visible },
          }));
        }
      }

      // Listen for deck reload (clear all strokes)
      const onDeckReload = (): void => {
        if (sync && !sync.readonly) {
          clearAllStrokes(sync);
          sync.getEphemeralMap().delete('_self');
        }
        whiteboard.clear();
      };
      document.addEventListener('geek:presentation:reload', onDeckReload);

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

      // Register commands (presenter only)
      if (!isReadonly) {
        ctx.commands.register({
          name: 'whiteboard', label: 'Toggle whiteboard',
          execute: () => {
            whiteboard.toggle();
            if (sync) sync.getSharedMap().set('visible', whiteboard.isVisible);
            if (whiteboard.isVisible) {
              document.dispatchEvent(new CustomEvent('geek:surface:activate', {
                bubbles: true, detail: { surface: 'slide' },
              }));
            }
          },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'whiteboard-clear', label: 'Clear whiteboard on current slide',
          execute: () => {
            whiteboard.clear();
            if (sync && !sync.readonly) clearStrokesForSlide(sync, whiteboard.slideIndex);
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

      // Listen for surface coordination — hide whiteboard when blank canvas activates
      const onSurfaceActivate = (e: Event): void => {
        const { surface } = (e as CustomEvent<{ surface: string }>).detail;
        if (surface === 'canvas' && whiteboard.isVisible) {
          whiteboard.toggle();
          if (sync) sync.getSharedMap().set('visible', false);
        }
      };
      document.addEventListener('geek:surface:activate', onSurfaceActivate);

      return () => {
        unsubSlideEnter();
        document.removeEventListener('geek:presentation:reload', onDeckReload);
        document.removeEventListener('geek:surface:activate', onSurfaceActivate);
        if (!isReadonly) {
          (whiteboard as unknown as EventTarget).removeEventListener('geek:whiteboard:hide', onHide);
          (whiteboard as unknown as EventTarget).removeEventListener('geek:whiteboard:clear', onClear);
        }
        pointerCleanup?.();
        eventBridge?.deactivate();
        observerCleanup?.();
        if (sync) sync.getEphemeralMap().delete('_self');
        (whiteboard as unknown as HTMLElement).remove();
      };
    },
  };
}

/**
 * Creates the blank canvas feature — a white drawing surface independent of slides.
 * Uses its own Yjs namespace (features.whiteboard-canvas) and event namespace.
 */
function createBlankCanvasFeature(): Feature {
  const EVENT_NS = 'whiteboard-canvas';

  return {
    id: 'whiteboard-canvas',
    label: 'Blank canvas overlay for freeform drawing',

    activate(ctx: FeatureContext): () => void {
      const isReadonly = ctx.role === 'viewer';
      const sync = ctx.sync;

      const canvas = document.createElement('geek-whiteboard') as unknown as Whiteboard;
      canvas.setAttribute('canvas-mode', '');
      canvas.setAttribute('data-event-ns', EVENT_NS);
      if (isReadonly) {
        canvas.setAttribute('readonly', '');
      }
      ctx.container.appendChild(canvas as unknown as Node);

      // Sync: local → remote via EventBridge + manual handlers
      let eventBridge: EventBridgeInstance | null = null;
      let observerCleanup: (() => void) | null = null;

      const onHide = (e: Event): void => {
        const { visible } = (e as CustomEvent<{ visible: boolean }>).detail;
        if (sync) sync.getSharedMap().set('visible', visible);
      };
      const onClear = (): void => {
        if (sync && !sync.readonly) clearAllStrokes(sync);
      };
      if (!isReadonly) {
        (canvas as unknown as EventTarget).addEventListener(`geek:${EVENT_NS}:hide`, onHide);
        (canvas as unknown as EventTarget).addEventListener(`geek:${EVENT_NS}:clear`, onClear);
      }

      if (sync) {
        // EventBridge: forward completed strokes to array, progress to ephemeral
        eventBridge = sync.createEventBridge({
          actions: [
            {
              event: `geek:${EVENT_NS}:stroke`,
              target: 'array',
              transform: (detail: unknown) => {
                sync.getEphemeralMap().delete('_self');
                return detail;
              },
            },
            { event: `geek:${EVENT_NS}:stroke-progress`, target: 'ephemeral' },
          ],
        });
        eventBridge.activate();

        // Set up remote → local observers (using canvas event namespace)
        observerCleanup = setupSyncObservers(sync, document, EVENT_NS);

        // Replay existing strokes
        const arr = sync.getSharedArray();
        for (let i = 0; i < arr.length; i++) {
          canvas.drawRemoteStroke(arr.get(i) as { points: Array<{ x: number; y: number }>; color: string; width: number; slideIndex: number });
        }

        // Replay current visibility state
        const visible = sync.getSharedMap().get('visible') as boolean | undefined;
        if (visible !== undefined) {
          document.dispatchEvent(new CustomEvent(`geek:${EVENT_NS}:remote-visibility`, {
            bubbles: true,
            detail: { visible },
          }));
        }
      }

      // Listen for deck reload (clear canvas strokes)
      const onDeckReload = (): void => {
        if (sync && !sync.readonly) {
          clearAllStrokes(sync);
          sync.getEphemeralMap().delete('_self');
        }
        canvas.clear();
      };
      document.addEventListener('geek:presentation:reload', onDeckReload);

      // Register commands (presenter only)
      if (!isReadonly) {
        ctx.commands.register({
          name: 'wb-canvas', label: 'Toggle blank canvas',
          execute: () => {
            canvas.toggle();
            if (sync) sync.getSharedMap().set('visible', canvas.isVisible);
            if (canvas.isVisible) {
              document.dispatchEvent(new CustomEvent('geek:surface:activate', {
                bubbles: true, detail: { surface: 'canvas' },
              }));
            }
          },
          category: 'whiteboard',
        });
        ctx.commands.register({
          name: 'wb-canvas-clear', label: 'Clear blank canvas',
          execute: () => {
            canvas.clear();
            if (sync && !sync.readonly) clearAllStrokes(sync);
          },
          category: 'whiteboard',
        });
      }

      // Listen for surface coordination — hide canvas when regular whiteboard activates
      const onSurfaceActivate = (e: Event): void => {
        const { surface } = (e as CustomEvent<{ surface: string }>).detail;
        if (surface === 'slide' && canvas.isVisible) {
          canvas.toggle();
          if (sync) sync.getSharedMap().set('visible', false);
        }
      };
      document.addEventListener('geek:surface:activate', onSurfaceActivate);

      return () => {
        document.removeEventListener('geek:presentation:reload', onDeckReload);
        document.removeEventListener('geek:surface:activate', onSurfaceActivate);
        if (!isReadonly) {
          (canvas as unknown as EventTarget).removeEventListener(`geek:${EVENT_NS}:hide`, onHide);
          (canvas as unknown as EventTarget).removeEventListener(`geek:${EVENT_NS}:clear`, onClear);
        }
        eventBridge?.deactivate();
        observerCleanup?.();
        if (sync) sync.getEphemeralMap().delete('_self');
        (canvas as unknown as HTMLElement).remove();
      };
    },
  };
}

export const activate: PluginActivate = (): PluginExports => ({
  features: {
    'whiteboard': createWhiteboardFeature(),
    'whiteboard-canvas': createBlankCanvasFeature(),
  },
});
