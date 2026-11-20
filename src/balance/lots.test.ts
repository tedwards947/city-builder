import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { ZONE_R } from '../sim/constants';
import { canMergeLot, mergeLot } from '../sim/lots';
import { lotsResult } from './lots';
import { TARGETS } from './targets';
import { buildLivingCity } from '../__tests__/fixtures/testCity';

describe('balance lab: 2×2 lots probe', () => {
  it('runs merging on copies, undoes the save\'s own merged lots first, measures capacity, and leaves the city and BALANCE as they were', () => {
    const before = JSON.stringify(BALANCE);
    const { world } = buildLivingCity();
    // A merged lot in the "save", as the owner's debug merges are.
    const { width } = world.grid;
    let merged = false;
    for (let k = 0; k < world.index.zonedCount && !merged; k++) {
      const i = world.index.zoned[k], x = i % width, y = (i - x) / width;
      if (world.layers.zone[i] === ZONE_R && canMergeLot(world, x, y)) merged = mergeLot(world, x, y);
    }
    const lots = world.layers.lot.slice(), pop = world.stats.population, tick = world.tick;
    const r = lotsResult(world, 12, [1]);
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(world.layers.lot).toEqual(lots);
    expect(world.stats.population).toBe(pop);
    expect(world.tick).toBe(tick);
    expect(r.undone).toBe(merged ? 1 : 0);
    expect(r.homesShops.first).toHaveLength(1);
    // Capacity is exactly the tables' 1.5×, and so are the trips (taken from the traffic pass).
    for (const c of r.capacity) {
      expect(c.weight).toBeCloseTo(1.5, 3);
      if (c.residents !== null) expect(c.residents).toBeCloseTo(1.5, 3);
      if (c.trips !== null) expect(c.trips).toBeCloseTo(1.5, 2);
    }
    expect(r.capacity.some((c) => c.zone === ZONE_R)).toBe(true);
  }, 120_000);

  it('grades its targets, n/a on fresh maps and lots.first on generated cities', () => {
    const lots = TARGETS.filter((t) => t.suite === 'lots');
    expect(lots.map((t) => t.id)).toEqual(['lots.first', 'lots.edge', 'lots.rare', 'lots.capacity', 'lots.traffic']);
    const g = { first: [40, null], firstMean: 200.5, by90: 2, byEnd: 7, edgeShare: 0.1, maxWindow: 2 };
    const l = { days: 360, seeds: [1, 2], undone: 0, homesShops: g, industry: g, pairs: g, capacity: [{ zone: 1, shape: 'square' as const, residents: 1.5, weight: 1.5, trips: 1.5 }] };
    const ctx = (city: string, cityKind: 'fresh' | 'save') => ({ variant: 'shipped', city, cityKind, runs: {}, probes: null, refill: null, ordinancesOn: false, lots: l });
    const at = (id: string, city: string, kind: 'fresh' | 'save' = 'save') => lots.find((t) => t.id === id)!.evaluate(ctx(city, kind)).pass;
    expect(at('lots.first', 'golden-1')).toBe(false);   // mean 200.5 > 120
    expect(at('lots.first', 'gen-s1-t10000')).toBe(null);
    expect(at('lots.edge', 'golden-1')).toBe(true);
    expect(at('lots.rare', 'golden-1')).toBe(true);
    expect(at('lots.capacity', 'golden-1')).toBe(true);
    expect(at('lots.traffic', 'golden-1')).toBe(true);
    for (const t of lots) expect(t.evaluate(ctx('fresh-128', 'fresh')).pass).toBe(null);
  });
});
