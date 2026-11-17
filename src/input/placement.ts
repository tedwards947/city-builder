// Where a building would go for a pointer position: its anchor and, for a
// kind that can be turned (the seaport), which way it faces.
//
// The pointer holds the middle of the footprint. A kind with docks turns by
// itself to the first way it fits, starting from the player's own turn (the
// turn key adds a quarter turn), so its docks swing toward open water as the
// pointer nears a shore. If it fits no way, the way with the fewest problem
// tiles shows, so the preview can say what is wrong.

import type { World, PlacementCheck } from '../sim/World';
import { buildingShape, hasDocks } from '../sim/buildingShapes';

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
  return c.offMap ? 1e9 : c.blocked.length + c.notOpenWater.length + (c.noWater ? 1 : 0);
}

let memo: { world: World; edits: number; key: string; value: Placement } | null = null;

/** Where a `kind` building held at (tx, ty) would go, and whether it can. */
export function placementFor(world: World, kind: number, tx: number, ty: number): Placement {
  const key = kind + ':' + tx + ':' + ty + ':' + turn;
  if (memo && memo.world === world && memo.edits === world.grid.edits && memo.key === key) return memo.value;
  let best: Placement | null = null, bestScore = Infinity;
  const turns = hasDocks(kind) ? 4 : 1;
  for (let k = 0; k < turns; k++) {
    const rot = turns === 1 ? 0 : (turn + k) & 3;
    const a = placementAnchor(kind, tx, ty, rot);
    const check = world.checkPlacement(a.tx, a.ty, kind, rot);
    const score = placementScore(check);
    if (score < bestScore) { bestScore = score; best = { tx: a.tx, ty: a.ty, rot, check }; }
    if (score === 0) break;
  }
  memo = { world, edits: world.grid.edits, key, value: best! };
  return best!;
}
