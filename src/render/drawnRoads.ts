// How a road tile is drawn depends on its neighbours (see clay/roads.ts).
// These look the neighbours up in the world for the two places that draw
// roads: the chunk layer and the per-frame traffic cars.

import type { World } from '../sim/World';
import { ROAD_NONE } from '../sim/constants';
import { drawnRoadClass } from './clay/roads';

const rawAround: number[] = [0, 0, 0, 0];
const around: number[] = [0, 0, 0, 0];

/** The class the road tile at (tx, ty) is drawn as (ROAD_NONE off the map or where there is no road). */
export function drawnRoadAt(world: World, tx: number, ty: number): number {
  const R = world.layers.roadClass, { width, height } = world.grid;
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return ROAD_NONE;
  const cls = R[ty * width + tx];
  if (cls === ROAD_NONE) return ROAD_NONE;
  const raw = rawAround;
  raw[0] = ty > 0 ? R[(ty - 1) * width + tx] : ROAD_NONE;
  raw[1] = tx < width - 1 ? R[ty * width + tx + 1] : ROAD_NONE;
  raw[2] = ty < height - 1 ? R[(ty + 1) * width + tx] : ROAD_NONE;
  raw[3] = tx > 0 ? R[ty * width + tx - 1] : ROAD_NONE;
  return drawnRoadClass(cls, raw);
}

/** Drawn road classes of the N, E, S and W neighbours. The array is reused. */
export function drawnRoadsAround(world: World, tx: number, ty: number): number[] {
  const out = around;
  out[0] = drawnRoadAt(world, tx, ty - 1);
  out[1] = drawnRoadAt(world, tx + 1, ty);
  out[2] = drawnRoadAt(world, tx, ty + 1);
  out[3] = drawnRoadAt(world, tx - 1, ty);
  return out;
}
