/**
 * GeekSlides v2 — Plugin loader utilities.
 *
 * Supports three plugin types:
 * 1. Built-in plugins — referenced by name (e.g. "header", "iframe")
 * 2. Local plugins — relative paths (e.g. "./plugins/my-pp.js")
 * 3. Remote plugins — full URLs (e.g. "https://cdn.example.com/plugins/emoji.js")
 *
 * Remote plugins are fetched through the server's /api/plugin-proxy endpoint
 * to avoid CORS issues, then loaded via blob URL dynamic import.
 */

import type { Preprocessor, Processor } from './types.ts';

/**
 * Returns true when the plugin name is a relative file path
 * rather than a built-in plugin name.
 */
export function isLocalPluginPath(name: string): boolean {
  return name.startsWith('./') || name.startsWith('../');
}

/**
 * Returns true when the plugin name is a remote URL (http: or https:).
 */
export function isRemotePluginUrl(name: string): boolean {
  return name.startsWith('https://') || name.startsWith('http://');
}

/**
 * Dynamically import a remote plugin through the server proxy.
 *
 * Fetches the JS source via /api/plugin-proxy?url=<encoded>, creates
 * a blob URL, and uses dynamic import() to load the module.
 */
export async function importRemotePlugin(url: string): Promise<Record<string, unknown>> {
  const proxyUrl = `/api/plugin-proxy?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    let message = `HTTP ${String(response.status)}`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* use status text */ }
    throw new Error(`Failed to load remote plugin "${url}": ${message}`);
  }

  const source = await response.text();
  const blob = new Blob([source], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    return await import(/* @vite-ignore */ blobUrl) as Record<string, unknown>;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Extract a Preprocessor function from a dynamically imported module.
 *
 * The module must have a `default` export that is a function.
 */
export function extractPreprocessor(mod: Record<string, unknown>, path: string): Preprocessor {
  const fn = mod['default'];
  if (typeof fn !== 'function') {
    throw new Error(
      `Local preprocessor plugin "${path}" must export a default function`,
    );
  }
  return fn as Preprocessor;
}

/**
 * Extract a Processor function from a dynamically imported module.
 *
 * The module must have a `default` export that is a function.
 */
export function extractProcessor(mod: Record<string, unknown>, path: string): Processor {
  const fn = mod['default'];
  if (typeof fn !== 'function') {
    throw new Error(
      `Local processor plugin "${path}" must export a default function`,
    );
  }
  return fn as Processor;
}
