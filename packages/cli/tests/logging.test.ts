import { describe, it, expect } from 'vitest';
import { parseLogConfig, lowestLevel, isValidLevel } from '../src/logging.ts';
import type { LogLevel } from '../src/logging.ts';

describe('logging config', () => {
  describe('isValidLevel', () => {
    it('accepts all pino levels', () => {
      for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']) {
        expect(isValidLevel(level)).toBe(true);
      }
    });

    it('rejects invalid levels', () => {
      expect(isValidLevel('verbose')).toBe(false);
      expect(isValidLevel('')).toBe(false);
      expect(isValidLevel('INFO')).toBe(false);
    });
  });

  describe('parseLogConfig', () => {
    it('defaults to info when given no argument and no env var', () => {
      const original = process.env['GEEKSLIDES_LOG'];
      delete process.env['GEEKSLIDES_LOG'];
      try {
        const config = parseLogConfig();
        expect(config.globalLevel).toBe('info');
        expect(config.nsLevels.size).toBe(0);
      } finally {
        if (original !== undefined) process.env['GEEKSLIDES_LOG'] = original;
      }
    });

    it('parses a plain global level', () => {
      const config = parseLogConfig('debug');
      expect(config.globalLevel).toBe('debug');
      expect(config.nsLevels.size).toBe(0);
    });

    it('parses global level with namespace overrides', () => {
      const config = parseLogConfig('warn,dev:debug,pdf:trace');
      expect(config.globalLevel).toBe('warn');
      expect(config.nsLevels.get('dev')).toBe('debug');
      expect(config.nsLevels.get('pdf')).toBe('trace');
      expect(config.nsLevels.size).toBe(2);
    });

    it('ignores invalid namespace levels', () => {
      const config = parseLogConfig('warn,dev:banana,pdf:error');
      expect(config.globalLevel).toBe('warn');
      expect(config.nsLevels.has('dev')).toBe(false);
      expect(config.nsLevels.get('pdf')).toBe('error');
    });

    it('ignores invalid global level and falls back to info', () => {
      const config = parseLogConfig('banana');
      expect(config.globalLevel).toBe('info');
    });

    it('handles whitespace in entries', () => {
      const config = parseLogConfig('debug , dev : trace ');
      expect(config.globalLevel).toBe('debug');
      expect(config.nsLevels.get('dev')).toBe('trace');
    });

    it('handles empty string', () => {
      const config = parseLogConfig('');
      expect(config.globalLevel).toBe('info');
      expect(config.nsLevels.size).toBe(0);
    });
  });

  describe('lowestLevel', () => {
    it('returns global level when no overrides exist', () => {
      expect(lowestLevel('info', new Map())).toBe('info');
    });

    it('returns the most verbose level from overrides', () => {
      const ns = new Map<string, LogLevel>([['dev', 'debug'], ['pdf', 'error']]);
      expect(lowestLevel('warn', ns)).toBe('debug');
    });

    it('returns trace when any namespace is trace', () => {
      const ns = new Map<string, LogLevel>([['dev', 'trace']]);
      expect(lowestLevel('error', ns)).toBe('trace');
    });

    it('returns global level when overrides are less verbose', () => {
      const ns = new Map<string, LogLevel>([['dev', 'error']]);
      expect(lowestLevel('debug', ns)).toBe('debug');
    });
  });
});
