// Where a building would go for a pointer position: its anchor and, for a
// kind that can be turned (the seaport), which way it faces.
//
// The pointer holds the middle of the footprint. A kind with docks turns by
// itself to the first way it fits, starting from the player's own turn (the
// turn key adds a quarter turn), so its docks swing toward open water as the
// pointer nears a shore. If it fits no way, the way with the fewest problem
// tiles shows, so the preview can say what is wrong. A train station, a ramp
// and a subway station turn the same way, preferring a way that joins track.

import type { World, PlacementCheck } from '../sim/World';
import { buildingShape, hasDocks, hasPlatforms, placementRules, platformEnds, platformLevel, rampLevel, shapeRoles, stationPlatform } from '../sim/buildingShapes';
import { RAIL_GROUND } from '../sim/constants';

/** The anchor that puts the middle of a `kind` building (turned `rot`) on (tx, ty). Odd sizes centre; even sizes take the top-left of the middle four. */
export function placementAnchor(kind: number, tx: number, ty: number, rot = 0): { tx: number; ty: number } {
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const [dx, dy] of buildingShape(kind, rot)) { if (dx < minX) minX = dx; if (dx > maxX) maxX = dx; if (dy < minY) minY = dy; if (dy > maxY) maxY = dy; }
  return { tx: tx - (minX + ((maxX - minX) >> 1)), ty: ty - (minY + ((maxY - minY) >> 1)) };
}

let turn = 0;
/** The turn key: start the search a quarter turn further round. */
export function cyclePlacementTurn(): void { turn = (turn + 1) & 3; }
export function resetPlacementTurn(): void { turn = 0; }
export function placementTurn(): number { return turn; }

export interface Placement {
  /** The anchor tile. */
  tx: number; ty: number;
  rot: number;
  check: PlacementCheck;
}

/** How badly a placement fails: 0 when it fits. Same count as the engine's suggestRotation. */
export function placementScore(c: PlacementCheck): number {
  if (c.ok) return 0;
  return c.offMap ? 1e9 : c.blocked.length + c.notOpenWater.length + (c.noWater ? 1 : 0) + (c.alreadyBuilt ? 1 : 0);
}

/**
 * Whether a `kind` building anchored at (tx, ty) and turned `rot` would join
 * track that is already there:
 *   a train station: track of its level (ground, or elevated for the elevated station) straight on from an end of its platform;
 *   a ramp: ground track straight out of its low end, or track of its own
 *     level straight out of (or already on) its high end;
 *   a subway or elevated station: track of its level along its platform (two tiles or more) or straight on from an end.
 */
export function meetsTrack(world: World, kind: number, tx: number, ty: number, rot: number): boolean {
  const rail = world.layers.rail;
  const has = (dx: number, dy: number, level = RAIL_GROUND) => world.grid.inBounds(tx + dx, ty + dy) && (rail[world.grid.idx(tx + dx, ty + dy)] & level) !== 0;
  const level = rampLevel(kind);
  if (level !== 0) {
    const [dx, dy] = buildingShape(kind, rot)[1];
    return has(-dx, -dy) || has(2 * dx, 2 * dy, level) || has(dx, dy, level);
  }
  const under = stationPlatform(kind, rot);
  if (under.length > 0) {
    const lv = platformLevel(kind);
    const [ax, ay] = under[0], [bx, by] = under[under.length - 1], sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    // Along a line (two or more of its tiles), not merely across one.
    return under.filter(([dx, dy]) => has(dx, dy, lv)).length >= 2 || has(ax - sx, ay - sy, lv) || has(bx + sx, by + sy, lv);
  }
  return platformEnds(kind, rot).some(([dx, dy]) => has(dx, dy, platformLevel(kind)));
}

let memo: { world: World; edits: number; key: string; value: Placement } | null = null;

/** Where a `kind` building held at (tx, ty) would go, and whether it can. */
export function placementFor(world: World, kind: number, tx: number, ty: number): Placement {
  const key = kind + ':' + tx + ':' + ty + ':' + turn;
  if (memo && memo.world === world && memo.edits === world.grid.edits && memo.key === key) return memo.value;
  let best: Placement | null = null, bestScore = Infinity;
  // A station, a ramp and a subway station turn to meet track.
  const twoWay = placementRules(kind).twoWay === true;
  const station = hasPlatforms(kind);
  const overhead = !twoWay && stationPlatform(kind, 0).length > 0;   // the elevated station: its platform is beside its entrance
  const joins = station || rampLevel(kind) !== 0 || twoWay || overhead;
  const turns = twoWay ? 2 : hasDocks(kind) || joins ? 4 : 1;
  for (let k = 0; k < turns; k++) {
    const rot = turns === 1 ? 0 : twoWay ? (turn + k) & 1 : (turn + k) & 3;
    // The pointer holds the middle of the footprint. A station is also tried with each
    // platform tile under the pointer, so pointing at a line puts the platform on it.
    const anchors = [placementAnchor(kind, tx, ty, rot)];
    if (station) {
      const shape = buildingShape(kind, rot), roles = shapeRoles(kind);
      shape.forEach(([dx, dy], n) => { if (roles[n] === 'platform') anchors.push({ tx: tx - dx, ty: ty - dy }); });
    }
    // An elevated station too: pointing at a line (or a street) puts the platform over it, the entrance beside.
    if (overhead) for (const [dx, dy] of stationPlatform(kind, rot)) anchors.push({ tx: tx - dx, ty: ty - dy });
    for (const a of anchors) {
      const check = world.checkPlacement(a.tx, a.ty, kind, rot);
      // A station prefers the first way that fits AND meets track; failing that, the first way that fits.
      const score = placementScore(check) + (joins && !meetsTrack(world, kind, a.tx, a.ty, rot) ? 0.5 : 0);
      if (score < bestScore) { bestScore = score; best = { tx: a.tx, ty: a.ty, rot, check }; }
      if (score === 0) break;
    }
    if (bestScore === 0) break;
  }
  memo = { world, edits: world.grid.edits, key, value: best! };
  return best!;
}
