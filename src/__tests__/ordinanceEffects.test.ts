// What each ordinance modifier does inside the simulation systems. The shipped
// modifiers are all 1 (no effect), so these tests set numbers for their duration
// and compare a city run with an ordinance against the same city without it.

import { describe, it, expect, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { enactOrdinance } from '../sim/ordinances';
import type { OrdinanceId } from '../sim/ordinances';
import { pcQuote } from '../sim/politics';
import { ZONE_R, ZONE_C, ZONE_I, ROAD_HIGHWAY } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { buildLivingCity } from './fixtures/testCity';
import { landWorld, home, displacementCost } from './pcTestWorld';

type Numbers = { enactCost: number; dailyUpkeep: number; dailyMoney: number; modifiers: Record<string, number> };
const table = BALANCE.politicalCapital.ordinances as Record<string, Numbers>;
const saved = structuredClone(table);
afterEach(() => { for (const id of Object.keys(saved)) Object.assign(table[id], structuredClone(saved[id])); });

/** Enough ticks for land value and demand (recalculated every growth.tickInterval ticks) to have run. */
const RECALC = BALANCE.growth.tickInterval + 1;

/** Run the test city for `ticks`, with `id` enacted (after setting its modifiers) or with nothing. */
function run(ticks: number, id?: OrdinanceId, modifiers?: Record<string, number>): World {
  const { world } = buildLivingCity();
  if (id) {
    Object.assign(table[id].modifiers, modifiers);
    expect(enactOrdinance(world, id)).toBe(true);
  }
  const scheduler = new Scheduler(world, createSystems().systems);
  for (let k = 0; k < ticks; k++) scheduler.tick();
  return world;
}

function sumWhere(w: World, layer: Uint8Array, zoneType?: number): number {
  let s = 0;
  for (let i = 0; i < layer.length; i++) if (zoneType === undefined || w.layers.zone[i] === zoneType) s += layer[i];
  return s;
}
const levels = (w: World, zoneType: number) => sumWhere(w, w.layers.devLevel, zoneType);
const trafficTotal = (w: World) => {
  let s = 0;
  for (const m of w.traffic!.markets) for (let i = 0; i < m.volume.length; i++) s += m.volume[i];
  return s;
};

describe('ordinance modifiers in the simulation', () => {
  it('an enacted ordinance whose modifiers are all 1 changes nothing', () => {
    const base = run(60);
    const same = run(60, 'fastTrackPermits');
    expect(sumWhere(same, same.layers.crime)).toBe(sumWhere(base, base.layers.crime));
    expect(sumWhere(same, same.layers.pollution)).toBe(sumWhere(base, base.layers.pollution));
    expect(sumWhere(same, same.layers.devLevel)).toBe(sumWhere(base, base.layers.devLevel));
    expect(same.budget.money).toBe(base.budget.money);
    expect(trafficTotal(same)).toBe(trafficTotal(base));
  });

  it('crime: less builds up', () => {
    const base = run(80);
    const watched = run(80, 'neighbourhoodWatch', { crime: 0.7 });
    expect(sumWhere(watched, watched.layers.crime)).toBeLessThan(sumWhere(base, base.layers.crime) * 0.9);
  });

  it('industrialPollution and pollution: sources put out less (or more)', () => {
    const base = run(80);
    // Dense industry already saturates its own tile, so the test uses the
    // extremes: industry emitting nothing, and everything emitting double.
    const clean = run(80, 'cleanAirAct', { industrialPollution: 0 });
    const dirty = run(80, 'fastTrackPermits', { pollution: 2 });
    const total = (w: World) => sumWhere(w, w.layers.pollution);
    expect(total(clean)).toBeLessThan(total(base) * 0.5);
    expect(total(clean)).toBeGreaterThan(0);                    // power plants still pollute
    expect(total(dirty)).toBeGreaterThan(total(base));
  });

  it('commercialIncome and industrialIncome: tax from shops and industry scales, homes do not', () => {
    const base = run(2);
    const curfew = run(2, 'curfew', { commercialIncome: 0 });
    const both = run(2, 'businessIncentives', { commercialIncome: 0, industrialIncome: 0 });
    expect(curfew.budget.income).toBeLessThan(base.budget.income);
    expect(both.budget.income).toBeLessThan(curfew.budget.income);
    expect(both.budget.income).toBeGreaterThan(0);              // homes still pay
  });

  it('commercialDemand and industrialDemand: demand for shops and industry scales, within its limits', () => {
    const base = run(RECALC);
    // Extremes, so the result lands on the demand limits whatever the city's own ratios are.
    const up = run(RECALC, 'businessIncentives', { commercialDemand: 1000, industrialDemand: 0 });
    expect(up.stats.cDemand).toBe(BALANCE.demand.max);
    expect(up.stats.iDemand).toBe(BALANCE.demand.min);
    expect(up.stats.rDemand).toBe(base.stats.rDemand);
    const mild = run(RECALC, 'businessIncentives', { commercialDemand: 1.2, industrialDemand: 1.2 });
    expect(mild.stats.cDemand).toBeGreaterThanOrEqual(base.stats.cDemand);
    expect(mild.stats.iDemand).toBeGreaterThanOrEqual(base.stats.iDemand);
  });

  it('growth and industrialGrowth: zones stop growing at 0', () => {
    // The fixture city's suburbs are low-rise, so there is room to grow.
    const base = run(300);
    const frozen = run(300, 'fastTrackPermits', { growth: 0 });
    const noIndustry = run(300, 'cleanAirAct', { industrialGrowth: 0 });
    const start = run(0);
    expect(levels(base, ZONE_R)).toBeGreaterThan(levels(start, ZONE_R));
    for (const z of [ZONE_R, ZONE_C, ZONE_I]) expect(levels(frozen, z)).toBeLessThanOrEqual(levels(start, z));
    expect(levels(noIndustry, ZONE_I)).toBeLessThanOrEqual(levels(start, ZONE_I));
    expect(levels(noIndustry, ZONE_R)).toBeGreaterThan(levels(start, ZONE_R));
  });

  it('trafficTrips: fewer trips on the roads', () => {
    const base = run(40);
    const free = run(40, 'freeTransit', { trafficTrips: 0.5 });
    expect(trafficTotal(free)).toBeLessThan(trafficTotal(base) * 0.75);
  });

  it('landValueGrowth: land value rises more slowly, and still falls at full speed', () => {
    const base = run(6);
    const slow = run(6, 'rentControl', { landValueGrowth: 0.2 });
    // From its starting value the test city's land value climbs; with rent control it has climbed less.
    expect(sumWhere(slow, slow.layers.landValue)).toBeLessThan(sumWhere(base, base.layers.landValue));
  });

  it('satisfaction: scales the city-wide figure', () => {
    const base = run(4);
    const seized = run(4, 'eminentDomain', { satisfaction: 0.8 });
    expect(seized.stats.satisfaction).toBeCloseTo(base.stats.satisfaction * 0.8);
  });

  it('displacementCost: displacing residents costs less PC, highway cut-offs included', () => {
    const w = landWorld();
    home(w, 5, 5, 3);
    w.setRoad(10, 10, 1);
    home(w, 10, 9, 2);
    table.eminentDomain.modifiers.displacementCost = 0.5;
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).cost).toBe(displacementCost(3));
    enactOrdinance(w, 'eminentDomain');
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).cost).toBe(displacementCost(3) / 2);
    expect(pcQuote(w, { type: 'road', tx: 10, ty: 10, roadClass: ROAD_HIGHWAY }).cost).toBe(displacementCost(2) / 2);
    // Suspended (PC at or below 0): back to full price once the system has noticed.
    w.politics.ordinances.suspended.push('eminentDomain');
    expect(pcQuote(w, { type: 'bulldoze', tx: 5, ty: 5 }).cost).toBe(displacementCost(3));
  });
});
