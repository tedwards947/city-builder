// What TransitSystem worked out on its last pass, for the traffic overlay,
// the tile inspector and the tuning panel. Read-only outside TransitSystem,
// never saved: it is rebuilt from the layers on the first pass after a load.

import { doorTile } from './lots';
import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY } from './constants';
import type { World } from './World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_R, ZONE_C, ZONE_I } from './constants';
import { BALANCE, type TrafficMarketKey } from '../data/balance';

/**
 * One travel-time map: time to the nearest destination, and the way there.
 *
 * Its arrays are indexed by NODE. A road tile's node is its tile index. A tile
 * of rail track is a second node, tile index + `TrafficData.tiles` (so a level
 * crossing is two nodes). `parent` and `order` hold nodes: one that is
 * `>= tiles` is track, on tile `node - tiles`.
 */
export interface TrafficField {
  // Travel time per road tile to the nearest door, in street tiles
  // (congestion included). Infinity = unreachable.
  dist: Float32Array;
  parent: Int32Array;    // next tile on the quickest way there; -1 at a door
  order: Int32Array;     // road tiles in order of increasing dist (doors first)
  count: number;         // number of valid entries in `order`
  // Doors: road tiles next to a destination zone. Indexed by road tile.
  doorCap: Float32Array;   // trips the zones at this door can take; 0 = not a door
  doorLoad: Float32Array;  // trips that ended at this door on the last iteration
  /** Total trips wanting this destination type ÷ total door capacity. */
  demandRatio: number;
  /** Trips put on the road toward this destination type on the last iteration. */
  demand: number;
  /** Trips that origins wanted to make but could not: no road, no route to any door, or out of reach. */
  stranded: number;
  /**
   * True when some door of this map starts at more than 0 (a door provider gave it a handicap):
   * `dist` then includes the handicap, doors are no longer the first entries of `order`, and a
   * door on the way to a better one is passed through (its `parent` is not -1).
   */
  handicapped: boolean;
}

/**
 * A MARKET is one kind of trip: who sends it, who receives it, how many per
 * level, and how many a destination can take. Each market has its own map,
 * door capacities, prices and road volumes. To add a kind of trip, add a row
 * to MARKET_DEFS; the traffic pass, overlay and debug tools all loop over it.
 */
export type MarketKey = TrafficMarketKey;

/** `dest` of a market no zone receives: its only destinations are buildings (door providers). */
export const NO_ZONE = -1;

export interface MarketDef {
  key: MarketKey;
  origin: number;                                   // zone type that sends the trips
  dest: number;                                     // zone type that receives them, or NO_ZONE
  /** Trips per origin level (read live from BALANCE). */
  rate: () => number;
  /** Trips each destination level can take (read live from BALANCE). Unused for a NO_ZONE market. */
  capacity: () => number;
  /** How much road each trip takes up, 1 if left out (a truck is more than a car). */
  weight?: () => number;
  /** Origins further than this from the nearest door (travel time, in street tiles) send nothing. No limit if left out. */
  reach?: () => number;
  /** The trips are people, who take a train when that is faster. Freight never rides. */
  rides?: boolean;
  /** Its doors come and go by themselves (a stadium event): when they do, the pass settles as it does after a road edit. */
  occasional?: boolean;
}

export const MARKET_DEFS: readonly MarketDef[] = [
  { key: 'shopping', origin: ZONE_R, dest: ZONE_C, rate: () => BALANCE.transit.tripsRtoC, capacity: () => BALANCE.transit.shopCapacity, rides: true },
  { key: 'jobs',     origin: ZONE_R, dest: ZONE_I, rate: () => BALANCE.transit.tripsRtoI, capacity: () => BALANCE.transit.jobCapacity, rides: true },
  // Shops fetch their goods: every shop draws from the nearest industry with output to spare
  // (or from a seaport's imports, sim/seaport.ts).
  { key: 'goods',    origin: ZONE_C, dest: ZONE_I, rate: () => BALANCE.transit.tripsCtoI, capacity: () => BALANCE.transit.goodsCapacity },
  // Industry sends goods to a seaport. No zone receives exports: the ports are the only doors,
  // so with no connected port (or the trips switched off) this market does not run at all.
  { key: 'exports',  origin: ZONE_I, dest: NO_ZONE,
    rate: () => BALANCE.port.exportTripsPerLevel, capacity: () => 0,
    weight: () => BALANCE.port.truckWeight, reach: () => BALANCE.port.reach },
  // Homes send visitors to buildings that draw them (an airport, a landmark: BALANCE.transit.buildings).
  // No zone receives visitors, so with no such building (or the trips at 0) this market does not run.
  { key: 'visitors', origin: ZONE_R, dest: NO_ZONE, rate: () => BALANCE.transit.tripsVisitors, capacity: () => 0, rides: true },
  // Leisure (LEISURE_DESIGN.md, sim/leisureTraffic.ts): homes, and tourists arriving at a gateway,
  // go to attractions. No zone receives them, so with no attraction on a road the market does not run.
  // An attraction's appeal is a head start (a door handicap), so people weigh appeal against travel time.
  { key: 'leisure', origin: ZONE_R, dest: NO_ZONE, rate: () => BALANCE.leisure.tripsPerLevel, capacity: () => 0,
    reach: () => BALANCE.leisure.reach, rides: true },
  // Stadium events (sim/eventDays.ts): fans go to the stadium. Its doors exist during an event only,
  // so between events this market holds nothing and costs nothing. The crowd is scaled over the
  // event (setMarketScale).
  { key: 'event', origin: ZONE_R, dest: NO_ZONE, rate: () => BALANCE.leisure.event.fansPerLevel, capacity: () => 0,
    reach: () => BALANCE.leisure.event.reach, rides: true, occasional: true },
];

// ── Doors that are not zones ────────────────────────────────────────────────
//
// A market's destinations are normally developed zone tiles of `def.dest`.
// A BUILDING can be a destination too (a seaport takes goods): it registers a
// door provider, which is asked on every traffic pass for the road tiles its
// buildings are entered from and how many trips each can take. Those doors
// behave exactly like zone doors: trips route to the nearest, fill it, and
// spill to others nearby. With no provider registered nothing changes.

/**
 * Called once per market per traffic pass. Call `add(roadTile, capacity)` for
 * each extra door: a street or avenue tile (anything else is ignored) and the
 * trips it can take (0 or less is ignored). Must be a pure function of the
 * world and the balance numbers: the pass re-runs only when what it adds changes.
 *
 * `handicap` (0 if left out) is travel time, in street tiles, added to every
 * trip that ends at this door: the map starts there at `handicap` instead of
 * 0, so a door with a smaller handicap is preferred from further away (an
 * attraction's appeal is a head start: the best has handicap 0). Where two
 * buildings share a door tile the smaller handicap counts.
 */
export type DoorProvider = (world: World, market: MarketKey, add: (roadTile: number, capacity: number, handicap?: number) => void) => void;

const doorProviders: DoorProvider[] = [];

/** Register a door provider. Returns a function that removes it again (for tests). */
export function addDoorProvider(provider: DoorProvider): () => void {
  doorProviders.push(provider);
  return () => { const k = doorProviders.indexOf(provider); if (k >= 0) doorProviders.splice(k, 1); };
}

/** Whether any building can be a market destination at all (false = the usual, zone-only pass). */
export function hasDoorProviders(): boolean {
  return doorProviders.length > 0;
}

/** Every extra door of `market`, from every provider. */
export function extraDoors(world: World, market: MarketKey, add: (roadTile: number, capacity: number, handicap?: number) => void): void {
  for (const provider of doorProviders) provider(world, market, add);
}

// ── Origins that are not zones ──────────────────────────────────────────────
//
// A market's trips normally start at developed zone tiles of `def.origin`. A
// BUILDING can send trips too (arrivals at an airport heading for the shops):
// it registers a trip provider, which is asked on every traffic pass for the
// road tiles its trips start from and how many. Those trips behave exactly
// like a zone's: they take the quickest way to the nearest door, fill it and
// spill. Trips with no way to a door (or beyond the market's reach) count as
// stranded. With no provider registered nothing changes.

/**
 * Called once per market per traffic pass. Call `add(roadTile, trips)` for
 * each source: a street or avenue tile (anything else is ignored) and the
 * trips per tick starting there (0 or less is ignored). Must be a pure
 * function of the world and the balance numbers, like a DoorProvider.
 */
export type TripProvider = (world: World, market: MarketKey, add: (roadTile: number, trips: number) => void) => void;

const tripProviders: TripProvider[] = [];

/** Register a trip provider. Returns a function that removes it again (for tests). */
export function addTripProvider(provider: TripProvider): () => void {
  tripProviders.push(provider);
  return () => { const k = tripProviders.indexOf(provider); if (k >= 0) tripProviders.splice(k, 1); };
}

/** Whether any building can send trips at all. */
export function hasTripProviders(): boolean {
  return tripProviders.length > 0;
}

/** Every extra source of `market`'s trips, from every provider. */
export function extraTrips(world: World, market: MarketKey, add: (roadTile: number, trips: number) => void): void {
  for (const provider of tripProviders) provider(world, market, add);
}

/**
 * Trips served at one building's doors in one market on the last pass: what
 * arrived, up to the room, by the building's share of each door. `roads` are
 * its door tiles and `capacity` what it can take in total, as it told the
 * door provider. In road units: divide by marketWeight for trips.
 */
export function servedAtDoors(roads: readonly number[], field: { doorLoad: Float32Array; doorCap: Float32Array } | undefined, capacity: number): number {
  if (!field || !(capacity > 0) || roads.length === 0) return 0;
  const share = capacity / roads.length;
  let trips = 0;
  for (const ri of roads) {
    const cap = field.doorCap[ri];
    if (!(cap > 0)) continue;
    // A door may be shared (two buildings on one road, or one beside a zone): take this building's part of it.
    trips += Math.min(field.doorLoad[ri], cap) * Math.min(1, share / cap);
  }
  return trips;
}

/** Trips each origin level sends in this market. */
export function marketRate(def: MarketDef): number { return def.rate(); }

// A market's origin rate can be scaled by the state of the city (a stadium event's crowd grows
// and drains: sim/eventDays.ts). The owner of the market registers the scale; 1 if none.
const marketScales = new Map<MarketKey, (world: World) => number>();
export function setMarketScale(key: MarketKey, scale: (world: World) => number): void { marketScales.set(key, scale); }
/** What the trips this market's zones send are multiplied by right now (0 or more; 1 for most markets). */
export function marketScale(world: World, key: MarketKey): number {
  const f = marketScales.get(key);
  return f ? Math.max(0, f(world)) : 1;
}
/** Trips each destination level can take in this market. */
export function marketCapacity(def: MarketDef): number { return def.capacity(); }
/** Road each trip of this market takes up (1 unless the market says otherwise). */
export function marketWeight(def: MarketDef): number { const w = def.weight ? def.weight() : 1; return w > 0 ? w : 1; }
/** The furthest an origin may be from a door and still send trips (Infinity unless the market says otherwise). */
export function marketReach(def: MarketDef): number { const r = def.reach ? def.reach() : Infinity; return r > 0 ? r : Infinity; }

export interface TrafficMarket {
  def: MarketDef;
  field: TrafficField;     // the way to this market's destinations, with doors and prices
  // Trips passing through each node (road tile, or track tile + `tiles`).
  // Averaged over recent iterations, so where routes alternate the traffic
  // shows as split.
  volume: Float32Array;
}

/** A train station as traffic sees it. */
export interface StationTraffic {
  /** Tile index of the station building's anchor. */
  anchor: number;
  /** The streets and avenues it is entered from. Empty: no road, so nobody boards here. */
  roads: number[];
  /** Riders boarding here on the last iteration (trips, all markets). */
  boardings: number;
}

/** Rail traffic: what the trains carry. */
export interface RailTraffic {
  /**
   * Per track node (node − tiles; so plain tile index for ground track): riders the track
   * there carries before it counts as full; 0 where there is no track. Read it with railCapacity.
   */
  capacity: Float32Array;
  /** Every station, in world.buildings order. */
  stations: StationTraffic[];
  /** Riders boarding at all stations on the last iteration. */
  boardings: number;
}

export interface TrafficData {
  /** Bumped every time the pass is recomputed. */
  version: number;
  /**
   * Tiles on the map. A node below this is a road tile; `tiles + i` is the ground track on
   * tile i, `2 × tiles + i` its elevated track and `3 × tiles + i` its subway (railNode).
   * The tile of any node is `node % tiles`.
   */
  tiles: number;
  /** Rail traffic. Track volumes are in each market's `volume`, at railNode(d, i, level); see railVolume. */
  rail: RailTraffic;
  /** Every market, in MARKET_DEFS order. */
  markets: TrafficMarket[];
  // The same markets by name.
  shopping: TrafficMarket; // homes → commerce
  jobs: TrafficMarket;     // homes → industry
  goods: TrafficMarket;    // commerce → industry (shops fetching goods)
  exports: TrafficMarket;  // industry → seaport (all zero while no port takes exports)
  visitors: TrafficMarket; // homes → buildings that draw visitors (all zero while none takes them)
  leisure: TrafficMarket;  // homes and tourists → attractions (all zero while none stands on a road)
  event: TrafficMarket;    // fans → the stadium (all zero except on an event day)
  /** The way to the nearest developed homes (no trips follow it; used for accessibility). */
  toR: TrafficField;
  // What accessibility is measured on (TransitSystem). Each is one of the maps above unless a
  // building takes part in the shopping or jobs market, when it is a map of its own.
  /** Homes' way to the nearest shops / jobs, counting zones only (not doors that buildings add). */
  toShops: TrafficField;
  toJobs: TrafficField;
  /** Shops' way to the nearest customers: homes, or a building that sends shoppers (an airport). */
  toCustomers: TrafficField;
  /** Industry's way to the nearest workers: homes, or a building that sends job seekers. */
  toWorkers: TrafficField;
  /** False while the pass is still settling toward a stable assignment. */
  settled: boolean;
}

/** Nodes per tile of the traffic network: the road, then the track on each rail level (ground, elevated, subway). */
export const NODES_PER_TILE = 4;

/** Which of a tile's nodes the track of `level` is: 1 ground, 2 elevated, 3 subway (0 is the road). */
export function railSlot(level: number): number {
  return level === RAIL_ELEVATED ? 2 : level === RAIL_SUBWAY ? 3 : 1;
}

/** The node of the `level` track on tile `i` (ground by default): `railSlot(level) × tiles + i`. */
export function railNode(d: TrafficData, i: number, level: number = RAIL_GROUND): number {
  return railSlot(level) * d.tiles + i;
}

export function makeTrafficData(n: number): TrafficData {
  // Four nodes per tile: the road and the track on each of the three rail levels.
  const nn = NODES_PER_TILE * n;
  const markets = MARKET_DEFS.map((def): TrafficMarket => ({ def, field: makeTrafficField(nn), volume: new Float32Array(nn) }));
  const byKey = (key: MarketKey) => markets.find(m => m.def.key === key)!;
  const toR = makeTrafficField(nn);
  return {
    version: 0, markets, tiles: n, rail: { capacity: new Float32Array(nn - n), stations: [], boardings: 0 },
    shopping: byKey('shopping'), jobs: byKey('jobs'), goods: byKey('goods'), exports: byKey('exports'), visitors: byKey('visitors'), leisure: byKey('leisure'), event: byKey('event'),
    toR, toShops: byKey('shopping').field, toJobs: byKey('jobs').field, toCustomers: toR, toWorkers: toR, settled: false,
  };
}

export function makeTrafficField(n: number): TrafficField {
  return {
    dist: new Float32Array(n), parent: new Int32Array(n), order: new Int32Array(n), count: 0,
    doorCap: new Float32Array(n), doorLoad: new Float32Array(n), demandRatio: 0, demand: 0, stranded: 0, handicapped: false,
  };
}

/** Travel time from a road tile to the nearest destination on `field` (Infinity if none). */
export function travelTime(field: TrafficField, roadIdx: number): number {
  return field.dist[roadIdx];
}

/** Total trips through a road tile. */
export function trafficVolume(d: TrafficData, i: number): number {
  let v = 0;
  for (const m of d.markets) v += m.volume[i];
  return v;
}

/** Riders on the `level` track (ground by default) of tile `i`, all markets. */
export function railVolume(d: TrafficData, i: number, level: number = RAIL_GROUND): number {
  return trafficVolume(d, railNode(d, i, level));
}

/** Riders the `level` track on tile `i` carries before it counts as full; 0 where there is none. */
export function railCapacity(d: TrafficData, i: number, level: number = RAIL_GROUND): number {
  return d.rail.capacity[railNode(d, i, level) - d.tiles];
}

/** How full the `level` track on tile `i` is: riders ÷ capacity (1 = full; more is overloaded). 0 where there is no track. */
export function railLoad(d: TrafficData, i: number, level: number = RAIL_GROUND): number {
  const cap = railCapacity(d, i, level);
  return cap > 0 ? railVolume(d, i, level) / cap : 0;
}

/** Trips a road tile of this class can carry before it counts as full. */
export function roadCapacity(roadClass: number): number {
  return BALANCE.roadClasses[roadClass]?.capacity ?? BALANCE.roadClasses[1].capacity;
}

/**
 * A road tile's load as the traffic overlay and the drawn cars show it: volume ÷
 * capacity, except at a level crossing (`groundTrack`), where the capacity is cut by
 * BALANCE.rail.crossing.overlayCut × the line's load (up to 1). Looks only.
 */
export function shownRoadLoad(d: TrafficData, i: number, roadClass: number, groundTrack: boolean): number {
  let cap = roadCapacity(roadClass);
  if (groundTrack) {
    const cut = BALANCE.rail.crossing.overlayCut;
    if (cut > 0) cap *= Math.max(0.05, 1 - cut * Math.min(1, railLoad(d, i)));
  }
  return trafficVolume(d, i) / cap;
}

/** Index of the tile's k-th cardinal neighbour (W, E, N, S), or -1 off the map. */
export function neighbourIndex(i: number, k: number, width: number, height: number): number {
  const x = i % width;
  if (k === 0) return x > 0 ? i - 1 : -1;
  if (k === 1) return x < width - 1 ? i + 1 : -1;
  if (k === 2) return i >= width ? i - width : -1;
  return i < width * (height - 1) ? i + width : -1;
}

/**
 * The adjacent street or avenue tile from which a zone tile's trips enter the
 * network for `field` (the one nearest the destination), or -1 if it has no
 * access road or none of them reaches a destination. Highways give no access.
 */
export function bestAccessRoad(world: World, zoneIdx: number, field: TrafficField): number {
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  // A tile of a merged 2×2 lot with no road of its own goes out through its building's (sim/lots.ts).
  if (world.layers.lot[zoneIdx] !== 0) zoneIdx = doorTile(world, zoneIdx);
  let best = -1, bestDist = Infinity;
  for (let k = 0; k < 4; k++) {
    const ri = neighbourIndex(zoneIdx, k, width, height);
    if (ri < 0) continue;
    const rc = roadClass[ri];
    if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
    if (field.dist[ri] < bestDist) { bestDist = field.dist[ri]; best = ri; }
  }
  return best;
}
