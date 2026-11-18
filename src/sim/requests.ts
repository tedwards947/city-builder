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
import { ZONE_R, BUILDING_PARK, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL } from './constants';
import { trafficVolume, roadCapacity } from './TrafficData';
import { changePc } from './politics';
import { coveredBy, homesWithinReach, touchesAccessRoad } from './serviceValue';
import { hasCapacity, homeSeat } from './serviceCapacity';

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** An open request, as saved in world.politics.requests. */
export interface OpenRequest extends Rect {
  id: number;
  kind: string;
  openedTick: number;
  deadlineTick: number;
  /** The area's need when the request opened; met once it has at least halved (or the target is reached). */
  needAtOpen: number;
  /**
   * Coverage kinds only (park, police, fire, school, hospital): the home that
   * asked and the asking homes (tile indices), fixed at opening: developed
   * homes lacking the service within the kind's range in road steps of the
   * seed. x0..y1 is then their bounding box. Need is measured over these homes.
   */
  seed?: number;
  homes?: number[];
  /**
   * Durable kinds only (smoothDays or holdDays above 1): the last smoothDays
   * daily readings of the need, oldest first, and how many daily checks in a
   * row their average has passed the met rule. Kept by observeRequests().
   */
  samples?: number[];
  heldDays?: number;
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

interface RequestNumbers { days: number; reward: number; penalty: number; askAt: number; metAt: number; smoothDays?: number; holdDays?: number }

type RequestConfig = {
  spawnEveryDays: number; maxOpen: number; cellSize: number; minHomes: number;
  randomness: number; kinds: Record<string, RequestNumbers>;
};
export const requestConfig = (): RequestConfig => BALANCE.politicalCapital.requests as unknown as RequestConfig;

const wholeDays = (v: number | undefined): number => (v !== undefined && v > 1 ? Math.floor(v) : 1);
/** Daily readings a kind's need is averaged over (1 = today's reading alone). */
export const smoothDaysOf = (kind: string): number => wholeDays(requestConfig().kinds[kind]?.smoothDays);
/** Daily checks in a row a request of this kind must pass before it counts as met (1 = at once). */
export const holdDaysOf = (kind: string): number => wholeDays(requestConfig().kinds[kind]?.holdDays);
const average = (v: readonly number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

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
  // The sim's own park coverage along streets and avenues (cached until the map changes).
  const parks = coveredBy(world, BUILDING_PARK);
  return shareLacking(world, a, (i) => !parks.has(i));
}

/** Share of the area's homes outside one service's coverage layer (the sim's own road coverage). */
function layerNeed(layer: (w: World) => Uint8Array): (world: World, a: Rect) => number {
  return (world, a) => { const l = layer(world); return shareLacking(world, a, (i) => !l[i]); };
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

// ── Road-shaped clusters for the coverage kinds ─────────────────────────────

/** The building each coverage kind asks for. */
const SERVICE_OF: Record<string, number> = {
  park: BUILDING_PARK, police: BUILDING_POLICE, fire: BUILDING_FIRE, school: BUILDING_SCHOOL, hospital: BUILDING_HOSPITAL,
};
export const isClusterKind = (kind: string): boolean => SERVICE_OF[kind] !== undefined;

function isHome(world: World, i: number): boolean {
  const { zone, devLevel, abandoned } = world.layers;
  return zone[i] === ZONE_R && devLevel[i] > 0 && !abandoned[i];
}

/** Does home tile `i` lack the service `kind` asks for (the sim's own coverage)? */
function lacks(world: World, kind: string, i: number): boolean {
  switch (kind) {
    case 'park': return !coveredBy(world, BUILDING_PARK).has(i);
    case 'police': return !world.layers.police[i];
    case 'fire': return !world.layers.fireStation[i];
    case 'school': return !world.layers.school[i];
    case 'hospital': return !world.layers.hospital[i];
    default: return false;
  }
}

/**
 * The homes that ask with `seed`: developed homes lacking the service within
 * the kind's coverage range in road steps of the seed, found with the same
 * walk the sim uses for a building there (homesWithinReach in serviceValue.ts). Sorted.
 */
export function clusterFor(world: World, kind: string, seed: number): number[] {
  const w = world.grid.width;
  const out: number[] = [];
  for (const i of homesWithinReach(world, seed % w, Math.floor(seed / w), SERVICE_OF[kind])) {
    if (isHome(world, i) && lacks(world, kind, i)) out.push(i);
  }
  if (!out.includes(seed) && isHome(world, seed) && lacks(world, kind, seed)) out.push(seed);
  return out.sort((a, b) => a - b);
}

function boundsOf(world: World, tiles: readonly number[]): Rect {
  const w = world.grid.width;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of tiles) {
    const x = i % w, y = Math.floor(i / w);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** Share of a request's asking homes, still lived in, that lack the service; 0 if none are left. */
function clusterNeed(world: World, req: OpenRequest): number {
  let live = 0, missing = 0;
  for (const i of req.homes!) {
    if (!isHome(world, i)) continue;
    live++;
    if (lacks(world, req.kind, i)) missing++;
  }
  return live ? missing / live : 0;
}

/** A request's need as the map stands this tick: its asking homes for a cluster kind, else its area. */
function rawNeed(world: World, req: OpenRequest): number {
  if (req.homes) return clusterNeed(world, req);
  return requestKind(req.kind)?.need(world, req) ?? 0;
}

/**
 * The need a request is judged on. For a durable kind with readings taken,
 * the average of its last smoothDays daily readings; otherwise the need now.
 */
export function requestNeed(world: World, req: OpenRequest): number {
  if (req.samples?.length && smoothDaysOf(req.kind) > 1) return average(req.samples);
  return rawNeed(world, req);
}

// Daily readings per neighbourhood for the smoothed kinds, so a request opens
// only on a need that has lasted. Derived, not saved: after a load a smoothed
// kind waits smoothDays days before it can ask again.
const histories = new WeakMap<World, Map<string, number[]>>();

/** A neighbourhood's grid cell (every home of one is in the same cell). */
function cellKey(world: World, a: Rect): number {
  const { cellSize } = requestConfig();
  return Math.floor(a.y0 / cellSize) * Math.ceil(world.grid.width / cellSize) + Math.floor(a.x0 / cellSize);
}

/** The last daily readings of `kind` for a neighbourhood, oldest first (empty if none). */
function historyOf(world: World, kind: string, area: Rect): readonly number[] {
  return histories.get(world)?.get(`${kind}:${cellKey(world, area)}`) ?? [];
}

/**
 * The need a neighbourhood is judged on for asking: for a smoothed kind, the
 * average of a full smoothDays of readings (0 until there are that many);
 * otherwise the need now. A smoothed coverage kind (school, hospital) is
 * asked for on the neighbourhood's averaged need too; its request then opens
 * on the homes lacking the service that day, with no readings yet.
 */
function askingNeed(world: World, k: RequestKind, area: Rect): number {
  const days = smoothDaysOf(k.id);
  if (days <= 1) return k.need(world, area);
  const h = historyOf(world, k.id, area);
  return h.length >= days ? average(h) : 0;
}

/**
 * The daily reading (RequestSystem, once a game day, before it resolves and
 * opens): each open durable request takes today's need and counts the days
 * its average has passed the met rule; each neighbourhood takes a reading for
 * every smoothed kind that is switched on. Does nothing, and draws no random
 * number, while no kind is durable or none is on.
 */
export function observeRequests(world: World): void {
  const cfg = requestConfig();
  for (const r of world.politics.requests) {
    const n = cfg.kinds[r.kind];
    const smooth = smoothDaysOf(r.kind), hold = holdDaysOf(r.kind);
    if (!n || (smooth <= 1 && hold <= 1)) continue;
    const samples = r.samples ?? (r.samples = []);
    samples.push(rawNeed(world, r));
    if (samples.length > smooth) samples.splice(0, samples.length - smooth);
    r.heldDays = metAt(average(samples), r.needAtOpen, n.metAt) ? (r.heldDays ?? 0) + 1 : 0;
  }
  if (cfg.spawnEveryDays <= 0) return;
  const smoothed = REQUEST_KINDS.filter((k) => smoothDaysOf(k.id) > 1 && (cfg.kinds[k.id]?.days ?? 0) > 0);
  if (!smoothed.length) { histories.delete(world); return; }
  const before = histories.get(world);
  const now = new Map<string, number[]>();      // rebuilt, so a neighbourhood that is gone is forgotten
  for (const area of neighbourhoods(world)) {
    for (const k of smoothed) {
      const key = `${k.id}:${cellKey(world, area)}`;
      const h = before?.get(key) ?? [];
      h.push(k.need(world, area));
      const days = smoothDaysOf(k.id);
      if (h.length > days) h.splice(0, h.length - days);
      now.set(key, h);
    }
  }
  histories.set(world, now);
}

/**
 * How a request of `kind` would open over `area` (a neighbourhood): for a
 * coverage kind, a seed home lacking the service is drawn from the area with
 * `rng` and the request covers its road-shaped cluster (need 1: every asking
 * home lacks it); otherwise the area itself at its current need.
 */
export function planRequest(world: World, kind: string, area: Rect, rng: () => number):
    { area: Rect; need: number; seed?: number; homes?: number[] } | null {
  if (!isClusterKind(kind)) {
    const k = requestKind(kind);
    return k ? { area, need: k.need(world, area) } : null;
  }
  // Seeds come from homes on a street or avenue: one off the road would reach only itself.
  const onRoad: number[] = [], offRoad: number[] = [];
  forHomes(world, area, (i, x, y) => {
    if (lacks(world, kind, i)) (touchesAccessRoad(world, x, y) ? onRoad : offRoad).push(i);
  });
  const candidates = onRoad.length ? onRoad : offRoad;
  if (!candidates.length) return null;
  const seed = candidates[Math.floor(rng() * candidates.length)];
  const homes = clusterFor(world, kind, seed);
  return { area: boundsOf(world, homes), need: 1, seed, homes };
}

const kind = (id: string, need: RequestKind['need'], cityWide = false): RequestKind =>
  ({ id, nameKey: `requests.${id}.name`, descKey: `requests.${id}.desc`, need, cityWide });

/** The registry. */
export const REQUEST_KINDS: readonly RequestKind[] = [
  kind('park', parkNeed),
  kind('police', layerNeed((w) => w.layers.police)),
  kind('fire', layerNeed((w) => w.layers.fireStation)),
  kind('school', layerNeed((w) => w.layers.school)),
  kind('hospital', layerNeed((w) => w.layers.hospital)),
  kind('utilities', utilitiesNeed, true),
  kind('trafficJam', trafficNeed),
  kind('blight', blightNeed),
];

export const requestKind = (id: string): RequestKind | undefined => REQUEST_KINDS.find((k) => k.id === id);

/**
 * The met rule (owner's): the target is reached (need ≤ metAt), or the gap
 * has at least halved since the request opened and is smaller than it was
 * (so a request that opened at a tiny need can't be met by doing nothing).
 */
function metAt(need: number, needAtOpen: number, target: number): boolean {
  return need <= target || (need <= needAtOpen / 2 && need < needAtOpen);
}

/**
 * Whether a request counts as met. A kind with holdDays above 1 must have
 * passed the met rule on that many daily checks in a row (observeRequests
 * keeps the count), so a need that only dips for a day does not pay out.
 */
export function isMet(world: World, req: OpenRequest): boolean {
  const k = requestKind(req.kind);
  const n = requestConfig().kinds[req.kind];
  if (!k || !n) return true;
  const hold = holdDaysOf(req.kind);
  if (hold > 1) return (req.heldDays ?? 0) >= hold;
  return metAt(requestNeed(world, req), req.needAtOpen, n.metAt);
}

/** A durable request that is passing its met rule but has not yet held for holdDays. It does not expire meanwhile. */
export function isHolding(req: OpenRequest): boolean {
  return holdDaysOf(req.kind) > 1 && (req.heldDays ?? 0) > 0;
}

/** What a request's progress looks like, for the quest log and badges. Shares are 0–1. */
export interface RequestProgress {
  covered: number;        // share of the area that has what was asked, now (1 − need)
  coveredAtOpen: number;  // the same when the request opened
  coveredNeeded: number;  // met once covered reaches this (see `met` for the exact rule)
  met: boolean;           // exactly isMet()
  /**
   * Durable kinds (traffic, school, hospital, utilities): `covered` is an average over the last days, and
   * the request is met once it has stayed at or past `coveredNeeded` for
   * `holdDays` daily checks in a row; `heldDays` is the count so far (0 when
   * it is not passing). Other kinds: holdDays 1, heldDays 0 or 1.
   */
  heldDays: number;
  holdDays: number;
  units: number;          // how many things the share is of
  unit: 'homes' | 'roads' | 'lots' | 'city';
  daysLeft: number;       // whole game days to the deadline, ≥ 0
  reward: number;
  penalty: number;
  rect: Rect;                // the request's area (for a cluster kind, its homes' bounding box)
  homes: readonly number[];  // the asking homes' tile indices (cluster kinds; else empty)
  /**
   * Coverage kinds only (else all 0 / null): the asking homes still without
   * the service, by why. `unmetFull`: a building reaches the home but it and
   * every other in reach are full (only kinds with a capacity: school,
   * hospital); the remedy is more seats. `unmetOutOfReach`: no building
   * reaches it; the remedy is one nearer. `unmetReason` is the commoner of the
   * two (out of reach on a tie), null when no asking home is without it.
   * Seats are re-dealt once a game day and on a map change, so for a tick or
   * two after an edit the two counts may not add up to every home lacking it.
   */
  unmetFull: number;
  unmetOutOfReach: number;
  unmetReason: UnmetReason | null;
}

export type UnmetReason = 'full' | 'outOfReach';

/** The asking homes of a cluster request still without the service, by why (see RequestProgress). */
function unmetByReason(world: World, req: OpenRequest): { full: number; outOfReach: number } {
  const out = { full: 0, outOfReach: 0 };
  const service = SERVICE_OF[req.kind];
  if (!req.homes || service === undefined) return out;
  const w = world.grid.width;
  const seats = hasCapacity(service);
  for (const i of req.homes) {
    if (!isHome(world, i) || !lacks(world, req.kind, i)) continue;
    if (!seats) { out.outOfReach++; continue; }
    const reason = homeSeat(world, i % w, (i - (i % w)) / w, service)?.reason;
    if (reason === 'full') out.full++; else if (reason === 'outOfReach') out.outOfReach++;
  }
  return out;
}

const UNITS: Record<string, RequestProgress['unit']> = { utilities: 'city', trafficJam: 'roads', blight: 'lots' };

export function requestProgress(world: World, req: OpenRequest): RequestProgress {
  const k = requestKind(req.kind);
  const n = requestConfig().kinds[req.kind];
  const need = k ? requestNeed(world, req) : 0;
  const target = n ? n.metAt : 0;
  const unit = UNITS[req.kind] ?? 'homes';
  let units = 1;
  if (req.homes) units = req.homes.filter((i) => isHome(world, i)).length;
  else if (unit === 'homes') units = forHomes(world, req, () => {});
  else if (unit !== 'city') units = countTiles(world, unit === 'roads' ? growArea(world, req, 2) : req, unit);
  const unmet = unmetByReason(world, req);
  const met = !k || !n || isMet(world, req);
  const holdDays = holdDaysOf(req.kind);
  return {
    covered: 1 - need,
    coveredAtOpen: 1 - req.needAtOpen,
    coveredNeeded: 1 - Math.max(target, req.needAtOpen / 2),
    met,
    heldDays: holdDays > 1 ? Math.min(holdDays, req.heldDays ?? 0) : met ? 1 : 0,
    holdDays,
    units,
    unit,
    daysLeft: Math.max(0, Math.ceil((req.deadlineTick - world.tick) / BALANCE.ticksPerDay)),
    reward: n?.reward ?? 0,
    penalty: n?.penalty ?? 0,
    rect: { x0: req.x0, y0: req.y0, x1: req.x1, y1: req.y1 },
    homes: req.homes ?? [],
    unmetFull: unmet.full,
    unmetOutOfReach: unmet.outOfReach,
    unmetReason: unmet.full + unmet.outOfReach === 0 ? null : unmet.full > unmet.outOfReach ? 'full' : 'outOfReach',
  };
}

function growArea(world: World, a: Rect, by: number): Rect {
  const { width, height } = world.grid;
  return { x0: Math.max(0, a.x0 - by), y0: Math.max(0, a.y0 - by), x1: Math.min(width - 1, a.x1 + by), y1: Math.min(height - 1, a.y1 + by) };
}

/** Road tiles or zoned lots in an area (what trafficJam and blight measure). */
function countTiles(world: World, a: Rect, unit: 'roads' | 'lots'): number {
  const layer = unit === 'roads' ? world.layers.roadClass : world.layers.zone;
  const w = world.grid.width;
  let n = 0;
  for (let y = a.y0; y <= a.y1; y++) for (let x = a.x0; x <= a.x1; x++) if (layer[y * w + x]) n++;
  return n;
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
export function pickRequest(world: World, rng: () => number):
    { kind: string; area: Rect; need: number; seed?: number; homes?: number[]; samples?: number[] } | null {
  const { randomness, kinds } = requestConfig();
  const open = world.politics.requests;
  const areas = neighbourhoods(world).filter((area) => !open.some((r) => overlaps(r, area)));
  if (!areas.length) return null;

  const eligible: { k: RequestKind; needs: number[]; worst: number }[] = [];
  let total = 0;
  for (const k of REQUEST_KINDS) {
    const n = kinds[k.id];
    if (!n || n.days <= 0 || (k.cityWide && open.some((r) => r.kind === k.id))) continue;
    const needs = areas.map((a) => askingNeed(world, k, a));
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
  if (best < 0) return null;
  const plan = planRequest(world, chosen.k.id, areas[best], rng);
  if (!plan) return null;
  if (!isClusterKind(chosen.k.id) && smoothDaysOf(chosen.k.id) > 1) {
    // A smoothed kind opens at the averaged need, with the readings behind it.
    return { kind: chosen.k.id, ...plan, need: chosen.needs[best], samples: [...historyOf(world, chosen.k.id, areas[best])] };
  }
  return { kind: chosen.k.id, ...plan };
}

// ── Opening and resolving (RequestSystem, and the debug panel's buttons) ─────

const payload = (r: OpenRequest) =>
  ({ id: r.id, kind: r.kind, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, deadlineTick: r.deadlineTick });

/** Open a request of `kind` for `area`, due in `days` game days; `needAtOpen` is the area's need now. */
export function openRequest(
  world: World, kind: string, area: Rect, days: number, needAtOpen: number,
  cluster?: { seed?: number; homes?: number[]; samples?: number[] },
): OpenRequest {
  const req: OpenRequest = {
    id: world.politics.nextRequestId++,
    kind,
    x0: area.x0, y0: area.y0, x1: area.x1, y1: area.y1,
    openedTick: world.tick,
    deadlineTick: world.tick + days * BALANCE.ticksPerDay,
    needAtOpen,
  };
  if (cluster?.homes) { req.seed = cluster.seed; req.homes = [...cluster.homes]; }
  if (cluster?.samples) req.samples = [...cluster.samples];
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

/** Close an open request as met, paying its reward (which may take PC over the cap). */
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

/**
 * Bring requests loaded from an older save up to date: an open 'policeOrFire'
 * or 'schoolOrHospital' (split into four kinds) becomes whichever half its
 * area needs more, and a request without needAtOpen takes its need now.
 */
export function upgradeLoadedRequests(world: World): void {
  const split: Record<string, [string, string]> = { policeOrFire: ['police', 'fire'], schoolOrHospital: ['school', 'hospital'] };
  for (const r of world.politics.requests) {
    const halves = split[r.kind];
    if (halves) {
      const [a, b] = halves.map((id) => requestKind(id)!);
      r.kind = a.need(world, r) >= b.need(world, r) ? a.id : b.id;
    }
    if (isClusterKind(r.kind) && !r.homes) {
      // From before road-shaped clusters: the cluster of the area's first home that lacks the service.
      let seed = -1, offRoad = -1;
      forHomes(world, r, (i, x, y) => {
        if (!lacks(world, r.kind, i)) return;
        if (touchesAccessRoad(world, x, y)) { if (seed < 0) seed = i; } else if (offRoad < 0) offRoad = i;
      });
      if (seed < 0) seed = offRoad;
      r.homes = seed >= 0 ? clusterFor(world, r.kind, seed) : [];
      if (seed >= 0) { r.seed = seed; Object.assign(r, boundsOf(world, r.homes)); }
      r.needAtOpen = r.homes.length ? 1 : 0;
    }
    if (!Number.isFinite(r.needAtOpen)) r.needAtOpen = requestNeed(world, r);
  }
}
