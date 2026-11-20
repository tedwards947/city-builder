// Leisure in the traffic system (LEISURE_DESIGN.md): the `leisure` market.
//
//   WHO GOES   Homes send leisure trips (BALANCE.leisure.tripsPerLevel per
//              level). TOURISTS arrive at the gateways (the airport): as many
//              as the city's PULL, the sum of `pull` over its attractions that
//              a road reaches, but no more than the gateways can bring
//              (BALANCE.leisure.gateways). No gateway on a road: no tourists,
//              residents only.
//   WHERE      To attractions: every leisure kind with a `capacity`
//              (BALANCE.leisure.kinds). Its access roads are its doors.
//   WHICH ONE  Appeal against travel time. An attraction's `appeal` is a head
//              start in street tiles: its doors start the travel-time map at
//              (the best appeal in the table − its own), so a star attraction
//              draws from across the city and a small one mostly from nearby,
//              and a jam on the way makes a place less attractive. One map
//              serves residents and tourists alike.
//   MONEY      A ticketed attraction earns `ticket` per trip it takes. A free
//              one earns nothing; a share of its arrivals (`shopShare`) goes
//              on to the shops from its doors, as shopping trips.
//
// The trips that go on to the shops are read from the LAST traffic pass, in
// whole trips, so they follow the arrivals one pass behind.
//
// Numbers are read live. Everything here is derived from the map and the last
// traffic pass: nothing is saved. With no attraction on a road the market
// does not run and nothing here adds anything.

import type { World, BuildingEntity } from './World';
import { BALANCE, type LeisureRow } from '../data/balance';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_R } from './constants';
import { addDoorProvider, addTripProvider, servedAtDoors, type TrafficField } from './TrafficData';

const rows = (): Record<number, LeisureRow> => BALANCE.leisure.kinds;
const gateways = (): Record<number, number> => BALANCE.leisure.gateways;

const roadCache = new WeakMap<World, { edits: number; byAnchor: Map<number, number[]> }>();

/** The building's access roads, remembered until the map next changes. */
function accessRoads(world: World, b: BuildingEntity): number[] {
  let cached = roadCache.get(world);
  if (!cached || cached.edits !== world.grid.edits) { cached = { edits: world.grid.edits, byAnchor: new Map() }; roadCache.set(world, cached); }
  const anchor = b.ty * world.grid.width + b.tx;
  let roads = cached.byAnchor.get(anchor);
  if (!roads) { roads = world.buildingAccessRoads(b.tx, b.ty); cached.byAnchor.set(anchor, roads); }
  return roads;
}

/** Leisure trips a tick a `kind` building can take; 0 if it is not a destination. */
export function leisureCapacity(kind: number): number {
  const c = rows()[kind]?.capacity;
  return c! > 0 ? c! : 0;
}

/** The best appeal of any destination kind in the table: the attraction everything else is measured against. */
function bestAppeal(): number {
  let best = 0;
  for (const k in rows()) { const r = rows()[k]; if (r.capacity! > 0 && r.appeal! > best) best = r.appeal!; }
  return best;
}

/** Travel time, in street tiles, a trip to a `kind` attraction counts on top of the drive: the best appeal minus its own. */
export function leisureHandicap(kind: number): number {
  return Math.max(0, bestAppeal() - (rows()[kind]?.appeal ?? 0));
}

/** Call `fn` for every attraction (a leisure kind with a capacity) that a street or avenue reaches. */
function eachAttraction(world: World, fn: (b: BuildingEntity, row: LeisureRow, roads: number[]) => void): void {
  const table = rows();
  for (const b of world.buildings) {
    const row = table[b.kind];
    if (!row || !(row.capacity! > 0)) continue;
    const roads = accessRoads(world, b);
    if (roads.length > 0) fn(b, row, roads);
  }
}

/** Whether any kind in the table is a destination at all. */
function anyDestinationKind(): boolean {
  for (const k in rows()) if (rows()[k].capacity! > 0) return true;
  return false;
}

/** Tourists a tick the city's attractions would draw: the sum of `pull` over the attractions a road reaches. */
export function cityPull(world: World): number {
  let pull = 0;
  eachAttraction(world, (_b, row) => { if (row.pull! > 0) pull += row.pull!; });
  return pull;
}

/** Tourists a tick the gateways (airports) a road reaches can bring in. */
export function gatewayCapacity(world: World): number {
  const g = gateways();
  let cap = 0;
  for (const b of world.buildings) {
    if (!(g[b.kind] > 0)) continue;
    if (accessRoads(world, b).length > 0) cap += g[b.kind];
  }
  return cap;
}

/** Every gateway a road reaches: what it can bring in (tourists a tick) and its access roads. */
export function gatewayRoads(world: World): { capacity: number; roads: number[] }[] {
  const g = gateways();
  const out: { capacity: number; roads: number[] }[] = [];
  for (const b of world.buildings) {
    if (!(g[b.kind] > 0)) continue;
    const roads = accessRoads(world, b);
    if (roads.length > 0) out.push({ capacity: g[b.kind], roads });
  }
  return out;
}

/** Whether the city has a gateway that a road reaches: without one, attractions are for residents only. */
export function hasGateway(world: World): boolean {
  return gatewayCapacity(world) > 0;
}

/** Whether a `kind` building draws tourists (so building one with no gateway deserves a warning). */
export function drawsTourists(kind: number): boolean {
  const r = rows()[kind];
  return !!r && r.capacity! > 0 && r.pull! > 0;
}

/** Tourists a tick arriving in the city: its pull, capped by its gateways. */
export function touristsArriving(world: World): number {
  const cap = gatewayCapacity(world);
  return cap > 0 ? Math.min(cap, cityPull(world)) : 0;
}

/** Leisure trips a tick the attraction took on the last traffic pass (up to its capacity). */
function arrivalsOf(world: World, row: LeisureRow, roads: readonly number[]): number {
  return servedAtDoors(roads, world.traffic?.leisure.field, row.capacity!);
}

// Attractions are the doors of the leisure market; appeal is a head start.
addDoorProvider((world, market, add) => {
  if (market !== 'leisure' || !anyDestinationKind()) return;
  eachAttraction(world, (b, row, roads) => {
    const handicap = leisureHandicap(b.kind);
    for (const ri of roads) add(ri, row.capacity! / roads.length, handicap);
  });
});

// Tourists start at the gateways; arrivals at a free attraction go on to the shops.
addTripProvider((world, market, add) => {
  if (market === 'leisure') {
    const tourists = touristsArriving(world);
    if (!(tourists > 0)) return;
    const g = gateways();
    const total = gatewayCapacity(world);
    for (const b of world.buildings) {
      if (!(g[b.kind] > 0)) continue;
      const roads = accessRoads(world, b);
      // Each gateway brings its share of the tourists, spread over its roads.
      for (const ri of roads) add(ri, tourists * g[b.kind] / total / roads.length);
    }
    return;
  }
  if (market === 'shopping') {
    if (!world.traffic || !anyDestinationKind()) return;
    eachAttraction(world, (_b, row, roads) => {
      if (!(row.shopShare! > 0)) return;
      // Whole trips, so last pass's small wobbles do not start a new pass.
      const onward = Math.round(arrivalsOf(world, row, roads) * row.shopShare!);
      if (onward > 0) for (const ri of roads) add(ri, onward / roads.length);
    });
  }
});

/** Money per tick from tickets: `ticket` for every leisure trip a ticketed attraction took on the last pass. */
export function leisureTicketIncome(world: World): number {
  if (!world.traffic || !anyDestinationKind()) return 0;
  let income = 0;
  eachAttraction(world, (_b, row, roads) => {
    if (row.ticket! > 0) income += arrivalsOf(world, row, roads) * row.ticket!;
  });
  return income;
}

/** What one attraction is doing, from the last traffic pass. Per tick. */
export interface AttractionInfo {
  /** Whether a street or avenue reaches it. */
  connected: boolean;
  /** Leisure trips it took, and the most it can take. */
  arrivals: number;
  capacity: number;
  /** Money its tickets earn (0 for a free one). */
  income: number;
  /** Trips it sends on to the shops (0 for a ticketed one). */
  toShops: number;
  /** Tourists it draws to the city, if a gateway can bring them. */
  pull: number;
}

/** What the attraction at (tx, ty) (any of its tiles) is doing, or null if nothing there is a leisure destination. */
export function attractionAt(world: World, tx: number, ty: number): AttractionInfo | null {
  const b = world.buildingAt(tx, ty);
  const row = b ? rows()[b.kind] : undefined;
  if (!b || !row || !(row.capacity! > 0)) return null;
  const roads = accessRoads(world, b);
  const arrivals = roads.length > 0 ? arrivalsOf(world, row, roads) : 0;
  return {
    connected: roads.length > 0,
    arrivals, capacity: row.capacity!,
    income: row.ticket! > 0 ? arrivals * row.ticket! : 0,
    toShops: row.shopShare! > 0 ? Math.round(arrivals * row.shopShare!) : 0,
    pull: row.pull! > 0 ? row.pull! : 0,
  };
}

/** The city's tourism at a glance, per tick, from the map and the last traffic pass. */
export interface TourismInfo {
  /** Tourists its attractions would draw. */
  pull: number;
  /** Tourists its gateways can bring (0: no gateway on a road, residents only). */
  gatewayCapacity: number;
  /** Tourists arriving: the smaller of the two. */
  tourists: number;
  /** Leisure trips taken at all attractions (residents and tourists). */
  arrivals: number;
  /** Ticket money. */
  income: number;
}

export function tourismInfo(world: World): TourismInfo {
  let arrivals = 0;
  if (world.traffic) eachAttraction(world, (_b, row, roads) => { arrivals += arrivalsOf(world, row, roads); });
  return { pull: cityPull(world), gatewayCapacity: gatewayCapacity(world), tourists: touristsArriving(world), arrivals, income: leisureTicketIncome(world) };
}

/**
 * How well tile `i` (a home, usually) reaches leisure, 0–1, from the last
 * traffic pass: 1 beside the best attraction, falling in a straight line to 0
 * at BALANCE.leisure.reach of travel time (the attraction's head start
 * included). Measured from the best street or avenue beside the tile (a
 * merged lot's tiles ask through `door`, the tile whose roads count). 0 with
 * no attraction, no road or no traffic pass yet.
 */
export function leisureReachAt(world: World, i: number, door: number = i): number {
  const field: TrafficField | undefined = world.traffic?.leisure.field;
  if (!field || field.count === 0) return 0;
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  let best = Infinity;
  const x = door % width;
  const around = [x > 0 ? door - 1 : -1, x < width - 1 ? door + 1 : -1, door >= width ? door - width : -1, door < width * (height - 1) ? door + width : -1];
  for (const ri of around) {
    if (ri < 0) continue;
    const rc = roadClass[ri];
    if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
    if (field.dist[ri] < best) best = field.dist[ri];
  }
  const reach = BALANCE.leisure.reach;
  return best < reach ? 1 - best / reach : 0;
}

/**
 * What a home's chance to grow to `toLevel` is multiplied by for want of
 * leisure (BALANCE.leisure.need): `growthMult` when `toLevel` is at or past
 * `fromLevel` and no attraction is in reach of tile `i` (leisureReachAt at or
 * below `minReach`), otherwise 1. Also 1 in the tutorial city and before the
 * first traffic pass (nothing is known yet). `door` as in leisureReachAt.
 */
export function leisureGrowthMult(world: World, i: number, toLevel: number, door: number = i): number {
  const need = BALANCE.leisure.need;
  if (need.growthMult === 1 || toLevel < need.fromLevel || world.tutorial || !world.traffic) return 1;
  return leisureReachAt(world, i, door) > need.minReach ? 1 : need.growthMult;
}

/** Whether the home on tile `i` is being held back for want of leisure: it is at the level just below the need (or above) and none is in reach. For Inspect. */
export function lacksLeisure(world: World, i: number, door: number = i): boolean {
  const need = BALANCE.leisure.need;
  if (world.layers.zone[i] !== ZONE_R || world.layers.devLevel[i] + 1 < need.fromLevel) return false;
  return leisureGrowthMult(world, i, need.fromLevel, door) !== 1;
}
