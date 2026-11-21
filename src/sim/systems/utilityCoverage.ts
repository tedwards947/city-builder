// Shared by PowerSystem, WaterSystem and SewageSystem, which work the same
// way: a utility building next to a street or avenue serves that whole road
// network, and coverage reaches `range` tiles off every served road.
//
// Loops over the road and zone lists in world.index rather than the whole
// map, so the cost follows the size of the city, not of the map.

import { levelWeight } from '../lots';
import type { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY } from '../constants';
import { markLayerChanges } from '../layerDirty';
import { footprintTiles, footprintEdge, hasNeededWater } from '../buildingShapes';

/**
 * Recompute a coverage layer (1 = covered, 0 = not) for one utility. Returns
 * the total supply: each building's output, for each building that is
 * connected to a street or avenue. `output` is either one building kind and
 * its output, or a table of kind → output when several kinds supply the same
 * utility (a small and a large plant).
 */
export function spreadUtility(
  world: World, layer: Uint8Array, buildingKind: number | Readonly<Record<number, number>>, outputPerBuilding: number, range: number,
): number {
  const outputs = typeof buildingKind === 'number' ? null : buildingKind;
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  const roadNet = world.layers.roadNet;
  layer.fill(0);

  // 1. Which road networks have a connected building of this kind?
  const served = new Set<number>();
  let supply = 0;
  for (const b of world.buildings) {
    const output = outputs ? outputs[b.kind] : b.kind === buildingKind ? outputPerBuilding : undefined;
    if (output === undefined) continue;
    // Connected if any tile along the building's edge is a street or avenue.
    const tiles = footprintTiles(width, height, b.tx, b.ty, b.kind, b.rot ?? 0) ?? [b.ty * width + b.tx];
    let connected = false;
    for (const ni of footprintEdge(width, height, tiles)) {
      const rc = roadClass[ni];
      if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) {
        served.add(roadNet[ni]);
        connected = true;
      }
    }
    // A plant that draws from the water supplies nothing once the water beside it is gone.
    if (connected && !hasNeededWater(b.kind, tiles, world.layers.terrain, width, height)) connected = false;
    if (connected) {
      supply += output;
      for (const i of tiles) layer[i] = 1;
    }
  }
  // 2. Every tile of a served network is covered, and so is everything within
  //    `range` tiles of it.
  if (served.size > 0) {
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
  }
  markLayerChanges(world, layer);   // only what changed: none, on most ticks
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
    if (zone[i] !== 0 && devLevel[i] >= minLevel && abandoned[i] === 0) demand += levelWeight(devLevel[i]) * perLevel;
  }
  return demand;
}
