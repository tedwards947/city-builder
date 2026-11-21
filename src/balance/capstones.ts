// Capstones suite (CAPSTONE_DESIGN.md, C3; owner 2026-11-20/21): what each capstone costs a saved
// city to run against the small buildings it replaces. On copies of the city:
//   none     as built (each need's running cost: the small buildings' upkeep and the per-resident
//            or per-unit cost; the city's daily surplus);
//   alone    for each capstone kind: the capstone placed where it works and every small building of
//            its need cleared (that need's running cost, and the share of homes it serves);
//   large    for each utility: the city's plants of that utility swapped for large plants, enough to
//            meet demand (owner 2026-11-21: utility capstones are priced against large plants).
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
import { footprintTiles, hasNeededWater } from '../sim/buildingShapes';
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
  /**
   * A utility only: that need's running cost with the city's plants swapped for large ones, and
   * aloneCost ÷ that (what capstone.premium grades for a utility). Absent where the large plants
   * could not be placed to meet demand (largeNote says why).
   */
  largeCost?: number;
  largePremium?: number;
  largeNote?: string;
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

const LARGE: Record<string, { kind: number; output: () => number }> = {
  power: { kind: BUILDING_LARGE_POWER_PLANT, output: () => BALANCE.power.largePlantOutput },
  water: { kind: BUILDING_LARGE_WATER_PLANT, output: () => BALANCE.water.largePlantOutput },
  sewage: { kind: BUILDING_LARGE_SEWAGE_PLANT, output: () => BALANCE.sewage.largePlantOutput },
};

/** Whether a plant of `kind` just placed at (x, y) can supply: a road reaches it, and water beside it if it draws water. */
function plantWorks(w: World, x: number, y: number, kind: number): boolean {
  if (w.buildingAccessRoads(x, y).length === 0) return false;
  const { width, height } = w.grid;
  const tiles = footprintTiles(width, height, x, y, kind, 0) ?? [y * width + x];
  return hasNeededWater(kind, tiles, w.layers.terrain, width, height);
}

/**
 * Swap the city's plants of `need` for large plants: clear them all, then place large plants, each
 * at the nearest working spot to one of the old plants (spread over them), until their output
 * meets the demand with 10% spare. Returns null, or why it could not be done.
 */
function swapToLarge(w: World, need: string, demand: number): string | null {
  const big = LARGE[need], { width, height } = w.grid;
  const old = w.buildings.filter(b => UTILITY_KINDS[need].includes(b.kind)).map(b => ({ x: b.tx, y: b.ty }));
  for (const b of [...w.buildings]) if (UTILITY_KINDS[need].includes(b.kind)) w.clearTile(b.tx, b.ty);
  const want = Math.ceil((demand * 1.1) / big.output());
  const placed: { x: number; y: number }[] = [];
  const seeds = old.length ? old : [{ x: width >> 1, y: height >> 1 }];
  for (let pass = 0; placed.length < want && pass < 4; pass++) {
    for (const s of seeds) {
      if (placed.length >= want) break;
      if (pass === 0 && placed.some(p => Math.abs(p.x - s.x) + Math.abs(p.y - s.y) < 8)) continue;
      found: for (let r = 0; r <= 16; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = s.x + dx, y = s.y + dy;
          if (x < 0 || y < 0 || x >= width || y >= height || !w.placeBuilding(x, y, big.kind)) continue;
          if (plantWorks(w, x, y, big.kind)) { placed.push({ x, y }); break found; }
          w.clearTile(x, y);
        }
      }
    }
  }
  return placed.length >= want ? null : `only ${placed.length} of ${want} large plants could be placed`;
}

function smallKinds(kind: number): number[] {
  const row = capstoneRow(kind)!;
  return isUtilityNeed(row.need) ? UTILITY_KINDS[row.need] : [serviceBaseKind(kind)];
}

/** Run `days`, then one measured day: each kind's need cost, coverage, and the surplus. */
function measure(w: World, kinds: number[], days: number) {
  const sim = startSim(w);
  sim.tick(days * D);
  const head = kinds.map(() => 0), cover = kinds.map(() => 0), demand = kinds.map(() => 0);
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
        demand[j] = Math.max(demand[j], dem);
      } else cover[j] += (h.residents[serviceBaseKind(k)] ?? 0) / pop / D;
    });
  }
  const cost = kinds.map((k, j) => {
    let up = 0;
    const small = smallKinds(k);
    for (const b of w.buildings) if (small.includes(b.kind)) up += buildingUpkeep(b.kind) * D;
    return up + head[j];
  });
  return { cost, cover, demand, surplus: inc - exp, population: w.stats.population };
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
    let large: Pick<CapstoneNeedRun, 'largeCost' | 'largePremium' | 'largeNote'> = {};
    if (isUtilityNeed(row.need)) {
      const lw = cloneWorld(start);
      const why = swapToLarge(lw, row.need, base.demand[j]);
      if (why) large = { largeNote: why };
      else {
        lw.grid.markAllDirty();
        const m = measure(lw, [kind], days);
        if (m.cover[0] < 0.97) large = { largeNote: `large plants meet ${Math.round(m.cover[0] * 100)}% of demand` };
        else large = { largeCost: Math.round(m.cost[0]), largePremium: m.cost[0] > 0 ? r2(alone.cost[0] / m.cost[0]) : 0 };
      }
    }
    needs.push({
      kind, need: row.need, unlockPopulation: row.unlockPopulation,
      smallCost: Math.round(base.cost[j]), aloneCost: Math.round(alone.cost[0]),
      premium: base.cost[j] > 0 ? r2(alone.cost[0] / base.cost[j]) : 0, coverage: Math.round(alone.cover[0] * 1000) / 1000,
      ...large,
    });
  }
  const r: CapstonesResult = { population: base.population, surplusPerDay: Math.round(base.surplus), needs };
  if (needs.length === 0) r.note = 'no capstone could be placed';
  return r;
}

