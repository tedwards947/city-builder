// How buildings join the traffic system: BALANCE.transit.buildings has a row
// per building kind saying what it does in each market (see
// BuildingTrafficRow in data/balance.ts):
//
//   takes          It is a destination: its access roads become doors, like a
//                  zone's (people working at a school, visitors to a landmark).
//   sends          It is an origin: trips start from its access roads
//                  (arrivals at an airport looking for shops or jobs).
//   incomePerTrip  The city earns this for every trip it takes.
//   demandMult     City-wide growth demand is multiplied while one of the
//                  kind stands with a road to it.
//
// A building's access roads are the streets and avenues touching its
// footprint (World.buildingAccessRoads); what it takes or sends is shared
// evenly between them, so a long building on one road has a door at every
// tile of that road it touches. A building with no access road does nothing.
//
// A new building needs only a row in the table. The seaport is the exception:
// its trade depends on open water, so it has its own rules (sim/seaport.ts).
//
// Numbers are read live. Everything here is derived from the map and the last
// traffic pass: nothing is saved.

import type { World, BuildingEntity } from './World';
import { BALANCE, type BuildingTrafficRow } from '../data/balance';
import { MARKET_DEFS, addDoorProvider, addTripProvider, servedAtDoors, marketWeight, type MarketKey } from './TrafficData';

const table = (): Record<number, BuildingTrafficRow> => BALANCE.transit.buildings;

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

/** Call `fn` for every building whose kind has a row and that a street or avenue reaches. */
function eachConnected(world: World, fn: (row: BuildingTrafficRow, roads: number[]) => void): void {
  const rows = table();
  for (const b of world.buildings) {
    const row = rows[b.kind];
    if (!row) continue;
    const roads = accessRoads(world, b);
    if (roads.length > 0) fn(row, roads);
  }
}

/** Whether any row has a number above 0 under `part`: lets a pass with nothing to do skip the buildings. */
function anyRow(part: 'takes' | 'sends' | 'incomePerTrip', market?: MarketKey): boolean {
  const rows = table();
  for (const kind in rows) {
    const amounts = rows[kind][part];
    if (!amounts) continue;
    if (market !== undefined) { if (amounts[market]! > 0) return true; continue; }
    for (const k in amounts) if (amounts[k as MarketKey]! > 0) return true;
  }
  return false;
}

addDoorProvider((world, market, add) => {
  if (!anyRow('takes', market)) return;
  eachConnected(world, (row, roads) => {
    const capacity = row.takes?.[market];
    if (!(capacity! > 0)) return;
    for (const ri of roads) add(ri, capacity! / roads.length);
  });
});

addTripProvider((world, market, add) => {
  if (!anyRow('sends', market)) return;
  eachConnected(world, (row, roads) => {
    const trips = row.sends?.[market];
    if (!(trips! > 0)) return;
    for (const ri of roads) add(ri, trips! / roads.length);
  });
});

/**
 * Money per tick the city's buildings earn from the trips they take
 * (incomePerTrip, for each trip they have room for), from the last traffic
 * pass. 0 with no such building or no traffic pass yet.
 */
export function buildingTripIncome(world: World): number {
  const traffic = world.traffic;
  if (!traffic || !anyRow('incomePerTrip')) return 0;
  let income = 0;
  eachConnected(world, (row, roads) => {
    if (!row.incomePerTrip || !row.takes) return;
    for (const def of MARKET_DEFS) {
      const perTrip = row.incomePerTrip[def.key], capacity = row.takes[def.key];
      if (!(perTrip! > 0) || !(capacity! > 0)) continue;
      income += servedAtDoors(roads, traffic[def.key].field, capacity!) / marketWeight(def) * perTrip!;
    }
  });
  return income;
}

/**
 * What growth demand for a zone type is multiplied by: the demandMult of
 * every building kind that stands with a road to it, each kind counted once
 * however many of it there are. 1 with no such building.
 */
export function buildingDemandMult(world: World, zone: 'R' | 'C' | 'I'): number {
  const rows = table();
  let any = false;
  for (const kind in rows) { const m = rows[kind].demandMult?.[zone]; if (m !== undefined && m !== 1) { any = true; break; } }
  if (!any) return 1;
  let mult = 1;
  const counted = new Set<BuildingTrafficRow>();
  eachConnected(world, (row) => {
    const m = row.demandMult?.[zone];
    if (m === undefined || counted.has(row)) return;
    counted.add(row);
    mult *= m;
  });
  return mult;
}

/** What one building is doing in traffic, from the last pass. Trips are per tick. */
export interface BuildingTrips {
  /** Whether a street or avenue reaches it. */
  connected: boolean;
  /** Per market it takes trips in: the trips arriving that it has room for, and the most it can take. */
  takes: { market: MarketKey; trips: number; capacity: number }[];
  /** Per market it sends trips in: the trips it puts on the road (0 while no road reaches it). */
  sends: { market: MarketKey; trips: number }[];
  /** Money its trips earn per tick. */
  income: number;
}

/** What the building at (tx, ty) (any of its tiles) is doing in traffic, or null if its kind has no row. */
export function buildingTripsAt(world: World, tx: number, ty: number): BuildingTrips | null {
  const b = world.buildingAt(tx, ty);
  const row = b ? table()[b.kind] : undefined;
  if (!b || !row) return null;
  const roads = accessRoads(world, b);
  const out: BuildingTrips = { connected: roads.length > 0, takes: [], sends: [], income: 0 };
  for (const def of MARKET_DEFS) {
    const capacity = row.takes?.[def.key];
    if (capacity! > 0) {
      const trips = servedAtDoors(roads, world.traffic?.[def.key].field, capacity!) / marketWeight(def);
      out.takes.push({ market: def.key, trips, capacity: capacity! });
      const perTrip = row.incomePerTrip?.[def.key];
      if (perTrip! > 0) out.income += trips * perTrip!;
    }
    const sent = row.sends?.[def.key];
    if (sent! > 0) out.sends.push({ market: def.key, trips: roads.length > 0 ? sent! : 0 });
  }
  return out;
}
