import { describe, it, expect } from 'vitest';
import type { CapstonesResult, CapstoneNeedRun } from './capstones';
import { TARGETS, type EvalCtx } from './targets';

const grade = (r: CapstonesResult | null, cityKind: 'save' | 'fresh' = 'save') => {
  const ctx: EvalCtx = { variant: 'shipped', city: 'x', cityKind, runs: {}, probes: null, refill: null, ordinancesOn: false, capstones: r };
  return Object.fromEntries(TARGETS.filter((t) => t.suite === 'capstones').map((t) => [t.id.split('.')[1], t.evaluate(ctx)]));
};
const NEEDS: [string, number, number][] = [['sewage', 10000, 3000], ['water', 12500, 1300], ['fire', 15000, 1400], ['police', 20000, 2000], ['hospital', 25000, 1650], ['power', 30000, 4000], ['school', 40000, 1550]];
const needs = (mult: number, coverage = 1): CapstoneNeedRun[] => NEEDS.map(([need, unlockPopulation, smallCost], k) => ({
  kind: 26 + k, need, unlockPopulation, smallCost, aloneCost: Math.round(smallCost * mult), premium: mult, coverage,
}));

describe('balance lab: capstones targets', () => {
  it('a healthy 20k city: a premium over the small buildings, full coverage, two capstones affordable', () => {
    const g = grade({ population: 21000, surplusPerDay: 6000, needs: needs(1.4) });
    expect(g.premium.pass).toBe(true);
    expect(g.coverage.pass).toBe(true);
    expect(g.affordTwo.pass).toBe(true);                    // water +520 and fire +560 out of 6,000
    expect(g.allSeven.pass).toBeNull();                     // under 38k
    expect(grade({ population: 21000, surplusPerDay: 6000, needs: needs(1.05) }).premium.pass).toBe(false);
    expect(grade({ population: 21000, surplusPerDay: 6000, needs: needs(1.4, 0.9) }).coverage.pass).toBe(false);
    expect(grade({ population: 21000, surplusPerDay: 900, needs: needs(1.4) }).affordTwo.pass).toBe(false);
  });

  it('a plain 40k city cannot carry all seven; a much richer one can, and fails the target', () => {
    expect(grade({ population: 41000, surplusPerDay: 5000, needs: needs(1.4) }).allSeven.pass).toBe(true);    // 5,960 a day more
    expect(grade({ population: 41000, surplusPerDay: 9000, needs: needs(1.4) }).allSeven.pass).toBe(false);
    expect(grade({ population: 41000, surplusPerDay: 5000, needs: needs(1.4) }).affordTwo.pass).toBeNull();   // over 30k
    // Six placed (no water for the Waterworks): already over the surplus is a pass; still under it is n/a.
    expect(grade({ population: 41000, surplusPerDay: 4000, needs: needs(1.4).filter((n) => n.need !== 'water') }).allSeven.pass).toBe(true);
    expect(grade({ population: 41000, surplusPerDay: 9000, needs: needs(1.4).filter((n) => n.need !== 'water') }).allSeven.pass).toBeNull();
  });

  it('n/a under 19k, on fresh maps, with nothing placed, and affordTwo for a city in deficit', () => {
    for (const o of Object.values(grade({ population: 15000, surplusPerDay: 4000, needs: needs(1.4) }))) expect(o.pass).toBeNull();
    for (const o of Object.values(grade({ population: 21000, surplusPerDay: 6000, needs: needs(1.4) }, 'fresh'))) expect(o.pass).toBeNull();
    for (const o of Object.values(grade({ population: 21000, surplusPerDay: 6000, needs: [], note: 'no capstone could be placed' }))) expect(o.pass).toBeNull();
    expect(grade({ population: 21000, surplusPerDay: -500, needs: needs(1.4) }).affordTwo.pass).toBeNull();
  });
});
