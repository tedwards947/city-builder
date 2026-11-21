// What travels through an outside connection (CONNECTIONS_DESIGN.md, phase 2:
// the highway). A highway point that is OPEN (a highway stands on its tile;
// never in the tutorial city: connections.ts openHighways) joins the traffic
// system's markets at that one tile:
//
//   VISITORS IN    It is a tourist gateway, like the airport: it brings up to
//                  `visitors` a tick of the tourists the city's pull draws
//                  (sim/leisureTraffic.ts shares them between the gateways),
//                  and of the tourist fans on a stadium event.
//   EXPORTS OUT    Industry within reach sends trucks to it (a door in the
//                  'exports' market), up to `exportTrucks` a tick. Each truck
//                  it has room for earns BALANCE.port.exportIncomePerTrip, as
//                  at a seaport. No imports and no boost to industry.
//   RESIDENTS OUT  Homes send it visitors (a door in the 'visitors' market,
//                  beside the airport's), up to `residentsOut` a tick. They
//                  pay nothing.
//
// Everything enters and leaves on the point's own tile, so it all drives the
// road the player built inward from it. The traffic pass lets trips start and
// end on a highway tile there and nowhere else (connections.ts isEntryTile).
//
// Numbers live in BALANCE.connections.highway and are read live. Everything
// here is derived from the map and the last traffic pass: nothing is saved.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { addDoorProvider, servedAtDoors } from './TrafficData';
import { connectionOn, isJoined, openHighways, type Connection } from './connections';
import { gatewayCapacity, touristsArriving } from './leisureTraffic';

const H = () => BALANCE.connections.highway;
const truckWeight = (): number => (BALANCE.port.truckWeight > 0 ? BALANCE.port.truckWeight : 1);

/** Road the export trucks one highway point can take fill, counting each truck at its road weight. */
const exportDoorCapacity = (): number => H().exportTrucks * truckWeight();

// Each open highway point is a door for exports and for residents travelling out.
addDoorProvider((world, market, add) => {
  const capacity = market === 'exports' ? exportDoorCapacity() : market === 'visitors' ? H().residentsOut : 0;
  if (!(capacity > 0)) return;
  for (const c of openHighways(world)) add(c.tile, capacity);
});

/** Export trucks a tick the highway point took on the last traffic pass (up to its room). */
function trucksAt(world: World, c: Connection): number {
  return servedAtDoors([c.tile], world.traffic?.exports.field, exportDoorCapacity()) / truckWeight();
}

/** Money per tick from the trucks leaving by highway (0 with no open point or no traffic pass yet). */
export function connectionExportIncome(world: World): number {
  const perTrip = BALANCE.port.exportIncomePerTrip;
  if (!world.traffic || !(perTrip > 0) || !(H().exportTrucks > 0)) return 0;
  let trucks = 0;
  for (const c of openHighways(world)) trucks += trucksAt(world, c);
  return trucks * perTrip;
}

/** What one point is doing, from the map and the last traffic pass. Per tick. */
export interface ConnectionTrade {
  kind: Connection['kind'];
  /** A highway (or ground track) stands on its tile. */
  joined: boolean;
  /** It carries traffic: joined, a highway point, and not the tutorial city. (Rail points carry nothing yet.) */
  open: boolean;
  /** Tourists arriving through it, and the most it can bring. */
  visitorsIn: number;
  visitorsCapacity: number;
  /** Export trucks leaving through it that it has room for, the most it can take, and what they earn. */
  exports: number;
  exportCapacity: number;
  income: number;
  /** Residents travelling out through it that it has room for, and the most it can take. */
  residentsOut: number;
  residentsOutCapacity: number;
}

/** What the point on tile `i` is doing, or null if there is no point there. For Inspect and the overlay. */
export function connectionTradeAt(world: World, i: number): ConnectionTrade | null {
  const c = connectionOn(world, i);
  if (!c) return null;
  const open = openHighways(world).includes(c);
  const cfg = H();
  const total = open ? gatewayCapacity(world) : 0;
  const exports = open ? trucksAt(world, c) : 0;
  return {
    kind: c.kind,
    joined: isJoined(world, c),
    open,
    visitorsIn: total > 0 ? touristsArriving(world) * cfg.visitors / total : 0,
    visitorsCapacity: c.kind === 'highway' ? cfg.visitors : 0,
    exports,
    exportCapacity: c.kind === 'highway' ? cfg.exportTrucks : 0,
    income: exports * BALANCE.port.exportIncomePerTrip,
    residentsOut: open ? servedAtDoors([c.tile], world.traffic?.visitors.field, cfg.residentsOut) : 0,
    residentsOutCapacity: c.kind === 'highway' ? cfg.residentsOut : 0,
  };
}
