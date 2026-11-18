import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { airportResult } from './airport';
import { buildLivingCity } from '../__tests__/fixtures/testCity';

describe('balance lab: airport probe', () => {
  it('builds the airport on a copy against a twin, measures it, and leaves the city and BALANCE as they were', () => {
    const before = JSON.stringify(BALANCE);
    const { world } = buildLivingCity();
    const buildings = world.buildings.length, money = world.budget.money;
    const r = airportResult(world, 5);
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(world.buildings.length).toBe(buildings);
    expect(world.budget.money).toBe(money);
    // The request's size in PC bars is known whether or not a site is found.
    expect(r.requestBars).toBeGreaterThan(0);
    if (r.site) {
      expect(r.seats).toBeGreaterThanOrEqual(0);
      expect(r.seats).toBeLessThanOrEqual(1);
      expect(r.frontJam).toBeGreaterThanOrEqual(0);
    } else {
      expect(r.note).toBeTruthy();
    }
  }, 60_000);
});
