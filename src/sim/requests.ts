// Resident requests (PC_DESIGN.md → "Resident requests"): a neighbourhood
// asks for something by a deadline; meeting it earns PC, missing it costs a
// little. RequestSystem opens and resolves them; this file has the kinds.
//
// A neighbourhood is one cell of a coarse grid (BALANCE...requests.cellSize
// tiles square) with enough developed homes in it. Each kind scores a cell's
// NEED from 0 (has what it would ask for) to 1 (entirely without it), by
// looking only at the tiles of that cell, so nothing loops over the map. A
// new request goes to the cell and kind with the highest need, shaken by a
// little randomness (seeded world.rng): first a kind, weighted by its worst
// need, among kinds that some cell needs badly enough to ask for (askAt);
// then the neediest cell for that kind. A request is met once that cell's
// need for its kind is down to the kind's metAt.
//
// Numbers live in BALANCE.politicalCapital.requests and are read live.
// SWITCHED OFF: spawnEveryDays is 0, so no request ever opens.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { ZONE_R, BUILDING_PARK } from './constants';
import { trafficVolume, roadCapacity } from './TrafficData';
import { changePc } from './politics';

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
  /** One request for the whole city at a time (the same need everywhere). */
  cityWide?: boolean;
  /** 0 (nothing missing) to 1 (entirely without it) for the area's homes. */
  need(world: World, area: Rect): number;
}

interface RequestNumbers { days: number; reward: number; penalty: number; askAt: number; metAt: number }

type RequestConfig = {
  spawnEveryDays: number; maxOpen: number; cellSize: number; minHomes: number;
  randomness: number; kinds: Record<string, RequestNumbers>;
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

/**
 * 1 during a power or water shortage, else 0. A shortage doesn't uncover
 * any tile in this game, so it is the whole city's need, met when it ends.
 */
function utilitiesNeed(world: World): number {
  const s = world.stats;
  return s.powerSupply < s.powerDemand || s.waterSupply < s.waterDemand ? 1 : 0;
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

const kind = (id: string, need: RequestKind['need'], cityWide = false): RequestKind =>
  ({ id, nameKey: `requests.${id}.name`, descKey: `requests.${id}.desc`, need, cityWide });

/** The registry. */
export const REQUEST_KINDS: readonly RequestKind[] = [
  kind('park', parkNeed),
  kind('schoolOrHospital', (w, a) => coverageNeed(w, a, w.layers.school, w.layers.hospital)),
  kind('policeOrFire', (w, a) => coverageNeed(w, a, w.layers.police, w.layers.fireStation)),
  kind('utilities', utilitiesNeed, true),
  kind('trafficJam', trafficNeed),
  kind('blight', blightNeed),
];

export const requestKind = (id: string): RequestKind | undefined => REQUEST_KINDS.find((k) => k.id === id);

/** Is the request met: the area's need for its kind is down to the kind's metAt. */
export function isMet(world: World, req: OpenRequest): boolean {
  const k = requestKind(req.kind);
  const n = requestConfig().kinds[req.kind];
  return !k || !n || k.need(world, req) <= n.metAt;
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
 * The next request to open, or null if no neighbourhood needs anything badly
 * enough. Neighbourhoods that already have an open request are skipped, and
 * a city-wide kind is skipped while one is open.
 *  1. Kinds with days > 0 (0 = switched off) that some free neighbourhood
 *     needs above the kind's askAt are
 *     eligible; one is drawn at random, weighted by its worst need, so every
 *     eligible kind gets a turn and the most urgent comes up most often.
 *  2. For that kind, the neighbourhood with the highest need, each need
 *     scaled by a random factor in [1 - randomness, 1].
 */
export function pickRequest(world: World, rng: () => number): { kind: string; area: Rect } | null {
  const { randomness, kinds } = requestConfig();
  const open = world.politics.requests;
  const areas = neighbourhoods(world).filter((area) => !open.some((r) => overlaps(r, area)));
  if (!areas.length) return null;

  const eligible: { k: RequestKind; needs: number[]; worst: number }[] = [];
  let total = 0;
  for (const k of REQUEST_KINDS) {
    const n = kinds[k.id];
    if (!n || n.days <= 0 || (k.cityWide && open.some((r) => r.kind === k.id))) continue;
    const needs = areas.map((a) => k.need(world, a));
    const worst = Math.max(...needs);
    if (worst <= n.askAt) continue;
    eligible.push({ k, needs, worst });
    total += worst;
  }
  if (!eligible.length) return null;

  let roll = rng() * total;
  let chosen = eligible[eligible.length - 1];
  for (const e of eligible) { roll -= e.worst; if (roll < 0) { chosen = e; break; } }

  const askAt = kinds[chosen.k.id].askAt;
  let best = -1, bestScore = 0;
  chosen.needs.forEach((need, j) => {
    if (need <= askAt) return;
    const score = need * (1 - randomness * rng());
    if (score > bestScore) { bestScore = score; best = j; }
  });
  return best < 0 ? null : { kind: chosen.k.id, area: areas[best] };
}

// ── Opening and resolving (RequestSystem, and the debug panel's buttons) ─────

const payload = (r: OpenRequest) =>
  ({ id: r.id, kind: r.kind, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, deadlineTick: r.deadlineTick });

/** Open a request of `kind` for `area`, due in `days` game days. */
export function openRequest(world: World, kind: string, area: Rect, days: number): OpenRequest {
  const req: OpenRequest = {
    id: world.politics.nextRequestId++,
    kind,
    x0: area.x0, y0: area.y0, x1: area.x1, y1: area.y1,
    openedTick: world.tick,
    deadlineTick: world.tick + days * BALANCE.ticksPerDay,
  };
  world.politics.requests.push(req);
  world.events.emit('requestOpened', payload(req));
  return req;
}

function close(world: World, req: OpenRequest): boolean {
  const k = world.politics.requests.indexOf(req);
  if (k < 0) return false;
  world.politics.requests.splice(k, 1);
  return true;
}

/** Close an open request as met, paying its reward (stops at the cap). */
export function meetRequest(world: World, req: OpenRequest): void {
  if (!close(world, req)) return;
  const reward = requestConfig().kinds[req.kind]?.reward ?? 0;
  if (reward > 0) changePc(world, reward, 'requestMet');
  world.events.emit('requestMet', payload(req));
}

/** Close an open request as missed, charging its penalty (never into debt). */
export function failRequest(world: World, req: OpenRequest): void {
  if (!close(world, req)) return;
  const penalty = requestConfig().kinds[req.kind]?.penalty ?? 0;
  const take = Math.min(penalty, Math.max(0, world.budget.politicalCapital));
  if (take > 0) changePc(world, -take, 'requestFailed');
  world.events.emit('requestFailed', payload(req));
}

/**
 * For the debug panel: the neighbourhood that most needs `kind` (ignoring
 * askAt, open requests and randomness), or the first neighbourhood if none
 * needs it at all. Null when the city has no neighbourhood yet.
 */
export function neediestFor(world: World, kind: string): Rect | null {
  const k = requestKind(kind);
  const areas = neighbourhoods(world);
  if (!k || !areas.length) return null;
  let best = areas[0], bestNeed = -1;
  for (const a of areas) {
    const need = k.need(world, a);
    if (need > bestNeed) { bestNeed = need; best = a; }
  }
  return best;
}
