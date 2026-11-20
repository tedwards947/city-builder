// Balance Lab: the mid-game check for the running costs that grow with the city
// (sim/runningCost.ts; owner, 2026-11-20, pacing option A). Not part of the game.
//
// On a saved city at the neutral tax level: the surplus per resident once it
// has settled, and what it would cost to fix every police and fire station
// the city has outgrown (residents in reach but turned away, since police and
// fire have a capacity), in days of that surplus. Graded by econ.fixCost.

import { BALANCE } from '../data/balance';
import { BUILDING_FIRE, BUILDING_POLICE, ZONE_R } from '../sim/constants';
import { buildingReach, serviceCapacity } from '../sim/serviceCapacity';
import type { World } from '../sim/World';
import { cloneWorld, startSim } from './world';

export interface PaceShort { stations: number; turnedAway: number; more: number }

export interface PaceResult {
  population: number;
  /** (income − expenses) a day ÷ residents, at the neutral tax level. */
  surplusPerResident: number;
  /** Expenses ÷ income. */
  costShare: number;
  /** Police and fire: stations, residents in reach but turned away, stations needed to seat them. */
  police: PaceShort;
  fire: PaceShort;
  /** Price of those stations. */
  fixCost: number;
  /** fixCost in days of surplus (null when the city runs at a loss). */
  fixDays: number | null;
}

function shortfall(w: World, kind: number, layer: Uint8Array): PaceShort {
  const L = w.layers, pop = BALANCE.growth.popPerLevel;
  const reach = new Uint8Array(L.zone.length);
  let stations = 0;
  for (const b of w.buildings) {
    if (b.kind !== kind) continue;
    stations++;
    for (const t of buildingReach(w, b.tx, b.ty, kind).tiles) reach[t] = 1;
  }
  let away = 0;
  for (let k = 0; k < w.index.zonedCount; k++) {
    const i = w.index.zoned[k];
    if (L.zone[i] !== ZONE_R || L.devLevel[i] === 0 || L.abandoned[i] !== 0) continue;
    if (reach[i] && !layer[i]) away += pop[L.devLevel[i]] ?? 0;
  }
  const cap = serviceCapacity(kind);
  return { stations, turnedAway: away, more: cap > 0 ? Math.ceil(away / cap) : 0 };
}

/** The probe (see the top of this file) on a copy of `world`, 10 days settled then 5 measured. */
export function paceResult(world: World): PaceResult {
  const w = cloneWorld(world);
  w.budget.taxLevel = BALANCE.tax.level.neutral;
  const sim = startSim(w);
  sim.tick(10 * BALANCE.ticksPerDay);
  let inc = 0, exp = 0;
  const days = 5;
  for (let t = 0; t < days * BALANCE.ticksPerDay; t++) { sim.tick(1); inc += w.budget.income; exp += w.budget.expenses; }
  inc /= days; exp /= days;   // a day's
  const population = w.stats.population;
  const police = shortfall(w, BUILDING_POLICE, w.layers.police), fire = shortfall(w, BUILDING_FIRE, w.layers.fireStation);
  const fixCost = police.more * (BALANCE.buildings[BUILDING_POLICE]?.cost ?? 0) + fire.more * (BALANCE.buildings[BUILDING_FIRE]?.cost ?? 0);
  const surplus = inc - exp;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    population,
    surplusPerResident: population > 0 ? r3(surplus / population) : 0,
    costShare: inc > 0 ? r3(exp / inc) : 0,
    police, fire, fixCost,
    fixDays: surplus > 0 ? r3(fixCost / surplus) : null,
  };
}
