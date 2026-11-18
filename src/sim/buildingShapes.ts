// The shape of each building kind: which tiles it stands on.
//
// A shape is a list of offsets (dx, dy) from the building's ANCHOR tile. The
// anchor is offset (0, 0), which every shape must contain, so the anchor is
// always a real tile of the building (an L's bounding-box corner may not be).
// A building's entity in world.buildings sits at its anchor.
//
// A kind with no entry here is one tile, as every building was before shapes
// existed. Square buildings are just a full block of offsets (see `block`);
// nothing requires a shape to be square or even convex.
//
// Each tile of a shape has a ROLE: 'body' stands on land, 'dock' stands on
// open water (see World.checkPlacement). Every tile is 'body' unless the
// shape says otherwise.
//
// A building can be ROTATED in quarter turns clockwise about its anchor
// (0–3), so a seaport can face water on any side. The rotation is saved on
// the building's entity; shapes here are written at rotation 0.
//
// The renderer imports this too: engine and graphics must agree on the anchor
// and the offsets.

import { BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_SEAPORT, TERRAIN_WATER } from './constants';

/** One tile of a shape, as an offset from the anchor. */
export type ShapeOffset = readonly [dx: number, dy: number];

/** What a tile of a shape stands on: 'body' on land, 'dock' on open water. */
export type PartRole = 'body' | 'dock';

const ONE_TILE: readonly ShapeOffset[] = [[0, 0]];
const ONE_BODY: readonly PartRole[] = ['body'];

const SHAPES = new Map<number, readonly ShapeOffset[]>();
const ROLES = new Map<number, readonly PartRole[]>();
const DOCKED = new Set<number>();
// Each kind's shape at rotations 1–3, worked out when first asked for.
const ROTATED = new Map<number, (readonly ShapeOffset[])[]>();

/**
 * The tiles a `kind` building stands on, as offsets from its anchor, turned
 * `rot` quarter turns clockwise about the anchor (0–3; the order of the tiles
 * does not change). One tile unless the kind has a shape.
 */
export function buildingShape(kind: number, rot = 0): readonly ShapeOffset[] {
  const shape = SHAPES.get(kind) ?? ONE_TILE;
  const r = rot & 3;
  if (r === 0 || shape.length === 1) return shape;
  let turned = ROTATED.get(kind);
  if (!turned) { turned = []; ROTATED.set(kind, turned); }
  // Screen coordinates (y grows downward): one quarter turn clockwise takes (dx, dy) to (−dy, dx).
  return turned[r] ??= shape.map(([dx, dy]) => (r === 1 ? [-dy, dx] : r === 2 ? [-dx, -dy] : [dy, -dx]) as ShapeOffset)
    .map(([dx, dy]) => [dx + 0, dy + 0] as const);   // + 0: no negative zeros
}

/** The role of each tile of a `kind` building, in the same order as buildingShape(kind). */
export function shapeRoles(kind: number): readonly PartRole[] {
  let roles = ROLES.get(kind);
  if (!roles) {
    // All body. Kept, so the same array comes back every time (callers key caches on it).
    const shape = SHAPES.get(kind);
    if (!shape) return ONE_BODY;
    roles = shape.map(() => 'body' as const);
    ROLES.set(kind, roles);
  }
  return roles;
}

/** Whether any tile of `kind` is a dock (stands on water). */
export function hasDocks(kind: number): boolean {
  return DOCKED.has(kind);
}

/** Whether `kind` stands on more than one tile. */
export function isLargeBuilding(kind: number): boolean {
  return buildingShape(kind).length > 1;
}

/**
 * Give `kind` a shape. Throws if the shape has no (0, 0) (the anchor), repeats
 * a tile or is not whole numbers. `roles` gives each tile's role in the same
 * order (all 'body' if left out); the anchor must be a body tile. Buildings
 * of this kind already standing are not touched: set shapes before any exist.
 */
export function setBuildingShape(kind: number, shape: readonly ShapeOffset[], roles?: readonly PartRole[]): void {
  const seen = new Set<string>();
  for (const [dx, dy] of shape) {
    if (!Number.isInteger(dx) || !Number.isInteger(dy)) throw new Error(`building shape for kind ${kind}: offsets must be whole numbers`);
    const key = `${dx},${dy}`;
    if (seen.has(key)) throw new Error(`building shape for kind ${kind}: tile ${key} is listed twice`);
    seen.add(key);
  }
  if (!seen.has('0,0')) throw new Error(`building shape for kind ${kind}: must include (0, 0), the anchor`);
  if (roles) {
    if (roles.length !== shape.length) throw new Error(`building shape for kind ${kind}: one role per tile`);
    if (roles[shape.findIndex(([dx, dy]) => dx === 0 && dy === 0)] !== 'body') throw new Error(`building shape for kind ${kind}: the anchor must be a body tile`);
  }
  SHAPES.set(kind, shape.map(([dx, dy]) => [dx, dy] as const));
  if (roles && roles.includes('dock')) { ROLES.set(kind, [...roles]); DOCKED.add(kind); } else { ROLES.delete(kind); DOCKED.delete(kind); }
  ROTATED.delete(kind);
}

/** Remove a kind's shape, making it one tile again. For tests. */
export function clearBuildingShape(kind: number): void {
  SHAPES.delete(kind);
  ROLES.delete(kind);
  DOCKED.delete(kind);
  ROTATED.delete(kind);
}

/** A full w × h block with the anchor at its top-left tile, row by row. */
export function block(w: number, h: number): ShapeOffset[] {
  const out: ShapeOffset[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([dx, dy]);
  return out;
}

// The kinds that have a shape. Everything else is one tile.
setBuildingShape(BUILDING_LARGE_POWER_PLANT, block(3, 3));
setBuildingShape(BUILDING_LARGE_WATER_PLANT, block(2, 2));
setBuildingShape(BUILDING_LARGE_SEWAGE_PLANT, block(2, 2));
// The seaport: a 4×3 yard on land (anchor at its top-left) and, at rotation 0,
// a row of four docks along its north side, out over the water.
{
  const yard = block(4, 3), docks: ShapeOffset[] = [[0, -1], [1, -1], [2, -1], [3, -1]];
  setBuildingShape(BUILDING_SEAPORT, [...yard, ...docks], [...yard.map(() => 'body' as const), ...docks.map(() => 'dock' as const)]);
}

// ── Where a kind may stand ───────────────────────────────────────────────────

/** Extra conditions a kind puts on where it can be placed. A kind with none can go on any free land. */
export interface PlacementRules {
  /**
   * The building must stand at the water's edge: at least one tile just
   * outside its shape (sharing an edge with it) is water. The building itself
   * still stands on land. For a pump now, a seaport later.
   */
  needsWaterEdge?: boolean;
}

const NO_RULES: PlacementRules = {};
const RULES = new Map<number, PlacementRules>();

/** The extra placement conditions of `kind` (none for most kinds). */
export function placementRules(kind: number): PlacementRules {
  return RULES.get(kind) ?? NO_RULES;
}

/** Set a kind's placement conditions; `{}` or no argument removes them. Buildings already standing are not touched. */
export function setPlacementRules(kind: number, rules: PlacementRules = {}): void {
  if (Object.keys(rules).length === 0) RULES.delete(kind); else RULES.set(kind, { ...rules });
}

// The large water plant is a pump: it draws from open water.
setPlacementRules(BUILDING_LARGE_WATER_PLANT, { needsWaterEdge: true });

/**
 * Tile indices a `kind` building anchored at (tx, ty) and turned `rot`
 * quarter turns would stand on, in the shape's order (the anchor is wherever
 * (0, 0) is listed), or null if any of them is off the map.
 */
export function footprintTiles(width: number, height: number, tx: number, ty: number, kind: number, rot = 0): number[] | null {
  const shape = buildingShape(kind, rot);
  const out = new Array<number>(shape.length);
  for (let k = 0; k < shape.length; k++) {
    const x = tx + shape[k][0], y = ty + shape[k][1];
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    out[k] = y * width + x;
  }
  return out;
}

/**
 * The tiles just outside a footprint: every tile that shares an edge with a
 * footprint tile and is not itself part of it, each once. For each footprint
 * tile in order, its west, east, north and south neighbour — so for a
 * one-tile building this is exactly its four neighbours, in that order. A
 * building is connected if one of these is a street or avenue.
 */
export function footprintEdge(width: number, height: number, tiles: readonly number[]): number[] {
  const out: number[] = [];
  const add = (i: number) => { if (!tiles.includes(i) && !out.includes(i)) out.push(i); };
  for (const i of tiles) {
    const x = i % width;
    if (x > 0) add(i - 1);
    if (x < width - 1) add(i + 1);
    if (i >= width) add(i - width);
    if (i < width * (height - 1)) add(i + width);
  }
  return out;
}

/**
 * Whether a building of `kind` standing on `tiles` has the water it needs:
 * true for kinds with no such need; for the others (the large water plant),
 * whether any tile along its edge is water in `terrain`. Checked when it is
 * placed and again every time it supplies, since the player can move water.
 */
export function hasNeededWater(kind: number, tiles: readonly number[], terrain: Uint8Array, width: number, height: number): boolean {
  if (!placementRules(kind).needsWaterEdge) return true;
  for (const i of footprintEdge(width, height, tiles)) if (terrain[i] === TERRAIN_WATER) return true;
  return false;
}
