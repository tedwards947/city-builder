// Resident requests (PC_DESIGN.md → "Resident requests"): a neighbourhood
// asks for something by a deadline; meeting it earns PC, missing it costs a
// little. RequestSystem opens and resolves them; this file has the kinds.
//
// A neighbourhood is one cell of a coarse grid (BALANCE...requests.cellSize
// tiles square) with enough developed homes in it. Each kind scores a cell's
// NEED from 0 (has what it would ask for) to 1 (entirely without it), by
// looking only at the tiles of that cell, so nothing loops over the map. A
// new request goes to the cell and kind with the highest need, shaken by a
// little randomness (seeded world.rng), and is met once that cell's need for
// its kind is down to `metNeed`.
//
// Numbers live in BALANCE.politicalCapital.requests and are read live.
// SWITCHED OFF: spawnEveryDays is 0, so no request ever opens.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { ZONE_R, BUILDING_PARK } from './constants';
import { trafficVolume, roadCapacity } from './TrafficData';

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** An open request, as saved in world.politics.requests. */
export interface OpenRequest extends Rect {
  id: number;
  kind: string;
  openedTick: number;
  deadlineTick: number;
}

export interface RequestKind {
  id: string;
  nameKey: string;
  descKey: string;
  /** 0 (nothing missing) to 1 (entirely without it) for the area's homes. */
  need(world: World, area: Rect): number;
}

interface RequestNumbers { days: number; reward: number; penalty: number }

type RequestConfig = {
  spawnEveryDays: number; maxOpen: number; cellSize: number; minHomes: number;
  metNeed: number; randomness: number; kinds: Record<string, RequestNumbers>;
};
export const requestConfig = (): RequestConfig => BALANCE.politicalCapital.requests as unknown as RequestConfig;

/** Calls `f` for every developed, lived-in home tile in the area. */
function forHomes(world: World, a: Rect, f: (i: number, x: number, y: number) => void): number {
  const { zone, devLevel, abandoned } = world.layers;
  const w = world.grid.width;
  let n = 0;
  for (let y = a.y0; y <= a.y1; y++) {
    for (let x = a.x0; x <= a.x1; x++) {
      const i = y * w + x;
      if (zone[i] !== ZONE_R || devLevel[i] === 0 || abandoned[i]) continue;
      n++;
      f(i, x, y);
    }
  }
  return n;
}

/** Share of the area's homes for which `lacks(i)` is true; 0 with no homes. */
function shareLacking(world: World, a: Rect, lacks: (i: number, x: number, y: number) => boolean): number {
  let missing = 0;
  const homes = forHomes(world, a, (i, x, y) => { if (lacks(i, x, y)) missing++; });
  return homes ? missing / homes : 0;
}

function parkNeed(world: World, a: Rect): number {
  const reach = BALANCE.service.coverageRange[BUILDING_PARK];
  // Only parks near the area can reach it.
  const parks = world.buildings.filter((b) => b.kind === BUILDING_PARK
    && b.tx >= a.x0 - reach && b.tx <= a.x1 + reach && b.ty >= a.y0 - reach && b.ty <= a.y1 + reach);
  return shareLacking(world, a, (_i, x, y) => !parks.some((p) => Math.abs(p.tx - x) + Math.abs(p.ty - y) <= reach));
}

function coverageNeed(world: World, a: Rect, l1: Uint8Array, l2: Uint8Array): number {
  return Math.max(shareLacking(world, a, (i) => !l1[i]), shareLacking(world, a, (i) => !l2[i]));
}

function utilitiesNeed(world: World, a: Rect): number {
  const s = world.stats;
  // Only asked for during a shortage.
  if (s.powerSupply >= s.powerDemand && s.waterSupply >= s.waterDemand) return 0;
  const { power, water } = world.layers;
  return shareLacking(world, a, (i) => !power[i] || !water[i]);
}

function trafficNeed(world: World, a: Rect): number {
  const t = world.traffic;
  if (!t) return 0;
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  let roads = 0, over = 0;
  // The roads in and just around the area.
  for (let y = Math.max(0, a.y0 - 2); y <= Math.min(height - 1, a.y1 + 2); y++) {
    for (let x = Math.max(0, a.x0 - 2); x <= Math.min(width - 1, a.x1 + 2); x++) {
      const i = y * width + x;
      if (!roadClass[i]) continue;
      roads++;
      if (trafficVolume(t, i) > roadCapacity(roadClass[i])) over++;
    }
  }
  return roads ? over / roads : 0;
}

function blightNeed(world: World, a: Rect): number {
  const { zone, abandoned } = world.layers;
  const w = world.grid.width;
  let zoned = 0, empty = 0;
  for (let y = a.y0; y <= a.y1; y++) {
    for (let x = a.x0; x <= a.x1; x++) {
      const i = y * w + x;
      if (!zone[i]) continue;
      zoned++;
      if (abandoned[i]) empty++;
    }
  }
  return zoned ? empty / zoned : 0;
}

const kind = (id: string, need: RequestKind['need']): RequestKind =>
  ({ id, nameKey: `requests.${id}.name`, descKey: `requests.${id}.desc`, need });

/** The registry. */
export const REQUEST_KINDS: readonly RequestKind[] = [
  kind('park', parkNeed),
  kind('schoolOrHospital', (w, a) => coverageNeed(w, a, w.layers.school, w.layers.hospital)),
  kind('policeOrFire', (w, a) => coverageNeed(w, a, w.layers.police, w.layers.fireStation)),
  kind('utilities', utilitiesNeed),
  kind('trafficJam', trafficNeed),
  kind('blight', blightNeed),
];

export const requestKind = (id: string): RequestKind | undefined => REQUEST_KINDS.find((k) => k.id === id);

/** Is the request met: the area's need for its kind is down to metNeed. */
export function isMet(world: World, req: OpenRequest): boolean {
  const k = requestKind(req.kind);
  return !k || k.need(world, req) <= requestConfig().metNeed;
}

const overlaps = (a: Rect, b: Rect) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/**
 * Neighbourhoods that could ask: grid cells with at least minHomes
 * developed homes, from the index's zoned list (not a map scan). Each is the
 * bounding box of its homes.
 */
export function neighbourhoods(world: World): Rect[] {
  const { cellSize, minHomes } = requestConfig();
  const { width } = world.grid;
  const { zone, devLevel, abandoned } = world.layers;
  const cols = Math.ceil(width / cellSize);
  const cells = new Map<number, { n: number } & Rect>();
  const { zoned, zonedCount } = world.index;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (zone[i] !== ZONE_R || devLevel[i] === 0 || abandoned[i]) continue;
    const x = i % width, y = (i - x) / width;
    const key = Math.floor(y / cellSize) * cols + Math.floor(x / cellSize);
    const c = cells.get(key);
    if (!c) { cells.set(key, { n: 1, x0: x, y0: y, x1: x, y1: y }); continue; }
    c.n++;
    if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
    if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
  }
  return [...cells.entries()]
    .sort((a, b) => a[0] - b[0])            // the same order every time, for the seeded pick
    .filter(([, c]) => c.n >= minHomes)
    .map(([, c]) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }));
}

/**
 * The next request to open: the (neighbourhood, kind) with the highest need
 * above metNeed, each need scaled by a random factor in [1 - randomness, 1].
 * Skips neighbourhoods that already have an open request. Null if nobody needs anything.
 */
export function pickRequest(world: World, rng: () => number): { kind: string; area: Rect } | null {
  const { metNeed, randomness } = requestConfig();
  const open = world.politics.requests;
  let best: { kind: string; area: Rect } | null = null;
  let bestScore = 0;
  for (const area of neighbourhoods(world)) {
    if (open.some((r) => overlaps(r, area))) continue;
    for (const k of REQUEST_KINDS) {
      const need = k.need(world, area);
      if (need <= metNeed) continue;
      const score = need * (1 - randomness * rng());
      if (score > bestScore) { bestScore = score; best = { kind: k.id, area }; }
    }
  }
  return best;
}
