// What a service building (park, police, fire, school, hospital) is worth to
// the residents it covers, in political capital. One rule prices both ends:
//   - opening one earns the total value residents gain;
//   - closing one costs the total value they lose. Residents it leaves with
//     no building of that kind at all count times a multiplier of at least 1:
//     a closure that strands people hurts, and building and bulldozing cannot
//     be farmed. Residents still covered by another lose only what this one
//     was worth to them, with no multiplier.
// Each resident values each further building of the same kind covering them
// less than the one before (the first park matters a lot, a second nearby one
// less). So moving a service is cheap: opening the new one beside the old
// earns the reduced value, closing the old one then costs that same reduced
// value back, and only the homes the move leaves behind are charged in full.
//
// "Covers" is the simulation's own coverage (computeServiceCoverage: along
// streets and avenues out to the kind's range), so the reward matches the
// coverage preview the player already sees.
//
// Kinds with a capacity (schools and hospitals once BALANCE.service.capacity
// is set; see sim/serviceCapacity.ts) are priced by seats instead, with no
// repeat discount:
//   - a home that gains a seat because of the building earns its value;
//   - a home that loses its seat costs its value times the closure multiplier;
//   - a home that only moves to another building costs and earns nothing.
// So a second school over homes that already have seats earns nothing, one
// that relieves a full school earns for the overflow it seats, moving stays
// cheap, and closing the only hospital costs the whole city. Opening and
// closing price the same two seatings from either side, so a loop never
// comes out ahead while the multiplier is at least 1.
//
// Pure: reads the world, changes nothing. Coverage of the buildings already
// standing is remembered until the map next changes, so pricing a hover every
// frame walks the roads once for the hovered tile and no more.

import type { World } from './World';
import { ZONE_R, ROAD_NONE, ROAD_HIGHWAY } from './constants';
import { BALANCE } from '../data/balance';
import { computeServiceCoverage } from './systems/ServiceSystem';
import { footprintTiles, footprintEdge } from './buildingShapes';
import { hasCapacity, seatsIfOpened, seatsIfClosed, type SeatChange } from './serviceCapacity';

export interface ServiceValueConfig {
  /**
   * PC per resident for the first building of a kind that covers them, by
   * building kind. Missing or 0 = that kind earns and costs nothing.
   */
  perResident: Readonly<Record<number, number>>;
  /**
   * Each further building of the same kind covering a resident is worth this
   * fraction of the one before (0–1). 0.5: the second is worth half, the
   * third a quarter.
   */
  repeatFactor: number;
  /**
   * Closing costs this many times the value lost by residents left with no
   * building of the kind (at least 1). Residents another building still
   * covers are charged their loss once.
   */
  closureMultiplier: number;
}

/** One home's share of a service building's value. */
export interface ServiceValuePart {
  tx: number;
  ty: number;
  /** PC this home contributes: positive for an opening, negative for a closure. */
  amount: number;
  /** How much this building matters to the home, 0–1: 1 if it is their only one of its kind. */
  strength: number;
}

interface KindCoverage {
  edits: number;
  range: number;
  /** How many standing buildings of the kind cover each tile. */
  counts: Map<number, number>;
  /** Each standing building's own coverage, by its tile index. */
  own: Map<number, Int32Array>;
}

const cache = new WeakMap<World, Map<number, KindCoverage>>();

/** Coverage of every standing building of `kind`, remembered until the map changes. */
function kindCoverage(world: World, kind: number): KindCoverage {
  let byKind = cache.get(world);
  if (!byKind) { byKind = new Map(); cache.set(world, byKind); }
  const range = BALANCE.service.coverageRange[kind] ?? -1;
  const have = byKind.get(kind);
  if (have && have.edits === world.grid.edits && have.range === range) return have;

  const counts = new Map<number, number>();
  const own = new Map<number, Int32Array>();
  for (const b of world.buildings) {
    if (b.kind !== kind) continue;
    const tiles = Int32Array.from(computeServiceCoverage(world, b.tx, b.ty, kind));
    own.set(world.grid.idx(b.tx, b.ty), tiles);
    for (let k = 0; k < tiles.length; k++) counts.set(tiles[k], (counts.get(tiles[k]) ?? 0) + 1);
  }
  const fresh = { edits: world.grid.edits, range, counts, own };
  byKind.set(kind, fresh);
  return fresh;
}

/**
 * How many standing buildings of `kind` cover each tile (tile index → count;
 * a tile that is not covered is absent). The simulation's own coverage, along
 * streets and avenues, so anything that asks "is this home served?" agrees
 * with the coverage preview. Remembered until the map next changes: do not
 * keep the map across ticks, ask again.
 */
export function coveredBy(world: World, kind: number): ReadonlyMap<number, number> {
  return kindCoverage(world, kind).counts;
}

/** What a service building of `kind` placed at (tx, ty) would reach. */
export interface ServiceReach {
  /**
   * Whether the spot touches a street or avenue. If not, the building is not
   * connected: it serves only its own tile, which is to say nobody. A highway
   * does not count.
   */
  touchesRoad: boolean;
  /** Occupied homes it would cover. */
  homesCovered: number;
}

/** Whether (tx, ty) or one of its four neighbours is a street or avenue: what a service building needs to reach anyone. */
export function touchesAccessRoad(world: World, tx: number, ty: number): boolean {
  const { grid, layers } = world;
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const x = tx + dx, y = ty + dy;
    if (!grid.inBounds(x, y)) continue;
    const rc = layers.roadClass[grid.idx(x, y)];
    if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) return true;
  }
  return false;
}

/** Whether a street or avenue runs along the edge of a building standing on `tiles` (its whole shape). */
export function shapeTouchesAccessRoad(world: World, tiles: readonly number[]): boolean {
  const roadClass = world.layers.roadClass;
  for (const i of footprintEdge(world.grid.width, world.grid.height, tiles)) {
    if (roadClass[i] !== ROAD_NONE && roadClass[i] !== ROAD_HIGHWAY) return true;
  }
  return false;
}

/** What a `kind` building anchored at (tx, ty) would reach, for a placement warning or an inspect line. */
export function serviceReach(world: World, tx: number, ty: number, kind: number): ServiceReach {
  let homesCovered = 0;
  for (const i of computeServiceCoverage(world, tx, ty, kind)) if (residentsAt(world, i) > 0) homesCovered++;
  const tiles = footprintTiles(world.grid.width, world.grid.height, tx, ty, kind);
  const touchesRoad = tiles && tiles.length > 1 ? shapeTouchesAccessRoad(world, tiles) : touchesAccessRoad(world, tx, ty);
  return { touchesRoad, homesCovered };
}

/**
 * The occupied homes a `kind` building standing at (tx, ty) would serve, as
 * tile indices: every developed, lived-in home within the kind's range in
 * road steps, by the same walk along streets and avenues that coverage uses.
 * (tx, ty) may itself be a home, e.g. the seed of a neighbourhood: the result
 * is then "the homes one building beside this home could serve", the seed
 * included if a road reaches it. Bounded by the range, never a map scan.
 * `range` overrides the kind's range (in road steps).
 */
export function homesWithinReach(world: World, tx: number, ty: number, kind: number, range?: number): number[] {
  const homes: number[] = [];
  for (const i of computeServiceCoverage(world, tx, ty, kind, range)) if (residentsAt(world, i) > 0) homes.push(i);
  return homes;
}

/** Whether `kind` is a building that serves homes by coverage (police, fire, school, hospital, park). */
export function isServiceKind(kind: number): boolean {
  return BALANCE.service.coverageRange[kind] !== undefined;
}

/**
 * What a building of `kind` costs to keep up per tick: its `maintenance` in
 * the balance table, times `maintenance.serviceMult` for a service building.
 * The one figure the budget charges and the UI shows.
 */
export function buildingUpkeep(kind: number): number {
  const m = BALANCE.buildings[kind]?.maintenance ?? 0;
  return isServiceKind(kind) ? m * BALANCE.maintenance.serviceMult : m;
}

/** Residents of an occupied, non-abandoned home on tile `i`; 0 for anything else. */
function residentsAt(world: World, i: number): number {
  const { zone, devLevel, abandoned } = world.layers;
  if (zone[i] !== ZONE_R || devLevel[i] === 0 || abandoned[i] !== 0) return 0;
  return BALANCE.growth.popPerLevel[devLevel[i]] ?? 0;
}

/** Parts for a change of seats: homes that gain one earn, homes that lose one cost `closureMultiplier` times as much. */
function seatParts(world: World, change: SeatChange, rate: number, cfg: ServiceValueConfig): ServiceValuePart[] {
  const parts: ServiceValuePart[] = [];
  const width = world.grid.width;
  for (const i of change.gained) {
    parts.push({ tx: i % width, ty: (i - (i % width)) / width, amount: residentsAt(world, i) * rate, strength: 1 });
  }
  for (const i of change.lost) {
    parts.push({ tx: i % width, ty: (i - (i % width)) / width, amount: -residentsAt(world, i) * rate * cfg.closureMultiplier, strength: 1 });
  }
  return parts;
}

/**
 * What opening a `kind` building at (tx, ty) would earn: one part per home it
 * would cover (for a kind with a capacity, per home whose seat it changes).
 * Empty if the kind has no value set.
 */
export function serviceOpeningValue(
  world: World, tx: number, ty: number, kind: number,
  cfg: ServiceValueConfig = BALANCE.politicalCapital.service,
): ServiceValuePart[] {
  const rate = cfg.perResident[kind] ?? 0;
  if (rate <= 0) return [];
  if (hasCapacity(kind)) return seatParts(world, seatsIfOpened(world, tx, ty, kind), rate, cfg);
  const parts: ServiceValuePart[] = [];
  const { counts } = kindCoverage(world, kind);
  const width = world.grid.width;
  for (const i of computeServiceCoverage(world, tx, ty, kind)) {
    const pop = residentsAt(world, i);
    if (pop === 0) continue;
    const strength = cfg.repeatFactor ** (counts.get(i) ?? 0);
    const amount = pop * rate * strength;
    if (amount > 0) parts.push({ tx: i % width, ty: (i - (i % width)) / width, amount, strength });
  }
  return parts;
}

/**
 * What closing the service building standing at (tx, ty) would cost: one part
 * per home it covers. A home it is the only one of its kind for is charged
 * `closureMultiplier` times its value; a home another still covers, its
 * reduced value once. Empty if there is no service building there or its kind
 * has no value set.
 */
export function serviceClosureValue(
  world: World, tx: number, ty: number,
  cfg: ServiceValueConfig = BALANCE.politicalCapital.service,
): ServiceValuePart[] {
  if (!world.grid.inBounds(tx, ty)) return [];
  // Any tile of the building will do: its coverage is kept under its anchor.
  const at = world.buildingAnchorAt(world.grid.idx(tx, ty));
  if (at < 0) return [];
  const kind = world.layers.building[at];
  const rate = cfg.perResident[kind] ?? 0;
  if (rate <= 0) return [];
  if (hasCapacity(kind)) return seatParts(world, seatsIfClosed(world, at, kind), rate, cfg);
  const { counts, own } = kindCoverage(world, kind);
  const tiles = own.get(at);
  if (!tiles) return [];
  const parts: ServiceValuePart[] = [];
  const width = world.grid.width;
  for (let k = 0; k < tiles.length; k++) {
    const i = tiles[k];
    const pop = residentsAt(world, i);
    if (pop === 0) continue;
    const others = (counts.get(i) ?? 1) - 1;
    const strength = cfg.repeatFactor ** others;
    // The multiplier is for residents this leaves with nothing of the kind.
    const amount = pop * rate * strength * (others === 0 ? cfg.closureMultiplier : 1);
    if (amount > 0) parts.push({ tx: i % width, ty: (i - (i % width)) / width, amount: -amount, strength });
  }
  return parts;
}
