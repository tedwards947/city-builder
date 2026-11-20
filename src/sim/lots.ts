// Merged lots (BIG_LOTS_DESIGN.md): top-level lots of one zone that have become
// a single big building. Four lots in a 2×2 square, for any zone; or, for shops
// only, two lots side by side (a "pair": owner, 2026-11-20, because shops
// seldom stand two deep).
//
// A merged lot is NOT a building kind. Its tiles stay zone tiles, so every
// system that counts residents, jobs, taxes and trips per tile keeps working:
//   - each tile is at devLevel LOT_LEVEL (4), one above what a lot grows to;
//   - `layers.lot` says which part of the building a tile is. 0 = an ordinary lot.
//       2×2 square:  1 NW (the anchor), 2 NE, 3 SW, 4 SE
//       wide pair:   5 west (the anchor), 6 east
//       tall pair:   7 north (the anchor), 8 south
//     Ask lotShape / isLotAnchor / world.lotAnchor / world.lotTilesAt rather
//     than reading the numbers;
//   - capacity comes from the per-level tables in BALANCE.growth: `popPerLevel[4]`
//     for residents and `levelWeight[4]` wherever a system multiplies by the level.
//
// It is one building: knocking down, rezoning, paving or building over any of
// its tiles brings the whole of it down first (World.razeLot), leaving the
// other tiles as empty zoned lots. Commands snapshot all its tiles
// (Command.tilesClearedWith / lotSiblings) so one undo puts it back.

import type { World } from './World';
import { countsAsPark } from './leisure';
import { BUILDING_NONE, ROAD_HIGHWAY, ROAD_NONE, TERRAIN_WATER, ZONE_C, ZONE_I, ZONE_NONE, ZONE_R } from './constants';
import { BALANCE } from '../data/balance';

/** The devLevel of every tile of a merged lot. */
export const LOT_LEVEL = 4;

/** What a lot of level `dev` counts for where a system multiplies by the level: itself for 0–3, more for a merged lot. */
export function levelWeight(dev: number): number {
  return BALANCE.growth.levelWeight[dev] ?? dev;
}

/** The shape of a merged lot: a 2×2 square, or (shops only) two lots side by side, east–west ('wide') or north–south ('tall'). */
export type LotShape = 'square' | 'wide' | 'tall';

/** Width and height in tiles of each shape. */
export const LOT_SIZE: Readonly<Record<LotShape, { w: number; h: number }>> = { square: { w: 2, h: 2 }, wide: { w: 2, h: 1 }, tall: { w: 1, h: 2 } };

/** The `layers.lot` value of the anchor tile of each shape; the other tiles count up from it. */
const FIRST: Readonly<Record<LotShape, number>> = { square: 1, wide: 5, tall: 7 };

/** Whether a `layers.lot` value marks the anchor tile of a merged lot (its NW, west or north tile): the one tile per building. */
export function isLotAnchor(q: number): boolean {
  return q === 1 || q === 5 || q === 7;
}

/** The shape a `layers.lot` value belongs to, or null for 0 (an ordinary lot). */
export function shapeOfQuarter(q: number): LotShape | null {
  return q === 0 ? null : q <= 4 ? 'square' : q <= 6 ? 'wide' : 'tall';
}

/** The shape of the merged lot that tile `i` is part of, or null for an ordinary tile. */
export function lotShape(world: World, i: number): LotShape | null {
  return shapeOfQuarter(world.layers.lot[i]);
}

/** The tile indices of the `shape` whose anchor (NW corner) is (tx, ty), anchor first, or null if it leaves the map. */
function tilesOf(world: World, tx: number, ty: number, shape: LotShape): number[] | null {
  const { width, height } = world.grid;
  const { w, h } = LOT_SIZE[shape];
  if (tx < 0 || ty < 0 || tx + w > width || ty + h > height) return null;
  const a = ty * width + tx;
  return shape === 'wide' ? [a, a + 1] : shape === 'tall' ? [a, a + width] : [a, a + 1, a + width, a + width + 1];
}

/**
 * Whether the `shape` with its anchor at (tx, ty) can merge: lots of one zone
 * (shops, for a pair), none already part of a merged lot, each at the top
 * level and none abandoned. With `force` (debug), the level and abandonment
 * are not asked.
 */
export function canMergeLot(world: World, tx: number, ty: number, force = false, shape: LotShape = 'square'): boolean {
  const tiles = tilesOf(world, tx, ty, shape);
  if (!tiles) return false;
  const L = world.layers;
  const zone = L.zone[tiles[0]];
  if (zone === ZONE_NONE || (shape !== 'square' && zone !== ZONE_C)) return false;
  for (const i of tiles) {
    if (L.zone[i] !== zone || L.building[i] !== BUILDING_NONE || L.roadClass[i] !== ROAD_NONE || L.lot[i] !== 0) return false;
    if (!force && (L.devLevel[i] !== BALANCE.growth.maxLevel || L.abandoned[i] !== 0)) return false;
  }
  return true;
}

/**
 * Merge the `shape` with its anchor at (tx, ty) into one building. Nobody is
 * displaced: the lots' residents and jobs are simply part of it. Returns
 * false, changing nothing, if it cannot merge (canMergeLot).
 */
export function mergeLot(world: World, tx: number, ty: number, force = false, shape: LotShape = 'square'): boolean {
  if (!canMergeLot(world, tx, ty, force, shape)) return false;
  const tiles = tilesOf(world, tx, ty, shape)!;
  const L = world.layers;
  const { width } = world.grid;
  for (let q = 0; q < tiles.length; q++) {
    const i = tiles[q];
    L.devLevel[i] = LOT_LEVEL;
    L.lot[i] = FIRST[shape] + q;
    L.abandoned[i] = 0;
    L.distress[i] = 0;
    world.lotStreak[i] = 0;
    world.grid.markDirty(i % width, (i - (i % width)) / width);
  }
  world.events.emit('lotMerged', { tx, ty, zone: L.zone[tiles[0]], shape });
  return true;
}

/** The other tiles of the merged lot that tile `i` is part of; empty for an ordinary tile. For commands to snapshot before they change `i`. */
export function lotSiblings(world: World, i: number): number[] {
  return world.lotTilesAt(i).filter((t) => t !== i);
}

export interface LotSummary {
  /** Tile index of the anchor: the NW corner of a 2×2, the west or north tile of a pair. */
  anchor: number;
  /** The tiles, anchor first: NW, NE, SW, SE for a 2×2; two for a pair. */
  tiles: number[];
  shape: LotShape;
  zone: number;
  abandoned: boolean;
  /** Residents of the whole building (0 for shops and industry, and when abandoned). */
  residents: number;
  /** What the whole building counts for in taxes, jobs and trips, in level-1 lots (0 when abandoned). */
  weight: number;
}

/** The merged lot that tile `i` is part of, summed over its tiles, or null for an ordinary tile. */
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
  return { anchor: tiles[0], tiles, shape: lotShape(world, i)!, zone, abandoned, residents, weight };
}

/**
 * After loading: make `layers.lot` and the levels agree. A tile that is not
 * part of a whole, same-zone merged lot at LOT_LEVEL (a 2×2, or a pair of
 * shops) goes back to an ordinary lot, and so does any tile above the top
 * level that is not in a merged lot.
 */
export function cleanLots(world: World): void {
  const L = world.layers;
  const { width } = world.grid;
  const top = BALANCE.growth.maxLevel;
  const good = new Uint8Array(L.lot.length);
  for (let a = 0; a < L.lot.length; a++) {
    const shape = isLotAnchor(L.lot[a]) ? shapeOfQuarter(L.lot[a])! : null;
    if (!shape) continue;
    const x = a % width;
    const tiles = tilesOf(world, x, (a - x) / width, shape);
    const zone = L.zone[a];
    if (!tiles || zone === ZONE_NONE || (shape !== 'square' && zone !== ZONE_C)) continue;
    if (tiles.every((t, q) => L.lot[t] === FIRST[shape] + q && L.zone[t] === zone && L.devLevel[t] === LOT_LEVEL && L.building[t] === BUILDING_NONE && L.roadClass[t] === ROAD_NONE)) {
      for (const t of tiles) good[t] = 1;
    }
  }
  for (let i = 0; i < L.lot.length; i++) {
    if (good[i]) continue;
    L.lot[i] = 0;
    if (L.devLevel[i] > top) L.devLevel[i] = top;
  }
}

/** The anchor of the `shape` nearest (tx, ty), within `radius` tiles, that canMergeLot accepts; null if there is none. For the debug button. */
export function nearestMergeable(world: World, tx: number, ty: number, force = false, radius = 12, shape: LotShape = 'square'): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null, bestD = Infinity;
  for (let y = ty - radius; y <= ty + radius; y++) for (let x = tx - radius; x <= tx + radius; x++) {
    const d = (x + 0.5 - tx) ** 2 + (y + 0.5 - ty) ** 2;
    if (d < bestD && canMergeLot(world, x, y, force, shape)) { best = { tx: x, ty: y }; bestD = d; }
  }
  return best;
}

// ── When lots merge (systems/LotMergeSystem.ts) ──────────────────────────────

/**
 * "Jobs nearby" for every lot, and where the city's homes and shops stand on
 * it: what makes a spot prime (owner + ENGINEER 3, 2026-11-19). Built once a
 * day by jobsNearby; reads the world as it is then.
 */
export interface JobsNearby {
  /** Developed, occupied shop and industry tiles within BALANCE.lots.jobsRadius of tile `i` (a square, the tile itself included). */
  at(i: number): number;
  /** The value a home or shop must reach to be in the city's top BALANCE.lots.topJobsShare for jobs nearby. Infinity when no lot has any. */
  top: number;
  /** The median over the city's developed, occupied home and shop lots. */
  median: number;
}

let sums = new Int32Array(0);

/** Count the jobs near every lot (a summed-area table over the built-up part of the map), and find the top and median values among homes and shops. */
export function jobsNearby(world: World): JobsNearby {
  const Lr = world.layers, cfg = BALANCE.lots;
  const { width } = world.grid;
  const r = cfg.jobsRadius;
  const area = world.index.area(world);
  const aw = area.x1 - area.x0 + 1, ah = area.y1 - area.y0 + 1;
  if (aw <= 0 || ah <= 0) return { at: () => 0, top: Infinity, median: 0 };
  const sw = aw + 1;
  if (sums.length < sw * (ah + 1)) sums = new Int32Array(sw * (ah + 1));
  const S = sums;
  for (let x = 0; x <= aw; x++) S[x] = 0;
  for (let y = 0; y < ah; y++) {
    let row = 0;
    S[(y + 1) * sw] = 0;
    for (let x = 0; x < aw; x++) {
      const i = (area.y0 + y) * width + area.x0 + x;
      const z = Lr.zone[i];
      if ((z === ZONE_C || z === ZONE_I) && Lr.devLevel[i] > 0 && Lr.abandoned[i] === 0) row++;
      S[(y + 1) * sw + x + 1] = S[y * sw + x + 1] + row;
    }
  }
  const at = (i: number): number => {
    const x = i % width - area.x0, y = (i - (i % width)) / width - area.y0;
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(aw - 1, x + r), y1 = Math.min(ah - 1, y + r);
    if (x1 < x0 || y1 < y0) return 0;
    return S[(y1 + 1) * sw + x1 + 1] - S[y0 * sw + x1 + 1] - S[(y1 + 1) * sw + x0] + S[y0 * sw + x0];
  };
  // Where the city's homes and shops stand: a count of lots for each value.
  const hist = new Int32Array((2 * r + 1) * (2 * r + 1) + 1);
  const { zoned, zonedCount } = world.index;
  let n = 0, any = false;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k], z = Lr.zone[i];
    if ((z !== ZONE_R && z !== ZONE_C) || Lr.devLevel[i] === 0 || Lr.abandoned[i] !== 0) continue;
    const v = at(i);
    hist[v]++;
    n++;
    if (v > 0) any = true;
  }
  /** The value of the lot at rank ceil(share × n), counting up from the lowest. */
  const rank = (share: number): number => {
    const want = Math.max(1, Math.ceil(share * n));
    let seen = 0;
    for (let v = 0; v < hist.length; v++) { seen += hist[v]; if (seen >= want) return v; }
    return hist.length - 1;
  };
  return { at, top: any ? Math.max(1, rank(1 - cfg.topJobsShare)) : Infinity, median: n > 0 ? rank(0.5) : 0 };
}

/** Whether something `test` accepts lies within `radius` tiles of tile `i` (a square). */
function near(world: World, i: number, radius: number, test: (j: number) => boolean): boolean {
  const { width, height } = world.grid;
  const x = i % width, y = (i - x) / width;
  for (let ny = Math.max(0, y - radius); ny <= Math.min(height - 1, y + radius); ny++) {
    for (let nx = Math.max(0, x - radius); nx <= Math.min(width - 1, x + radius); nx++) if (test(ny * width + nx)) return true;
  }
  return false;
}

/**
 * Whether lot `i` stands in a prime spot, where towers belong: downtown, or
 * by a park or the water (owner, 2026-11-19).
 *   - A home or shop: its land is worth at least BALANCE.lots.minLandValue (a
 *     low bar that screens out blight), AND it is either in the city's top
 *     tenth for jobs nearby, or within parkRadius of a park or waterRadius of
 *     water while at or above the city's median for jobs nearby.
 *   - Industry: anywhere.
 */
export function primeSpot(world: World, i: number, jobs: JobsNearby): boolean {
  const Lr = world.layers, cfg = BALANCE.lots;
  if (Lr.zone[i] === ZONE_I) return true;
  if (Lr.landValue[i] < cfg.minLandValue) return false;
  const v = jobs.at(i);
  if (v >= jobs.top) return true;
  if (v < jobs.median) return false;
  return near(world, i, cfg.parkRadius, (j) => countsAsPark(Lr.building[j])) || near(world, i, cfg.waterRadius, (j) => Lr.terrain[j] === TERRAIN_WATER);
}

/**
 * Whether lot `i` counts toward merging today: an ordinary lot at the top
 * level, not abandoned, with no distress (nothing wrong with its power, water,
 * road, crime or fire risk), in a prime spot (primeSpot), in a city whose
 * satisfaction is at least BALANCE.lots.minSatisfaction. (Satisfaction is one
 * number for the whole city; the rest is the lot's own.)
 */
export function lotIsHappy(world: World, i: number, jobs: JobsNearby = jobsNearby(world)): boolean {
  const Lr = world.layers;
  return Lr.lot[i] === 0 && Lr.devLevel[i] === BALANCE.growth.maxLevel && Lr.abandoned[i] === 0 && Lr.distress[i] === 0
    && world.stats.satisfaction >= BALANCE.lots.minSatisfaction
    && primeSpot(world, i, jobs);
}

/** One game day passes: every lot that counts today (lotIsHappy) adds a day to its streak (world.lotStreak); every other lot starts again from 0. */
export function updateLotStreaks(world: World): void {
  const streak = world.lotStreak;
  const { zoned, zonedCount } = world.index;
  const jobs = jobsNearby(world);
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    streak[i] = lotIsHappy(world, i, jobs) ? Math.min(255, streak[i] + 1) : 0;
  }
}

/** Whether the `shape` with its anchor at (tx, ty) is far enough from every merged lot: none within BALANCE.lots.spacing tiles of it. */
export function clearOfLots(world: World, tx: number, ty: number, shape: LotShape = 'square'): boolean {
  const { width, height } = world.grid, lot = world.layers.lot, gap = BALANCE.lots.spacing;
  const { w, h } = LOT_SIZE[shape];
  for (let y = Math.max(0, ty - gap); y <= Math.min(height - 1, ty + h - 1 + gap); y++) {
    for (let x = Math.max(0, tx - gap); x <= Math.min(width - 1, tx + w - 1 + gap); x++) if (lot[y * width + x] !== 0) return false;
  }
  return true;
}

/** Whether tile `i` is a corner of some 2×2 that canMergeLot accepts: four top-level lots of its zone, whatever their streaks. */
function inSquare(world: World, i: number): boolean {
  const { width } = world.grid, x = i % width, y = (i - x) / width;
  return canMergeLot(world, x, y) || canMergeLot(world, x - 1, y) || canMergeLot(world, x, y - 1) || canMergeLot(world, x - 1, y - 1);
}

/**
 * Whether the pair of shops (`shape` 'wide' or 'tall') anchored at (tx, ty)
 * may merge as a pair: canMergeLot, and neither shop is part of a 2×2 of
 * top-level shops. Where the block is deep enough for the full 2×2, the pair
 * waits for it (owner, 2026-11-20: deep shop blocks get the tall towers).
 */
export function canMergePair(world: World, tx: number, ty: number, shape: LotShape): boolean {
  if (shape === 'square' || !canMergeLot(world, tx, ty, false, shape)) return false;
  const tiles = tilesOf(world, tx, ty, shape)!;
  return !inSquare(world, tiles[0]) && !inSquare(world, tiles[1]);
}

/** A block that could merge today: its anchor tile and its shape. */
export interface MergeCandidate { anchor: number; shape: LotShape }

/**
 * Every block that could merge today: a 2×2 of one zone, or a pair of shops
 * that is not part of a possible 2×2 (canMergePair); every lot of it counting
 * for BALANCE.lots.streakDays in a row; and clear of every merged lot
 * (clearOfLots). Blocks may overlap.
 */
export function mergeCandidates(world: World): MergeCandidate[] {
  const streak = world.lotStreak, need = BALANCE.lots.streakDays;
  const { width, height } = world.grid;
  const { zoned, zonedCount } = world.index;
  const zone = world.layers.zone;
  const out: MergeCandidate[] = [];
  for (let k = 0; k < zonedCount; k++) {
    const a = zoned[k];
    if (streak[a] < need) continue;
    const x = a % width, y = (a - x) / width;
    const east = x + 1 < width && streak[a + 1] >= need, south = y + 1 < height && streak[a + width] >= need;
    if (east && south && streak[a + width + 1] >= need && canMergeLot(world, x, y) && clearOfLots(world, x, y)) out.push({ anchor: a, shape: 'square' });
    if (zone[a] !== ZONE_C) continue;
    if (east && canMergePair(world, x, y, 'wide') && clearOfLots(world, x, y, 'wide')) out.push({ anchor: a, shape: 'wide' });
    if (south && canMergePair(world, x, y, 'tall') && clearOfLots(world, x, y, 'tall')) out.push({ anchor: a, shape: 'tall' });
  }
  return out;
}

// ── One way in ───────────────────────────────────────────────────────────────

/** Whether a street or avenue lies beside tile `i` (a highway gives no access). */
function roadBeside(world: World, i: number): boolean {
  const { width, height } = world.grid, road = world.layers.roadClass, x = i % width;
  const ok = (j: number): boolean => road[j] !== ROAD_NONE && road[j] !== ROAD_HIGHWAY;
  return (x > 0 && ok(i - 1)) || (x < width - 1 && ok(i + 1)) || (i >= width && ok(i - width)) || (i < width * (height - 1) && ok(i + width));
}

/**
 * The tile whose neighbouring roads tile `i` uses: `i` itself, except for a
 * tile of a merged lot with no street or avenue of its own, which goes out
 * through the first tile of its building that has one. (Every lot has its own
 * road when it merges; this matters after the player takes a road away from
 * one side.) Traffic, accessibility and the "no road" warnings all ask this,
 * so they agree with AbandonmentSystem that the building still has a road.
 */
export function doorTile(world: World, i: number): number {
  if (world.layers.lot[i] === 0 || roadBeside(world, i)) return i;
  for (const t of world.lotTilesAt(i)) if (t !== i && roadBeside(world, t)) return t;
  return i;
}

/** How many merged lots the city has, by zone (index ZONE_R, ZONE_C, ZONE_I) and in all; `pairs` of them are pairs of shops, the rest 2×2. For the Balance Lab and the bench. */
export function lotCounts(world: World): { total: number; byZone: number[]; pairs: number } {
  const L = world.layers, byZone = [0, 0, 0, 0];
  const { zoned, zonedCount } = world.index;
  let total = 0, pairs = 0;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (!isLotAnchor(L.lot[i])) continue;
    total++;
    if (L.lot[i] !== 1) pairs++;
    byZone[L.zone[i]]++;
  }
  return { total, byZone, pairs };
}

export interface MergeReport {
  /** Ordinary lots at the top level, not abandoned. */
  topLots: number;
  /** Of those, how many count as happy and valuable today (lotIsHappy). */
  happyToday: number;
  /** The longest streak any lot has, in days. */
  bestStreak: number;
  /** Blocks that could merge today (mergeCandidates). */
  ready: number;
  /** 2×2 squares of top-level lots of one zone, ready or not: where a merge could ever happen. */
  squares: number;
  /** Pairs of top-level shops that may merge as a pair (canMergePair), ready or not. */
  pairs: number;
}

/** Where the city stands on merging, for the debug button and the lab: how many lots qualify, and how far along they are. */
export function mergeReport(world: World): MergeReport {
  const L = world.layers, top = BALANCE.growth.maxLevel;
  const { width, height } = world.grid;
  const { zoned, zonedCount } = world.index;
  const r: MergeReport = { topLots: 0, happyToday: 0, bestStreak: 0, ready: mergeCandidates(world).length, squares: 0, pairs: 0 };
  const jobs = jobsNearby(world);
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (L.lot[i] !== 0 || L.devLevel[i] !== top || L.abandoned[i] !== 0) continue;
    r.topLots++;
    if (lotIsHappy(world, i, jobs)) r.happyToday++;
    if (world.lotStreak[i] > r.bestStreak) r.bestStreak = world.lotStreak[i];
    const x = i % width, y = (i - x) / width;
    if (x + 1 < width && y + 1 < height && canMergeLot(world, x, y)) r.squares++;
    if (L.zone[i] === ZONE_C) r.pairs += +canMergePair(world, x, y, 'wide') + +canMergePair(world, x, y, 'tall');
  }
  return r;
}
