import { describe, it, expect } from 'vitest';
import { isValidLevel, parseNamespaceLevels } from '../../src/logging.ts';

describe('engine logging config', () => {
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
      expect(isValidLevel('Warning')).toBe(false);
    });
  });

  describe('parseNamespaceLevels', () => {
    it('parses namespace:level pairs', () => {
      const map = parseNamespaceLevels('sync:debug,parser:trace');
      expect(map.get('sync')).toBe('debug');
      expect(map.get('parser')).toBe('trace');
      expect(map.size).toBe(2);
    });

    it('returns empty map for empty string', () => {
      const map = parseNamespaceLevels('');
      expect(map.size).toBe(0);
    });

    it('ignores entries without a colon', () => {
      const map = parseNamespaceLevels('debug,sync:trace');
      expect(map.size).toBe(1);
      expect(map.get('sync')).toBe('trace');
    });

    it('ignores entries with invalid levels', () => {
      const map = parseNamespaceLevels('sync:banana,parser:info');
      expect(map.has('sync')).toBe(false);
      expect(map.get('parser')).toBe('info');
    });

    it('handles whitespace', () => {
      const map = parseNamespaceLevels(' sync : debug , parser : trace ');
      expect(map.get('sync')).toBe('debug');
      expect(map.get('parser')).toBe('trace');
    });

    it('handles single namespace', () => {
      const map = parseNamespaceLevels('hmr:warn');
      expect(map.size).toBe(1);
      expect(map.get('hmr')).toBe('warn');
    });

    it('ignores entry with empty namespace', () => {
      const map = parseNamespaceLevels(':debug');
      expect(map.size).toBe(0);
    });
  });
});
