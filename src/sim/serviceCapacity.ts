// Service capacity (SERVICES_DESIGN.md): a school or hospital serves a limited
// number of residents within its reach. A home is covered only if it has a
// seat.
//
// The rule is a pure function of the map, with nothing saved:
//   - every (home, building) pair in reach is listed and sorted by road
//     distance, then home tile, then building tile;
//   - going down the list, a home not yet seated takes a seat at the building
//     if the building has room for the whole home.
// So a home goes to its nearest building with room, overflow falls to the next
// nearest by itself, and the result does not depend on the order things were
// built in. When homes near a full building grow, the farthest seated homes
// lose their seats; there is no "keep my seat".
//
// A kind's capacity comes from BALANCE.service.capacity. 0 or missing means no
// limit: the kind is served by reach alone, as police, fire and parks are.
//
// Pure: reads the world, changes nothing. ServiceSystem uses assignSeats() to
// decide which homes its school and hospital layers leave uncovered; the
// queries at the bottom are for the UI and the PC rule.

import type { World } from './World';
import { ZONE_R } from './constants';
import { BALANCE } from '../data/balance';
import { computeServiceCoverage } from './systems/ServiceSystem';

/** Residents a building of `kind` can serve; 0 = no limit (reach alone decides). */
export function serviceCapacity(kind: number): number {
  const c = (BALANCE.service.capacity as Record<number, number>)[kind];
  return c !== undefined && c > 0 && Number.isFinite(c) ? c : 0;
}

/** Whether `kind` serves a limited number of residents (a capacity is set). */
export function hasCapacity(kind: number): boolean {
  return serviceCapacity(kind) > 0;
}

/** What one building reaches: its tiles and each tile's distance in road steps. */
export interface BuildingReach {
  /** The building's anchor tile index. */
  anchor: number;
  tiles: Int32Array;
  /** Road steps from the building to the road tile each tile sits beside (parallel to `tiles`). */
  dist: Uint16Array;
}

/** The reach of a `kind` building at (tx, ty), with distances, by the same road walk coverage uses. */
export function buildingReach(world: World, tx: number, ty: number, kind: number, range?: number): BuildingReach {
  const dist = new Map<number, number>();
  const covered = computeServiceCoverage(world, tx, ty, kind, range, dist);
  const tiles = Int32Array.from(covered);
  const d = new Uint16Array(tiles.length);
  for (let k = 0; k < tiles.length; k++) d[k] = dist.get(tiles[k]) ?? 0;
  return { anchor: world.grid.idx(tx, ty), tiles, dist: d };
}

/** Residents of an occupied, non-abandoned home on tile `i`; 0 for anything else. */
export function homeResidents(world: World, i: number): number {
  const { zone, devLevel, abandoned } = world.layers;
  if (zone[i] !== ZONE_R || devLevel[i] === 0 || abandoned[i] !== 0) return 0;
  return BALANCE.growth.popPerLevel[devLevel[i]] ?? 0;
}

/** The outcome of seating a city's homes at the buildings of one kind. */
export interface Seating {
  /** Per building, in the order given: residents seated there. */
  seated: Float64Array;
  /** Per building: residents of homes it reaches that have no seat anywhere. */
  inReachUnseated: Float64Array;
  /** Home tile → index of the building it is seated at. */
  seatOf: Map<number, number>;
  /** Homes in reach of at least one building but seated nowhere: every building that reaches them is full. */
  full: Set<number>;
}

/**
 * Whether no home can be turned away: every building has room for all the
 * residents it reaches, so every home in reach is seated and coverage is plain
 * reach. One pass over the reach tiles, no sorting.
 */
export function nothingIsFull(world: World, reaches: readonly BuildingReach[], capacity: number): boolean {
  if (capacity <= 0) return true;
  for (const r of reaches) {
    let residents = 0;
    for (let k = 0; k < r.tiles.length; k++) {
      residents += homeResidents(world, r.tiles[k]);
      if (residents > capacity) return false;
    }
  }
  return true;
}

/**
 * Seat the city's homes at these buildings (all of one kind), each serving up
 * to `capacity` residents (0 = no limit). See the top of the file for the rule.
 */
export function assignSeats(world: World, reaches: readonly BuildingReach[], capacity: number): Seating {
  const nB = reaches.length;
  const nTiles = world.grid.width * world.grid.height;
  const seated = new Float64Array(nB);
  const inReachUnseated = new Float64Array(nB);
  const seatOf = new Map<number, number>();
  const full = new Set<number>();
  if (nB === 0) return { seated, inReachUnseated, seatOf, full };

  // One sortable number per (home, building) pair: distance, then home tile, then building tile.
  // Buildings are ranked by anchor tile so the order they were built in cannot matter.
  const byAnchor = reaches.map((_, b) => b).sort((a, b) => reaches[a].anchor - reaches[b].anchor);
  let pairs = 0;
  for (const r of reaches) pairs += r.tiles.length;
  const keys = new Float64Array(pairs);
  let n = 0;
  for (let rank = 0; rank < nB; rank++) {
    const r = reaches[byAnchor[rank]];
    for (let k = 0; k < r.tiles.length; k++) {
      const i = r.tiles[k];
      if (homeResidents(world, i) === 0) continue;
      keys[n++] = (r.dist[k] * nTiles + i) * nB + rank;
    }
  }
  const sorted = keys.subarray(0, n).sort();

  const room = capacity > 0 ? capacity : Infinity;
  for (let k = 0; k < n; k++) {
    const key = sorted[k];
    const rank = key % nB;
    const i = ((key - rank) / nB) % nTiles;
    if (seatOf.has(i)) continue;
    const b = byAnchor[rank];
    const pop = homeResidents(world, i);
    if (seated[b] + pop > room) continue;
    seated[b] += pop;
    seatOf.set(i, b);
  }
  if (seatOf.size < n) {
    // Someone may be without a seat: find them, and count them against each building that reaches them.
    for (let b = 0; b < nB; b++) {
      const r = reaches[b];
      for (let k = 0; k < r.tiles.length; k++) {
        const i = r.tiles[k];
        const pop = homeResidents(world, i);
        if (pop === 0 || seatOf.has(i)) continue;
        full.add(i);
        inReachUnseated[b] += pop;
      }
    }
  }
  return { seated, inReachUnseated, seatOf, full };
}

// ── Queries for the UI and the PC rule ──────────────────────────────────────

interface KindSeating {
  edits: number; day: number; range: number; capacity: number;
  reaches: BuildingReach[];
  seating: Seating;
  /** Building anchor → its index in `reaches`. */
  indexOf: Map<number, number>;
}

const cache = new WeakMap<World, Map<number, KindSeating>>();

/** The seating of every standing building of `kind`, remembered until the map changes or the game day ends. */
function kindSeating(world: World, kind: number): KindSeating {
  let byKind = cache.get(world);
  if (!byKind) { byKind = new Map(); cache.set(world, byKind); }
  const range = BALANCE.service.coverageRange[kind] ?? -1;
  const capacity = serviceCapacity(kind);
  const day = Math.floor(world.tick / BALANCE.ticksPerDay);
  const have = byKind.get(kind);
  if (have && have.edits === world.grid.edits && have.day === day && have.range === range && have.capacity === capacity) return have;

  const reaches: BuildingReach[] = [];
  const indexOf = new Map<number, number>();
  for (const b of world.buildings) {
    if (b.kind !== kind) continue;
    const r = buildingReach(world, b.tx, b.ty, kind);
    indexOf.set(r.anchor, reaches.length);
    reaches.push(r);
  }
  const fresh = { edits: world.grid.edits, day, range, capacity, reaches, seating: assignSeats(world, reaches, capacity), indexOf };
  byKind.set(kind, fresh);
  return fresh;
}

/** How full a service building is. */
export interface BuildingSeats {
  /** Residents it can serve; 0 = no limit. */
  capacity: number;
  /** Residents seated at it now. */
  seated: number;
  /** Residents of homes it reaches that have no seat anywhere (it and every other in reach are full). */
  inReachUnseated: number;
}

/**
 * How full the service building standing at (tx, ty) is (any of its tiles
 * will do), or null if there is no service building there. For a kind with no
 * capacity, `seated` is the residents nearer to it than to any other of its
 * kind, and nobody is unseated.
 */
export function buildingSeats(world: World, tx: number, ty: number): BuildingSeats | null {
  if (!world.grid.inBounds(tx, ty)) return null;
  const at = world.buildingAnchorAt(world.grid.idx(tx, ty));
  if (at < 0) return null;
  const kind = world.layers.building[at];
  if (BALANCE.service.coverageRange[kind] === undefined) return null;
  const s = kindSeating(world, kind);
  const b = s.indexOf.get(at);
  if (b === undefined) return null;
  return { capacity: s.capacity, seated: s.seating.seated[b], inReachUnseated: s.seating.inReachUnseated[b] };
}

/** Where a home is served for one kind of service. */
export interface HomeSeat {
  /** The tile of the building it is seated at, or null if it has no seat. */
  seatedAt: { tx: number; ty: number } | null;
  /** Why it has no seat: no building of the kind reaches it, or every one that does is full. Null when seated. */
  reason: 'outOfReach' | 'full' | null;
}

/** Where the home on (tx, ty) is served for `kind`, or null if the tile is not an occupied home. */
export function homeSeat(world: World, tx: number, ty: number, kind: number): HomeSeat | null {
  if (!world.grid.inBounds(tx, ty)) return null;
  const i = world.grid.idx(tx, ty);
  if (homeResidents(world, i) === 0) return null;
  const s = kindSeating(world, kind);
  const b = s.seating.seatOf.get(i);
  if (b !== undefined) {
    const a = s.reaches[b].anchor, w = world.grid.width;
    return { seatedAt: { tx: a % w, ty: (a - (a % w)) / w }, reason: null };
  }
  return { seatedAt: null, reason: s.seating.full.has(i) ? 'full' : 'outOfReach' };
}
