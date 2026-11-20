// Balance Lab: 2×2 merged lots (BIG_LOTS_DESIGN.md, sim/lots.ts). Not part of the game.
//
// Two probes on a saved city, under the shipped BALANCE.lots:
//   - merge runs: the city plays on for `days` game days, once per seed, with the
//     real LotMergeSystem, and every new merged lot is recorded (day, zone, shape,
//     how far from the middle of town). 2×2s are graded; pairs of shops (#400)
//     are reported, not graded (no approved targets yet). Merged lots already in the save (the owner's
//     debug merges) are first undone, back to four level-3 lots, so every city
//     starts from none;
//   - capacity: the most central home (and shop, and industry) 2×2 that could
//     merge, and the most central pair of shops, is merged in a copy of the city, and its residents, weight (taxes,
//     jobs) and trips sent are compared with the same four lots unmerged.
// Graded by the lots.* targets in targets.ts.

import { BALANCE } from '../data/balance';
import { ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';
import { canMergeLot, canMergePair, isLotAnchor, levelWeight, lotSummary, mergeLot, shapeOfQuarter, type LotShape } from '../sim/lots';
import { mulberry32 } from '../sim/rng';
import type { World } from '../sim/World';
import { cloneWorld, startSim } from './world';

export interface LotMerge { day: number; zone: number; shape: LotShape; x: number; y: number; /** distance from the zoned centroid ÷ its 95th percentile: ≥ 0.66 is the outer third */ rel: number }

export interface LotsGroup {
  /** First merge's day, per seed (null: none in the run). */
  first: (number | null)[];
  /** Mean over seeds, a run with none counting as `days` + 1; null if no run had one. */
  firstMean: number | null;
  by90: number;        // merges by day 90, mean per seed
  byEnd: number;       // merges by the last day, mean per seed
  edgeShare: number | null;   // share of the merges in the outer third (null: no merges)
  maxWindow: number;   // most merges whose anchors fit in one 16×16 square, worst seed
}

export interface LotsCapacity {
  zone: number;
  shape: LotShape;
  /** Residents of the merged lot ÷ the four lots' (homes only; null otherwise). */
  residents: number | null;
  /** Weight (taxes, jobs, utilities) of the merged lot ÷ the four lots'. */
  weight: number;
  /** Trips the block sends, merged ÷ unmerged (all markets from its zone, measured on the traffic pass). */
  trips: number | null;
}

export interface LotsResult {
  days: number;
  seeds: number[];
  /** Merged lots in the save, undone before the runs. */
  undone: number;
  /** 2×2s of homes or shops. */
  homesShops: LotsGroup;
  /** 2×2s of industry. */
  industry: LotsGroup;
  /** Pairs of shops (two side by side): reported, not graded. */
  pairs: LotsGroup;
  capacity: LotsCapacity[];
}

export const LOTS_DAYS = 360;
export const LOTS_SEEDS = [1, 2, 3];
const WINDOW = 16;

/** Four level-3 lots again wherever the save has a merged lot. Returns how many merged lots there were. */
function undoMerges(w: World): number {
  const L = w.layers, top = BALANCE.growth.maxLevel;
  let n = 0;
  for (let i = 0; i < L.lot.length; i++) {
    if (L.lot[i] === 0) continue;
    if (isLotAnchor(L.lot[i])) n++;
    L.lot[i] = 0;
    L.devLevel[i] = top;
  }
  return n;
}

function group(runs: LotMerge[][], days: number): LotsGroup {
  const first = runs.map((m) => m[0]?.day ?? null);
  const all = runs.flat();
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const maxWindow = Math.max(0, ...runs.map((m) => Math.max(0, ...m.map((a) => m.filter((b) => b.x >= a.x && b.x < a.x + WINDOW && b.y >= a.y && b.y < a.y + WINDOW).length))));
  return {
    first,
    firstMean: first.some((d) => d !== null) ? r2(mean(first.map((d) => d ?? days + 1))) : null,
    by90: r2(mean(runs.map((m) => m.filter((x) => x.day <= 90).length))),
    byEnd: r2(mean(runs.map((m) => m.length))),
    edgeShare: all.length ? r2(all.filter((m) => m.rel >= 0.66).length / all.length) : null,
    maxWindow,
  };
}

/** Trips sent by every lot of `zone` (all markets that zone sends), on a fresh traffic pass. */
function tripsFrom(w: World, zone: number): number {
  const sim = startSim(w);   // recomputes traffic
  let t = 0;
  for (const m of sim.world.traffic?.markets ?? []) if (m.def.origin === zone) t += m.field.demand + m.field.stranded;
  return t;
}

/** The most central block of `zone` and `shape` that could merge, as [x, y], or null. */
function centralBlock(w: World, zone: number, shape: LotShape, cx: number, cy: number): [number, number] | null {
  const { width } = w.grid, L = w.layers;
  let best: [number, number] | null = null, bd = Infinity;
  for (let k = 0; k < w.index.zonedCount; k++) {
    const i = w.index.zoned[k], x = i % width, y = (i - x) / width;
    if (L.zone[i] !== zone || L.abandoned[i] !== 0 || !(shape === 'square' ? canMergeLot(w, x, y) : canMergePair(w, x, y, shape))) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

function capacity(base: World, zone: number, shape: LotShape, cx: number, cy: number): LotsCapacity | null {
  const at = centralBlock(base, zone, shape, cx, cy);
  if (!at) return null;
  const { width } = base.grid, [x, y] = at, a = y * width + x;
  const tiles = shape === 'wide' ? [a, a + 1] : shape === 'tall' ? [a, a + width] : [a, a + 1, a + width, a + width + 1];
  const before = { residents: 0, weight: 0 };
  for (const t of tiles) { before.weight += levelWeight(base.layers.devLevel[t]); before.residents += BALANCE.growth.popPerLevel[base.layers.devLevel[t]] ?? 0; }
  const merged = cloneWorld(base), cleared = cloneWorld(base);
  if (!mergeLot(merged, x, y, false, shape)) return null;
  for (const t of tiles) cleared.layers.devLevel[t] = 0;   // the block sends nothing: the rest of the city's trips
  const s = lotSummary(merged, a)!;
  const rest = tripsFrom(cleared, zone), unmerged = tripsFrom(cloneWorld(base), zone) - rest, asOne = tripsFrom(merged, zone) - rest;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    zone,
    shape,
    residents: zone === ZONE_R ? r3(s.residents / before.residents) : null,
    weight: r3(s.weight / before.weight),
    trips: unmerged > 0 ? r3(asOne / unmerged) : null,
  };
}

/** Both probes on a saved city (see the top of this file). Leaves `world` as it was. */
export function lotsResult(world: World, days = LOTS_DAYS, seeds = LOTS_SEEDS): LotsResult {
  const base = cloneWorld(world);
  const undone = undoMerges(base);
  const { width } = base.grid, { zoned, zonedCount } = base.index;
  let cx = 0, cy = 0;
  for (let k = 0; k < zonedCount; k++) { const i = zoned[k]; cx += i % width; cy += Math.floor(i / width); }
  cx /= Math.max(zonedCount, 1); cy /= Math.max(zonedCount, 1);
  const dists: number[] = [];
  for (let k = 0; k < zonedCount; k++) { const i = zoned[k]; dists.push(Math.hypot(i % width - cx, Math.floor(i / width) - cy)); }
  dists.sort((p, q) => p - q);
  const d95 = Math.max(1, dists[Math.floor(dists.length * 0.95)] ?? 1);

  const hs: LotMerge[][] = [], ind: LotMerge[][] = [], pairs: LotMerge[][] = [];
  for (const seed of seeds) {
    const w = cloneWorld(base);
    w.rng = mulberry32(seed * 7919 + 1);
    const sim = startSim(w);
    const L = w.layers, seen = new Set<number>(), merges: LotMerge[] = [];
    for (let d = 1; d <= days; d++) {
      sim.tick(BALANCE.ticksPerDay);
      for (let k = 0; k < w.index.zonedCount; k++) {
        const i = w.index.zoned[k];
        if (!isLotAnchor(L.lot[i]) || seen.has(i)) continue;
        seen.add(i);
        const x = i % width, y = (i - x) / width;
        merges.push({ day: d, zone: L.zone[i], shape: shapeOfQuarter(L.lot[i])!, x, y, rel: Math.round(Math.hypot(x - cx, y - cy) / d95 * 100) / 100 });
      }
    }
    const squares = merges.filter((m) => m.shape === 'square');
    hs.push(squares.filter((m) => m.zone !== ZONE_I));
    ind.push(squares.filter((m) => m.zone === ZONE_I));
    pairs.push(merges.filter((m) => m.shape !== 'square'));
  }

  // Capacity on the city after a few settled days (traffic and levels as they play).
  const settled = cloneWorld(base);
  startSim(settled).tick(10 * BALANCE.ticksPerDay);
  undoMerges(settled);   // in case the shipped chance merged something while settling
  const pair = capacity(settled, ZONE_C, 'wide', cx, cy) ?? capacity(settled, ZONE_C, 'tall', cx, cy);
  const cap = [...[ZONE_R, ZONE_C, ZONE_I].map((z) => capacity(settled, z, 'square', cx, cy)), pair].filter((c): c is LotsCapacity => c !== null);

  return { days, seeds, undone, homesShops: group(hs, days), industry: group(ind, days), pairs: group(pairs, days), capacity: cap };
}
