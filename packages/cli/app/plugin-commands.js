/**
 * GeekSlides v2 — Plugin management terminal commands.
 *
 * Registers terminal commands for managing plugin registries and
 * loading/unloading plugins at room scope.
 *
 * Commands:
 *   plugin-registry-add <url>    — Add a plugin registry
 *   plugin-registry-ls           — List configured registries
 *   plugin-registry-remove <url> — Remove a registry
 *   plugin-available             — List all available plugins from registries
 *   plugin-active                — List currently loaded room plugins
 *   plugin-load <name>           — Load a plugin from registries
 *   plugin-unload <name>         — Unload a room plugin
 */

/**
 * @typedef {import('@geekslides/engine').RoomPluginManager} RoomPluginManager
 * @typedef {import('@geekslides/engine').PluginRegistryClient} PluginRegistryClient
 */

/**
 * Register all plugin management commands.
 *
 * @param {object} options
 * @param {import('@geekslides/engine').CommandSystem} options.commands
 * @param {RoomPluginManager | null} options.roomPluginManager
 * @param {PluginRegistryClient} options.registryClient
 * @param {(msg: string) => void} options.showOutput
 * @param {(msg: string) => void} options.showError
 * @param {() => Promise<void>} options.reprocessDeck
 */
export function registerPluginCommands({
  commands,
  roomPluginManager,
  registryClient,
  showOutput,
  showError,
  reprocessDeck,
}) {
  commands.register({
    name: 'plugin-registry-add',
    label: 'Add a plugin registry URL',
    category: 'plugins',
    hasArgs: true,
    bindable: false,
    execute: (args) => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected — plugin registries require sync');
        return;
      }
      const url = args?.[0];
      if (!url) {
        showError('✗ Usage: plugin-registry-add <registry-url>');
        return;
      }
      void (async () => {
        try {
          const manifest = await registryClient.fetch(url);
          roomPluginManager.addRegistry({ url, name: manifest.name });
          showOutput(`✓ Registry added: ${manifest.name} (${String(manifest.plugins.length)} plugins)`);
        } catch (err) {
          showError(`✗ Failed to add registry: ${err.message}`);
        }
      })();
    },
  });

  commands.register({
    name: 'plugin-registry-ls',
    label: 'List configured plugin registries',
    category: 'plugins',
    bindable: false,
    execute: () => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected');
        return;
      }
      const registries = roomPluginManager.listRegistries();
      if (registries.length === 0) {
        showOutput('No registries configured. Use plugin-registry-add <url>');
        return;
      }
      const lines = registries.map((r) => `  ${r.name} — ${r.url}`);
      showOutput(`Registries:\n${lines.join('\n')}`);
    },
  });

  commands.register({
    name: 'plugin-registry-remove',
    label: 'Remove a plugin registry',
    category: 'plugins',
    hasArgs: true,
    bindable: false,
    execute: (args) => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected');
        return;
      }
      const urlOrName = args?.[0];
      if (!urlOrName) {
        showError('✗ Usage: plugin-registry-remove <url-or-name>');
        return;
      }
      const removed = roomPluginManager.removeRegistry(urlOrName);
      if (removed) {
        registryClient.invalidate(urlOrName);
        showOutput(`✓ Registry removed: ${urlOrName}`);
        void reprocessDeck();
      } else {
        showError(`✗ Registry not found: ${urlOrName}`);
      }
    },
  });

  commands.register({
    name: 'plugin-available',
    label: 'List available plugins from all registries',
    category: 'plugins',
    bindable: false,
    execute: () => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected');
        return;
      }
      const registries = roomPluginManager.listRegistries();
      if (registries.length === 0) {
        showOutput('No registries configured. Use plugin-registry-add <url>');
        return;
      }
      void (async () => {
        try {
          const lines = [];
          for (const reg of registries) {
            try {
              const plugins = await registryClient.resolvePlugins(reg.url);
              lines.push(`[${reg.name}]`);
              for (const p of plugins) {
                const active = roomPluginManager.listPlugins().some(
                  (lp) => lp.manifestUrl === p.manifestUrl,
                );
                const marker = active ? '●' : '○';
                lines.push(`  ${marker} ${p.name} v${p.version} — ${p.description}`);
              }
            } catch {
              lines.push(`[${reg.name}] (unreachable)`);
            }
          }
          showOutput(lines.join('\n'));
        } catch (err) {
          showError(`✗ Failed to list plugins: ${err.message}`);
        }
      })();
    },
  });

  commands.register({
    name: 'plugin-active',
    label: 'List currently loaded room plugins',
    category: 'plugins',
    bindable: false,
    execute: () => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected');
        return;
      }
      const plugins = roomPluginManager.listPlugins();
      if (plugins.length === 0) {
        showOutput('No room plugins loaded. Use plugin-load <name>');
        return;
      }
      const lines = plugins.map((p) => `  ● ${p.name} v${p.version} (${p.registryUrl})`);
      showOutput(`Active room plugins:\n${lines.join('\n')}`);
    },
  });

  commands.register({
    name: 'plugin-load',
    label: 'Load a plugin from registries',
    category: 'plugins',
    hasArgs: true,
    bindable: false,
    execute: (args) => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected');
        return;
      }
      const name = args?.[0];
      if (!name) {
        showError('✗ Usage: plugin-load <plugin-name>');
        return;
      }
      void (async () => {
        try {
          // Find the plugin in registries
          const registries = roomPluginManager.listRegistries();
          let found = null;
          for (const reg of registries) {
            try {
              const plugins = await registryClient.resolvePlugins(reg.url);
              const match = plugins.find((p) => p.name === name);
              if (match) {
                found = match;
                break;
              }
            } catch {
              // Skip unreachable registries
            }
          }
          if (!found) {
            showError(`✗ Plugin '${name}' not found in any registry`);
            return;
          }
          // Check if already loaded
          const active = roomPluginManager.listPlugins();
          if (active.some((p) => p.manifestUrl === found.manifestUrl)) {
            showOutput(`Plugin '${name}' is already loaded`);
            return;
          }
          roomPluginManager.loadPlugin({
            name: found.name,
            manifestUrl: found.manifestUrl,
            version: found.version,
            registryUrl: found.registryUrl,
          });
          showOutput(`✓ Plugin loaded: ${found.name} v${found.version}`);
          await reprocessDeck();
        } catch (err) {
          showError(`✗ Failed to load plugin: ${err.message}`);
        }
      })();
    },
  });

  commands.register({
    name: 'plugin-unload',
    label: 'Unload a room plugin',
    category: 'plugins',
    hasArgs: true,
    bindable: false,
    execute: (args) => {
      if (!roomPluginManager) {
        showError('✗ Sync not connected');
        return;
      }
      const name = args?.[0];
      if (!name) {
        showError('✗ Usage: plugin-unload <plugin-name>');
        return;
      }
      const removed = roomPluginManager.unloadPlugin(name);
      if (removed) {
        showOutput(`✓ Plugin unloaded: ${name}`);
        void reprocessDeck();
      } else {
        showError(`✗ Plugin '${name}' is not loaded`);
      }
    },
  });
}
