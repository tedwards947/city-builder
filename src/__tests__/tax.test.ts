// The city's tax level: one percentage that scales tax income and moves satisfaction.

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { PoliticsSystem } from '../sim/systems/PoliticsSystem';
import { taxLevelRange, setTaxLevel, taxEffect, taxIncomeMult, taxSatisfactionDelta } from '../sim/tax';
import { regenPerTick } from '../sim/politics';
import { serialize, deserialize } from '../persistence/Serializer';
import { ZONE_R, ZONE_C, ZONE_I, BUILDING_POWER_PLANT, TERRAIN_GRASS } from '../sim/constants';
import { BALANCE } from '../data/balance';

let w: World;

/** A few homes, shops and factories, and one power plant to pay for. */
function city(): World {
  const world = new World(12, 12, 1);
  world.layers.terrain.fill(TERRAIN_GRASS);
  [ZONE_R, ZONE_R, ZONE_C, ZONE_I].forEach((z, k) => {
    const i = world.grid.idx(2 + k, 2);
    world.layers.zone[i] = z; world.layers.devLevel[i] = 2; world.layers.landValue[i] = 128;
  });
  world.placeBuilding(8, 8, BUILDING_POWER_PLANT);
  return world;
}
const tick = (world = w) => { world.tick++; new EconomySystem().update(world); new PoliticsSystem().update(world); };

beforeEach(() => { w = city(); });

describe('tax level', () => {
  it('starts at the neutral level, where income and satisfaction are untouched', () => {
    const { min, max, neutral, step } = taxLevelRange();
    expect([min, max, neutral, step]).toEqual([0, 20, 10, 1]);
    expect(w.budget.taxLevel).toBe(neutral);
    expect(taxIncomeMult(neutral)).toBe(1);
    expect(taxSatisfactionDelta(neutral)).toBe(0);
    tick();
    const at10 = { income: w.budget.income, sat: w.stats.satisfaction };
    // The same city with the level never mentioned gives the same figures to the last bit.
    const plain = city();
    (plain.budget as { taxLevel: number }).taxLevel = 10;
    tick(plain);
    expect(plain.budget.income).toBe(at10.income);
    expect(plain.stats.satisfaction).toBe(at10.sat);
    expect(at10.income).toBeGreaterThan(0);
  });

  it('scales tax income in proportion and leaves expenses alone', () => {
    tick();
    const base = w.budget.income, expenses = w.budget.expenses;
    setTaxLevel(w, 15);
    tick();
    expect(w.budget.income).toBeCloseTo(base * 1.5);
    expect(w.budget.expenses).toBe(expenses);
    setTaxLevel(w, 0);
    tick();
    expect(w.budget.income).toBe(0);
    setTaxLevel(w, 20);
    tick();
    expect(w.budget.income).toBeCloseTo(base * 2);
  });

  it('lower tax raises satisfaction, higher tax lowers it, within 0 to 1', () => {
    // No services, power or water here, so base satisfaction is low but above zero (no crime).
    tick();
    const base = w.stats.satisfaction;
    expect(base).toBeGreaterThan(0.1);
    expect(base).toBeLessThan(0.9);
    setTaxLevel(w, 4);
    tick();
    expect(w.stats.satisfaction).toBeCloseTo(base + 0.06);
    setTaxLevel(w, 20);
    tick();
    expect(w.stats.satisfaction).toBeCloseTo(base - 0.10);
    // Clamped at the ends.
    const L = BALANCE.tax.level as { satisfactionPerPoint: number };
    const shipped = L.satisfactionPerPoint;
    try {
      L.satisfactionPerPoint = 1;
      setTaxLevel(w, 0); tick();
      expect(w.stats.satisfaction).toBe(1);
      setTaxLevel(w, 20); tick();
      expect(w.stats.satisfaction).toBe(0);
    } finally { L.satisfactionPerPoint = shipped; }
  });

  it('setTaxLevel keeps to the range and the step, and reports a change once', () => {
    const seen: { level: number; previous: number }[] = [];
    w.events.on('taxLevelChanged', (p) => seen.push(p as unknown as { level: number; previous: number }));
    expect(setTaxLevel(w, 12.4)).toBe(12);
    expect(setTaxLevel(w, 12)).toBe(12);              // no change: no event
    expect(setTaxLevel(w, 99)).toBe(20);
    expect(setTaxLevel(w, -5)).toBe(0);
    expect(setTaxLevel(w, NaN)).toBe(0);              // nonsense leaves it where it was
    expect(seen).toEqual([{ level: 12, previous: 10 }, { level: 20, previous: 12 }, { level: 0, previous: 20 }]);
  });

  it('taxEffect previews a level without changing anything, and matches what then happens', () => {
    tick();
    const now = taxEffect(w);
    expect(now).toMatchObject({ level: 10, incomeMult: 1, incomeChange: 0, satisfactionDelta: 0 });
    expect(now.income).toBe(w.budget.income);
    expect(now.net).toBe(w.budget.income - w.budget.expenses);
    expect(now.satisfaction).toBeCloseTo(w.stats.satisfaction);
    expect(now.pcRegenPerDay).toBeCloseTo(regenPerTick(w, w.stats.satisfaction) * BALANCE.ticksPerDay);

    const preview = taxEffect(w, 16);
    expect(w.budget.taxLevel).toBe(10);
    expect(preview.incomeMult).toBeCloseTo(1.6);
    expect(preview.satisfactionDelta).toBeCloseTo(-0.06);
    setTaxLevel(w, 16);
    tick();
    expect(w.budget.income).toBeCloseTo(preview.income);
    expect(w.stats.satisfaction).toBeCloseTo(preview.satisfaction);
    // Previewing from a non-neutral level works back to the same base.
    expect(taxEffect(w, 10).income).toBeCloseTo(now.income);
    expect(taxEffect(w, 10).satisfaction).toBeCloseTo(now.satisfaction);
    // At 0% there is no income to scale back from: the preview says 0 rather than guess.
    setTaxLevel(w, 0);
    tick();
    expect(taxEffect(w, 10).income).toBe(0);
  });

  it('is saved with the city; a save from before loads at neutral', () => {
    setTaxLevel(w, 7);
    expect(deserialize(serialize(w)).budget.taxLevel).toBe(7);
    const old = serialize(city());
    delete (old.budget as Partial<World['budget']>).taxLevel;
    expect(deserialize(old).budget.taxLevel).toBe(10);
  });
});
