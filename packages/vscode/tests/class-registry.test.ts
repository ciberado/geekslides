import { describe, expect, it } from 'vitest';
import { BUILTIN_CLASSES, buildClassMap, type ClassEntry } from '../src/completion/class-registry.ts';

describe('class-registry', () => {
  it('contains all 18 layout classes', () => {
    const layouts = BUILTIN_CLASSES.filter((c) => c.category === 'layout');
    expect(layouts.length).toBe(18);
  });

  it('contains mod- prefixed modifiers', () => {
    const modifiers = BUILTIN_CLASSES.filter((c) => c.category === 'modifier');
    expect(modifiers.length).toBeGreaterThanOrEqual(5);
    for (const mod of modifiers) {
      expect(mod.name).toMatch(/^mod-/);
    }
  });

  it('contains bgurl and bgcolor functions', () => {
    const functions = BUILTIN_CLASSES.filter((c) => c.category === 'function');
    const names = functions.map((f) => f.name);
    expect(names).toContain('bgurl');
    expect(names).toContain('bgcolor');
  });

  it('functions have insertText with snippet placeholders', () => {
    const functions = BUILTIN_CLASSES.filter((c) => c.category === 'function');
    for (const fn of functions) {
      expect(fn.insertText).toBeDefined();
      expect(fn.insertText).toContain('$1');
    }
  });

  it('all entries have name, detail, and documentation', () => {
    for (const entry of BUILTIN_CLASSES) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.detail.length).toBeGreaterThan(0);
      expect(entry.documentation.length).toBeGreaterThan(0);
    }
  });

  it('buildClassMap creates a lookup by name', () => {
    const map = buildClassMap(BUILTIN_CLASSES);
    expect(map.get('layout-title')).toBeDefined();
    expect(map.get('mod-coverbg')).toBeDefined();
    expect(map.get('bgurl')).toBeDefined();
    expect(map.get('nonexistent')).toBeUndefined();
  });
});
