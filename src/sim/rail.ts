// Rail track (RAIL_DESIGN.md). Track is its own tile layer, `world.layers.rail`:
// one bit per level (RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY), so a tile can
// hold more than one level. Only ground track can be laid so far.
//
// Ground track goes on land with no building or zone, or on water (a bridge).
// It may share a tile with a street or avenue: a LEVEL CROSSING. A crossing is
// always straight: the road runs along one axis and the track along the other.
// Track tiles that touch are joined, as roads are, except at a crossing, which
// only joins along its track axis. A station's platform tiles carry ground
// track too: they join each other, and the tile straight on from each end of
// the platform, and nothing beside them.

import type { World } from './World';
import { BUILDING_NONE, ROAD_NONE, ROAD_AVENUE, ZONE_NONE, TERRAIN_WATER, RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY } from './constants';
import { BALANCE } from '../data/balance';
import { buildingShape, rampLevel, subwayPlatform } from './buildingShapes';
import { railVolume } from './TrafficData';

/** Directions as bits, for railLinks. */
export const LINK_N = 1, LINK_E = 2, LINK_S = 4, LINK_W = 8;
const VERTICAL = LINK_N | LINK_S, HORIZONTAL = LINK_E | LINK_W;

/** Neighbour of tile `i` towards `dir` (one LINK_ bit), or -1 off the map. */
function towards(world: World, i: number, dir: number): number {
  const { width, height } = world.grid;
  const x = i % width;
  if (dir === LINK_N) return i >= width ? i - width : -1;
  if (dir === LINK_S) return i < width * (height - 1) ? i + width : -1;
  if (dir === LINK_E) return x < width - 1 ? i + 1 : -1;
  return x > 0 ? i - 1 : -1;
}
const opposite = (dir: number) => (dir === LINK_N ? LINK_S : dir === LINK_S ? LINK_N : dir === LINK_E ? LINK_W : LINK_E);
const DIRS = [LINK_N, LINK_E, LINK_S, LINK_W] as const;

/** The directions (LINK_ bits) in which tile `i` has a neighbour for which `has` holds. */
function sides(world: World, i: number, has: (j: number) => boolean): number {
  let m = 0;
  for (const d of DIRS) { const j = towards(world, i, d); if (j >= 0 && has(j)) m |= d; }
  return m;
}

/** True when tile `i` holds both a road and ground track. */
export function isLevelCrossing(world: World, i: number): boolean {
  return (world.layers.rail[i] & RAIL_GROUND) !== 0 && world.layers.roadClass[i] !== ROAD_NONE;
}

/**
 * The directions ground track on tile `i` may join in. All four for plain
 * track. A platform tile: see the top of the file. A level crossing joins only across its road: the road's axis is the
 * one it has road neighbours on; with no road neighbour, the track's axis is
 * the one it has track neighbours on (north–south if both).
 */
export function trackSides(world: World, i: number): number {
  const L = world.layers;
  if (L.building[i] !== BUILDING_NONE) {
    // A ramp's low end: only straight out, away from its high end.
    if (rampLevel(L.building[i]) !== 0) return world.buildingAnchorAt(i) === i ? rampOutward(world, i) : 0;
    // A platform: its own building's platform tiles, and straight on from an end.
    const anchor = world.buildingAnchorAt(i);
    const own = sides(world, i, (j) => L.building[j] !== BUILDING_NONE && (L.rail[j] & RAIL_GROUND) !== 0 && world.buildingAnchorAt(j) === anchor);
    return own === LINK_N || own === LINK_S ? VERTICAL : own === LINK_E || own === LINK_W ? HORIZONTAL : own;
  }
  if (L.roadClass[i] === ROAD_NONE) return VERTICAL | HORIZONTAL;
  const roads = sides(world, i, (j) => L.roadClass[j] !== ROAD_NONE);
  if (roads & HORIZONTAL) return VERTICAL;
  if (roads & VERTICAL) return HORIZONTAL;
  const tracks = sides(world, i, (j) => (L.rail[j] & RAIL_GROUND) !== 0);
  if (tracks & VERTICAL) return VERTICAL;
  if (tracks & HORIZONTAL) return HORIZONTAL;
  return VERTICAL | HORIZONTAL;
}

/**
 * The directions the track of `level` on tile `i` may join in. Ground: see
 * trackSides. Elevated and subway track joins on all four sides.
 */
export function levelSides(world: World, i: number, level: number): number {
  if (level === RAIL_GROUND) return trackSides(world, i);
  // A ramp's high (or deep) end: only straight out, away from its low end.
  const kind = world.layers.building[i];
  if (kind !== BUILDING_NONE && rampLevel(kind) === level && world.buildingAnchorAt(i) !== i) return rampOutward(world, i);
  return VERTICAL | HORIZONTAL;
}

/** The one side a ramp tile joins on: straight out, away from the ramp's other tile. `i` must be a ramp tile. */
function rampOutward(world: World, i: number): number {
  const anchor = world.buildingAnchorAt(i);
  const [dx, dy] = buildingShape(world.layers.building[i], world.buildingRotAt(anchor))[1];
  // From the low end (the anchor) the other tile is at (dx, dy); from the high end, at (−dx, −dy).
  const sx = i === anchor ? dx : -dx, sy = i === anchor ? dy : -dy;
  return sx > 0 ? LINK_W : sx < 0 ? LINK_E : sy > 0 ? LINK_N : LINK_S;
}

/**
 * The other end of the ramp that tile `i` is part of, and the level of the
 * track there: from the low end (ground track) the high end and its level,
 * from the high end the low end and RAIL_GROUND. Null if `i` is no ramp tile.
 * The ramp joins the two; railLinks never does (it is same-level only).
 */
export function rampOther(world: World, i: number): { tile: number; level: number } | null {
  const kind = world.layers.building[i];
  const level = rampLevel(kind);
  if (level === 0) return null;
  const anchor = world.buildingAnchorAt(i);
  if (i !== anchor) return { tile: anchor, level: RAIL_GROUND };
  const [dx, dy] = buildingShape(kind, world.buildingRotAt(anchor))[1];
  return { tile: anchor + dx + dy * world.grid.width, level };
}

/**
 * The neighbours the track of `level` (RAIL_GROUND by default, or
 * RAIL_ELEVATED or RAIL_SUBWAY) on tile `i` is joined to, as LINK_ bits; 0 if
 * the tile has no track on that level. Track only joins track of its own
 * level. Two bits: plain track or a bend; three or four: a junction.
 */
export function railLinks(world: World, i: number, level: number = RAIL_GROUND): number {
  const rail = world.layers.rail;
  if (!(rail[i] & level)) return 0;
  const mine = levelSides(world, i, level);
  let m = 0;
  for (const d of DIRS) {
    if (!(mine & d)) continue;
    const j = towards(world, i, d);
    if (j >= 0 && (rail[j] & level) && (levelSides(world, j, level) & opposite(d))) m |= d;
  }
  return m;
}

/** Why ground track cannot be laid on a tile, or null if it can. */
export type TrackBlocker = 'offMap' | 'blocked' | 'hasTrack' | 'crossing';

/**
 * Whether track of `level` can be laid on (tx, ty), and if not, why.
 *   Ground: 'offMap'; 'blocked' (a building or a zone); 'hasTrack' (already
 *     there); 'crossing' (a road it cannot cross: a highway, or a road tile
 *     that is a bend or a junction).
 *   Elevated: goes over land, water, any road (no crossing is made) and
 *     ground track; 'blocked' by a building or a zone.
 *   Subway: goes under anything; only 'offMap' and 'hasTrack'.
 */
export function trackBlocker(world: World, tx: number, ty: number, level: number = RAIL_GROUND): TrackBlocker | null {
  if (!world.grid.inBounds(tx, ty)) return 'offMap';
  const L = world.layers;
  const i = world.grid.idx(tx, ty);
  if (level === RAIL_SUBWAY) return L.rail[i] & RAIL_SUBWAY ? 'hasTrack' : null;
  if (L.building[i] !== BUILDING_NONE || L.zone[i] !== ZONE_NONE) return 'blocked';
  if (level === RAIL_ELEVATED) return L.rail[i] & RAIL_ELEVATED ? 'hasTrack' : null;
  if (L.rail[i] & RAIL_GROUND) return 'hasTrack';
  const rc = L.roadClass[i];
  if (rc !== ROAD_NONE) {
    if (rc > ROAD_AVENUE) return 'crossing';
    const roads = sides(world, i, (j) => L.roadClass[j] !== ROAD_NONE);
    if ((roads & VERTICAL) && (roads & HORIZONTAL)) return 'crossing';
  }
  return null;
}

/**
 * Whether track stops a road of `roadClass` being built on tile `i` (or an
 * existing road there being raised to that class). It does when:
 *   - the tile has ground track and the road would not make a straight level
 *     crossing: a highway, track that bends or branches there, or a road that
 *     would run along the track;
 *   - or the road would join a level crossing next to it from the side its
 *     track runs to, turning that crossing's road into a bend or junction.
 * Costs a few array reads on a map with no track.
 */
export function trackBlocksRoad(world: World, i: number, roadClass: number): boolean {
  const L = world.layers;
  const here = (L.rail[i] & RAIL_GROUND) !== 0;
  const roads = sides(world, i, (j) => L.roadClass[j] !== ROAD_NONE);
  if (here) {
    if (roadClass > ROAD_AVENUE) return true;
    if ((roads & VERTICAL) && (roads & HORIZONTAL)) return true;
    // The track as it joins now, before the road changes anything.
    const links = railLinks(world, i);
    if ((links & VERTICAL) && (links & HORIZONTAL)) return true;
    if ((links & VERTICAL) && (roads & VERTICAL)) return true;
    if ((links & HORIZONTAL) && (roads & HORIZONTAL)) return true;
  }
  if (L.roadClass[i] !== ROAD_NONE) return false;   // an upgrade joins nothing new
  for (const d of DIRS) {
    if (!(roads & d)) continue;
    const j = towards(world, i, d);
    if (!isLevelCrossing(world, j)) continue;
    const along = d & VERTICAL ? VERTICAL : HORIZONTAL;       // the axis this road would give the crossing's road
    const across = along === VERTICAL ? HORIZONTAL : VERTICAL;
    const jRoads = sides(world, j, (k) => k !== i && L.roadClass[k] !== ROAD_NONE);
    if (jRoads & across) return true;
    if (railLinks(world, j) & along) return true;
  }
  return false;
}

/**
 * Money to lay track of `level` on (tx, ty): the level's price per tile;
 * ground track on water is a bridge and costs that times the bridge
 * multiplier (elevated track is a bridge already, and subway goes under).
 * Null if track cannot go there.
 */
export function trackBuildCost(world: World, tx: number, ty: number, level: number = RAIL_GROUND): number | null {
  if (trackBlocker(world, tx, ty, level) !== null) return null;
  const mult = level === RAIL_GROUND && world.getTerrain(tx, ty) === TERRAIN_WATER ? BALANCE.costs.bridgeMultiplier : 1;
  return (BALANCE.rail.track[level]?.cost ?? 0) * mult;
}

const upkeepCache = new WeakMap<World, { version: number; upkeep: number }>();

/** Upkeep of all track per economy tick. Recounted only after track changes. */
export function trackMaintenance(world: World): number {
  const hit = upkeepCache.get(world);
  if (hit && hit.version === world.railVersion) return hit.upkeep;
  const rail = world.layers.rail;
  const table = BALANCE.rail.track;
  let upkeep = 0;
  for (let i = 0; i < rail.length; i++) {
    const r = rail[i];
    if (r === 0) continue;
    for (let bit = 1; bit <= r; bit <<= 1) if (r & bit) upkeep += table[bit]?.maintenance ?? 0;
  }
  upkeepCache.set(world, { version: world.railVersion, upkeep });
  return upkeep;
}

/**
 * The busiest platform tile of the station at (tx, ty): its tile index, or -1
 * before the first traffic pass or if the building has no platform. Riders
 * get on and off at ONE platform tile (the middle one), so the other platform
 * tiles on the dead-end side of it carry nobody; ask this for "the riders at
 * this station" rather than reading one platform tile. Counts riders getting
 * on, getting off and passing through, averaged like all traffic volumes.
 */
export function stationBusiestTile(world: World, tx: number, ty: number): number {
  return stationPeak(world, tx, ty)?.tile ?? -1;
}

/**
 * The busiest platform tile of the station at (tx, ty) and the level its
 * track is on: ground for a train station, subway for a subway station (whose
 * platform is under the tiles round its entrance). Null before the first
 * traffic pass or if the building has no platform. `riders` are those getting
 * on, getting off and passing through, per tick.
 */
export function stationPeak(world: World, tx: number, ty: number): { tile: number; level: number; riders: number } | null {
  const d = world.traffic;
  if (!d || !world.grid.inBounds(tx, ty)) return null;
  const b = world.buildingAt(tx, ty);
  let tiles: number[], level = RAIL_GROUND;
  const under = b ? subwayPlatform(b.kind, b.rot ?? 0) : [];
  if (b && under.length > 0) {
    level = RAIL_SUBWAY;
    tiles = under.map(([dx, dy]) => world.grid.idx(b.tx + dx, b.ty + dy));
  } else {
    tiles = world.buildingTilesAt(tx, ty);
  }
  let best = -1, most = -1;
  for (const i of tiles) {
    if (!(world.layers.rail[i] & level)) continue;
    const v = railVolume(d, i, level);
    if (v > most) { most = v; best = i; }
  }
  return best < 0 ? null : { tile: best, level, riders: most };
}

/** What the stations earn per economy tick: riders boarding × BALANCE.rail.fare. */
export function railFareIncome(world: World): number {
  const boardings = world.traffic?.rail.boardings ?? 0;
  return boardings > 0 ? boardings * BALANCE.rail.fare : 0;
}
