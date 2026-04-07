// Service coverage system.
// Coverage propagates along the road network via BFS, up to `range` road hops
// per building kind. Road tiles within range and their immediate neighbors
// (propagationRange=1) receive coverage — the same pattern as power/water.
// The building's own tile is always covered regardless of road adjacency.
// ServiceSystem runs before ZoneGrowthSystem so it can gate level 2→3 growth.

import type { World } from '../World';
import { ROAD_NONE, ZONE_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

/**
 * BFS coverage for a single service building placed at (tx, ty) of kind `kind`.
 * Returns the set of tile indices that would receive coverage.
 * Used by both ServiceSystem.update() and the renderer's hover preview.
 */
export function computeServiceCoverage(
  world: World,
  tx: number,
  ty: number,
  kind: number,
): Set<number> {
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  const range = BALANCE.service.coverageRange[kind] ?? 4;
  const covered = new Set<number>();

  // The building tile itself is always covered.
  covered.add(ty * width + tx);

  // Seed BFS from road tiles at or adjacent to the building.
  const visited = new Set<number>();
  const queue: Array<{ idx: number; dist: number }> = [];

  const seed = (stx: number, sty: number) => {
    if (stx < 0 || sty < 0 || stx >= width || sty >= height) return;
    const i = sty * width + stx;
    if (roadClass[i] === ROAD_NONE) return;
    if (visited.has(i)) return;
    visited.add(i);
    queue.push({ idx: i, dist: 0 });
  };
  seed(tx,     ty);
  seed(tx - 1, ty);
  seed(tx + 1, ty);
  seed(tx,     ty - 1);
  seed(tx,     ty + 1);

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
          covered.add(ny * width + nx);
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

export class ServiceSystem {
  update(world: World): void {
    const { width, height } = world.grid;
    const services = world.layers.services;
    const police = world.layers.police;
    services.fill(0);
    police.fill(0);

    for (const b of world.serviceBuildings) {
      for (const idx of computeServiceCoverage(world, b.tx, b.ty, b.kind)) {
        services[idx] = 1;
        if (b.kind === 4) { // BUILDING_POLICE
          police[idx] = 1;
        }
      }
    }

    // Count covered developed zones for HUD stat.
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    let covered = 0;
    for (let i = 0; i < width * height; i++) {
      if (zone[i] !== ZONE_NONE && dev[i] > 0 && services[i] === 1) covered++;
    }
    world.stats.servicesCoveredZones = covered;
  }
}
