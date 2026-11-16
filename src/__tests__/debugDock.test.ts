import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { foldOpen, rememberFold } from '../ui/debugDock';

describe('debug dock fold memory', () => {
  const g = globalThis as { localStorage?: unknown };
  const before = g.localStorage;
  afterEach(() => { g.localStorage = before; });

  describe('with storage', () => {
    beforeEach(() => {
      const m = new Map<string, string>();
      g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    });
    it('uses the fallback until a choice is stored', () => {
      expect(foldOpen('dock', true)).toBe(true);
      expect(foldOpen('traffic', false)).toBe(false);
    });
    it('remembers each key separately', () => {
      rememberFold('dock', false);
      rememberFold('traffic', true);
      expect(foldOpen('dock', true)).toBe(false);
      expect(foldOpen('traffic', false)).toBe(true);
      expect(foldOpen('economy', true)).toBe(true);
    });
  });

  it('falls back quietly when storage throws', () => {
    g.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(foldOpen('dock', true)).toBe(true);
    expect(() => rememberFold('dock', false)).not.toThrow();
  });
});
