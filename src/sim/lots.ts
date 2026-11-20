// Merged 2×2 lots (BIG_LOTS_DESIGN.md): four top-level lots of one zone that
// have become a single big building.
//
// A merged lot is NOT a building kind. Its four tiles stay zone tiles, so every
// system that counts residents, jobs, taxes and trips per tile keeps working:
//   - each tile is at devLevel LOT_LEVEL (4), one above what a lot grows to;
//   - `layers.lot` says which quarter a tile is: 1 NW (the anchor), 2 NE, 3 SW, 4 SE;
//     0 = an ordinary lot;
//   - capacity comes from the per-level tables in BALANCE.growth: `popPerLevel[4]`
//     for residents and `levelWeight[4]` wherever a system multiplies by the level.
//
// It is one building: knocking down, rezoning, paving or building over any of
// its tiles brings the whole of it down first (World.razeLot), leaving the
// other tiles as empty zoned lots. Commands snapshot all four tiles
// (Command.tilesClearedWith / lotSiblings) so one undo puts it back.
//
// Phase 1 (this file): the model, a forced merge for debug, the summary for
// Inspect. Nothing merges in normal play yet; the trigger comes later.

import type { World } from './World';
import { BUILDING_NONE, ROAD_NONE, ZONE_NONE, ZONE_R } from './constants';
import { BALANCE } from '../data/balance';

/** The devLevel of every tile of a merged lot. */
export const LOT_LEVEL = 4;

/** What a lot of level `dev` counts for where a system multiplies by the level: itself for 0–3, more for a merged lot. */
export function levelWeight(dev: number): number {
  return BALANCE.growth.levelWeight[dev] ?? dev;
}

/** The four tile indices of the 2×2 whose NW corner is (tx, ty), in quarter order, or null if it leaves the map. */
function square(world: World, tx: number, ty: number): number[] | null {
  const { width, height } = world.grid;
  if (tx < 0 || ty < 0 || tx + 1 >= width || ty + 1 >= height) return null;
  const a = ty * width + tx;
  return [a, a + 1, a + width, a + width + 1];
}

/**
 * Whether the 2×2 with its NW corner at (tx, ty) can merge: four lots of one
 * zone, none already part of a merged lot, each at the top level and none
 * abandoned. With `force` (debug), the level and abandonment are not asked.
 */
export function canMergeLot(world: World, tx: number, ty: number, force = false): boolean {
  const tiles = square(world, tx, ty);
  if (!tiles) return false;
  const L = world.layers;
  const zone = L.zone[tiles[0]];
  if (zone === ZONE_NONE) return false;
  for (const i of tiles) {
    if (L.zone[i] !== zone || L.building[i] !== BUILDING_NONE || L.roadClass[i] !== ROAD_NONE || L.lot[i] !== 0) return false;
    if (!force && (L.devLevel[i] !== BALANCE.growth.maxLevel || L.abandoned[i] !== 0)) return false;
  }
  return true;
}

/**
 * Merge the 2×2 with its NW corner at (tx, ty) into one building. Nobody is
 * displaced: the four lots' residents and jobs are simply part of it. Returns
 * false, changing nothing, if it cannot merge (canMergeLot).
 */
export function mergeLot(world: World, tx: number, ty: number, force = false): boolean {
  if (!canMergeLot(world, tx, ty, force)) return false;
  const tiles = square(world, tx, ty)!;
  const L = world.layers;
  const { width } = world.grid;
  for (let q = 0; q < 4; q++) {
    const i = tiles[q];
    L.devLevel[i] = LOT_LEVEL;
    L.lot[i] = q + 1;
    L.abandoned[i] = 0;
    L.distress[i] = 0;
    world.lotStreak[i] = 0;
    world.grid.markDirty(i % width, (i - (i % width)) / width);
  }
  world.events.emit('lotMerged', { tx, ty, zone: L.zone[tiles[0]] });
  return true;
}

/** The other tiles of the merged lot that tile `i` is part of; empty for an ordinary tile. For commands to snapshot before they change `i`. */
export function lotSiblings(world: World, i: number): number[] {
  return world.lotTilesAt(i).filter((t) => t !== i);
}

export interface LotSummary {
  /** Tile index of the NW corner. */
  anchor: number;
  /** The four tiles, NW, NE, SW, SE. */
  tiles: number[];
  zone: number;
  abandoned: boolean;
  /** Residents of the whole building (0 for shops and industry, and when abandoned). */
  residents: number;
  /** What the whole building counts for in taxes, jobs and trips, in level-1 lots (0 when abandoned). */
  weight: number;
}

/** The merged lot that tile `i` is part of, summed over its four tiles, or null for an ordinary tile. */
export function lotSummary(world: World, i: number): LotSummary | null {
  const tiles = world.lotTilesAt(i);
  if (tiles.length === 0) return null;
  const L = world.layers;
  const zone = L.zone[tiles[0]];
  let residents = 0, weight = 0, abandoned = false;
  for (const t of tiles) {
    if (L.abandoned[t] !== 0) { abandoned = true; continue; }
    weight += levelWeight(L.devLevel[t]);
    if (zone === ZONE_R) residents += BALANCE.growth.popPerLevel[L.devLevel[t]] ?? 0;
  }
  return { anchor: tiles[0], tiles, zone, abandoned, residents, weight };
}

/**
 * After loading: make `layers.lot` and the levels agree. A quarter that is not
 * part of a whole, same-zone 2×2 at LOT_LEVEL goes back to an ordinary lot,
 * and so does any tile above the top level that is not in a merged lot.
 */
export function cleanLots(world: World): void {
  const L = world.layers;
  const { width, height } = world.grid;
  const top = BALANCE.growth.maxLevel;
  const good = new Uint8Array(L.lot.length);
  for (let y = 0; y + 1 < height; y++) for (let x = 0; x + 1 < width; x++) {
    const a = y * width + x;
    if (L.lot[a] !== 1) continue;
    const tiles = [a, a + 1, a + width, a + width + 1];
    const zone = L.zone[a];
    if (zone !== ZONE_NONE && tiles.every((t, q) => L.lot[t] === q + 1 && L.zone[t] === zone && L.devLevel[t] === LOT_LEVEL && L.building[t] === BUILDING_NONE && L.roadClass[t] === ROAD_NONE)) {
      for (const t of tiles) good[t] = 1;
    }
  }
  for (let i = 0; i < L.lot.length; i++) {
    if (good[i]) continue;
    L.lot[i] = 0;
    if (L.devLevel[i] > top) L.devLevel[i] = top;
  }
}

/** The NW corner of the 2×2 nearest (tx, ty), within `radius` tiles, that canMergeLot accepts; null if there is none. For the debug button. */
export function nearestMergeable(world: World, tx: number, ty: number, force = false, radius = 12): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null, bestD = Infinity;
  for (let y = ty - radius; y <= ty + radius; y++) for (let x = tx - radius; x <= tx + radius; x++) {
    const d = (x + 0.5 - tx) ** 2 + (y + 0.5 - ty) ** 2;
    if (d < bestD && canMergeLot(world, x, y, force)) { best = { tx: x, ty: y }; bestD = d; }
  }
  return best;
}

// ── When lots merge (systems/LotMergeSystem.ts) ──────────────────────────────

/**
 * Whether lot `i` counts as happy and valuable today: an ordinary lot at the
 * top level, not abandoned, with no distress (nothing wrong with its power,
 * water, road, crime or fire risk), on land worth at least
 * BALANCE.lots.minLandValue for its zone, in a city whose satisfaction is at
 * least BALANCE.lots.minSatisfaction. (Satisfaction is one number for the
 * whole city; distress and land value are the lot's own.)
 */
export function lotIsHappy(world: World, i: number): boolean {
  const L = world.layers, cfg = BALANCE.lots;
  return L.lot[i] === 0 && L.devLevel[i] === BALANCE.growth.maxLevel && L.abandoned[i] === 0 && L.distress[i] === 0
    && L.landValue[i] >= (cfg.minLandValue[L.zone[i]] ?? 255)
    && world.stats.satisfaction >= cfg.minSatisfaction;
}

/** One game day passes: every happy, valuable lot adds a day to its streak (world.lotStreak); every other lot starts again from 0. */
export function updateLotStreaks(world: World): void {
  const streak = world.lotStreak;
  const { zoned, zonedCount } = world.index;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    streak[i] = lotIsHappy(world, i) ? Math.min(255, streak[i] + 1) : 0;
  }
}

/** The NW tile of every 2×2 that could merge today: canMergeLot, and all four lots happy for BALANCE.lots.streakDays in a row. Blocks may overlap. */
export function mergeCandidates(world: World): number[] {
  const streak = world.lotStreak, need = BALANCE.lots.streakDays;
  const { width, height } = world.grid;
  const { zoned, zonedCount } = world.index;
  const out: number[] = [];
  for (let k = 0; k < zonedCount; k++) {
    const a = zoned[k];
    if (streak[a] < need) continue;
    const x = a % width, y = (a - x) / width;
    if (x + 1 >= width || y + 1 >= height) continue;
    if (streak[a + 1] < need || streak[a + width] < need || streak[a + width + 1] < need) continue;
    if (canMergeLot(world, x, y)) out.push(a);
  }
  return out;
}
