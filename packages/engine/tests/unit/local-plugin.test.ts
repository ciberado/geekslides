import { describe, it, expect } from 'vitest';
import { isLocalPluginPath, extractPreprocessor, extractProcessor } from '../../src/plugins/local-plugin.ts';

describe('isLocalPluginPath', () => {
  it('returns true for ./ relative paths', () => {
    expect(isLocalPluginPath('./plugins/emoji.js')).toBe(true);
  });

  it('returns true for ../ relative paths', () => {
    expect(isLocalPluginPath('../shared/plugin.js')).toBe(true);
  });

  it('returns false for built-in names', () => {
    expect(isLocalPluginPath('header')).toBe(false);
    expect(isLocalPluginPath('iframe')).toBe(false);
  });

  it('returns false for absolute paths', () => {
    expect(isLocalPluginPath('/plugins/emoji.js')).toBe(false);
  });

  it('returns false for URLs', () => {
    expect(isLocalPluginPath('https://cdn.example.com/plugin.js')).toBe(false);
  });
});

describe('extractPreprocessor', () => {
  it('extracts a default function export', () => {
    const fn = (md: string) => md.toUpperCase();
    const mod = { default: fn };
    const result = extractPreprocessor(mod, './test.js');
    expect(result).toBe(fn);
  });

  it('throws when default export is missing', () => {
    const mod = { notDefault: () => '' };
    expect(() => extractPreprocessor(mod, './test.js')).toThrow(
      'must export a default function',
    );
  });

  it('throws when default export is not a function', () => {
    const mod = { default: 'not a function' };
    expect(() => extractPreprocessor(mod, './test.js')).toThrow(
      'must export a default function',
    );
  });

  it('includes the path in the error message', () => {
    const mod = { default: 42 };
    expect(() => extractPreprocessor(mod, './my-plugin.js')).toThrow('./my-plugin.js');
  });
});

describe('extractProcessor', () => {
  it('extracts a default function export', () => {
    const fn = () => {};
    const mod = { default: fn };
    const result = extractProcessor(mod, './test.js');
    expect(result).toBe(fn);
  });

  it('throws when default export is missing', () => {
    const mod = {};
    expect(() => extractProcessor(mod, './zoom.js')).toThrow(
      'must export a default function',
    );
  });

  it('throws when default export is not a function', () => {
    const mod = { default: null };
    expect(() => extractProcessor(mod, './zoom.js')).toThrow(
      'must export a default function',
    );
  });

  it('includes the path in the error message', () => {
    const mod = { default: [] };
    expect(() => extractProcessor(mod, './my-proc.js')).toThrow('./my-proc.js');
  });
});
