// Auto road mode: click a start tile, move the pointer, click an end tile, and
// the road between them is built in one go. This file is the pure part: which
// tiles the road takes, and what building them would cost.
//
// The route is a right-angled "L": along the longer axis first, then the
// shorter one. It does not avoid obstacles; tiles that cannot take a road
// (buildings) are skipped, exactly as a manual drag over them would be.

import type { World } from '../sim/World';
import { roadBuildCost } from '../commands/BuildRoadCommand';
import { tilesBetween } from './dragPath';
import type { TilePos } from './dragPath';

/** Tiles of the L-shaped route from `start` to `end`, both ends included, in order, no tile twice. */
export function autoRoadPath(start: TilePos, end: TilePos): TilePos[] {
  const dx = Math.abs(end.tx - start.tx);
  const dy = Math.abs(end.ty - start.ty);
  // Longer leg first (x on a tie), so the corner sits near the end of the road.
  const corner: TilePos = dx >= dy
    ? { tx: end.tx, ty: start.ty }
    : { tx: start.tx, ty: end.ty };
  const first = tilesBetween(start, corner);
  const second = tilesBetween(corner, end);
  return first.concat(second.slice(1));
}

export interface AutoRoadPlan {
  /** Every tile of the route, in order. */
  tiles: TilePos[];
  /** Money needed to build it (new road, upgrades and bridges; tiles needing nothing cost nothing). */
  cost: number;
  /** Tiles that will get new or upgraded road. */
  buildCount: number;
  /** Tiles a road cannot go on (a building, or off the map); they are skipped. */
  blockedCount: number;
  /** Whether the city has the money for it right now. */
  affordable: boolean;
}

/** What building `tiles` as `roadClass` would do and cost. Reads the world, changes nothing. */
export function planAutoRoad(world: World, tiles: TilePos[], roadClass: number): AutoRoadPlan {
  let cost = 0, buildCount = 0, blockedCount = 0;
  for (const { tx, ty } of tiles) {
    const c = roadBuildCost(world, tx, ty, roadClass);
    if (c === null) blockedCount++;
    else if (c > 0) { cost += c; buildCount++; }
  }
  return { tiles, cost, buildCount, blockedCount, affordable: world.budget.money >= cost };
}
