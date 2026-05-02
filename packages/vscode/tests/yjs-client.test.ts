import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import { YjsClient } from '../src/sync/yjs-client.ts';

describe('YjsClient', () => {
  it('creates a provider with the requested room and server url', () => {
    const provider = { destroy: vi.fn() };
    const providerFactory = vi.fn(() => provider);
    const client = new YjsClient({ providerFactory });

    client.connect('ws://localhost:1234', 'authors');

    expect(providerFactory).toHaveBeenCalledWith('ws://localhost:1234', 'authors', expect.any(Y.Doc));
  });

  it('publishes slide and partial to sessionState', () => {
    const doc = new Y.Doc();
    const client = new YjsClient({ doc, providerFactory: vi.fn(() => ({ destroy: vi.fn() })) });

    client.setSlide(3, 0);

    expect(doc.getMap('sessionState').get('slide')).toBe(3);
    expect(doc.getMap('sessionState').get('partial')).toBe(0);
  });

  it('emits remote slide changes only for non-local transactions', () => {
    const doc = new Y.Doc();
    const remoteDoc = new Y.Doc();
    const client = new YjsClient({ doc, providerFactory: vi.fn(() => ({ destroy: vi.fn() })) });
    const listener = vi.fn();
    client.onSlideChange(listener);

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc));
    remoteDoc.getMap('sessionState').set('slide', 2);
    remoteDoc.getMap('sessionState').set('partial', 1);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc));

    expect(listener).toHaveBeenCalledWith(2, 1);
  });
});
