import { describe, it, expect, afterEach } from 'vitest';
import { BALANCE } from '../data/balance';
import { BUILDING_STADIUM } from '../sim/constants';
import { stadiumResult } from './stadium';
import { TARGETS } from './targets';
import { buildLivingCity } from '../__tests__/fixtures/testCity';

const ev = BALANCE.leisure.event;
const shipped = { ...ev };
const unlock = BALANCE.leisure.kinds[BUILDING_STADIUM].unlockPopulation;
afterEach(() => { Object.assign(ev, shipped); BALANCE.leisure.kinds[BUILDING_STADIUM].unlockPopulation = unlock; });

describe('balance lab: stadium probe', () => {
  it('a city under the unlock is skipped and every stadium target is n/a', () => {
    const { world } = buildLivingCity();
    BALANCE.leisure.kinds[BUILDING_STADIUM].unlockPopulation = 1e9;
    const r = stadiumResult(world, 1);
    expect(r.asBuilt).toBeUndefined();
    expect(r.note).toMatch(/too small/);
    for (const t of TARGETS.filter(t => t.suite === 'stadium'))
      expect(t.evaluate({ variant: 'shipped', city: 'x', cityKind: 'save', runs: {}, probes: null, refill: null, ordinancesOn: false, stadium: r }).pass).toBeNull();
  });

  it('plays short events on copies, as built and with one line, and leaves the city and BALANCE as they were', () => {
    const { world } = buildLivingCity();
    BALANCE.leisure.kinds[BUILDING_STADIUM].unlockPopulation = 0;
    Object.assign(ev, { duration: 48, ramp: 8, drain: 8, firstGap: 16, gapMin: 16, gapMax: 16 });
    const before = JSON.stringify(BALANCE), tick = world.tick, pop = world.stats.population, n = world.buildings.length;
    const r = stadiumResult(world, 2);
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(world.tick).toBe(tick);
    expect(world.stats.population).toBe(pop);
    expect(world.buildings.length).toBe(n);
    expect(r.note).toBeUndefined();
    expect(r.asBuilt?.events).toHaveLength(2);
    expect(r.asBuilt?.wantedShare).toBeGreaterThan(0);
    expect(r.asBuilt?.declined).toBe(0);
    expect(r.asBuilt?.netPerDay).not.toBeNull();
  }, 120_000);
});
