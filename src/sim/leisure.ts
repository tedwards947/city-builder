// Leisure buildings (LEISURE_DESIGN.md): parks, plazas and the unique
// buildings (museum, stadium). What each kind is lives in one table,
// BALANCE.leisure.kinds; this file answers questions about it.
//
//   - Two groups: 'parks' (Parks and leisure, as many as the player likes)
//     and 'unique' (Unique buildings, one per city: the one-per-city rule is a
//     placement rule in sim/buildingShapes.ts).
//   - A kind may be locked until the city has had enough residents.
//   - A kind may cost political capital to build ("big projects cost PC",
//     priced by pcQuote in sim/politics.ts with the reason 'bigProject').
//   - A kind raises land value round it (LandValueSystem calls
//     addLeisureLandValue).
//   - Some kinds count as a park for the merged lots' prime-spot rule
//     (sim/lots.ts).
//
// Numbers are read live. Nothing here is saved: a leisure building is an
// ordinary entry in world.buildings.

import type { World } from './World';
import { BALANCE, type LeisureRow } from '../data/balance';
import { footprintTiles } from './buildingShapes';
import { BUILDING_NONE, ROAD_NONE, TERRAIN_SAND, TERRAIN_WATER, ZONE_NONE } from './constants';

const rows = (): Record<number, LeisureRow> => BALANCE.leisure.kinds;

/** The leisure row of `kind`, or undefined if it is not a leisure building. */
export function leisureRow(kind: number): LeisureRow | undefined {
  return rows()[kind];
}

/** Whether `kind` is a leisure building (a park, a plaza, a unique building). */
export function isLeisureKind(kind: number): boolean {
  return rows()[kind] !== undefined;
}

/** The leisure kinds of a toolbar group, in kind order. */
export function leisureKinds(category: LeisureRow['category']): number[] {
  const out: number[] = [];
  for (const k in rows()) if (rows()[k].category === category) out.push(Number(k));
  return out.sort((a, b) => a - b);
}

/** Whether `kind` counts as a park for the prime-spot rule of merged lots. */
export function countsAsPark(kind: number): boolean {
  return rows()[kind]?.countsAsPark === true;
}

/** Residents a city must have had before `kind` can be built (a leisure kind's or a capstone's row); 0 for a kind with no lock. */
export function unlockPopulation(kind: number): number {
  return rows()[kind]?.unlockPopulation ?? BALANCE.capstones.kinds[kind]?.unlockPopulation ?? 0;
}

/**
 * Whether the city may build `kind` yet: always for a kind with no lock,
 * otherwise once its population has reached the kind's unlockPopulation. It
 * stays unlocked if the population later falls (the highest population the
 * city has been credited for counts too).
 */
export function buildingUnlocked(world: World, kind: number): boolean {
  const need = unlockPopulation(kind);
  return need <= 0 || Math.max(world.stats.population, world.politics.peakPopulation) >= need;
}

/** Political capital it costs to build `kind` (0 for most kinds). */
export function bigProjectPc(kind: number): number {
  return Math.max(0, rows()[kind]?.pcCost ?? 0);
}

/** The furthest any leisure kind's land-value lift reaches, in tiles. */
export function leisureLandValueReach(): number {
  let reach = 0;
  for (const k in rows()) {
    const lv = rows()[k].landValue;
    if (lv.bonus !== 0 && lv.radius > reach) reach = lv.radius;
  }
  return Math.ceil(reach);
}

/**
 * Add each leisure building's land-value lift to `acc` (one number per tile),
 * for the tiles inside the rectangle x0..x1, y0..y1. A tile gets
 * bonus × (1 − (d − 1) / radius), where d is its distance (the larger of the
 * two axis distances) to the building's nearest tile: the full bonus on the
 * tiles touching it, nothing past `radius`. The building's own tiles get
 * nothing. Several buildings add up.
 */
export function addLeisureLandValue(world: World, acc: Float64Array, x0: number, y0: number, x1: number, y1: number): void {
  if (x1 < x0 || y1 < y0) return;
  const table = rows();
  const { width, height } = world.grid;
  for (const b of world.buildings) {
    const lv = table[b.kind]?.landValue;
    if (!lv || lv.bonus === 0 || !(lv.radius > 0)) continue;
    const tiles = footprintTiles(width, height, b.tx, b.ty, b.kind, b.rot ?? 0);
    if (!tiles) continue;
    // The building's bounding box. (Distance is to the nearest TILE, so a shape that is not a
    // rectangle is measured tile by tile below.)
    let bx0 = width, by0 = height, bx1 = -1, by1 = -1;
    for (const i of tiles) {
      const x = i % width, y = (i - x) / width;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    const r = Math.ceil(lv.radius);
    const ax0 = Math.max(x0, bx0 - r), ax1 = Math.min(x1, bx1 + r);
    const ay0 = Math.max(y0, by0 - r), ay1 = Math.min(y1, by1 + r);
    const rect = tiles.length === (bx1 - bx0 + 1) * (by1 - by0 + 1);
    for (let y = ay0; y <= ay1; y++) {
      for (let x = ax0; x <= ax1; x++) {
        let d: number;
        if (rect) {
          d = Math.max(x < bx0 ? bx0 - x : x > bx1 ? x - bx1 : 0, y < by0 ? by0 - y : y > by1 ? y - by1 : 0);
        } else {
          d = Infinity;
          for (const i of tiles) {
            const tx = i % width, ty = (i - tx) / width;
            const dd = Math.max(Math.abs(tx - x), Math.abs(ty - y));
            if (dd < d) d = dd;
          }
        }
        if (d === 0 || d > lv.radius) continue;
        acc[y * width + x] += lv.bonus * (1 - (d - 1) / lv.radius);
      }
    }
  }
}

/**
 * The beach of a beach park, for drawing (umbrellas): the free tiles within
 * `radius` of the building (the larger of the two axis distances to its
 * nearest tile) that are sand, or land with water on one of their four sides.
 * A tile with a building, a road, rail or a zone on it is not beach. Row by
 * row. Reads the world, changes nothing; looks only.
 */
export function beachTilesNear(world: World, b: { tx: number; ty: number; kind: number; rot?: number }, radius = 2): number[] {
  const { width, height } = world.grid;
  const L = world.layers;
  const tiles = footprintTiles(width, height, b.tx, b.ty, b.kind, b.rot ?? 0);
  if (!tiles) return [];
  let bx0 = width, by0 = height, bx1 = -1, by1 = -1;
  for (const i of tiles) {
    const x = i % width, y = (i - x) / width;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  const out: number[] = [];
  for (let y = Math.max(0, by0 - radius); y <= Math.min(height - 1, by1 + radius); y++) {
    for (let x = Math.max(0, bx0 - radius); x <= Math.min(width - 1, bx1 + radius); x++) {
      const i = y * width + x;
      if (L.terrain[i] === TERRAIN_WATER || L.building[i] !== BUILDING_NONE || L.roadClass[i] !== ROAD_NONE || L.zone[i] !== ZONE_NONE || L.rail[i] !== 0) continue;
      const shore = (x > 0 && L.terrain[i - 1] === TERRAIN_WATER) || (x < width - 1 && L.terrain[i + 1] === TERRAIN_WATER)
        || (y > 0 && L.terrain[i - width] === TERRAIN_WATER) || (y < height - 1 && L.terrain[i + width] === TERRAIN_WATER);
      if (L.terrain[i] === TERRAIN_SAND || shore) out.push(i);
    }
  }
  return out;
}
