/**
 * GeekSlides v2 — Room-level plugin state management.
 *
 * Uses Yjs shared state to synchronize active plugin registries and loaded
 * plugins across all clients in a room. Plugin state is room-scoped (not
 * deck-scoped), so it persists across deck changes within the same room session.
 *
 * State shape in Yjs (doc.getMap('roomPlugins')):
 * - registries: Y.Array<{ url: string; name: string }>
 * - plugins: Y.Array<{ name: string; manifestUrl: string; version: string; registryUrl: string }>
 */

import * as Y from 'yjs';
import { createLogger } from '../logging.ts';

const log = createLogger('room-plugins');

/**
 * A registry entry stored in room state.
 */
export interface RoomRegistryEntry {
  readonly url: string;
  readonly name: string;
}

/**
 * A loaded plugin entry stored in room state.
 * Stores the fully-resolved manifest URL for deterministic loading.
 */
export interface RoomPluginEntry {
  readonly name: string;
  readonly manifestUrl: string;
  readonly version: string;
  readonly registryUrl: string;
}

export type RoomPluginChangeHandler = (plugins: readonly RoomPluginEntry[]) => void;

/**
 * Manages room-level plugin state via Yjs shared document.
 */
export class RoomPluginManager {
  readonly #doc: Y.Doc;
  readonly #rootMap: Y.Map<unknown>;
  readonly #changeHandlers = new Set<RoomPluginChangeHandler>();

  constructor(doc: Y.Doc) {
    this.#doc = doc;
    this.#rootMap = doc.getMap('roomPlugins');
    this.#setupObservers();
  }

  /**
   * Get the registries Y.Array, creating it if needed.
   */
  #getRegistries(): Y.Array<unknown> {
    let arr = this.#rootMap.get('registries') as Y.Array<unknown> | undefined;
    if (!arr) {
      arr = new Y.Array();
      this.#rootMap.set('registries', arr);
    }
    return arr;
  }

  /**
   * Get the plugins Y.Array, creating it if needed.
   */
  #getPlugins(): Y.Array<unknown> {
    let arr = this.#rootMap.get('plugins') as Y.Array<unknown> | undefined;
    if (!arr) {
      arr = new Y.Array();
      this.#rootMap.set('plugins', arr);
    }
    return arr;
  }

  /**
   * Add a registry to the room.
   */
  addRegistry(entry: RoomRegistryEntry): void {
    const registries = this.#getRegistries();
    // Check for duplicates
    for (let i = 0; i < registries.length; i++) {
      const existing = registries.get(i) as Record<string, unknown>;
      if (existing['url'] === entry.url) {
        log.warn({ url: entry.url }, 'registry already added');
        return;
      }
    }
    this.#doc.transact(() => {
      registries.push([{ url: entry.url, name: entry.name }]);
    });
    log.info({ url: entry.url, name: entry.name }, 'registry added to room');
  }

  /**
   * Remove a registry from the room (by URL or name).
   */
  removeRegistry(urlOrName: string): boolean {
    const registries = this.#getRegistries();
    for (let i = 0; i < registries.length; i++) {
      const entry = registries.get(i) as Record<string, unknown>;
      if (entry['url'] === urlOrName || entry['name'] === urlOrName) {
        this.#doc.transact(() => {
          registries.delete(i, 1);
          // Also remove plugins from this registry
          const plugins = this.#getPlugins();
          const registryUrl = entry['url'] as string;
          const toRemove: number[] = [];
          for (let j = 0; j < plugins.length; j++) {
            const p = plugins.get(j) as Record<string, unknown>;
            if (p['registryUrl'] === registryUrl) {
              toRemove.push(j);
            }
          }
          // Remove in reverse order to keep indices valid
          for (let j = toRemove.length - 1; j >= 0; j--) {
            const idx = toRemove[j];
            if (idx !== undefined) {
              plugins.delete(idx, 1);
            }
          }
        });
        log.info({ urlOrName }, 'registry removed from room');
        return true;
      }
    }
    return false;
  }

  /**
   * List all registries in the room.
   */
  listRegistries(): RoomRegistryEntry[] {
    const registries = this.#getRegistries();
    const result: RoomRegistryEntry[] = [];
    for (let i = 0; i < registries.length; i++) {
      const entry = registries.get(i) as Record<string, unknown>;
      result.push({
        url: entry['url'] as string,
        name: entry['name'] as string,
      });
    }
    return result;
  }

  /**
   * Load a plugin (add to active plugins list).
   */
  loadPlugin(entry: RoomPluginEntry): void {
    const plugins = this.#getPlugins();
    // Check for duplicates by manifest URL
    for (let i = 0; i < plugins.length; i++) {
      const existing = plugins.get(i) as Record<string, unknown>;
      if (existing['manifestUrl'] === entry.manifestUrl) {
        log.warn({ name: entry.name }, 'plugin already loaded');
        return;
      }
    }
    this.#doc.transact(() => {
      plugins.push([{
        name: entry.name,
        manifestUrl: entry.manifestUrl,
        version: entry.version,
        registryUrl: entry.registryUrl,
      }]);
    });
    log.info({ name: entry.name, manifestUrl: entry.manifestUrl }, 'plugin loaded in room');
  }

  /**
   * Unload a plugin (remove from active plugins list).
   */
  unloadPlugin(name: string): boolean {
    const plugins = this.#getPlugins();
    for (let i = 0; i < plugins.length; i++) {
      const entry = plugins.get(i) as Record<string, unknown>;
      if (entry['name'] === name) {
        this.#doc.transact(() => {
          plugins.delete(i, 1);
        });
        log.info({ name }, 'plugin unloaded from room');
        return true;
      }
    }
    return false;
  }

  /**
   * List all active plugins in the room.
   */
  listPlugins(): RoomPluginEntry[] {
    const plugins = this.#getPlugins();
    const result: RoomPluginEntry[] = [];
    for (let i = 0; i < plugins.length; i++) {
      const entry = plugins.get(i) as Record<string, unknown>;
      result.push({
        name: entry['name'] as string,
        manifestUrl: entry['manifestUrl'] as string,
        version: entry['version'] as string,
        registryUrl: entry['registryUrl'] as string,
      });
    }
    return result;
  }

  /**
   * Register a handler called whenever the plugin list changes (including remote changes).
   */
  onChange(handler: RoomPluginChangeHandler): () => void {
    this.#changeHandlers.add(handler);
    return () => { this.#changeHandlers.delete(handler); };
  }

  #setupObservers(): void {
    this.#rootMap.observeDeep(() => {
      const plugins = this.listPlugins();
      for (const handler of this.#changeHandlers) {
        try {
          handler(plugins);
        } catch (err: unknown) {
          log.error({ err }, 'room plugin change handler threw');
        }
      }
    });
  }
}
