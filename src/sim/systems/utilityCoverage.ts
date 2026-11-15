// Shared by PowerSystem, WaterSystem and SewageSystem, which work the same
// way: a utility building next to a street or avenue serves that whole road
// network, and coverage reaches `range` tiles off every served road.
//
// Loops over the road and zone lists in world.index rather than the whole
// map, so the cost follows the size of the city, not of the map.

import type { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY } from '../constants';

/**
 * Recompute a coverage layer (1 = covered, 0 = not) for one kind of utility
 * building. Returns the total supply: `outputPerBuilding` for each building
 * that is connected to a street or avenue.
 */
export function spreadUtility(
  world: World, layer: Uint8Array, buildingKind: number, outputPerBuilding: number, range: number,
): number {
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  const roadNet = world.layers.roadNet;
  layer.fill(0);

  // 1. Which road networks have a connected building of this kind?
  const served = new Set<number>();
  let supply = 0;
  for (const b of world.buildings) {
    if (b.kind !== buildingKind) continue;
    let connected = false;
    for (let k = 0; k < 4; k++) {
      const nx = b.tx + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const ny = b.ty + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      const rc = roadClass[ni];
      if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) {
        served.add(roadNet[ni]);
        connected = true;
      }
    }
    if (connected) {
      supply += outputPerBuilding;
      layer[b.ty * width + b.tx] = 1;
    }
  }
  if (served.size === 0) return supply;

  // 2. Every tile of a served network is covered, and so is everything within
  //    `range` tiles of it.
  const { roads, roadCount } = world.index;
  for (let k = 0; k < roadCount; k++) {
    const i = roads[k];
    if (roadClass[i] === ROAD_NONE || !served.has(roadNet[i])) continue;
    const x = i % width, y = (i - x) / width;
    const xa = x - range < 0 ? 0 : x - range, xb = x + range >= width ? width - 1 : x + range;
    const ya = y - range < 0 ? 0 : y - range, yb = y + range >= height ? height - 1 : y + range;
    for (let ny = ya; ny <= yb; ny++) {
      const row = ny * width;
      for (let nx = xa; nx <= xb; nx++) layer[row + nx] = 1;
    }
  }
  return supply;
}

/**
 * Total demand from developed, non-abandoned zones at or above `minLevel`:
 * level × `perLevel` each.
 */
export function utilityDemand(world: World, minLevel: number, perLevel: number): number {
  const zone = world.layers.zone;
  const devLevel = world.layers.devLevel;
  const abandoned = world.layers.abandoned;
  const { zoned, zonedCount } = world.index;
  let demand = 0;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (zone[i] !== 0 && devLevel[i] >= minLevel && abandoned[i] === 0) demand += devLevel[i] * perLevel;
  }
  return demand;
}
