// Capstone buildings (CAPSTONE_DESIGN.md): seven whole-city buildings, one of
// each per city, each unlocked at its own population. One per need: sewage,
// water, fire, police, hospital, power, school.
//
// Everything about a kind is its row in BALANCE.capstones.kinds: the need it
// meets, its footprint, the population that unlocks it, its output (the three
// utilities) and the extra it costs a day for each resident it serves, on top
// of the normal running cost (sim/runningCost.ts). The build cost is in
// BALANCE.buildings like any building's.
//
//   UTILITIES  The Nuclear Power Station, the Waterworks and the Sewage Works
//              are plants with a very large output: they supply like any
//              plant (a street or avenue beside them, and the road network it
//              belongs to: systems/utilityCoverage.ts). The Waterworks is a
//              pump: it must stand beside water, and supplies nothing once
//              that water is gone.
//   SERVICES   The Police and Fire Headquarters, the General Hospital and the
//              University cover every home on the road network their street
//              belongs to, highways included, at any distance, and never run
//              out of room. To the rest of the game each is one more building
//              of its small kind (`serviceBaseKind`: a police station, a fire
//              station, a school, a hospital) whose reach has no limit
//              (`serviceRange`) and which seats everyone it reaches
//              (sim/serviceCapacity.ts): so coverage, residents' requests,
//              the PC services rule and the running cost all follow, and the
//              small buildings go on working beside it.
//
// Pure: reads the world, changes nothing. Nothing here is saved.

import type { World, BuildingEntity } from './World';
import { BALANCE, type CapstoneRow, type CapstoneNeed } from '../data/balance';
import { footprintTiles, hasNeededWater } from './buildingShapes';
import { BUILDING_FIRE, BUILDING_HOSPITAL, BUILDING_POLICE, BUILDING_SCHOOL } from './constants';

/** A service capstone's reach in road steps: the whole road network. (The road walk keeps distances in 16 bits.) */
export const WHOLE_CITY = 0xffff;

const BASE: Partial<Record<CapstoneNeed, number>> = { police: BUILDING_POLICE, fire: BUILDING_FIRE, school: BUILDING_SCHOOL, hospital: BUILDING_HOSPITAL };

export type { CapstoneNeed, CapstoneRow };
export type UtilityNeed = 'power' | 'water' | 'sewage';

const rows = (): Record<number, CapstoneRow> => BALANCE.capstones.kinds;

/** The capstone row of `kind`, or undefined if it is not a capstone. */
export function capstoneRow(kind: number): CapstoneRow | undefined {
  return rows()[kind];
}

export function isCapstone(kind: number): boolean {
  return rows()[kind] !== undefined;
}

/** Every capstone kind, in the order they unlock. */
export function capstoneKinds(): number[] {
  return Object.keys(rows()).map(Number).sort((a, b) => rows()[a].unlockPopulation - rows()[b].unlockPopulation || a - b);
}

/** The capstone kind that meets `need`, if the table has one. */
export function capstoneFor(need: CapstoneNeed): number | undefined {
  for (const k in rows()) if (rows()[k].need === need) return Number(k);
  return undefined;
}

/**
 * The small service kind a service capstone stands in for (the Police Headquarters: a police
 * station), or `kind` itself for anything else. Coverage and seats are worked out per base kind.
 */
export function serviceBaseKind(kind: number): number {
  const row = rows()[kind];
  return (row && BASE[row.need]) ?? kind;
}

/** Whether `kind` is one of the four service capstones. */
export function isServiceCapstone(kind: number): boolean {
  const row = rows()[kind];
  return row !== undefined && BASE[row.need] !== undefined;
}

/** How far a `kind` building's coverage walks along the roads: its range in the balance table, the whole city for a service capstone, undefined if it is no service building. */
export function serviceRange(kind: number): number | undefined {
  return isServiceCapstone(kind) ? WHOLE_CITY : BALANCE.service.coverageRange[kind];
}

/** Whether `need` is one of the three utilities. */
export function isUtilityNeed(need: CapstoneNeed): need is UtilityNeed {
  return need === 'power' || need === 'water' || need === 'sewage';
}

/** Kind → output for the capstone that supplies `utility`: one more entry for the utility system's table of plants. */
export function capstoneOutputs(utility: UtilityNeed): Record<number, number> {
  const out: Record<number, number> = {};
  for (const k in rows()) {
    const row = rows()[k];
    if (row.need === utility && row.output! > 0) out[Number(k)] = row.output!;
  }
  return out;
}

/** Whether the capstone is at work: a street or avenue reaches it, and (the Waterworks) there is water beside it. */
export function capstoneWorking(world: World, b: BuildingEntity): boolean {
  if (!isCapstone(b.kind) || world.buildingAccessRoads(b.tx, b.ty).length === 0) return false;
  const { width, height } = world.grid;
  const tiles = footprintTiles(width, height, b.tx, b.ty, b.kind, b.rot ?? 0) ?? [b.ty * width + b.tx];
  return hasNeededWater(b.kind, tiles, world.layers.terrain, width, height);
}

/**
 * Residents each standing capstone serves, by kind: for a utility capstone at
 * work, the whole population (it supplies the city); for a service capstone,
 * every resident of the homes it covers, which `covered` gives, small
 * buildings or not (ENGINEER 3, 2026-11-21: charging only those seated at it
 * made a capstone plus the busier small stations cheaper than no capstone; the
 * owner's rule is a luxury at about 1.5× what it replaces).
 */
export function capstoneResidents(world: World, population: number, covered: (b: BuildingEntity) => number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const b of world.buildings) {
    const row = rows()[b.kind];
    if (!row) continue;
    out[b.kind] = isUtilityNeed(row.need) ? (capstoneWorking(world, b) ? population : 0) : covered(b);
  }
  return out;
}
