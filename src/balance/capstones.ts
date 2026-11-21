// Capstones suite (CAPSTONE_DESIGN.md, C3; owner 2026-11-20/21): what each capstone costs a saved
// city to run against the small buildings it replaces. On copies of the city:
//   none     as built (each need's running cost: the small buildings' upkeep and the per-resident
//            or per-unit cost; the city's daily surplus);
//   alone    for each capstone kind: the capstone placed where it works and every small building of
//            its need cleared (that need's running cost, and the share of homes it serves).
// The owner's rule: a luxury, not a saving. About 1.5× what it replaces in running cost, so a 20k
// city with a healthy surplus carries one or two and only a strong city all seven.

import { BALANCE } from '../data/balance';
import type { World } from '../sim/World';
import { buildingUpkeep } from '../sim/serviceValue';
import { headcountCost, type HeadcountCost } from '../sim/runningCost';
import { capstoneKinds, capstoneRow, capstoneWorking, isUtilityNeed, serviceBaseKind } from '../sim/capstones';
import {
  BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_POWER_PLANT, BUILDING_SEWAGE_PLANT, BUILDING_WATER_TOWER,
} from '../sim/constants';
import { cloneWorld, startSim } from './world';

const D = BALANCE.ticksPerDay;
const r2 = (x: number) => Math.round(x * 100) / 100;

const UTILITY_KINDS: Record<string, number[]> = {
  power: [BUILDING_POWER_PLANT, BUILDING_LARGE_POWER_PLANT],
  water: [BUILDING_WATER_TOWER, BUILDING_LARGE_WATER_PLANT],
  sewage: [BUILDING_SEWAGE_PLANT, BUILDING_LARGE_SEWAGE_PLANT],
};

export interface CapstoneNeedRun {
  kind: number;
  need: string;
  unlockPopulation: number;
  /** That need's running cost a day as built, and with the capstone alone. */
  smallCost: number;
  aloneCost: number;
  /** aloneCost ÷ smallCost. */
  premium: number;
  /** Share of residents (a service) or of demand (a utility) served with the capstone alone. */
  coverage: number;
}

export interface CapstonesResult {
  population: number;
  /** Income less expenses a day, as built. */
  surplusPerDay: number;
  needs: CapstoneNeedRun[];
  note?: string;
}

/** Place `kind` at the first spot, from the middle of the map outward, where it stands and works. */
function place(w: World, kind: number): boolean {
  const { width, height } = w.grid, cx = width >> 1, cy = height >> 1;
  const order: number[] = [];
  for (let i = 0; i < width * height; i++) order.push(i);
  const d = (i: number) => Math.abs((i % width) - cx) + Math.abs(Math.floor(i / width) - cy);
  order.sort((a, b) => d(a) - d(b));
  for (const i of order) {
    const x = i % width, y = Math.floor(i / width);
    if (!w.placeBuilding(x, y, kind)) continue;
    if (capstoneWorking(w, w.buildings[w.buildings.length - 1])) return true;
    w.clearTile(x, y);
  }
  return false;
}

/** One need's running cost a day from a headcount snapshot (the small buildings' upkeep is added by the caller). */
function needHead(h: HeadcountCost, kind: number): number {
  const row = capstoneRow(kind)!;
  const normal = isUtilityNeed(row.need) ? h.utilities[row.need] : (h.services[serviceBaseKind(kind)] ?? 0);
  return (normal + (h.capstones[kind] ?? 0)) * D;
}

function smallKinds(kind: number): number[] {
  const row = capstoneRow(kind)!;
  return isUtilityNeed(row.need) ? UTILITY_KINDS[row.need] : [serviceBaseKind(kind)];
}

/** Run `days`, then one measured day: each kind's need cost, coverage, and the surplus. */
function measure(w: World, kinds: number[], days: number) {
  const sim = startSim(w);
  sim.tick(days * D);
  const head = kinds.map(() => 0), cover = kinds.map(() => 0);
  let inc = 0, exp = 0;
  for (let t = 0; t < D; t++) {
    sim.tick(1);
    inc += w.budget.income; exp += w.budget.expenses;
    const h = headcountCost(w);
    const pop = Math.max(1, w.stats.population), s = w.stats;
    kinds.forEach((k, j) => {
      head[j] += needHead(h, k) / D;
      const row = capstoneRow(k)!;
      if (isUtilityNeed(row.need)) {
        const dem = row.need === 'power' ? s.powerDemand : row.need === 'water' ? s.waterDemand : s.sewageDemand;
        const sup = row.need === 'power' ? s.powerSupply : row.need === 'water' ? s.waterSupply : s.sewageSupply;
        cover[j] += (dem > 0 ? Math.min(1, sup / dem) : 1) / D;
      } else cover[j] += (h.residents[serviceBaseKind(k)] ?? 0) / pop / D;
    });
  }
  const cost = kinds.map((k, j) => {
    let up = 0;
    const small = smallKinds(k);
    for (const b of w.buildings) if (small.includes(b.kind)) up += buildingUpkeep(b.kind) * D;
    return up + head[j];
  });
  return { cost, cover, surplus: inc - exp, population: w.stats.population };
}

/** The capstone probes on a saved city (copies; the city is left as it was). */
export function capstonesResult(world: World, days = 3): CapstonesResult {
  const start = cloneWorld(world);
  startSim(start).tick(2 * D);
  const kinds = capstoneKinds();
  const base = measure(cloneWorld(start), kinds, days);
  const needs: CapstoneNeedRun[] = [];
  for (const [j, kind] of kinds.entries()) {
    const row = capstoneRow(kind)!;
    const w = cloneWorld(start);
    const small = smallKinds(kind);
    for (const b of [...w.buildings]) if (small.includes(b.kind)) w.clearTile(b.tx, b.ty);
    if (!place(w, kind)) continue;
    w.grid.markAllDirty();
    const alone = measure(w, [kind], days);
    needs.push({
      kind, need: row.need, unlockPopulation: row.unlockPopulation,
      smallCost: Math.round(base.cost[j]), aloneCost: Math.round(alone.cost[0]),
      premium: base.cost[j] > 0 ? r2(alone.cost[0] / base.cost[j]) : 0, coverage: Math.round(alone.cover[0] * 1000) / 1000,
    });
  }
  const r: CapstonesResult = { population: base.population, surplusPerDay: Math.round(base.surplus), needs };
  if (needs.length === 0) r.note = 'no capstone could be placed';
  return r;
}

