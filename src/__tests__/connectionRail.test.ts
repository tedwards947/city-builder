// Outside connections, phase 4 (CONNECTIONS_DESIGN.md, sim/connectionRail.ts):
// visitors riding in at a rail point. They start on the point's track, ride
// the line and get off at a station; nobody rides out.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PLAZA, BUILDING_STATION, RAIL_GROUND, ROAD_HIGHWAY, ROAD_STREET, ZONE_C, ZONE_R } from '../sim/constants';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { connectionOn, connectionStatus, openHighways, resetConnections } from '../sim/connections';
import { isRailEntryTile, openRails } from '../sim/connectionRail';
import { connectionTradeAt, dayTrippers } from '../sim/connectionTraffic';
import { cityPull, gatewayCapacity, gatewayRoads, hasGateway, touristsArriving } from '../sim/leisureTraffic';
import { railFareIncome } from '../sim/rail';
import { addTripProvider, railNode, railVolume } from '../sim/TrafficData';
import { beginTutorial, endTutorial } from '../tutorial/rules';
import { landWorld } from './pcTestWorld';

const FLOW = BALANCE.transit.flowInterval;
const C = BALANCE.connections;
const SIZE = 128, ROW = 64;
/** The rail point on the west edge of the row. */
const POINT = ROW * SIZE;

let w: World;
let transit: TransitSystem;
let pass = 0;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, z: number, level: number) => {
  w.layers.zone[idx(x, y)] = z; w.layers.devLevel[idx(x, y)] = level; w.layers.landValue[idx(x, y)] = 128;
};
/** Traffic passes until settled. */
const traffic = () => {
  for (let k = 0; k < 12; k++) { w.tick = ++pass * FLOW; transit.update(w); }
  return w.traffic!;
};

// Track in from the west edge along the row (x 0–29). The map's points are worked out with it
// there, so the west rail point is on it. A street runs along y = ROW − 2 (x 20–90).
beforeEach(() => {
  w = landWorld(SIZE);
  for (let x = 0; x <= 29; x++) expect(w.layTrack(x, ROW)).toBe(true);
  for (let x = 20; x <= 90; x++) w.setRoad(x, ROW - 2, ROAD_STREET);
  resetConnections(w);
  transit = new TransitSystem();
  pass = 0;
});

/** A station whose platform is x 30–32 on the row, at the end of the line. */
const station = () => expect(w.placeBuilding(30, ROW, BUILDING_STATION)).toBe(true);
/** The one-tile street from the station up to the street. */
const stub = () => expect(w.setRoad(31, ROW - 1, ROAD_STREET)).toBe(true);
const plaza = (x: number) => expect(w.placeBuilding(x, ROW - 4, BUILDING_PLAZA)).toBe(true);
const shops = (x: number, n: number, level = 3) => { for (let k = 0; k < n; k++) zone(x + k, ROW - 3, ZONE_C, level); };

describe('a rail point is open', () => {
  it('only when its track leads to a station that a street reaches', () => {
    expect(connectionOn(w, POINT)).toMatchObject({ kind: 'rail' });
    expect(connectionStatus(w).find((c) => c.tile === POINT)!.joined).toBe(true);
    expect(isRailEntryTile(w, POINT)).toBe(true);
    expect(isRailEntryTile(w, POINT + 1)).toBe(false);
    expect(openRails(w)).toEqual([]);                       // track, but no station
    station();
    expect(openRails(w)).toEqual([]);                       // a station nobody can leave
    expect(hasGateway(w)).toBe(false);
    stub();
    expect(openRails(w).map((c) => c.tile)).toEqual([POINT]);
    expect(hasGateway(w)).toBe(true);
    expect(gatewayCapacity(w)).toBe(C.rail.visitors);
    expect(gatewayRoads(w)).toEqual([{ capacity: C.rail.visitors, roads: [POINT], level: RAIL_GROUND }]);
  });

  it('not when the line is broken on the way', () => {
    station(); stub();
    expect(openRails(w)).toHaveLength(1);
    expect(w.clearTile(15, ROW)).toBe(true);
    expect(openRails(w)).toEqual([]);
    expect(w.layTrack(15, ROW)).toBe(true);
    expect(openRails(w)).toHaveLength(1);
  });

  it('not in the tutorial city, and again once the tutorial ends', () => {
    station(); stub();
    beginTutorial(w);
    expect(openRails(w)).toEqual([]);
    expect(isRailEntryTile(w, POINT)).toBe(false);
    endTutorial(w);
    expect(openRails(w)).toHaveLength(1);
  });
});

describe('visitors riding in', () => {
  it('tourists start on the point\'s track, ride the line, get off at the station and go to the attraction; no fare', () => {
    station(); stub(); plaza(50);
    const tourists = touristsArriving(w);
    expect(tourists).toBe(Math.min(cityPull(w), C.rail.visitors));
    expect(tourists).toBeGreaterThan(0);
    const t = traffic();
    expect(t.leisure.field.stranded).toBe(0);
    expect(t.leisure.volume[railNode(t, POINT)]).toBeCloseTo(tourists, 3);
    expect(railVolume(t, idx(15, ROW))).toBeCloseTo(tourists, 3);
    expect(t.leisure.volume[idx(31, ROW - 1)]).toBeCloseTo(tourists, 3);      // off the platform, up the stub
    expect(t.leisure.volume[idx(45, ROW - 2)]).toBeCloseTo(tourists, 3);      // along the street to the plaza
    expect(railFareIncome(w)).toBe(0);                                         // riders in pay nothing
    const trade = connectionTradeAt(w, POINT)!;
    expect(trade).toMatchObject({ kind: 'rail', joined: true, open: true, visitorsCapacity: C.rail.visitors, exports: 0, exportCapacity: 0, residentsOut: 0, residentsOutCapacity: 0, income: 0 });
    expect(trade.visitorsIn).toBeCloseTo(tourists, 6);
  });

  it('with no station to get off at, the point is no gateway and nobody comes', () => {
    plaza(50);
    expect(touristsArriving(w)).toBe(0);
    const t = traffic();
    expect(railVolume(t, idx(15, ROW))).toBe(0);
    expect(connectionTradeAt(w, POINT)).toMatchObject({ joined: true, open: false, visitorsIn: 0 });
  });

  it('day-trippers ride in for the shops', () => {
    station(); stub(); shops(40, 40);
    const want = dayTrippers(w);
    expect(want).toBe(Math.floor(40 * (BALANCE.growth.levelWeight[3] ?? 3) * C.highway.shopPull));
    expect(want).toBeGreaterThan(0);
    const t = traffic();
    expect(t.shopping.volume[railNode(t, POINT)]).toBeCloseTo(want, 3);
    expect(t.shopping.volume[idx(31, ROW - 1)]).toBeCloseTo(want, 3);
    expect(t.shopping.field.stranded).toBe(0);
    expect(connectionTradeAt(w, POINT)!.dayTrippers).toBeCloseTo(want, 6);
  });

  it('residents do not ride out: with no airport and no highway the visitors market does not run', () => {
    station(); stub();
    for (let x = 40; x < 80; x++) zone(x, ROW - 3, ZONE_R, 3);
    const t = traffic();
    expect(railVolume(t, idx(15, ROW))).toBe(0);
    expect(t.visitors.volume[idx(31, ROW - 1)]).toBe(0);
  });
});

describe('rail beside a highway', () => {
  it('they share the visitors by what each can bring: rail three times a highway', () => {
    station(); stub();
    for (const x of [44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84]) plaza(x);
    // A highway in from the north edge to the street. The north point is worked out with it there; the rail point stays.
    for (let y = 0; y <= ROW - 3; y++) w.setRoad(88, y, ROAD_HIGHWAY);
    resetConnections(w);
    expect(openHighways(w)).toHaveLength(1);
    expect(openRails(w).map((c) => c.tile)).toEqual([POINT]);
    const room = C.highway.visitors + C.rail.visitors;
    expect(gatewayCapacity(w)).toBe(room);
    const tourists = touristsArriving(w);
    expect(tourists).toBeGreaterThan(40);
    const t = traffic();
    expect(t.leisure.volume[railNode(t, POINT)]).toBeCloseTo(tourists * C.rail.visitors / room, 2);
    expect(t.leisure.volume[idx(88, 0)]).toBeCloseTo(tourists * C.highway.visitors / room, 2);
  });
});

describe('the track itself', () => {
  it('riders start on track only at a rail point: a provider\'s riders anywhere else are ignored', () => {
    station(); stub(); plaza(50);
    const mid = idx(15, ROW);
    const off = addTripProvider((_w, market, add) => { if (market === 'leisure') add(mid, 25, RAIL_GROUND); });
    try {
      const tourists = touristsArriving(w);
      const t = traffic();
      expect(railVolume(t, idx(20, ROW))).toBeCloseTo(tourists, 3);   // the point's tourists only
      expect(t.leisure.field.stranded).toBe(0);
    } finally { off(); }
  });
});
