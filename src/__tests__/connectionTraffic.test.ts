// Outside connections, phase 2 (CONNECTIONS_DESIGN.md, sim/connectionTraffic.ts):
// what travels through a joined highway point. Visitors in, export trucks
// out, residents travelling out, all on the point's one highway tile.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PLAZA, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, ZONE_I, ZONE_R } from '../sim/constants';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { connectionOn, isEntryTile, openHighways, resetConnections } from '../sim/connections';
import { connectionExportIncome, connectionTradeAt } from '../sim/connectionTraffic';
import { cityPull, gatewayCapacity, gatewayRoads, hasGateway, touristsArriving } from '../sim/leisureTraffic';
import { addDoorProvider, addTripProvider, trafficVolume } from '../sim/TrafficData';
import { landWorld } from './pcTestWorld';

const FLOW = BALANCE.transit.flowInterval;
const H = BALANCE.connections.highway;
const SIZE = 128, ROW = 64;

let w: World;
let transit: TransitSystem;
let pass = 0;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, z: number, level: number) => {
  w.layers.zone[idx(x, y)] = z; w.layers.devLevel[idx(x, y)] = level; w.layers.landValue[idx(x, y)] = 128;
};
const traffic = () => { w.tick = ++pass * FLOW; transit.update(w); return w.traffic!; };
/** The point on the west edge of the row. */
const POINT = ROW * SIZE;

// A highway in from the west edge (x 0–8), then a street along the row to x = 100.
// The map's points are worked out with the highway there, so the west one is on it.
beforeEach(() => {
  w = landWorld(SIZE);
  for (let x = 0; x <= 8; x++) w.setRoad(x, ROW, ROAD_HIGHWAY);
  for (let x = 9; x <= 100; x++) w.setRoad(x, ROW, ROAD_STREET);
  resetConnections(w);
  transit = new TransitSystem();
  pass = 0;
});

const plaza = (x: number) => expect(w.placeBuilding(x, ROW - 2, BUILDING_PLAZA)).toBe(true);
const homes = (x: number, n: number, level = 2) => { for (let k = 0; k < n; k++) zone(x + k, ROW + 1, ZONE_R, level); };
const industry = (x: number, n: number, level = 2) => { for (let k = 0; k < n; k++) zone(x + k, ROW + 1, ZONE_I, level); };

describe('a joined highway point', () => {
  it('is open once a highway stands on its tile, and only then', () => {
    expect(connectionOn(w, POINT)).toMatchObject({ kind: 'highway' });
    expect(openHighways(w).map((c) => c.tile)).toEqual([POINT]);
    expect(isEntryTile(w, POINT)).toBe(true);
    expect(isEntryTile(w, POINT + 1)).toBe(false);          // the next tile of the same highway
    w.setRoad(0, ROW, ROAD_NONE);
    expect(openHighways(w)).toEqual([]);
    expect(isEntryTile(w, POINT)).toBe(false);
    expect(connectionTradeAt(w, POINT)).toMatchObject({ joined: false, open: false, visitorsIn: 0, exports: 0, residentsOut: 0 });
    expect(connectionTradeAt(w, POINT + 1)).toBeNull();
  });

  it('carries nothing in the tutorial city', () => {
    w.tutorial = { step: 0 };
    plaza(40); industry(60, 10); homes(20, 10);
    expect(openHighways(w)).toEqual([]);
    expect(hasGateway(w)).toBe(false);
    const t = traffic();
    expect(trafficVolume(t, POINT)).toBe(0);
    expect(connectionExportIncome(w)).toBe(0);
  });
});

describe('visitors in', () => {
  it('the point is a gateway: tourists arrive on its tile and drive in to the attraction', () => {
    plaza(40);
    expect(hasGateway(w)).toBe(true);
    expect(gatewayCapacity(w)).toBe(H.visitors);
    expect(gatewayRoads(w)).toEqual([{ capacity: H.visitors, roads: [POINT] }]);
    const pull = cityPull(w);
    expect(pull).toBeGreaterThan(0);
    expect(touristsArriving(w)).toBe(Math.min(pull, H.visitors));
    const t = traffic();
    // No homes: every leisure trip on the road is a tourist, and they all pass along the highway.
    expect(t.leisure.volume[POINT]).toBeCloseTo(touristsArriving(w), 3);
    expect(t.leisure.volume[idx(5, ROW)]).toBeCloseTo(touristsArriving(w), 3);
    expect(t.leisure.volume[idx(30, ROW)]).toBeCloseTo(touristsArriving(w), 3);
    expect(t.leisure.field.stranded).toBe(0);
    expect(connectionTradeAt(w, POINT)).toMatchObject({ kind: 'highway', joined: true, open: true, visitorsCapacity: H.visitors });
    expect(connectionTradeAt(w, POINT)!.visitorsIn).toBeCloseTo(touristsArriving(w), 6);
  });

  it('no more than it can bring, however strong the pull', () => {
    for (const x of [20, 30, 40, 50, 60, 70, 80]) plaza(x);
    expect(cityPull(w)).toBeGreaterThan(H.visitors);
    expect(touristsArriving(w)).toBe(H.visitors);
    expect(traffic().leisure.volume[POINT]).toBeCloseTo(H.visitors, 3);
  });

  it('with the highway off the point there is no gateway, and nobody comes', () => {
    plaza(40);
    w.setRoad(0, ROW, ROAD_NONE);
    expect(hasGateway(w)).toBe(false);
    expect(touristsArriving(w)).toBe(0);
    expect(traffic().leisure.volume[idx(5, ROW)]).toBe(0);
  });
});

describe('exports out', () => {
  it('industry within reach sends trucks out by the highway, and each one earns the port\'s price', () => {
    industry(20, 10, 3);
    const t = traffic();
    const wanted = 10 * 3 * BALANCE.port.exportTripsPerLevel;                 // 3 trucks a tick
    expect(t.exports.volume[POINT]).toBeCloseTo(wanted, 3);
    expect(t.exports.volume[idx(12, ROW)]).toBeCloseTo(wanted, 3);
    const trade = connectionTradeAt(w, POINT)!;
    expect(trade.exports).toBeCloseTo(wanted, 3);
    expect(trade.exportCapacity).toBe(H.exportTrucks);
    expect(trade.income).toBeCloseTo(wanted * BALANCE.port.exportIncomePerTrip, 3);
    expect(connectionExportIncome(w)).toBeCloseTo(trade.income, 6);
  });

  it('it takes no more trucks than its room, and is paid for no more', () => {
    industry(15, 80, 3);                                                        // 24 trucks a tick wanted
    traffic();
    expect(connectionTradeAt(w, POINT)!.exports).toBeCloseTo(H.exportTrucks, 3);
    expect(connectionExportIncome(w)).toBeCloseTo(H.exportTrucks * BALANCE.port.exportIncomePerTrip, 3);
  });

  it('the money reaches the budget', () => {
    industry(20, 10, 3);
    traffic();
    const economy = new EconomySystem();
    const before = w.budget.money;
    economy.update(w);
    const withPoint = w.budget.money - before;
    w.setRoad(0, ROW, ROAD_NONE);
    traffic();
    const mid = w.budget.money;
    economy.update(w);
    const without = w.budget.money - mid;
    // Losing the point tile also saves a tile of highway upkeep, so the gap is at least the export money less that.
    expect(withPoint - without).toBeGreaterThan(3 * BALANCE.port.exportIncomePerTrip - 5);
  });

  it('industry beyond the port\'s reach exports nothing', () => {
    const reach = BALANCE.port.reach;
    (BALANCE.port as { reach: number }).reach = 10;
    try {
      industry(80, 10, 3);
      const t = traffic();
      expect(t.exports.volume[POINT]).toBe(0);
      expect(connectionExportIncome(w)).toBe(0);
    } finally { (BALANCE.port as { reach: number }).reach = reach; }
  });
});

describe('residents travelling out', () => {
  it('homes send visitors out by the highway, up to its room; they pay nothing', () => {
    homes(20, 40, 3);
    const t = traffic();
    const wanted = 40 * 3 * BALANCE.transit.tripsVisitors;                     // 6 a tick
    expect(t.visitors.volume[POINT]).toBeCloseTo(wanted, 3);
    const trade = connectionTradeAt(w, POINT)!;
    expect(trade.residentsOut).toBeCloseTo(wanted, 3);
    expect(trade.residentsOutCapacity).toBe(H.residentsOut);
    expect(trade.income).toBe(0);
  });

  it('with no point joined (and no airport) nobody travels', () => {
    homes(20, 40, 3);
    w.setRoad(0, ROW, ROAD_NONE);
    expect(traffic().visitors.volume[idx(5, ROW)]).toBe(0);
  });
});

describe('the highway itself', () => {
  it('everything shares the one tile: in and out add up there', () => {
    plaza(40); homes(20, 40, 3);
    for (let x = 12; x <= 21; x++) zone(x, ROW - 1, ZONE_I, 3);              // industry on the north side, within reach
    const t = traffic();
    const tourists = touristsArriving(w), trucks = 3, out = 6;
    // Residents going to the plaza do not use the highway; these three do.
    expect(trafficVolume(t, POINT)).toBeCloseTo(tourists + trucks + out, 2);
  });

  it('any other highway tile still has no doors: a building\'s trips on one are ignored', () => {
    for (let x = 30; x <= 34; x++) w.setRoad(x, ROW - 10, ROAD_HIGHWAY);
    homes(20, 40, 3);
    const mid = idx(32, ROW - 10);
    const offDoor = addDoorProvider((_w, market, add) => { if (market === 'visitors') add(mid, 50); });
    const offTrip = addTripProvider((_w, market, add) => { if (market === 'visitors') add(mid, 50); });
    try {
      const t = traffic();
      expect(t.visitors.field.doorCap[mid]).toBe(0);
      expect(t.visitors.volume[mid]).toBe(0);
      expect(t.visitors.field.doorCap[POINT]).toBe(H.residentsOut);
    } finally { offDoor(); offTrip(); }
  });

  it('a street or avenue cannot stand on the point, so a point is always entered by highway', () => {
    w.setRoad(0, ROW, ROAD_NONE);
    expect(w.setRoad(0, ROW, ROAD_AVENUE)).toBe(false);
    expect(w.setRoad(0, ROW, ROAD_HIGHWAY)).toBe(true);
  });
});
