// The budget panel's lines add up to what the money does.

import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { setTaxLevel } from '../sim/tax';
import { budgetLines } from '../ui/EconPanel';
import { ZONE_R, ZONE_C, BUILDING_POWER_PLANT, BUILDING_POLICE, ROAD_STREET, TERRAIN_GRASS } from '../sim/constants';
import { makeTrafficData } from '../sim/TrafficData';
import { BALANCE } from '../data/balance';
import { enactOrdinance } from '../sim/ordinances';
import { lostFareIncome, railFareIncome } from '../sim/rail';

let w: World;

function city(): World {
  const world = new World(14, 14, 1);
  world.layers.terrain.fill(TERRAIN_GRASS);
  [ZONE_R, ZONE_R, ZONE_C].forEach((z, k) => {
    const i = world.grid.idx(2 + k, 2);
    world.layers.zone[i] = z; world.layers.devLevel[i] = 2; world.layers.landValue[i] = 128;
  });
  for (let x = 0; x < 10; x++) world.setRoad(x, 4, ROAD_STREET);
  world.placeBuilding(8, 8, BUILDING_POWER_PLANT);
  world.placeBuilding(6, 6, BUILDING_POLICE);
  return world;
}
const tick = () => { w.tick++; new EconomySystem().update(w); };

beforeEach(() => {
  w = city();
  // Fares are non-tax income: riders boarded this tick.
  w.traffic = makeTrafficData(w.grid.width * w.grid.height);
  w.traffic.rail.boardings = 40;
});

describe('budget lines', () => {
  it('lost fares: shown only under Free Transit, equal to the fares not collected, never in the money flow', () => {
    w.budget.politicalCapital = 100;
    expect(lostFareIncome(w)).toBe(0);
    const paid = railFareIncome(w);
    expect(paid).toBeGreaterThan(0);
    expect(enactOrdinance(w, 'freeTransit')).toBe(true);
    expect(railFareIncome(w)).toBe(0);
    expect(lostFareIncome(w)).toBe(paid);
    const l = budgetLines(w);
    expect(Object.keys(l)).not.toContain('lostFares');
  });

  it('count an enacted ordinance\'s money cost in expenses, on its own line, and still add up', () => {
    w.stats.population = 20_000;
    w.budget.politicalCapital = 100;
    tick();
    const off = budgetLines(w);
    expect(off.ordinances).toBe(0);
    expect(enactOrdinance(w, 'freeTransit')).toBe(true);
    const before = w.budget.money;
    tick();
    const l = budgetLines(w);
    expect(l.ordinances).toBeGreaterThan(0);
    expect(w.budget.expenses).toBeGreaterThan(off.upkeep + off.running);
    expect(l.tax + l.other - l.upkeep - l.running - l.ordinances).toBeCloseTo(l.net, 6);
    expect(l.net).toBeCloseTo(w.budget.money - before, 6);
  });

  it('sum to the net, and the net is what the money does each tick', () => {
    const before = w.budget.money;
    tick();
    const l = budgetLines(w);
    expect(l.other).toBeGreaterThan(0);                 // fares are in
    expect(l.upkeep).toBeGreaterThan(0);
    expect(l.running).toBeGreaterThanOrEqual(0);
    expect(l.tax + l.other - l.upkeep - l.running).toBeCloseTo(l.net, 6);
    expect(l.net).toBeCloseTo(w.budget.income - w.budget.expenses, 6);
    expect(l.net).toBeCloseTo(w.budget.money - before, 6);
    expect(l.net * BALANCE.ticksPerDay).toBeCloseTo((w.budget.money - before) * BALANCE.ticksPerDay, 4);
  });

  it('the slider preview moves tax and net together and leaves the other lines alone', () => {
    tick();
    const now = budgetLines(w), hi = budgetLines(w, 16);
    expect(hi.tax).toBeCloseTo(now.tax * 1.6);
    expect(hi.other).toBe(now.other);
    expect(hi.upkeep).toBe(now.upkeep);
    expect(hi.tax + hi.other - hi.upkeep - hi.running).toBeCloseTo(hi.net, 6);
    const preview = hi.net;
    setTaxLevel(w, 16);
    const before = w.budget.money;
    tick();
    expect(w.budget.money - before).toBeCloseTo(preview, 6);
  });
});
