import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { applyTaxDebtValues, taxDebtResult } from './taxdebt';
import { TUNED_T } from './tunedT';

describe('balance lab: debt / tax probes', () => {
  it('applies a number set and puts the old numbers back', () => {
    const before = JSON.stringify(BALANCE);
    const restore = applyTaxDebtValues({ debtPcDrainPerDay: 1, satisfactionPerPoint: 0.02, demandStrength: 2 });
    expect(BALANCE.budget.debtPcDrainPerDay).toBe(1);
    expect(BALANCE.tax.level.satisfactionPerPoint).toBe(0.02);
    restore();
    expect(JSON.stringify(BALANCE)).toBe(before);
  });

  it('measures the drain over the grace period and leaves BALANCE as it was', () => {
    const before = JSON.stringify(BALANCE);
    const restore = applyTaxDebtValues({ debtPcDrainPerDay: 1 });
    try {
      const r = taxDebtResult({ id: 'fresh', kind: 'fresh', size: 128, seed: 7 }, 20, 20, TUNED_T);
      // A city held in debt from a full cap loses about drain × days × cap ÷ max.
      expect(r.drain.share).toBeGreaterThan(0);
      expect(r.drain.share).toBeLessThanOrEqual(1);
      expect(Object.keys(r.levels).map(Number)).toEqual([0, 5, 10, 15, 20]);
    } finally { restore(); }
    expect(JSON.stringify(BALANCE)).toBe(before);
  }, 60_000);
});
