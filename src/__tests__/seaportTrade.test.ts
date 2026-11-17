// Seaport, phase 3: exports, imports, the shops-need-goods rule and the
// industry boost. Everything ships switched off, so these tests set
// BALANCE's numbers for their duration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { seaports, hasConnectedPort, portTradeAt, exportIncome, portIndustrialDemandMult, portTrade, shipRoute } from '../sim/seaport';
import { PollutionSystem } from '../sim/systems/PollutionSystem';
import { pcQuote } from '../sim/politics';
import { goodsShortage, goodsIncomeMult, goodsDemandMult } from '../sim/goods';
import { BUILDING_SEAPORT, TERRAIN_WATER, ROAD_STREET, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home } from './pcTestWorld';

const P = BALANCE.port as Record<string, number>;
const G = BALANCE.goods as Record<string, number>;
const T = BALANCE.transit;
const shipped = { port: { ...P }, goods: { ...G } };
const PORT = BUILDING_SEAPORT;

let w: World;
let transit: TransitSystem;
let pass = 0;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, z: number, level: number) => {
  w.layers.zone[idx(x, y)] = z; w.layers.devLevel[idx(x, y)] = level; w.layers.landValue[idx(x, y)] = 128;
};
/** One traffic pass (each call is a new traffic tick). */
const traffic = () => { w.tick = ++pass * T.flowInterval; transit.update(w); return w.traffic!; };
const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);

// Sea along the north (y 0–9). A port's yard at x 10–13, y 10–12, with a street along y = 13
// from x = 4 to 28: the four road tiles under the yard are its doors. Industry (three level-3
// lots) at x 20–22 and shops (two level-2 lots) at x 5–6, all on the street's south side.
beforeEach(() => {
  w = landWorld();
  for (let y = 0; y <= 9; y++) for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, y)] = TERRAIN_WATER;
  for (let x = 4; x <= 28; x++) w.setRoad(x, 13, ROAD_STREET);
  for (const x of [20, 21, 22]) zone(x, 14, ZONE_I, 3);
  for (const x of [5, 6]) zone(x, 14, ZONE_C, 2);
  transit = new TransitSystem();
  pass = 0;
});
afterEach(() => { Object.assign(P, shipped.port); Object.assign(G, shipped.goods); });

const exportsOn = () => { P.exportTripsPerLevel = 0.5; P.exportCapacity = 100; P.exportIncomePerTrip = 2; };

describe('seaport trade', () => {
  it('ships switched off: a connected port changes no traffic and earns nothing', () => {
    expect(shipped.port).toMatchObject({ exportTripsPerLevel: 0, exportCapacity: 0, exportIncomePerTrip: 0, importCapacity: 0, industrialDemandMult: 1 });
    expect(shipped.goods).toEqual({ shortageIncomePenalty: 0, shortageDemandPenalty: 0 });
    const before = traffic().markets.map((m) => Array.from(m.volume).join(','));
    expect(w.placeBuilding(10, 10, PORT)).toBe(true);
    expect(hasConnectedPort(w)).toBe(true);
    const t = traffic();
    expect(t.markets.map((m) => Array.from(m.volume).join(','))).toEqual(before);
    expect(sum(t.exports.volume)).toBe(0);
    expect(exportIncome(w)).toBe(0);
    expect(portTradeAt(w, 11, 9)).toEqual({ connected: true, exports: 0, exportCapacity: 0, imports: 0, importCapacity: 0, income: 0 });
    expect(portIndustrialDemandMult(w)).toBe(1);
    expect(goodsIncomeMult(w)).toBe(1);
    expect(goodsDemandMult(w)).toBe(1);
  });

  it('industry within reach exports through a connected port, and the city is paid per trip', () => {
    exportsOn();
    w.placeBuilding(10, 10, PORT);
    const t = traffic();
    const trips = 9 * 0.5;                                  // nine industry levels
    expect(portTradeAt(w, 10, 10)!.exports).toBeCloseTo(trips);
    expect(portTradeAt(w, 10, 10)!.income).toBeCloseTo(trips * 2);
    expect(exportIncome(w)).toBeCloseTo(trips * 2);
    // The trucks are on the street between the industry and the port, and nowhere west of it.
    expect(t.exports.volume[idx(16, 13)]).toBeCloseTo(trips);
    expect(t.exports.volume[idx(7, 13)]).toBe(0);
    // And in the budget, on top of tax, untouched by the tax level.
    new EconomySystem().update(w);
    const withExports = w.budget.income;
    P.exportIncomePerTrip = 0;
    new EconomySystem().update(w);
    expect(withExports - w.budget.income).toBeCloseTo(trips * 2);
    P.exportIncomePerTrip = 2;
    w.budget.taxLevel = 20;
    new EconomySystem().update(w);
    expect(w.budget.income).toBeCloseTo((withExports - trips * 2) * 2 + trips * 2);
  });

  it('a port takes no more than its capacity; the rest is not paid for', () => {
    exportsOn();
    P.exportCapacity = 2;
    w.placeBuilding(10, 10, PORT);
    traffic();
    expect(portTradeAt(w, 10, 10)).toMatchObject({ exports: 2, exportCapacity: 2, income: 4 });
    expect(exportIncome(w)).toBeCloseTo(4);
    expect(w.traffic!.exports.field.demandRatio).toBeCloseTo(4.5 / 2);
  });

  it('with no road to its yard a port trades nothing, and the export market does not run', () => {
    exportsOn();
    w.placeBuilding(10, 10, PORT);
    for (let x = 4; x <= 28; x++) w.clearTile(x, 13);
    for (let x = 16; x <= 28; x++) w.setRoad(x, 13, ROAD_STREET);      // the street stops short of the port
    const t = traffic();
    expect(hasConnectedPort(w)).toBe(false);
    expect(sum(t.exports.volume)).toBe(0);
    expect(t.exports.field.count).toBe(0);
    expect(portTradeAt(w, 10, 10)).toMatchObject({ connected: false, exports: 0 });
    // Joined up, it trades from the next pass; bulldozed, it stops.
    for (let x = 4; x <= 15; x++) w.setRoad(x, 13, ROAD_STREET);
    traffic();
    expect(portTradeAt(w, 10, 10)!.exports).toBeCloseTo(4.5);
    w.clearTile(10, 10);
    const after = traffic();
    expect(seaports(w)).toEqual([]);
    expect(sum(after.exports.volume)).toBe(0);
    expect(exportIncome(w)).toBe(0);
  });

  it('industry further than the reach does not export', () => {
    exportsOn();
    w.placeBuilding(10, 10, PORT);
    P.reach = 3;                                             // the nearest factory is seven tiles from the port's doors
    expect(sum(traffic().exports.volume)).toBe(0);
    P.reach = 8;                                             // the factories at 20 and 21 are within 8; the one at 22 is not
    traffic();
    expect(portTradeAt(w, 10, 10)!.exports).toBeCloseTo(6 * 0.5);
  });

  it('a truck takes up more road than it counts for in trade', () => {
    exportsOn();
    P.truckWeight = 3;
    w.placeBuilding(10, 10, PORT);
    const t = traffic();
    expect(t.exports.volume[idx(16, 13)]).toBeCloseTo(4.5 * 3);        // road load
    expect(portTradeAt(w, 10, 10)!.exports).toBeCloseTo(4.5);         // trips traded
    expect(exportIncome(w)).toBeCloseTo(9);
  });

  it('two ports share the exports between them', () => {
    exportsOn();
    P.exportCapacity = 3;
    w.placeBuilding(10, 10, PORT);
    w.placeBuilding(15, 10, PORT);                           // yard x 15–18: nearer the industry
    traffic();
    const near = portTradeAt(w, 15, 10)!, far = portTradeAt(w, 10, 10)!;
    expect(near.exports).toBeCloseTo(3);                     // fills first
    expect(far.exports).toBeCloseTo(1.5);                    // takes the overflow
    expect(exportIncome(w)).toBeCloseTo(4.5 * 2);
  });
});

describe('imports and the goods shortage', () => {
  const shopTrips = 4 * T.tripsCtoI;                         // four shop levels

  it('shops fetch goods from a port that is nearer than industry', () => {
    P.importCapacity = 10;
    const plain = traffic();
    expect(plain.goods.field.doorLoad[idx(20, 13)]).toBeGreaterThan(0);          // from the factories
    w.placeBuilding(10, 10, PORT);
    const t = traffic();
    expect(portTradeAt(w, 10, 10)!.imports).toBeCloseTo(shopTrips);
    expect(sum(t.goods.field.doorLoad.subarray(idx(20, 13), idx(23, 13)))).toBeCloseTo(0);
    expect(t.goods.volume[idx(8, 13)]).toBeCloseTo(shopTrips);                    // shop → port
    expect(t.goods.volume[idx(16, 13)]).toBeCloseTo(0);
  });

  it('a shortage is how far supply falls short of what shops want; no source at all is a full shortage', () => {
    expect(goodsShortage(w)).toBe(0);                        // no traffic pass yet
    traffic();
    expect(goodsShortage(w)).toBe(0);                        // 18 trips of supply for 1.52 wanted
    // One factory level left: 2 trips of supply. Shops grown to want more.
    for (const x of [20, 21, 22]) zone(x, 14, 0, 0);
    zone(20, 14, ZONE_I, 1);
    for (const x of [5, 6]) zone(x, 14, ZONE_C, 3);
    zone(7, 14, ZONE_C, 3);
    zone(8, 14, ZONE_R, 2);                                  // someone to shop there
    traffic();
    const wanted = 9 * T.tripsCtoI, supply = 1 * T.goodsCapacity;
    expect(goodsShortage(w)).toBeCloseTo(1 - supply / wanted);
    // No industry and no port: shops have nowhere to fetch from.
    zone(20, 14, 0, 0);
    traffic();
    expect(goodsShortage(w)).toBe(1);
    // A port's imports end the shortage.
    P.importCapacity = 10;
    w.placeBuilding(10, 10, PORT);
    traffic();
    expect(goodsShortage(w)).toBe(0);
    expect(portTradeAt(w, 10, 10)!.imports).toBeCloseTo(wanted);
  });

  it('a shortage cuts shops\' income and commercial demand by the penalties, and nothing else', () => {
    for (const x of [20, 21, 22]) zone(x, 14, 0, 0);
    zone(8, 14, ZONE_R, 2);
    zone(24, 14, ZONE_I, 2);
    w.clearTile(23, 13);                                     // the factory at 24 is cut off: no goods, but it still pays tax
    traffic();
    expect(goodsShortage(w)).toBe(1);
    const econ = new EconomySystem(), lv = new LandValueSystem();
    lv.update(w);                                            // settles land value before income is compared
    lv.update(w);
    const plain = { income: 0, c: w.stats.cDemand, r: w.stats.rDemand, i: w.stats.iDemand };
    econ.update(w);
    plain.income = w.budget.income;
    // With the whole of shops' income taken away, the difference is what shops pay.
    G.shortageIncomePenalty = 1;
    econ.update(w);
    const shops = plain.income - w.budget.income;
    expect(shops).toBeGreaterThan(0);
    expect(w.budget.income).toBeGreaterThan(0);              // the factory still pays
    G.shortageIncomePenalty = 0.4;
    G.shortageDemandPenalty = 0.5;
    expect(goodsIncomeMult(w)).toBeCloseTo(0.6);
    expect(goodsDemandMult(w)).toBeCloseTo(0.5);
    econ.update(w);
    expect(plain.income - w.budget.income).toBeCloseTo(shops * 0.4);
    lv.update(w);
    expect(w.stats.cDemand).toBeCloseTo(Math.max(BALANCE.demand.min, plain.c * 0.5));
    expect(w.stats.rDemand).toBe(plain.r);
    expect(w.stats.iDemand).toBe(plain.i);
  });
});

describe('the industry boost', () => {
  it('a connected port multiplies industrial demand city-wide; an unconnected one does not', () => {
    zone(8, 14, ZONE_R, 3);
    const lv = new LandValueSystem();
    lv.update(w);
    const plain = { i: w.stats.iDemand, c: w.stats.cDemand, r: w.stats.rDemand };
    P.industrialDemandMult = 1.5;
    lv.update(w);
    expect(w.stats.iDemand).toBe(plain.i);                   // no port
    w.placeBuilding(10, 10, PORT);
    expect(portIndustrialDemandMult(w)).toBe(1.5);
    lv.update(w);
    expect(w.stats.iDemand).toBeCloseTo(Math.min(BALANCE.demand.max, plain.i * 1.5));
    expect(w.stats.cDemand).toBe(plain.c);
    expect(w.stats.rDemand).toBe(plain.r);
    for (let x = 4; x <= 28; x++) w.clearTile(x, 13);        // the road goes: the boost with it
    expect(portIndustrialDemandMult(w)).toBe(1);
  });
});

describe('ships', () => {
  it('the route runs over open water from just off the docks to the edge of the map', () => {
    w.placeBuilding(10, 10, PORT);                           // docks at y = 9; the sea is y 0–9
    const anchor = idx(10, 10);
    const route = shipRoute(w, anchor)!;
    expect(route.length).toBe(9);                            // y = 8 down to y = 0, straight out
    expect(Math.floor(route[0] / 32)).toBe(8);               // beside a dock
    expect(Math.floor(route[route.length - 1] / 32)).toBe(0);
    for (const i of route) {
      expect(w.layers.terrain[i]).toBe(TERRAIN_WATER);
      expect(w.layers.building[i]).toBe(0);
    }
    for (let k = 1; k < route.length; k++) {
      const d = Math.abs(route[k] - route[k - 1]);
      expect(d === 1 || d === 32).toBe(true);                // tile to tile
    }
    expect(shipRoute(w, anchor)).toBe(route);                // remembered until the map changes
    expect(shipRoute(w, idx(11, 10))).toBeNull();            // not an anchor
    expect(shipRoute(w, idx(20, 20))).toBeNull();            // no port
  });

  it('the route passes under a bridge, goes round land, and is null when the docks are shut in', () => {
    w.placeBuilding(10, 10, PORT);
    const anchor = idx(10, 10);
    for (let x = 0; x < 32; x++) w.setRoad(x, 5, ROAD_STREET);                 // a bridge right across the sea
    expect(shipRoute(w, anchor)!.length).toBe(9);
    for (let x = 0; x < 32; x++) w.clearTile(x, 5);
    // A wall of land across the sea at y = 4 with one gap at x = 30: the ship goes round.
    for (let x = 0; x < 30; x++) w.layers.terrain[idx(x, 4)] = 0;
    w.setRoad(0, 20, ROAD_STREET); w.clearTile(0, 20);                        // any edit: the route is worked out again
    const round = shipRoute(w, anchor)!;
    expect(round.length).toBeGreaterThan(9);
    expect(round.every((i) => w.layers.terrain[i] === TERRAIN_WATER)).toBe(true);
    // Closed altogether, and the sea's own side edges walled off: nowhere to go.
    for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, 4)] = 0;
    for (let y = 5; y <= 9; y++) { w.layers.terrain[idx(0, y)] = 0; w.layers.terrain[idx(31, y)] = 0; }
    w.setRoad(0, 20, ROAD_STREET); w.clearTile(0, 20);
    expect(shipRoute(w, anchor)).toBeNull();
  });

  it('ships call in proportion to the trade', () => {
    exportsOn();
    P.importCapacity = 10;
    P.tripsPerShip = 10;
    w.placeBuilding(10, 10, PORT);
    const anchor = idx(10, 10);
    expect(portTrade(w, anchor)).toEqual({ exportsPerDay: 0, importsPerDay: 0, shipsPerDay: 0, capacity: 110 * BALANCE.ticksPerDay });
    traffic();
    const t = portTrade(w, anchor)!;
    const day = BALANCE.ticksPerDay;
    expect(t.exportsPerDay).toBeCloseTo(4.5 * day);
    expect(t.importsPerDay).toBeCloseTo(4 * T.tripsCtoI * day);
    expect(t.shipsPerDay).toBeCloseTo((t.exportsPerDay + t.importsPerDay) / 10);
    expect(portTrade(w, idx(11, 10))).toBeNull();
    expect(portTrade(w, idx(20, 20))).toBeNull();
  });
});

describe('the port as a neighbour', () => {
  it('homes object to the yard, not to the docks', () => {
    const N = BALANCE.politicalCapital.nuisance as { buildingPerResident: Record<number, number> };
    const was = N.buildingPerResident[PORT];
    N.buildingPerResident[PORT] = 1;
    try {
      w.budget.politicalCapital = 1000;
      home(w, 15, 11);                                       // two tiles east of the yard (x 10–13): full weight
      // A spit of land level with the docks: this home is two tiles from a dock but three from the yard.
      w.layers.terrain[idx(14, 9)] = 0; w.layers.terrain[idx(15, 9)] = 0;
      home(w, 15, 9);
      const q = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: PORT });
      const parts = Object.fromEntries(q.parts.filter((p) => p.reason === 'nuisance').map((p) => [p.tx + ',' + p.ty, p.strength]));
      expect(parts).toEqual({ '15,11': 1, '15,9': 0.6 });
    } finally { N.buildingPerResident[PORT] = was; }
  });

  it('the yard pollutes when its output is set; the docks do not', () => {
    const Pol = BALANCE.pollution as { seaportOutput: number };
    w.placeBuilding(10, 10, PORT);
    const sys = new PollutionSystem();
    for (let k = 0; k < 5; k++) { w.tick++; sys.update(w); }
    expect(w.layers.pollution[idx(11, 11)]).toBe(0);
    Pol.seaportOutput = 20;
    try {
      w.tick++; sys.update(w);
      // After one step: the yard holds what it put out (less what spread); a dock only what spread to it.
      expect(w.layers.pollution[idx(11, 11)]).toBeGreaterThan(w.layers.pollution[idx(11, 9)]);
      expect(w.layers.pollution[idx(11, 11)]).toBeGreaterThan(10);
    } finally { Pol.seaportOutput = 0; }
  });
});
