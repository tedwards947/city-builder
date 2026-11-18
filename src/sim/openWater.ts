// Open water: water that connects to the edge of the map, as opposed to a
// pond or a lake. A seaport's docks must stand on it, because ships come and
// go by the map edge.
//
// One flood fill from every water tile on the boundary, through water tiles
// that share an edge. Bridges (roads over water) and docks do not close a
// channel: ships pass under and between them. The answer depends only on the
// terrain, so it is remembered until the terrain changes.

import type { World } from './World';
import { TERRAIN_WATER } from './constants';

const cache = new WeakMap<World, { key: number; mask: Uint8Array }>();

/** A cheap fingerprint of where the water is: one pass, no allocation. */
function waterKey(terrain: Uint8Array): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === TERRAIN_WATER) h = Math.imul(h ^ i, 0x01000193);
  }
  return h;
}

/**
 * Per tile: 1 if the tile is water and its water body touches the edge of
 * the map, else 0. Do not keep the array across terrain changes; ask again.
 */
export function openWater(world: World): Uint8Array {
  const terrain = world.layers.terrain;
  const key = waterKey(terrain);
  const have = cache.get(world);
  if (have && have.key === key) return have.mask;

  const mask = openWaterOf(terrain, world.grid.width, world.grid.height);
  cache.set(world, { key, mask });
  return mask;
}

/** The same answer for any terrain array (say, the map as an edit would leave it). Not remembered. */
export function openWaterOf(terrain: Uint8Array, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let n = 0;
  const seed = (i: number) => { if (terrain[i] === TERRAIN_WATER && mask[i] === 0) { mask[i] = 1; queue[n++] = i; } };
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }
  for (let q = 0; q < n; q++) {
    const i = queue[q], x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < width * (height - 1)) seed(i + width);
  }
  return mask;
}

/** Whether tile `i` is water that connects to the edge of the map. */
export function isOpenWater(world: World, i: number): boolean {
  return openWater(world)[i] === 1;
}

/**
 * Which way to turn a `kind` building anchored at (tx, ty) so it fits: the
 * first rotation, starting at `from` and turning clockwise, where it can be
 * placed. If none can, the one with the fewest failing tiles (blocked tiles
 * plus docks not on open water, plus one if it needs water beside it and has
 * none; off the map counts as worst), earliest from `from` on a tie.
 */
export function suggestRotation(world: World, tx: number, ty: number, kind: number, from = 0): number {
  let best = from & 3, bestScore = Infinity;
  for (let k = 0; k < 4; k++) {
    const rot = (from + k) & 3;
    const c = world.checkPlacement(tx, ty, kind, rot);
    if (c.ok) return rot;
    const score = c.offMap ? 1e9 : c.blocked.length + c.notOpenWater.length + (c.noWater ? 1 : 0);
    if (score < bestScore) { bestScore = score; best = rot; }
  }
  return best;
}
