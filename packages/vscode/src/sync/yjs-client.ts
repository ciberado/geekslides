import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface ProviderLike {
  destroy(): void;
}

type ProviderFactory = (serverUrl: string, room: string, doc: Y.Doc) => ProviderLike;

export class YjsClient {
  readonly #doc: Y.Doc;
  readonly #sessionState: Y.Map<unknown>;
  readonly #providerFactory: ProviderFactory;
  #provider: ProviderLike | null = null;

  constructor(options?: {
    doc?: Y.Doc;
    providerFactory?: ProviderFactory;
  }) {
    this.#doc = options?.doc ?? new Y.Doc();
    this.#sessionState = this.#doc.getMap('sessionState');
    this.#providerFactory = options?.providerFactory ?? (
      (serverUrl, room, doc) => (
        typeof globalThis.WebSocket === 'undefined'
          ? new WebsocketProvider(serverUrl, room, doc)
          : new WebsocketProvider(serverUrl, room, doc, { WebSocketPolyfill: globalThis.WebSocket })
      )
    );
  }

  connect(serverUrl: string, room: string): void {
    this.disconnect();
    this.#provider = this.#providerFactory(serverUrl, room, this.#doc);
  }

  disconnect(): void {
    this.#provider?.destroy();
    this.#provider = null;
  }

  setSlide(slide: number, partial: number = 0): void {
    this.#sessionState.set('slide', slide);
    this.#sessionState.set('partial', partial);
  }

  clearPreview(): void {
    this.#sessionState.set('classPreview', null);
  }

  onSlideChange(listener: (slide: number, partial: number) => void): () => void {
    const observer = (event: Y.YMapEvent<unknown>) => {
      if (event.transaction.local || !event.keysChanged.has('slide')) {
        return;
      }

      const slide = this.#sessionState.get('slide');
      const partial = this.#sessionState.get('partial');
      if (typeof slide === 'number') {
        listener(slide, typeof partial === 'number' ? partial : 0);
      }
    };

    this.#sessionState.observe(observer);
    return () => {
      this.#sessionState.unobserve(observer);
    };
  }
}
