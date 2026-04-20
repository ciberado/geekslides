/**
 * GeekSlides v2 — Browser logging (pino/browser).
 *
 * Creates namespace-scoped child loggers.
 * Configure via localStorage or URL search parameter:
 *
 *   localStorage.setItem('geekslides_log', 'debug');
 *   localStorage.setItem('geekslides_log_ns', 'sync:debug,parser:trace');
 *   // or URL: ?log=debug
 */

import pino from 'pino';
import type { Logger } from 'pino';

export type { Logger } from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const VALID_LEVELS = new Set<string>(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

export function isValidLevel(level: string): level is LogLevel {
  return VALID_LEVELS.has(level);
}

/** Parse a comma-separated namespace config string like "sync:debug,parser:trace". */
export function parseNamespaceLevels(config: string): Map<string, LogLevel> {
  const map = new Map<string, LogLevel>();
  for (const entry of config.split(',')) {
    const sepIdx = entry.indexOf(':');
    if (sepIdx > 0) {
      const ns = entry.substring(0, sepIdx).trim();
      const level = entry.substring(sepIdx + 1).trim();
      if (ns && isValidLevel(level)) {
        map.set(ns, level);
      }
    }
  }
  return map;
}

function getGlobalLevel(): LogLevel {
  try {
    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
      const url = new URL(window.location.href);
      const param = url.searchParams.get('log');
      if (param && isValidLevel(param)) return param;
    }
  } catch {
    // Not in a browser context
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('geekslides_log');
      if (stored && isValidLevel(stored)) return stored;
    }
  } catch {
    // localStorage unavailable (e.g. incognito, SSR)
  }

  return 'warn';
}

function getNamespaceLevels(): Map<string, LogLevel> {
  try {
    if (typeof localStorage !== 'undefined') {
      const config = localStorage.getItem('geekslides_log_ns');
      if (config) {
        return parseNamespaceLevels(config);
      }
    }
  } catch {
    // localStorage unavailable
  }

  return new Map<string, LogLevel>();
}

const globalLevel = getGlobalLevel();
const nsLevels = getNamespaceLevels();

const rootLogger: Logger = pino({
  level: globalLevel,
  browser: { asObject: false },
});

/**
 * Create a child logger scoped to a namespace.
 *
 * ```ts
 * import { createLogger } from '../logging.ts';
 * const log = createLogger('parser');
 * log.debug({ slideCount: 12 }, 'slides parsed');
 * ```
 */
export function createLogger(namespace: string): Logger {
  const child = rootLogger.child({ ns: namespace });
  const override = nsLevels.get(namespace);
  if (override) {
    child.level = override;
  }
  return child;
}
