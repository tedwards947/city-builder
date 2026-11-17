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
import { BUILDING_NONE, TERRAIN_WATER } from './constants';
import { shapeRoles } from './buildingShapes';

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

// ── For the ships graphics draws ────────────────────────────────────────────

/** A port's trade per game day, and how often a ship calls. Ships are for show: nothing in the sim depends on them. */
export interface PortTradePerDay {
  exportsPerDay: number;
  importsPerDay: number;
  /** Ship calls per game day: trade trips per day ÷ BALANCE.port.tripsPerShip. 0 = no ships. */
  shipsPerDay: number;
  /** The most trade (exports plus imports) the port can handle per game day. */
  capacity: number;
}

/** The trade per game day of the port anchored at tile index `anchor`, or null if no seaport is anchored there. */
export function portTrade(world: World, anchor: number): PortTradePerDay | null {
  const w = world.grid.width;
  const t = portTradeAt(world, anchor % w, (anchor - (anchor % w)) / w);
  if (!t || world.buildingAnchorAt(anchor) !== anchor) return null;
  const day = BALANCE.ticksPerDay, P = BALANCE.port;
  const exportsPerDay = t.exports * day, importsPerDay = t.imports * day;
  return {
    exportsPerDay, importsPerDay,
    shipsPerDay: P.tripsPerShip > 0 ? (exportsPerDay + importsPerDay) / P.tripsPerShip : 0,
    capacity: (t.exportCapacity + t.importCapacity) * day,
  };
}

const routes = new WeakMap<World, { edits: number; byAnchor: Map<number, number[] | null> }>();

/**
 * The way a ship takes between the port anchored at tile index `anchor` and
 * the edge of the map: water tile indices, starting on the water just off the
 * port's docks and ending on a water tile at the map's edge. The shortest
 * such way in tile steps; it may pass under bridges, but not through any
 * port's docks. Null if no seaport is anchored there or its docks are shut
 * in. Remembered until the map next changes.
 */
export function shipRoute(world: World, anchor: number): number[] | null {
  let cached = routes.get(world);
  if (!cached || cached.edits !== world.grid.edits) { cached = { edits: world.grid.edits, byAnchor: new Map() }; routes.set(world, cached); }
  const have = cached.byAnchor.get(anchor);
  if (have !== undefined) return have;
  const route = findShipRoute(world, anchor);
  cached.byAnchor.set(anchor, route);
  return route;
}

function findShipRoute(world: World, anchor: number): number[] | null {
  const { width, height } = world.grid;
  const { terrain, building } = world.layers;
  if (anchor < 0 || anchor >= terrain.length || building[anchor] !== BUILDING_SEAPORT || world.buildingAnchorAt(anchor) !== anchor) return null;
  const tiles = world.buildingTilesAt(anchor % width, (anchor - (anchor % width)) / width);
  const roles = shapeRoles(BUILDING_SEAPORT);
  const docks = tiles.filter((_, k) => roles[k] === 'dock');

  // Breadth-first over free water, from the water beside the docks, until the map's edge.
  const from = new Int32Array(width * height).fill(-2);       // -2 = not reached, -1 = a start
  const queue: number[] = [];
  const free = (i: number) => terrain[i] === TERRAIN_WATER && building[i] === BUILDING_NONE;
  const visit = (i: number, prev: number) => { if (from[i] === -2 && free(i)) { from[i] = prev; queue.push(i); } };
  for (const d of docks) {
    const x = d % width;
    if (x > 0) visit(d - 1, -1);
    if (x < width - 1) visit(d + 1, -1);
    if (d >= width) visit(d - width, -1);
    if (d < width * (height - 1)) visit(d + width, -1);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % width, y = (i - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      const route: number[] = [];
      for (let t = i; t >= 0; t = from[t]) route.push(t);
      return route.reverse();
    }
    visit(i - 1, i); visit(i + 1, i); visit(i - width, i); visit(i + width, i);
  }
  return null;
}
