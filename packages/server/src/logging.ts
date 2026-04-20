/**
 * GeekSlides v2 — Node.js server logging (pino).
 *
 * Creates namespace-scoped child loggers.
 * Configure via environment variables:
 *
 *   GEEKSLIDES_LOG=info                     # global level
 *   GEEKSLIDES_LOG=info,ws:debug,content:trace  # per-namespace
 *   GEEKSLIDES_LOG_FORMAT=json              # 'pretty' (default) | 'json'
 */

import pino from 'pino';
import type { Logger } from 'pino';

export type { Logger } from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const VALID_LEVELS = new Set<string>(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

export function isValidLevel(level: string): level is LogLevel {
  return VALID_LEVELS.has(level);
}

export interface LogConfig {
  globalLevel: LogLevel;
  nsLevels: Map<string, LogLevel>;
}

export function parseLogConfig(env?: string): LogConfig {
  const raw = env ?? process.env['GEEKSLIDES_LOG'] ?? 'info';
  const parts = raw.split(',');
  const nsLevels = new Map<string, LogLevel>();
  let globalLevel: LogLevel = 'info';

  for (const part of parts) {
    const trimmed = part.trim();
    const sepIdx = trimmed.indexOf(':');
    if (sepIdx > 0) {
      const ns = trimmed.substring(0, sepIdx).trim();
      const level = trimmed.substring(sepIdx + 1).trim();
      if (ns && isValidLevel(level)) {
        nsLevels.set(ns, level);
      }
    } else if (isValidLevel(trimmed)) {
      globalLevel = trimmed;
    }
  }

  return { globalLevel, nsLevels };
}

/**
 * Find the lowest (most verbose) level across global and all namespace overrides
 * so pino's root logger doesn't filter out messages before child loggers see them.
 */
export function lowestLevel(globalLevel: LogLevel, nsLevels: Map<string, LogLevel>): LogLevel {
  const ORDER: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
  let lowestIdx = ORDER.indexOf(globalLevel);
  for (const level of nsLevels.values()) {
    const idx = ORDER.indexOf(level);
    if (idx < lowestIdx) lowestIdx = idx;
  }
  return ORDER[lowestIdx] ?? globalLevel;
}

const config = parseLogConfig();

const format = process.env['GEEKSLIDES_LOG_FORMAT'] ?? 'pretty';

const rootLogger: Logger = pino({
  level: lowestLevel(config.globalLevel, config.nsLevels),
  ...(format !== 'json'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

/**
 * Create a child logger scoped to a namespace.
 *
 * ```ts
 * import { createLogger } from './logging.ts';
 * const log = createLogger('ws');
 * log.info({ room: 'demo', role: 'presenter' }, 'ws connection accepted');
 * ```
 */
export function createLogger(namespace: string): Logger {
  const child = rootLogger.child({ ns: namespace });
  const override = config.nsLevels.get(namespace);
  child.level = override ?? config.globalLevel;
  return child;
}
