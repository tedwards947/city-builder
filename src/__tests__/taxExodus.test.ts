// Tax exodus: while the tax level is above neutral, developed homes slowly
// lose levels. Ships switched off.

import { describe, it, expect, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_C } from '../sim/constants';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { taxExodusChance, taxEffect } from '../sim/tax';
import { landWorld, homes } from './pcTestWorld';

const LEVEL = BALANCE.tax.level as Record<string, number>;
const shipped = { ...LEVEL };
afterEach(() => { Object.assign(LEVEL, shipped); });

/** 100 level-2 homes with no power (so nothing grows), at the given tax level. */
function town(taxLevel: number): World {
  const w = landWorld();
  homes(w, 5, 5, 14, 14);
  w.budget.taxLevel = taxLevel;
  return w;
}
/** Run `passes` growth passes. */
function run(w: World, passes: number): void {
  const sys = new ZoneGrowthSystem();
  for (let k = 0; k < passes; k++) { w.tick += BALANCE.growth.tickInterval; sys.update(w); }
}
const levels = (w: World) => w.layers.devLevel.reduce((a, b) => a + b, 0);

describe('tax exodus', () => {
  it('ships switched off: no home declines and no random number is drawn for it', () => {
    expect(shipped.exodusPerPoint).toBe(0);
    expect(taxExodusChance(20)).toBe(0);
    const high = town(20), neutral = town(10);
    run(high, 50); run(neutral, 50);
    expect(levels(high)).toBe(200);
    expect(high.rng()).toBe(neutral.rng());
  });

  it('the chance grows with each point above neutral and is 0 at or below it', () => {
    LEVEL.exodusPerPoint = 0.01;
    expect(taxExodusChance(10)).toBe(0);
    expect(taxExodusChance(5)).toBe(0);
    expect(taxExodusChance(11)).toBeCloseTo(0.01);
    expect(taxExodusChance(20)).toBeCloseTo(0.1);
    expect(taxEffect(town(10), 15).exodusChance).toBeCloseTo(0.05);
    LEVEL.exodusPerPoint = 1;
    expect(taxExodusChance(20)).toBe(1);
  });

  it('homes lose levels above neutral, faster the higher the tax; none at neutral', () => {
    LEVEL.exodusPerPoint = 0.01;
    const at10 = town(10), at12 = town(12), at20 = town(20);
    run(at10, 10); run(at12, 10); run(at20, 10);
    expect(levels(at10)).toBe(200);
    // Expected losses: 100 homes × 10 passes × chance = 20 at 12%, 100 at 20%.
    const lost12 = 200 - levels(at12), lost20 = 200 - levels(at20);
    expect(lost12).toBeGreaterThan(5);
    expect(lost12).toBeLessThan(45);
    expect(lost20).toBeGreaterThan(65);
    expect(lost20).toBeLessThan(135);
  });

  it('a home loses one level at a time, down to an empty lot, and says so; shops and abandoned homes are left alone', () => {
    LEVEL.exodusPerPoint = 0.1;                      // certain at 20%
    const w = town(20);
    const shop = w.grid.idx(20, 20), ruin = w.grid.idx(5, 5);
    w.setZone(20, 20, ZONE_C); w.layers.devLevel[shop] = 2;
    w.layers.abandoned[ruin] = 1;
    const seen: { level: number; reason: string }[] = [];
    w.events.on('tileDeclined', e => seen.push(e as { level: number; reason: string }));
    run(w, 1);
    expect(levels(w)).toBe(99 + 2 + 2);              // 99 homes at level 1, the ruin and the shop at 2
    expect(seen.length).toBe(99);
    expect(seen.every(e => e.level === 1 && e.reason === 'tax')).toBe(true);
    run(w, 2);
    expect(levels(w)).toBe(4);                       // homes empty and stay empty
    expect(w.layers.devLevel[shop]).toBe(2);
    expect(w.layers.devLevel[ruin]).toBe(2);
    expect(w.layers.zone[w.grid.idx(6, 6)]).not.toBe(0);   // still zoned: it can grow back
  });
});
