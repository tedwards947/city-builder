// Running costs that grow with the city (owner, 2026-11-20: pacing option A;
// ENGINEER 3's plan). Besides its fixed upkeep (BALANCE.buildings), every
// police station, fire station, school and hospital costs
// BALANCE.runningCost.perResident[kind] a day for each resident it covers, and
// power, water and sewage cost BALANCE.runningCost.perUnit a day for each unit
// of demand they supply. Large plants run cheaper per unit
// (BALANCE.runningCost.largePlantMult), the reward for building big.
// The first BALANCE.runningCost.freeResidents residents are free (all of it
// is scaled by the share of the population above that), so the early game is
// as it was.
//
// So a bigger city costs more to run in proportion to its size, not just its
// footprint. What the player does about it is plan: police and fire stations
// now serve a limited number of residents (BALANCE.service.capacity), so a
// growing district needs another station, and big plants are cheaper per head.
//
// Pure: reads the world (coverage layers, utility stats, buildings), changes
// nothing. EconomySystem charges `headcountCost(world).total` every tick.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { capstoneResidents, capstoneRow, capstoneWorking } from './capstones';
import { residentsCoveredBy } from './serviceValue';
import {
  BUILDING_FIRE, BUILDING_HOSPITAL, BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_LARGE_WATER_PLANT,
  BUILDING_POLICE, BUILDING_POWER_PLANT, BUILDING_SCHOOL, BUILDING_SEWAGE_PLANT, BUILDING_WATER_TOWER, ZONE_R,
} from './constants';

export type Utility = 'power' | 'water' | 'sewage';

export interface HeadcountCost {
  /** Per tick, by service building kind (police, fire, school, hospital). */
  services: Record<number, number>;
  /** Per tick, by utility. */
  utilities: Record<Utility, number>;
  /** Residents each service kind covers. */
  residents: Record<number, number>;
  /** Per tick, by capstone kind standing in the city (sim/capstones.ts): its extra per resident it serves. */
  capstones: Record<number, number>;
  /** Per tick, all of it. */
  total: number;
  /** The share charged: (population − freeResidents) ÷ population, 0–1; every figure above is already scaled by it. */
  charged: number;
}

const SERVICE_KINDS = [BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL] as const;
const PLANTS: Record<Utility, { small: number; large: number }> = {
  power: { small: BUILDING_POWER_PLANT, large: BUILDING_LARGE_POWER_PLANT },
  water: { small: BUILDING_WATER_TOWER, large: BUILDING_LARGE_WATER_PLANT },
  sewage: { small: BUILDING_SEWAGE_PLANT, large: BUILDING_LARGE_SEWAGE_PLANT },
};
/** The plant outputs, as the utility systems read them. */
const OUTPUT: Record<Utility, () => { small: number; large: number }> = {
  power: () => ({ small: BALANCE.power.plantOutput, large: BALANCE.power.largePlantOutput }),
  water: () => ({ small: BALANCE.water.towerOutput, large: BALANCE.water.largePlantOutput }),
  sewage: () => ({ small: BALANCE.sewage.plantOutput, large: BALANCE.sewage.largePlantOutput }),
};

/** A day's cost per resident covered by a service building of `kind` (0 for other kinds). */
export function perResidentCost(kind: number): number {
  return (BALANCE.runningCost.perResident as Record<number, number>)[kind] ?? 0;
}

/** A day's cost per unit of `utility` a plant of `kind` supplies (large plants at largePlantMult). */
export function perUnitCost(utility: Utility, large: boolean): number {
  return BALANCE.runningCost.perUnit[utility] * (large ? BALANCE.runningCost.largePlantMult : 1);
}

/** What the city's headcount costs to serve this tick (see the top of this file). */
export function headcountCost(world: World): HeadcountCost {
  const L = world.layers, perTick = 1 / BALANCE.ticksPerDay;
  const layer: Record<number, Uint8Array> = { [BUILDING_POLICE]: L.police, [BUILDING_FIRE]: L.fireStation, [BUILDING_SCHOOL]: L.school, [BUILDING_HOSPITAL]: L.hospital };
  const residents: Record<number, number> = { [BUILDING_POLICE]: 0, [BUILDING_FIRE]: 0, [BUILDING_SCHOOL]: 0, [BUILDING_HOSPITAL]: 0 };
  const { zoned, zonedCount } = world.index;
  const pop = BALANCE.growth.popPerLevel;
  let population = 0;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (L.zone[i] !== ZONE_R || L.devLevel[i] === 0 || L.abandoned[i] !== 0) continue;
    const n = pop[L.devLevel[i]] ?? 0;
    population += n;
    for (const kind of SERVICE_KINDS) if (layer[kind][i]) residents[kind] += n;
  }
  const charged = population > 0 ? Math.max(0, population - BALANCE.runningCost.freeResidents) / population : 0;
  const services: Record<number, number> = {};
  let total = 0;
  for (const kind of SERVICE_KINDS) { services[kind] = residents[kind] * perResidentCost(kind) * perTick * charged; total += services[kind]; }

  // Utilities: the units supplied (demand, up to supply), split between small and large plants by their output.
  const count: Record<number, number> = {};
  for (const b of world.buildings) count[b.kind] = (count[b.kind] ?? 0) + 1;
  const s = world.stats;
  const supplied: Record<Utility, number> = {
    power: Math.min(s.powerDemand, s.powerSupply), water: Math.min(s.waterDemand, s.waterSupply), sewage: Math.min(s.sewageDemand, s.sewageSupply),
  };
  const utilities = { power: 0, water: 0, sewage: 0 } as Record<Utility, number>;
  for (const u of ['power', 'water', 'sewage'] as const) {
    const out = OUTPUT[u](), large = (count[PLANTS[u].large] ?? 0) * out.large;
    // A capstone at work supplies at the small plants' rate (CAPSTONE_DESIGN.md: measured against small plants).
    let small = (count[PLANTS[u].small] ?? 0) * out.small;
    for (const b of world.buildings) {
      const row = capstoneRow(b.kind);
      if (row && row.need === u && row.output! > 0 && capstoneWorking(world, b)) small += row.output!;
    }
    if (small + large <= 0 || supplied[u] <= 0) continue;
    const largeShare = large / (small + large);
    utilities[u] = supplied[u] * ((1 - largeShare) * perUnitCost(u, false) + largeShare * perUnitCost(u, true)) * perTick * charged;
    total += utilities[u];
  }
  // Capstones: the extra each costs for every resident it covers (a service capstone: every home it reaches, seated at it or at a small building).
  const capstones: Record<number, number> = {};
  const served = capstoneResidents(world, population, (b) => residentsCoveredBy(world, b));
  for (const k in served) {
    capstones[k] = served[k] * (capstoneRow(Number(k))?.perResident ?? 0) * perTick * charged;
    total += capstones[k];
  }
  return { services, utilities, residents, capstones, total, charged };
}
