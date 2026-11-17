// The seaport's trade (SEAPORT_DESIGN.md). A port that a street or avenue
// reaches joins the traffic system's markets through its yard's roads:
//
//   EXPORTS   Industry within reach sends goods to the port (the 'exports'
//             market). The city earns exportIncomePerTrip for each trip the
//             port has room for.
//   IMPORTS   The port is one more source of goods for shops (an extra door
//             in the 'goods' market), so shops whose industry is far or full
//             fetch from the port. It matters once BALANCE.goods makes a
//             goods shortage hurt (sim/goods.ts).
//   DEMAND    While the city has a connected port, industrial growth demand
//             is multiplied by industrialDemandMult, city-wide.
//
// Numbers live in BALANCE.port and are read live. Everything here is derived
// from the map and the last traffic pass: nothing is saved.

import type { World, BuildingEntity } from './World';
import { BALANCE } from '../data/balance';
import { BUILDING_SEAPORT } from './constants';
import { addDoorProvider } from './TrafficData';

/** Every seaport standing in the city. */
export function seaports(world: World): BuildingEntity[] {
  return world.buildings.filter((b) => b.kind === BUILDING_SEAPORT);
}

/** Whether the city has a seaport that a street or avenue reaches. */
export function hasConnectedPort(world: World): boolean {
  for (const b of world.buildings) {
    if (b.kind === BUILDING_SEAPORT && world.buildingAccessRoads(b.tx, b.ty).length > 0) return true;
  }
  return false;
}

/** Trips of export traffic the port can take, counting each truck at its road weight. */
const exportDoorCapacity = () => BALANCE.port.exportCapacity * BALANCE.port.truckWeight;

// Each connected port adds its yard's roads as doors: for exports, and as a source of goods.
addDoorProvider((world, market, add) => {
  const capacity = market === 'exports' ? exportDoorCapacity() : market === 'goods' ? BALANCE.port.importCapacity : 0;
  if (!(capacity > 0)) return;
  for (const b of world.buildings) {
    if (b.kind !== BUILDING_SEAPORT) continue;
    const roads = world.buildingAccessRoads(b.tx, b.ty);
    for (const ri of roads) add(ri, capacity / roads.length);
  }
});

/** What one port is doing, from the last traffic pass. Trips are per tick. */
export interface PortTrade {
  /** Whether a street or avenue reaches its yard. */
  connected: boolean;
  /** Export trips arriving that it has room for. */
  exports: number;
  /** The most export trips it can take. */
  exportCapacity: number;
  /** Goods trips shops fetch from it that it has room for. */
  imports: number;
  /** The most goods trips it can supply. */
  importCapacity: number;
  /** Money its exports earn per tick. */
  income: number;
}

/** Trips served at one port's doors in one market: what arrived, up to the room, by the port's share of each door. */
function served(roads: readonly number[], field: { doorLoad: Float32Array; doorCap: Float32Array } | undefined, capacity: number): number {
  if (!field || !(capacity > 0) || roads.length === 0) return 0;
  const share = capacity / roads.length;
  let trips = 0;
  for (const ri of roads) {
    const cap = field.doorCap[ri];
    if (!(cap > 0)) continue;
    // A door may be shared (two ports on one road, or a port beside industry): take this port's part of it.
    trips += Math.min(field.doorLoad[ri], cap) * Math.min(1, share / cap);
  }
  return trips;
}

/** What the port at (tx, ty) (any of its tiles) is doing, or null if there is no seaport there. */
export function portTradeAt(world: World, tx: number, ty: number): PortTrade | null {
  const b = world.buildingAt(tx, ty);
  if (!b || b.kind !== BUILDING_SEAPORT) return null;
  const P = BALANCE.port;
  const roads = world.buildingAccessRoads(b.tx, b.ty);
  const weight = P.truckWeight > 0 ? P.truckWeight : 1;
  const exports = served(roads, world.traffic?.exports.field, exportDoorCapacity()) / weight;
  const imports = served(roads, world.traffic?.goods.field, P.importCapacity);
  return {
    connected: roads.length > 0,
    exports, exportCapacity: P.exportCapacity,
    imports, importCapacity: P.importCapacity,
    income: exports * P.exportIncomePerTrip,
  };
}

/** Money the city's ports earn from exports per tick (0 with no port, no traffic pass yet, or the income switched off). */
export function exportIncome(world: World): number {
  const P = BALANCE.port;
  if (!(P.exportIncomePerTrip > 0) || !(P.exportCapacity > 0) || !world.traffic) return 0;
  const field = world.traffic.exports.field;
  const weight = P.truckWeight > 0 ? P.truckWeight : 1;
  let trips = 0;
  for (const b of world.buildings) {
    if (b.kind !== BUILDING_SEAPORT) continue;
    trips += served(world.buildingAccessRoads(b.tx, b.ty), field, exportDoorCapacity());
  }
  return trips / weight * P.exportIncomePerTrip;
}

/** What industrial growth demand is multiplied by: industrialDemandMult while a connected port stands, else 1. */
export function portIndustrialDemandMult(world: World): number {
  const mult = BALANCE.port.industrialDemandMult;
  return mult !== 1 && hasConnectedPort(world) ? mult : 1;
}
