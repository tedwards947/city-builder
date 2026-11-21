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
// open water (see World.checkPlacement), 'frontage' stands on land and is
// where the building meets the road: a kind with frontage tiles is entered
// only from roads beside those (World.buildingAccessRoads). Every tile is
// 'body' unless the shape says otherwise. 'platform' stands on land and
// carries rail track (a train station's platform): it may be placed over
// ground track already there, track joins it at its two ends (sim/rail.ts),
// and no other track of its level may run beside it. Roads beside it reach
// the building.
//
// A building can be ROTATED in quarter turns clockwise about its anchor
// (0–3), so a seaport can face water on any side. The rotation is saved on
// the building's entity; shapes here are written at rotation 0.
//
// The renderer imports this too: engine and graphics must agree on the anchor
// and the offsets.

import { BALANCE } from '../data/balance';
import { BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_SEAPORT, BUILDING_AIRPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, BUILDING_SUBWAY_STATION, BUILDING_BIG_PARK, BUILDING_BEACH_PARK, BUILDING_PLAZA, BUILDING_MUSEUM, BUILDING_STADIUM, BUILDING_MID_PARK, BUILDING_LIDO, RAIL_ELEVATED, RAIL_SUBWAY, TERRAIN_WATER } from './constants';

/** One tile of a shape, as an offset from the anchor. */
export type ShapeOffset = readonly [dx: number, dy: number];

/**
 * What a tile of a shape is: 'body' on land, 'dock' on open water, 'frontage' on land where the building meets the road,
 * 'platform' on land with rail track through it, 'rampLow' the ground-track end of a ramp and 'rampHigh' its elevated or subway end.
 * 'runway' and 'apron' are land like 'body': the Fire Headquarters' strip and its tarmac, told apart for the art only.
 */
export type PartRole = 'body' | 'dock' | 'frontage' | 'platform' | 'rampLow' | 'rampHigh' | 'runway' | 'apron';

const ONE_TILE: readonly ShapeOffset[] = [[0, 0]];
const ONE_BODY: readonly PartRole[] = ['body'];

const RULES = new Map<number, PlacementRules>();
const SHAPES = new Map<number, readonly ShapeOffset[]>();
const ROLES = new Map<number, readonly PartRole[]>();
const DOCKED = new Set<number>();
const PLATFORMED = new Set<number>();
// Each kind's shape at rotations 1–3, worked out when first asked for.
const ROTATED = new Map<number, (readonly ShapeOffset[])[]>();

/**
 * The tiles a `kind` building stands on, as offsets from its anchor, turned
 * `rot` quarter turns clockwise about the anchor (0–3; the order of the tiles
 * does not change). One tile unless the kind has a shape. A kind that is
 * never turned (placement rule `noRotation`) has the same shape at every `rot`.
 */
export function buildingShape(kind: number, rot = 0): readonly ShapeOffset[] {
  const shape = SHAPES.get(kind) ?? ONE_TILE;
  const r = rot & 3;
  if (r === 0 || shape.length === 1 || RULES.get(kind)?.noRotation) return shape;
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

/** Whether any tile of `kind` is a platform (carries rail track): a train station. */
export function hasPlatforms(kind: number): boolean {
  return PLATFORMED.has(kind);
}

/**
 * Where track joins a `kind` building turned `rot`: for each end of its
 * platform (a platform tile with one platform neighbour), the offset of the
 * tile just outside it, straight on. Empty for a kind with no platform.
 */
export function platformEnds(kind: number, rot = 0): ShapeOffset[] {
  if (!PLATFORMED.has(kind)) return [];
  const shape = buildingShape(kind, rot), roles = shapeRoles(kind);
  const platform = shape.filter((_, k) => roles[k] === 'platform');
  const out: ShapeOffset[] = [];
  for (const [x, y] of platform) {
    const beside = platform.filter(([px, py]) => Math.abs(px - x) + Math.abs(py - y) === 1);
    if (beside.length === 1) out.push([2 * x - beside[0][0], 2 * y - beside[0][1]]);
  }
  return out;
}

/**
 * The tiles BESIDE the platform of a `kind` building turned `rot`, as offsets
 * from its anchor: every tile that touches a platform tile side-on, that is,
 * a neighbour of a platform tile that is neither part of the building nor
 * straight on from a platform end. No track of the platform's level may be
 * there (ground track for a train station, subway track for a subway
 * station). Empty for a kind with no platform.
 */
export function platformSides(kind: number, rot = 0): ShapeOffset[] {
  const under = subwayPlatform(kind, rot);
  const shape = under.length > 0 ? under : buildingShape(kind, rot);
  const roles = under.length > 0 ? null : shapeRoles(kind);
  if (roles && !PLATFORMED.has(kind)) return [];
  const platform = shape.filter((_, k) => !roles || roles[k] === 'platform');
  const ends = under.length > 0
    ? [[2 * under[0][0], 2 * under[0][1]], [2 * under[2][0], 2 * under[2][1]]]
    : platformEnds(kind, rot);
  const taken = new Set([...shape, ...ends].map(([x, y]) => `${x},${y}`));
  const out: ShapeOffset[] = [];
  for (const [x, y] of platform) {
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      const key = `${nx},${ny}`;
      if (taken.has(key)) continue;
      taken.add(key);
      out.push([nx, ny]);
    }
  }
  return out;
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
    const anchorRole = roles[shape.findIndex(([dx, dy]) => dx === 0 && dy === 0)];
    if (anchorRole === 'dock' || anchorRole === 'rampHigh') throw new Error(`building shape for kind ${kind}: the anchor must stand on the ground (not a dock or a ramp's high end)`);
  }
  SHAPES.set(kind, shape.map(([dx, dy]) => [dx, dy] as const));
  if (roles && roles.some((r) => r !== 'body')) ROLES.set(kind, [...roles]); else ROLES.delete(kind);
  if (roles && roles.includes('dock')) DOCKED.add(kind); else DOCKED.delete(kind);
  if (roles && roles.includes('platform')) PLATFORMED.add(kind); else PLATFORMED.delete(kind);
  ROTATED.delete(kind);
}

/** Remove a kind's shape, making it one tile again. For tests. */
export function clearBuildingShape(kind: number): void {
  SHAPES.delete(kind);
  ROLES.delete(kind);
  DOCKED.delete(kind);
  PLATFORMED.delete(kind);
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
// The airport: a 12×4 block, anchor at its top-left, over a runway row that
// runs 3 tiles past it at each end (18 tiles, the owner asked for a longer
// runway overrunning the terminal block). Rows from the north: terminal, tower
// and hangar (dy 0–1), apron and gates (dy 2–3), runway (dy 4, dx −3 to 14).
// The terminal's frontage is the north edge at dx 2–9: only roads along it
// reach the airport. The art has one facing, so it is never turned.
{
  const shape: ShapeOffset[] = [...block(12, 4), ...Array.from({ length: 18 }, (_, k): ShapeOffset => [k - 3, 4])];
  setBuildingShape(BUILDING_AIRPORT, shape, shape.map(([dx, dy]) => (dy === 0 && dx >= 2 && dx <= 9 ? 'frontage' : 'body')));
}
// Leisure (LEISURE_DESIGN.md). All blocks with the anchor at the top-left,
// every tile 'body': a road beside any tile reaches the building, so the
// player can spread a crowd over several sides. The stadium is a 4×4 bowl with
// a two-tile entrance plaza below the middle of its south side.
setBuildingShape(BUILDING_BIG_PARK, block(3, 3));
setBuildingShape(BUILDING_MID_PARK, block(2, 2));
setBuildingShape(BUILDING_BEACH_PARK, block(3, 2));
setBuildingShape(BUILDING_LIDO, block(3, 2));
setBuildingShape(BUILDING_PLAZA, block(2, 2));
setBuildingShape(BUILDING_MUSEUM, block(2, 2));
setBuildingShape(BUILDING_STADIUM, [...block(4, 4), [1, 4], [2, 4]]);
// Capstones (CAPSTONE_DESIGN.md): plain blocks of the size in BALANCE.capstones.kinds, read once here.
// The Fire Headquarters (graphics, 2026-11-21): the row dy = 0 is its runway, the last four columns below it
// the hangar and station, and the rest of the block tarmac. It is entered from any street or avenue beside it.
for (const kind in BALANCE.capstones.kinds) {
  const row = BALANCE.capstones.kinds[kind];
  const w = Math.max(1, row.size[0]), h = Math.max(1, row.size[1]);
  const shape = block(w, h);
  setBuildingShape(Number(kind), shape, row.need === 'fire' ? shape.map(([dx, dy]): PartRole => (dy === 0 ? 'runway' : dx >= w - 4 ? 'body' : 'apron')) : undefined);
}
// The train stations (RAIL_DESIGN.md; resized by the owner, TODO "station
// resize"). STRAIGHT: three tiles in a row, ALL platform, the anchor at one
// end; at rotation 0 they run east from the anchor, and track joins straight
// on at the west and east ends. Its station house is only drawn (beside the
// track, inside the row), so it takes no tile. CURVED: a 2×2 block, anchor at
// its top-left, which is the station house (the one body tile); the track
// comes in from the west along the bottom row, turns on (1, 1) and leaves to
// the north, so the platform is (0, 1), (1, 1), (1, 0), listed in that order
// so that the middle one is the corner. Both turn four ways. A road beside
// any tile of a station reaches it. No track of the same level may run
// beside a platform (platformSides).
setBuildingShape(BUILDING_STATION, [[0, 0], [1, 0], [2, 0]], ['platform', 'platform', 'platform']);
setBuildingShape(BUILDING_STATION_L, [[0, 0], [0, 1], [1, 1], [1, 0]], ['body', 'platform', 'platform', 'platform']);

// The ramps (RAIL_DESIGN.md): 2×1, the anchor is the GROUND end and (1, 0) at
// rotation 0 the high (elevated) or deep (subway) end. Ground track joins the
// low end straight on from outside, and the other level joins the high end
// straight on from outside; the ramp itself joins the two (sim/rail.ts).
for (const kind of [BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY]) {
  setBuildingShape(kind, [[0, 0], [1, 0]], ['rampLow', 'rampHigh']);
}
// The subway station: its shape is the one-tile entrance. Its platform is underground (subwayPlatform).
setPlacementRules(BUILDING_SUBWAY_STATION, { twoWay: true });

/** The level a ramp of `kind` climbs or dives to from the ground (RAIL_ELEVATED or RAIL_SUBWAY); 0 if `kind` is no ramp. */
export function rampLevel(kind: number): number {
  return kind === BUILDING_RAMP_ELEVATED ? RAIL_ELEVATED : kind === BUILDING_RAMP_SUBWAY ? RAIL_SUBWAY : 0;
}

const SUBWAY_PLATFORM: readonly (readonly ShapeOffset[])[] = [
  [[-1, 0], [0, 0], [1, 0]],
  [[0, -1], [0, 0], [0, 1]],
];
const NO_TILES: readonly ShapeOffset[] = [];

/**
 * The underground platform of a subway station, as offsets from its entrance
 * (the anchor): three tiles in a row, the entrance over the middle one,
 * west–east at rotation 0 and north–south at rotation 1. They carry subway track. Empty
 * for any other kind.
 */
export function subwayPlatform(kind: number, rot = 0): readonly ShapeOffset[] {
  return kind === BUILDING_SUBWAY_STATION ? SUBWAY_PLATFORM[rot & 1] : NO_TILES;
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
  /** The kind has one facing: it is placed at rotation 0 whatever is asked for. */
  noRotation?: boolean;
  /** A city may have only one: it cannot be placed while another stands. */
  onePerCity?: boolean;
  /** The kind has two facings only: its rotation is 0 or 1 (the subway station's platform). */
  twoWay?: boolean;
}

const NO_RULES: PlacementRules = {};

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
setPlacementRules(BUILDING_AIRPORT, { noRotation: true, onePerCity: true });
// Leisure: the beach park stands at the water's edge and can be turned to face it; the rest have one facing.
setPlacementRules(BUILDING_BIG_PARK, { noRotation: true });
setPlacementRules(BUILDING_MID_PARK, { noRotation: true });
setPlacementRules(BUILDING_BEACH_PARK, { needsWaterEdge: true });
setPlacementRules(BUILDING_LIDO, { needsWaterEdge: true });
setPlacementRules(BUILDING_PLAZA, { noRotation: true });
setPlacementRules(BUILDING_MUSEUM, { noRotation: true, onePerCity: true });
setPlacementRules(BUILDING_STADIUM, { noRotation: true, onePerCity: true });
// Capstones: one of each per city, each with one facing (their art has one, like the airport's); the Waterworks is a pump and stands beside water.
for (const kind in BALANCE.capstones.kinds) {
  const row = BALANCE.capstones.kinds[kind];
  setPlacementRules(Number(kind), { onePerCity: true, noRotation: true, ...(row.need === 'water' ? { needsWaterEdge: true } : {}) });
}

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
