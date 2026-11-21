// Outside connections (CONNECTIONS_DESIGN.md): the fixed points on the edges
// of the map where a highway or a rail line can join the region.
//
//   WHAT A POINT IS  Data only: a kind ('highway' or 'rail') and an edge tile
//                    (never a corner). Nothing is built there. The stub and
//                    the sign are drawn off the map; the player joins a point
//                    by building a highway (or ground track) onto its tile.
//   HOW MANY         By map size (BALANCE.connections.counts). Maps smaller
//                    than `minSize` get none.
//   WHERE            Spread over the edges, apart from each other and from
//                    the corners, on dry land with dry land behind it, and on
//                    the land the middle of the map belongs to where there is
//                    room. Chosen from the city's seed with a generator of
//                    their own: `world.rng` is not touched.
//   THE TILE         Reserved: a highway point's tile takes a highway and
//                    nothing else; a rail point's tile takes ground track and
//                    nothing else. No zone, building, other road or water.
//                    (A subway may pass under either.)
//   OLD MAPS         A save with no points gets them on load (and a map built
//                    by a generator, when it calls resetConnections): a
//                    highway or ground track that already runs to the edge
//                    becomes a point first, up to the map's count; the rest
//                    are chosen as above, from the map as it then is.
//
// What travels through a point is in sim/connectionTraffic.ts.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, RAIL_GROUND, RAIL_SURFACE, ROAD_HIGHWAY, ROAD_NONE, TERRAIN_WATER, ZONE_NONE } from './constants';
import { mulberry32 } from './rng';

export type ConnectionKind = 'highway' | 'rail';

/** The edge of the map a point is on. */
export const EDGE_N = 0, EDGE_E = 1, EDGE_S = 2, EDGE_W = 3;

export interface Connection {
  kind: ConnectionKind;
  /** Its edge tile (index into the layers). */
  tile: number;
  /** EDGE_N, EDGE_E, EDGE_S or EDGE_W: the side the region is on. */
  edge: number;
}

/** The edge a non-corner edge tile is on, or -1 for any other tile. */
export function edgeOf(width: number, height: number, tile: number): number {
  if (!Number.isInteger(tile) || tile < 0 || tile >= width * height) return -1;
  const x = tile % width, y = (tile - x) / width;
  const onX = x === 0 || x === width - 1, onY = y === 0 || y === height - 1;
  if (onX === onY) return -1;   // inside the map, or a corner
  return y === 0 ? EDGE_N : x === width - 1 ? EDGE_E : y === height - 1 ? EDGE_S : EDGE_W;
}

/** One step inward from an edge: the change in tile index. */
function inwardStep(width: number, edge: number): number {
  return edge === EDGE_N ? width : edge === EDGE_E ? -1 : edge === EDGE_S ? -width : 1;
}

/** Highway and rail points a map of this size has. */
export function connectionCounts(width: number, height: number): { highway: number; rail: number } {
  const C = BALANCE.connections, size = Math.min(width, height);
  if (size < C.minSize || C.counts.length === 0) return { highway: 0, rail: 0 };
  const row = C.counts.find((r) => size <= r.upTo) ?? C.counts[C.counts.length - 1];
  return { highway: row.highway, rail: row.rail };
}

/** The point on tile `i`, if there is one. */
export function connectionOn(world: World, i: number): Connection | null {
  for (const c of world.connections) if (c.tile === i) return c;
  return null;
}

/** Whether tile `i` is a point of another kind than `kind` (so `kind`'s road or track may not go there). Null kind: any point. */
export function reservedAgainst(world: World, i: number, kind: ConnectionKind | null): boolean {
  const c = world.connections.length > 0 ? connectionOn(world, i) : null;
  return c !== null && c.kind !== kind;
}

/** Whether the point has been joined: a highway (or ground track) stands on its tile. */
export function isJoined(world: World, c: Connection): boolean {
  return c.kind === 'highway' ? world.layers.roadClass[c.tile] === ROAD_HIGHWAY : (world.layers.rail[c.tile] & RAIL_GROUND) !== 0;
}

const NO_POINTS: readonly Connection[] = [];

/**
 * The highway points that carry traffic (sim/connectionTraffic.ts): those a
 * highway stands on. None in the tutorial city, where the stub is only the
 * road in.
 */
export function openHighways(world: World): readonly Connection[] {
  if (world.connections.length === 0 || world.tutorial) return NO_POINTS;
  const road = world.layers.roadClass;
  let all = true, any = false;
  for (const c of world.connections) {
    if (c.kind === 'highway' && road[c.tile] === ROAD_HIGHWAY) any = true; else all = false;
  }
  if (!any) return NO_POINTS;
  return all ? world.connections : world.connections.filter((c) => c.kind === 'highway' && road[c.tile] === ROAD_HIGHWAY);
}

/** Whether trips may start and end on highway tile `i`: only on an open highway point. Every other highway tile has no doors. */
export function isEntryTile(world: World, i: number): boolean {
  if (world.connections.length === 0 || world.tutorial) return false;
  for (const c of world.connections) if (c.tile === i) return c.kind === 'highway' && world.layers.roadClass[i] === ROAD_HIGHWAY;
  return false;
}

export interface ConnectionStatus extends Connection {
  tx: number;
  ty: number;
  /** A highway (or ground track) stands on its tile. */
  joined: boolean;
}

/** Every point, with where it is and whether it is joined. For the map art, the overlay and Inspect. */
export function connectionStatus(world: World): ConnectionStatus[] {
  const { width } = world.grid;
  return world.connections.map((c) => ({ ...c, tx: c.tile % width, ty: (c.tile - c.tile % width) / width, joined: isJoined(world, c) }));
}

/** Every edge tile but the corners, in a fixed order: north (west to east), east (north to south), south, west. */
function edgeTiles(width: number, height: number): number[] {
  const out: number[] = [];
  for (let x = 1; x < width - 1; x++) out.push(x);
  for (let y = 1; y < height - 1; y++) out.push(y * width + width - 1);
  for (let x = 1; x < width - 1; x++) out.push((height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) out.push(y * width);
  return out;
}

/**
 * The land the middle of the map belongs to: 1 on each of its tiles. If the
 * middle is water, the biggest piece of land instead. (Land joined by its
 * sides; a bridge does not count.)
 */
function mainLand(world: World): Uint8Array {
  const { width, height } = world.grid;
  const terrain = world.layers.terrain;
  const n = width * height;
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  let next = 0, best = 0, bestSize = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] !== 0 || terrain[s] === TERRAIN_WATER) continue;
    const id = ++next;
    let head = 0, tail = 0;
    queue[tail++] = s; label[s] = id;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width;
      if (x > 0 && label[i - 1] === 0 && terrain[i - 1] !== TERRAIN_WATER) { label[i - 1] = id; queue[tail++] = i - 1; }
      if (x < width - 1 && label[i + 1] === 0 && terrain[i + 1] !== TERRAIN_WATER) { label[i + 1] = id; queue[tail++] = i + 1; }
      if (i >= width && label[i - width] === 0 && terrain[i - width] !== TERRAIN_WATER) { label[i - width] = id; queue[tail++] = i - width; }
      if (i + width < n && label[i + width] === 0 && terrain[i + width] !== TERRAIN_WATER) { label[i + width] = id; queue[tail++] = i + width; }
    }
    if (tail > bestSize) { bestSize = tail; best = id; }
  }
  const middle = label[(height >> 1) * width + (width >> 1)];
  const want = middle !== 0 ? middle : best;
  const out = new Uint8Array(n);
  if (want !== 0) for (let i = 0; i < n; i++) if (label[i] === want) out[i] = 1;
  return out;
}

/**
 * The map's points, worked out from the map as it is now: what is already
 * built to the edge first, then the rest from the seed. The same map and
 * seed always give the same points. Does not draw from `world.rng`.
 */
export function generateConnections(world: World): Connection[] {
  const { width, height } = world.grid;
  const want = connectionCounts(width, height);
  const out: Connection[] = [];
  if (want.highway + want.rail === 0) return out;
  const C = BALANCE.connections, L = world.layers;
  const size = Math.min(width, height);
  const gap = C.minGap * size, corner = C.cornerGap * size;
  const edges = edgeTiles(width, height);
  const have = { highway: 0, rail: 0 };
  const dist = (a: number, b: number): number => Math.hypot(a % width - b % width, Math.floor(a / width) - Math.floor(b / width));
  const apart = (i: number): boolean => out.every((c) => dist(c.tile, i) >= gap);
  const take = (kind: ConnectionKind, i: number): void => { out.push({ kind, tile: i, edge: edgeOf(width, height, i) }); have[kind]++; };

  // 1. What already runs to the edge. One that runs straight in from the edge is taken before one that runs along it.
  for (const straight of [true, false]) {
    for (const i of edges) {
      if (L.building[i] !== BUILDING_NONE) continue;
      const inward = i + inwardStep(width, edgeOf(width, height, i));
      const isHighway = L.roadClass[i] === ROAD_HIGHWAY, isTrack = (L.rail[i] & RAIL_GROUND) !== 0;
      if (isHighway && have.highway < want.highway && (!straight || L.roadClass[inward] === ROAD_HIGHWAY) && apart(i)) take('highway', i);
      else if (isTrack && !isHighway && L.roadClass[i] === ROAD_NONE && have.rail < want.rail && (!straight || (L.rail[inward] & RAIL_GROUND) !== 0) && apart(i)) take('rail', i);
    }
  }
  if (have.highway >= want.highway && have.rail >= want.rail) return out;

  // 2. The rest: free, dry edge tiles with dry land behind them, away from the corners.
  const land = mainLand(world);
  const free: number[] = [], onMain: number[] = [];
  for (const i of edges) {
    const x = i % width, y = (i - x) / width;
    const edge = edgeOf(width, height, i);
    const along = edge === EDGE_N || edge === EDGE_S ? Math.min(x, width - 1 - x) : Math.min(y, height - 1 - y);
    if (along < corner) continue;
    if (L.building[i] !== BUILDING_NONE || L.zone[i] !== ZONE_NONE || L.roadClass[i] !== ROAD_NONE || (L.rail[i] & RAIL_SURFACE) !== 0) continue;
    const step = inwardStep(width, edge);
    let dry = true;
    for (let k = 0; k < C.inland && dry; k++) if (L.terrain[i + k * step] === TERRAIN_WATER) dry = false;
    if (!dry) continue;
    free.push(i);
    if (land[i]) onMain.push(i);
  }
  const rng = mulberry32((world.seed ^ 0x0C0221EC) >>> 0);
  const pick = (kind: ConnectionKind): void => {
    for (const list of [onMain, free]) {
      let best = -1, bestScore = -1;
      for (const i of list) {
        const roll = rng();   // drawn for every candidate, so the choice does not depend on which ones are too close
        if (!apart(i)) continue;
        let near = size, sameEdge = false;
        const edge = edgeOf(width, height, i);
        for (const c of out) {
          if (c.kind !== kind) continue;
          near = Math.min(near, dist(c.tile, i));
          if (c.edge === edge) sameEdge = true;
        }
        const score = near * (sameEdge ? 0.5 : 1) * (0.6 + 0.4 * roll);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best >= 0) { take(kind, best); return; }
    }
  };
  for (let k = 0; k < Math.max(want.highway, want.rail); k++) {
    if (have.highway < want.highway) pick('highway');
    if (have.rail < want.rail) pick('rail');
  }
  return out;
}

/** Work the map's points out again from the map as it is now. For a map generator, once its own roads are laid. */
export function resetConnections(world: World): void {
  world.connections = generateConnections(world);
}

/** Saved points made safe to load: a known kind, a non-corner edge tile, one point a tile. */
export function cleanConnections(saved: unknown, width: number, height: number): Connection[] {
  const out: Connection[] = [];
  if (!Array.isArray(saved)) return out;
  const seen = new Set<number>();
  for (const c of saved) {
    if (!c || (c.kind !== 'highway' && c.kind !== 'rail')) continue;
    const edge = edgeOf(width, height, c.tile);
    if (edge < 0 || seen.has(c.tile)) continue;
    seen.add(c.tile);
    out.push({ kind: c.kind, tile: c.tile, edge });
  }
  return out;
}
