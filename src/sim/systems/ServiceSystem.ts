// Service coverage system.
// Coverage propagates along the road network via BFS, up to `range` road hops
// per building kind. Road tiles within range and their immediate neighbors
// (propagationRange=1) receive coverage — the same pattern as power/water.
// The building's own tile is always covered regardless of road adjacency.
// ServiceSystem runs before ZoneGrowthSystem so it can gate level 2→3 growth.
//
// Kinds with a capacity (BALANCE.service.capacity; none as shipped) serve a
// limited number of residents: a home every building in reach is too full for
// is left out of that kind's coverage. See sim/serviceCapacity.ts.

import type { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL } from '../constants';
import { BALANCE } from '../../data/balance';
import { footprintTiles, footprintEdge } from '../buildingShapes';
import { serviceCapacity, seatHomes, type BuildingReach } from '../serviceCapacity';

/**
 * BFS coverage for a single service building placed at (tx, ty) of kind `kind`.
 * Returns the set of tile indices that would receive coverage.
 * Used by both ServiceSystem.update() and the renderer's hover preview.
 * `range` (road steps) defaults to the kind's range in the balance table.
 * `distOut`, if given, receives each covered tile's distance: the road steps
 * from the building to the nearest road tile the tile sits on or beside (0
 * for the building's own tiles).
 */
export function computeServiceCoverage(
  world: World,
  tx: number,
  ty: number,
  kind: number,
  range: number = BALANCE.service.coverageRange[kind] ?? 4,
  distOut?: Map<number, number>,
): Set<number> {
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  const covered = new Set<number>();

  // The building's own tiles are always covered. (A kind of several tiles
  // anchored where it does not fit is treated as its anchor tile alone.)
  const own = footprintTiles(width, height, tx, ty, kind) ?? [ty * width + tx];
  for (const i of own) { covered.add(i); distOut?.set(i, 0); }

  // Seed BFS from road tiles at or adjacent to the building.
  // Seeding only happens from STREET or AVENUE. HIGHWAY does not activate a building.
  const visited = new Set<number>();
  const queue: Array<{ idx: number; dist: number }> = [];

  const seed = (stx: number, sty: number) => {
    if (stx < 0 || sty < 0 || stx >= width || sty >= height) return;
    const i = sty * width + stx;
    const rc = roadClass[i];
    if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) return;
    if (visited.has(i)) return;
    visited.add(i);
    queue.push({ idx: i, dist: 0 });
  };
  // From the building's own tiles (never roads once it stands, but they can
  // be while it is only being previewed), then every tile along its edge: for
  // a one-tile building, itself and its west, east, north and south.
  for (const i of own) seed(i % width, (i - (i % width)) / width);
  for (const i of footprintEdge(width, height, own)) seed(i % width, (i - (i % width)) / width);

  let qi = 0;
  while (qi < queue.length) {
    const { idx, dist } = queue[qi++];
    const rtx = idx % width;
    const rty = (idx - rtx) / width;

    // Mark the road tile and its 1-tile neighborhood as covered.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = rtx + dx, ny = rty + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          const t = ny * width + nx;
          // The walk goes outward, so the first road tile to reach a tile is the nearest.
          if (distOut && !covered.has(t)) distOut.set(t, dist);
          covered.add(t);
        }
      }
    }

    // Expand to adjacent road tiles within range.
    if (dist < range) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = rtx + dx, ny = rty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (roadClass[ni] === ROAD_NONE) continue;
        if (visited.has(ni)) continue;
        visited.add(ni);
        queue.push({ idx: ni, dist: dist + 1 });
      }
    }
  }

  return covered;
}

/** The five coverage layers, in the order ServiceSystem keeps its copies. */
const LAYER_OF_KIND: Record<number, number> = {
  [BUILDING_POLICE]: 1, [BUILDING_FIRE]: 2, [BUILDING_SCHOOL]: 3, [BUILDING_HOSPITAL]: 4,
};

/** Everything ServiceSystem remembers about one kind of service building. */
interface KindCover {
  kind: number;
  /** Every tile some building of the kind reaches, each once. */
  union: Int32Array;
  // Kinds with a capacity only (serviceCapacity > 0):
  capacity: number;
  /** Each building's reach, tiles nearest first, with distances. */
  reaches: BuildingReach[];
  /** Per tile of `union`: which building (index into `reaches`) is nearest, ties to the lower anchor. */
  nearest: Int32Array | null;
  /** Per tile: 1 for a home every building in reach is too full for. Null = nobody is turned away. */
  full: Uint8Array | null;
}

export class ServiceSystem {
  // Coverage depends only on where the roads and buildings are, plus (for a
  // kind with a capacity) on who lives in reach. So the road walks are redone
  // only when a road or building changes, the seating when that happens or
  // once a game day, and on every other tick the five layers are copied back
  // from what was worked out then.
  private _world: World | null = null;
  private _key = NaN;
  private _capacityKey = '';
  private _kinds: KindCover[] = [];
  private _final: Uint8Array[] = [];            // services, police, fire, school, hospital
  // Scratch for the road walks and the seating: sized to the map, reused.
  private _n = 0;
  private _stampCovered!: Uint32Array;
  private _stampVisited!: Uint32Array;
  private _stamp = 0;
  private _queue!: Int32Array;
  private _queueDist!: Uint16Array;
  private _outTiles!: Int32Array;
  private _outDist!: Uint16Array;
  private _seatAt!: Int32Array;
  private _nearDist!: Uint16Array;

  update(world: World): void {
    const n = world.grid.width * world.grid.height;
    if (n !== this._n) {
      this._n = n;
      this._stampCovered = new Uint32Array(n);
      this._stampVisited = new Uint32Array(n);
      this._stamp = 0;
      this._queue = new Int32Array(n);
      this._queueDist = new Uint16Array(n);
      this._outTiles = new Int32Array(n);
      this._outDist = new Uint16Array(n);
      this._seatAt = new Int32Array(n);
      this._nearDist = new Uint16Array(n);
      this._final = [0, 1, 2, 3, 4].map(() => new Uint8Array(n));
      this._world = null;
    }

    // A fingerprint of everything coverage depends on: each road tile and its
    // class, each building and its kind, and the coverage ranges.
    const roadClass = world.layers.roadClass;
    const { roads, roadCount } = world.index;
    let key = 0x811c9dc5 | 0;
    const mix = (v: number) => { key = Math.imul(key ^ v, 0x9e3779b1); key ^= key >>> 15; };
    for (let k = 0; k < roadCount; k++) { mix(roads[k]); mix(roadClass[roads[k]]); }
    mix(roadCount);
    for (const b of world.buildings) {
      mix(b.ty * world.grid.width + b.tx); mix(b.kind);
      mix(BALANCE.service.coverageRange[b.kind] ?? -1);
    }
    mix(world.buildings.length);

    let capacityKey = '';
    for (const kind in BALANCE.service.coverageRange) {
      const c = serviceCapacity(+kind);
      if (c > 0) capacityKey += kind + ':' + c + ';';
    }

    const walked = world !== this._world || key !== this._key || capacityKey !== this._capacityKey;
    if (walked) {
      this._world = world;
      this._key = key;
      this._capacityKey = capacityKey;
      this._walk(world);
    }
    if (walked || world.tick % BALANCE.ticksPerDay === 0) {
      // Seat (only the homes can have changed since the walk); rebuild the layers if anything moved.
      if (this._seat(world) || walked) this._compose();
    }

    const L = world.layers;
    L.services.set(this._final[0]);
    L.police.set(this._final[1]);
    L.fireStation.set(this._final[2]);
    L.school.set(this._final[3]);
    L.hospital.set(this._final[4]);

    // Count covered developed zones for HUD stat.
    const services = L.services;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    let covered = 0;
    const { zoned, zonedCount } = world.index;
    for (let k = 0; k < zonedCount; k++) {
      const i = zoned[k];
      if (zone[i] !== ZONE_NONE && dev[i] > 0 && services[i] === 1) covered++;
    }
    world.stats.servicesCoveredZones = covered;
  }

  /**
   * One building's road walk: the same tiles, in the same order and with the
   * same distances, as computeServiceCoverage with `distOut` (a test holds
   * the two together), on reused typed arrays instead of a Set and a Map.
   * Returns how many tiles were written to _outTiles / _outDist.
   */
  private _walkOne(world: World, tx: number, ty: number, kind: number, range: number): number {
    const { width, height } = world.grid;
    const roadClass = world.layers.roadClass;
    const covered = this._stampCovered, visited = this._stampVisited;
    const stamp = ++this._stamp;
    const queue = this._queue, queueDist = this._queueDist;
    const out = this._outTiles, outDist = this._outDist;
    let m = 0, tail = 0;

    const own = footprintTiles(width, height, tx, ty, kind) ?? [ty * width + tx];
    for (const i of own) { if (covered[i] !== stamp) { covered[i] = stamp; out[m] = i; outDist[m++] = 0; } }
    const seed = (i: number) => {
      const rc = roadClass[i];
      if (rc === ROAD_NONE || rc === ROAD_HIGHWAY || visited[i] === stamp) return;
      visited[i] = stamp;
      queue[tail] = i; queueDist[tail++] = 0;
    };
    for (const i of own) seed(i);
    for (const i of footprintEdge(width, height, own)) seed(i);

    for (let head = 0; head < tail; head++) {
      const idx = queue[head], dist = queueDist[head];
      const rtx = idx % width, rty = (idx - rtx) / width;
      const y0 = rty > 0 ? rty - 1 : 0, y1 = rty < height - 1 ? rty + 1 : rty;
      const x0 = rtx > 0 ? rtx - 1 : 0, x1 = rtx < width - 1 ? rtx + 1 : rtx;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0, t = y * width + x0; x <= x1; x++, t++) {
          if (covered[t] !== stamp) { covered[t] = stamp; out[m] = t; outDist[m++] = dist; }
        }
      }
      if (dist < range) {
        // West, east, north, south: the order computeServiceCoverage expands in.
        if (rtx > 0)          { const ni = idx - 1;     if (roadClass[ni] !== ROAD_NONE && visited[ni] !== stamp) { visited[ni] = stamp; queue[tail] = ni; queueDist[tail++] = dist + 1; } }
        if (rtx < width - 1)  { const ni = idx + 1;     if (roadClass[ni] !== ROAD_NONE && visited[ni] !== stamp) { visited[ni] = stamp; queue[tail] = ni; queueDist[tail++] = dist + 1; } }
        if (rty > 0)          { const ni = idx - width; if (roadClass[ni] !== ROAD_NONE && visited[ni] !== stamp) { visited[ni] = stamp; queue[tail] = ni; queueDist[tail++] = dist + 1; } }
        if (rty < height - 1) { const ni = idx + width; if (roadClass[ni] !== ROAD_NONE && visited[ni] !== stamp) { visited[ni] = stamp; queue[tail] = ni; queueDist[tail++] = dist + 1; } }
      }
    }
    return m;
  }

  /** The reach of one service building, as ServiceSystem works it out. For tests. */
  reachOf(world: World, tx: number, ty: number, kind: number): BuildingReach {
    this.update(world);   // sizes the scratch arrays
    const m = this._walkOne(world, tx, ty, kind, BALANCE.service.coverageRange[kind] ?? 4);
    return { anchor: ty * world.grid.width + tx, tiles: this._outTiles.slice(0, m), dist: this._outDist.slice(0, m) };
  }

  /** Walk every service building again and gather, per kind, what it reaches. */
  private _walk(world: World): void {
    const width = world.grid.width;
    const byKind = new Map<number, { capacity: number; reaches: BuildingReach[] }>();
    for (const b of world.buildings) {
      const range = BALANCE.service.coverageRange[b.kind];
      if (range === undefined) continue; // not a service building
      let entry = byKind.get(b.kind);
      if (!entry) { entry = { capacity: serviceCapacity(b.kind), reaches: [] }; byKind.set(b.kind, entry); }
      const m = this._walkOne(world, b.tx, b.ty, b.kind, range);
      entry.reaches.push({
        anchor: b.ty * width + b.tx,
        tiles: this._outTiles.slice(0, m),
        // Distances are only needed to seat people.
        dist: entry.capacity > 0 ? this._outDist.slice(0, m) : EMPTY_DIST,
      });
    }

    this._kinds = [];
    const seen = this._stampCovered, nearDist = this._nearDist, out = this._outTiles;
    for (const [kind, { capacity, reaches }] of byKind) {
      // The union of the kind's reaches; for a kind with a capacity, also each tile's nearest building.
      const stamp = ++this._stamp;
      const limited = capacity > 0;
      const order = limited ? reaches.map((_, k) => k).sort((x, y) => reaches[x].anchor - reaches[y].anchor) : null;
      const nearest = limited ? this._seatAt : null;     // borrowed as scratch: building index per tile
      let m = 0;
      for (let r = 0; r < reaches.length; r++) {
        const bi = order ? order[r] : r;
        const { tiles, dist } = reaches[bi];
        for (let k = 0; k < tiles.length; k++) {
          const t = tiles[k];
          if (seen[t] !== stamp) {
            seen[t] = stamp; out[m++] = t;
            if (nearest) { nearest[t] = bi; nearDist[t] = dist[k]; }
          } else if (nearest && dist[k] < nearDist[t]) {
            nearest[t] = bi; nearDist[t] = dist[k];
          }
        }
      }
      const union = out.slice(0, m);
      let near: Int32Array | null = null;
      if (nearest) { near = new Int32Array(m); for (let k = 0; k < m; k++) near[k] = nearest[union[k]]; }
      this._kinds.push({ kind, union, capacity, reaches: limited ? reaches : [], nearest: near, full: null });
    }
  }

  /**
   * Seat the homes of every kind that has a capacity. Returns whether any
   * kind's unseated homes changed (so the layers must be rebuilt).
   *
   * Quick test first, one pass over the tiles the kind reaches: if every home
   * fits at its nearest building, that IS the seating and nobody is turned
   * away. Only otherwise is the full seating run.
   */
  private _seat(world: World): boolean {
    const { zone, devLevel, abandoned } = world.layers;
    const popPerLevel = BALANCE.growth.popPerLevel;
    let changed = false;
    for (const entry of this._kinds) {
      if (entry.capacity <= 0 || !entry.nearest) continue;
      const { union, nearest, reaches, capacity } = entry;
      const load = new Float64Array(reaches.length);
      let fits = true;
      for (let k = 0; k < union.length; k++) {
        const i = union[k];
        if (zone[i] !== ZONE_R || devLevel[i] === 0 || abandoned[i] !== 0) continue;
        const b = nearest[k];
        load[b] += popPerLevel[devLevel[i]] ?? 0;
        if (load[b] > capacity) { fits = false; break; }
      }
      let full: Uint8Array | null = null;
      if (!fits) {
        const seatAt = this._seatAt;
        for (let k = 0; k < union.length; k++) seatAt[union[k]] = -1;
        if (seatHomes(world, reaches, capacity, seatAt, load) > 0) {
          full = new Uint8Array(this._n);
          for (let k = 0; k < union.length; k++) if (seatAt[union[k]] === -2) full[union[k]] = 1;
        }
      }
      if (full || entry.full) changed = true;   // (an unchanged non-empty mask is rebuilt too: once a day at most)
      entry.full = full;
    }
    return changed;
  }

  /** Rebuild the five layers from each kind's reach, leaving out homes with no seat. */
  private _compose(): void {
    const services = this._final[0];
    for (const f of this._final) f.fill(0);
    for (const { kind, union, full } of this._kinds) {
      const layer = LAYER_OF_KIND[kind];
      const own = layer ? this._final[layer] : null;
      for (let k = 0; k < union.length; k++) {
        const t = union[k];
        // A home this kind reaches but has no seat for is not covered by it.
        if (full && full[t]) continue;
        services[t] = 1;
        if (own) own[t] = 1;
      }
    }
  }
}

const EMPTY_DIST = new Uint16Array(0);
