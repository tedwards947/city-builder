// Stakes: debt, fire damage, reachable abandonment thresholds, refusal reasons.
import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { FireSystem } from '../sim/systems/FireSystem';
import { CrimeSystem } from '../sim/systems/CrimeSystem';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import {
  ZONE_R, ZONE_C, ZONE_I, ROAD_STREET, ROAD_NONE,
  BUILDING_POWER_PLANT, BUILDING_PARK,
} from '../sim/constants';
import { BALANCE } from '../data/balance';

function makeWorld() {
  const w = new World(16, 16, 0);
  w.layers.terrain.fill(0);
  w.layers.vegetation.fill(0);
  return w;
}

/** A developed zone tile with power, water and an adjacent street. */
function develop(w: World, tx: number, ty: number, zone: number, level: number) {
  const i = w.grid.idx(tx, ty);
  w.layers.zone[i] = zone;
  w.layers.devLevel[i] = level;
  w.layers.power[i] = 1;
  w.layers.water[i] = 1;
  w.layers.roadClass[w.grid.idx(tx + 1, ty)] = ROAD_STREET;
  return i;
}

function record(w: World, type: string) {
  const seen: any[] = [];
  w.events.on(type, p => seen.push(p));
  return seen;
}

describe('debt', () => {
  it('emits debtEntered once when money drops below zero, debtCleared once on recovery', () => {
    const w = makeWorld();
    w.placeBuilding(2, 2, BUILDING_POWER_PLANT); // upkeep, no income
    const entered = record(w, 'debtEntered');
    const cleared = record(w, 'debtCleared');
    const sys = new EconomySystem();

    w.budget.money = 20;
    for (let k = 0; k < 10; k++) { w.tick++; sys.update(w); }
    expect(w.budget.money).toBeLessThan(0);
    expect(entered.length).toBe(1);
    expect(cleared.length).toBe(0);

    w.budget.money = 100000;
    for (let k = 0; k < 5; k++) { w.tick++; sys.update(w); }
    expect(cleared.length).toBe(1);
    expect(entered.length).toBe(1);
  });

  it('warns before the treasury runs dry, throttled by the cooldown', () => {
    const w = makeWorld();
    w.placeBuilding(2, 2, BUILDING_POWER_PLANT);
    const warnings = record(w, 'budgetWarning');
    const sys = new EconomySystem();
    const upkeep = BALANCE.buildings[BUILDING_POWER_PLANT].maintenance;

    // Plenty of runway: no warning.
    w.budget.money = upkeep * BALANCE.ticksPerDay * BALANCE.budget.lowFundsWarningDays * 10;
    w.tick++; sys.update(w);
    expect(warnings.length).toBe(0);

    // About 10 days of runway: warn once, then stay quiet for the cooldown.
    w.budget.money = upkeep * BALANCE.ticksPerDay * 10;
    for (let k = 0; k < 20; k++) { w.tick++; sys.update(w); }
    expect(warnings.length).toBe(1);
    expect(warnings[0].daysLeft).toBeGreaterThan(0);
    expect(warnings[0].daysLeft).toBeLessThan(BALANCE.budget.lowFundsWarningDays);
  });

  it('does not warn when the budget is balanced or growing', () => {
    const w = makeWorld();
    const warnings = record(w, 'budgetWarning');
    const sys = new EconomySystem();
    w.budget.money = 1;
    for (let k = 0; k < 20; k++) { w.tick++; sys.update(w); }
    expect(warnings.length).toBe(0);
  });

  it('blocks zones, roads and buildings in debt and reports the reason', () => {
    const w = makeWorld();
    w.budget.money = -1;

    const zone = new PaintZoneCommand(3, 3, ZONE_R);
    expect(zone.execute(w)).toBe(false);
    expect(zone.failReason).toBe('funds');

    const road = new BuildRoadCommand(4, 4);
    expect(road.execute(w)).toBe(false);
    expect(road.failReason).toBe('funds');
    expect(w.layers.roadClass[w.grid.idx(4, 4)]).toBe(ROAD_NONE);

    const park = new PlaceBuildingCommand(5, 5, BUILDING_PARK);
    expect(park.execute(w)).toBe(false);
    expect(park.failReason).toBe('funds');
    expect(w.budget.money).toBe(-1);
  });

  it('still lets a city in debt demolish upkeep', () => {
    const w = makeWorld();
    w.placeBuilding(2, 2, BUILDING_POWER_PLANT);
    w.budget.money = -500;
    expect(new BulldozeCommand(2, 2).execute(w)).toBe(true);
    expect(w.buildings.length).toBe(0);
  });

  it('reports political capital as the reason when residents cannot be displaced', () => {
    const w = makeWorld();
    develop(w, 3, 3, ZONE_R, 3);
    w.budget.politicalCapital = 0;
    const cmd = new BulldozeCommand(3, 3);
    expect(cmd.execute(w)).toBe(false);
    expect(cmd.failReason).toBe('politicalCapital');
  });

  it('leaves failReason null for refusals that are not about resources', () => {
    const w = makeWorld();
    const cmd = new BulldozeCommand(3, 3); // bare terrain
    expect(cmd.execute(w)).toBe(false);
    expect(cmd.failReason).toBeNull();
  });
});

describe('fire damage', () => {
  /** Lights a tile and runs the fire system until it is out. */
  function burnOut(w: World, tx: number, ty: number) {
    const sys = new FireSystem();
    w.setFire(tx, ty, BALANCE.fire.burnDuration);
    for (let k = 0; k < BALANCE.fire.burnDuration + 2; k++) {
      sys.update(w);
      if (w.layers.fire[w.grid.idx(tx, ty)] === 0) break;
    }
  }

  it('downgrades an uncovered building by one level when the fire burns out', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_C, 3);
    const damage = record(w, 'fireDamage');
    burnOut(w, 5, 5);
    expect(w.layers.fire[i]).toBe(0);
    expect(w.layers.devLevel[i]).toBe(3 - BALANCE.fire.damageLevels);
    expect(damage.length).toBe(1);
    expect(damage[0]).toMatchObject({ tx: 5, ty: 5, zone: ZONE_C, level: 2 });
  });

  it('does not damage a building covered by a fire station', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_C, 3);
    w.layers.fireStation[i] = 1;
    const damage = record(w, 'fireDamage');
    burnOut(w, 5, 5);
    expect(w.layers.fire[i]).toBe(0);
    expect(w.layers.devLevel[i]).toBe(3);
    expect(damage.length).toBe(0);
  });

  it('a level 1 building burns down to an empty zoned lot', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_R, 1);
    burnOut(w, 5, 5);
    expect(w.layers.devLevel[i]).toBe(0);
    expect(w.layers.zone[i]).toBe(ZONE_R);
  });

  it('an abandoned level 1 ruin that burns down is no longer abandoned', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_R, 1);
    w.layers.abandoned[i] = 1;
    w.layers.distress[i] = 30;
    burnOut(w, 5, 5);
    expect(w.layers.devLevel[i]).toBe(0);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
  });

  it('never damages an undeveloped lot', () => {
    const w = makeWorld();
    const i = w.grid.idx(5, 5);
    w.layers.zone[i] = ZONE_R;
    const damage = record(w, 'fireDamage');
    burnOut(w, 5, 5);
    expect(w.layers.devLevel[i]).toBe(0);
    expect(damage.length).toBe(0);
  });
});

describe('abandonment thresholds are reachable', () => {
  /** Runs crime + abandonment for `ticks` on a tile that has power, water and a road. */
  function run(w: World, ticks: number) {
    const crime = new CrimeSystem();
    const aband = new AbandonmentSystem();
    for (let k = 0; k < ticks; k++) { w.tick++; crime.update(w); aband.update(w); }
  }

  it('unpoliced commercial level 2 is stable', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_C, 2);
    run(w, 2000);
    expect(w.layers.crime[i]).toBeLessThan(BALANCE.crime.distressThreshold);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
  });

  it('unpoliced commercial level 3 reaches severe crime and is abandoned', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_C, 3);
    run(w, 400);
    expect(w.layers.crime[i]).toBeGreaterThanOrEqual(BALANCE.crime.abandonThreshold);
    expect(w.layers.abandoned[i]).toBe(1);
  });

  it('policed commercial level 3 is stable', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_C, 3);
    w.layers.police[i] = 1;
    run(w, 2000);
    expect(w.layers.abandoned[i]).toBe(0);
  });

  it('heavily polluted level 3 industry without a fire station reaches severe fire risk', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_I, 3);
    w.layers.pollution[i] = 255;
    const fire = new FireSystem();
    // Risk only; keep the rng from lighting anything.
    w.rng = () => 1;
    for (let k = 0; k < 200; k++) fire.update(w);
    expect(w.layers.fireRisk[i]).toBeGreaterThanOrEqual(BALANCE.fire.abandonThreshold);

    const aband = new AbandonmentSystem();
    for (let k = 0; k < 200; k++) { w.tick++; aband.update(w); }
    expect(w.layers.abandoned[i]).toBe(1);
  });

  it('the same industry with a fire station stays below severe fire risk', () => {
    const w = makeWorld();
    const i = develop(w, 5, 5, ZONE_I, 3);
    w.layers.pollution[i] = 255;
    w.layers.fireStation[i] = 1;
    const fire = new FireSystem();
    w.rng = () => 1;
    for (let k = 0; k < 200; k++) fire.update(w);
    expect(w.layers.fireRisk[i]).toBeLessThan(BALANCE.fire.abandonThreshold);
  });
});
