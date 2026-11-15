// What TransitSystem worked out on its last pass, for the traffic overlay,
// the tile inspector and the tuning panel. Read-only outside TransitSystem,
// never saved: it is rebuilt from the layers on the first pass after a load.

import type { World } from './World';
import { ROAD_NONE, ROAD_HIGHWAY } from './constants';
import { BALANCE } from '../data/balance';

/** One travel-time map: time to the nearest destination, and the way there. */
export interface TrafficField {
  // Cost per road tile to the destination it is assigned to, in street tiles:
  // travel time (congestion included) plus that destination's `price`.
  // Infinity = unreachable.
  dist: Float32Array;
  parent: Int32Array;    // next tile toward the destination; -1 at a door
  order: Int32Array;     // road tiles in order of increasing dist
  count: number;         // number of valid entries in `order`
  // Pure travel time (congestion included, no price) from this road tile to
  // the first door on its route.
  near: Float32Array;
  // Doors: road tiles next to a destination zone. Indexed by road tile.
  doorCap: Float32Array;   // trips the zones at this door can take; 0 = not a door
  doorLoad: Float32Array;  // trips that ended at this door on the last iteration
  // Extra cost of ending a route at this door, raised while more trips end
  // there than it can take so that the overflow drives on to the next one.
  price: Float32Array;
  isDoor: Uint8Array;      // 1 if the tile was a door at the last flood (to spot new doors)
  /** Total trips wanting this destination type ÷ total door capacity. */
  demandRatio: number;
}

export interface TrafficData {
  /** Bumped every time the pass is recomputed. */
  version: number;
  toC: TrafficField;     // to the nearest developed commerce
  toI: TrafficField;     // to the nearest developed industry
  toR: TrafficField;     // to the nearest developed homes
  // Trips passing through each road tile, per flow. Averaged over recent
  // iterations, so where routes alternate the traffic shows as split.
  volRC: Float32Array;   // homes → commerce (follows toC)
  volRI: Float32Array;   // homes → industry (follows toI)
  volIC: Float32Array;   // industry → commerce (follows toC)
  /** False while the pass is still settling toward a stable assignment. */
  settled: boolean;
}

export function makeTrafficField(n: number): TrafficField {
  return {
    dist: new Float32Array(n), parent: new Int32Array(n), order: new Int32Array(n), count: 0,
    near: new Float32Array(n), doorCap: new Float32Array(n), doorLoad: new Float32Array(n),
    price: new Float32Array(n), isDoor: new Uint8Array(n), demandRatio: 0,
  };
}

/** Pure travel time from a road tile to the nearest destination on its route (Infinity if none). */
export function travelTime(field: TrafficField, roadIdx: number): number {
  return field.dist[roadIdx] < Infinity ? field.near[roadIdx] : Infinity;
}

/** Total trips through a road tile. */
export function trafficVolume(d: TrafficData, i: number): number {
  return d.volRC[i] + d.volRI[i] + d.volIC[i];
}

/** Trips a road tile of this class can carry before it counts as full. */
export function roadCapacity(roadClass: number): number {
  return BALANCE.roadClasses[roadClass]?.capacity ?? BALANCE.roadClasses[1].capacity;
}

/** Index of the tile's k-th cardinal neighbour (W, E, N, S), or -1 off the map. */
export function neighbourIndex(i: number, k: number, width: number, height: number): number {
  const x = i % width;
  if (k === 0) return x > 0 ? i - 1 : -1;
  if (k === 1) return x < width - 1 ? i + 1 : -1;
  if (k === 2) return i >= width ? i - width : -1;
  return i < width * (height - 1) ? i + width : -1;
}

/**
 * The adjacent street or avenue tile from which a zone tile's trips enter the
 * network for `field` (the one nearest the destination), or -1 if it has no
 * access road or none of them reaches a destination. Highways give no access.
 */
export function bestAccessRoad(world: World, zoneIdx: number, field: TrafficField): number {
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  let best = -1, bestDist = Infinity;
  for (let k = 0; k < 4; k++) {
    const ri = neighbourIndex(zoneIdx, k, width, height);
    if (ri < 0) continue;
    const rc = roadClass[ri];
    if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
    if (field.dist[ri] < bestDist) { bestDist = field.dist[ri]; best = ri; }
  }
  return best;
}
