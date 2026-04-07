import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../sim/rng';

describe('mulberry32', () => {
  it('returns values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed produces same sequence', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const aVals = Array.from({ length: 10 }, () => a());
    const bVals = Array.from({ length: 10 }, () => b());
    expect(aVals).not.toEqual(bVals);
  });
});
