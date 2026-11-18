// Buildings in the traffic system (sim/buildingTraffic.ts): a row in
// BALANCE.transit.buildings makes a building kind take trips, send trips,
// earn per trip and scale growth demand. The shipped rows are all at no
// effect, so these tests set rows for their duration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { buildingTripIncome, buildingDemandMult, buildingTripsAt } from '../sim/buildingTraffic';
import { BUILDING_POLICE, BUILDING_SCHOOL, BUILDING_PARK, ROAD_STREET, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';
import { BALANCE, type BuildingTrafficRow } from '../data/balance';
import { landWorld } from './pcTestWorld';

const T = BALANCE.transit as unknown as { buildings: Record<number, BuildingTrafficRow>; tripsVisitors: number; tripsRtoI: number; tripsRtoC: number; flowInterval: number };
const shipped = { rows: T.buildings, tripsVisitors: T.tripsVisitors };

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
const rows = (r: Record<number, BuildingTrafficRow>) => { T.buildings = r; };

// A street along y = 13 from x = 4 to 28. Homes (two level-2 lots, four levels) at x 5–6 on its
// south side. Buildings go on its north side at y = 12, so each has one access road, under it.
beforeEach(() => {
  T.buildings = {};
  T.tripsVisitors = 0;
  w = landWorld();
  for (let x = 4; x <= 28; x++) w.setRoad(x, 13, ROAD_STREET);
  for (const x of [5, 6]) zone(x, 14, ZONE_R, 2);
  transit = new TransitSystem();
  pass = 0;
});
afterEach(() => { T.buildings = shipped.rows; T.tripsVisitors = shipped.tripsVisitors; });

describe('buildings in traffic', () => {
  it('services ship at no effect: their rows take, send and earn nothing (the airport is tuned: airport.test.ts)', () => {
    T.buildings = shipped.rows;
    T.tripsVisitors = shipped.tripsVisitors;
    for (const x of [20, 21]) zone(x, 14, ZONE_I, 3);
    const before = traffic().markets.map((m) => Array.from(m.volume).join(','));
    expect(w.placeBuilding(10, 12, BUILDING_POLICE)).toBe(true);
    expect(w.placeBuilding(12, 12, BUILDING_SCHOOL)).toBe(true);
    const t = traffic();
    expect(t.markets.map((m) => Array.from(m.volume).join(','))).toEqual(before);
    expect(sum(t.visitors.volume)).toBe(0);
    expect(buildingTripIncome(w)).toBe(0);
    for (const z of ['R', 'C', 'I'] as const) expect(buildingDemandMult(w, z)).toBe(1);
    expect(buildingTripsAt(w, 10, 12)).toEqual({ connected: true, takes: [], sends: [], income: 0 });
    for (const kind of [4, 5, 6, 7]) {
      const row = shipped.rows[kind];
      for (const part of [row.takes, row.sends, row.incomePerTrip]) for (const v of Object.values(part ?? {})) expect(v).toBe(0);
    }
  });

  it('a building that takes job trips is a door for commuters, nearer than the industry', () => {
    for (const x of [24, 25]) zone(x, 14, ZONE_I, 3);
    rows({ [BUILDING_POLICE]: { takes: { jobs: 100 } } });
    w.placeBuilding(8, 12, BUILDING_POLICE);
    const t = traffic();
    const trips = 4 * T.tripsRtoI;
    expect(t.jobs.field.doorCap[idx(8, 13)]).toBeCloseTo(100);
    expect(t.jobs.field.doorLoad[idx(8, 13)]).toBeCloseTo(trips);
    expect(t.jobs.volume[idx(7, 13)]).toBeCloseTo(trips);     // on the street between the homes and the station
    expect(t.jobs.volume[idx(15, 13)]).toBe(0);               // and none goes on to the industry
    expect(buildingTripsAt(w, 8, 12)).toMatchObject({ connected: true, takes: [{ market: 'jobs', capacity: 100 }] });
    expect(buildingTripsAt(w, 8, 12)!.takes[0].trips).toBeCloseTo(trips);
  });

  it('gives homes no accessibility: only zones count as somewhere to work or shop', () => {
    // Homes at x 5–6; industry 19 tiles east, so some accessibility but far from full.
    for (const x of [24, 25]) zone(x, 14, ZONE_I, 3);
    traffic();
    const before = w.layers.accessibility[idx(5, 14)];
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(200);
    // A station next door that takes commuters and shoppers: traffic goes to it, accessibility does not move.
    rows({ [BUILDING_POLICE]: { takes: { jobs: 100, shopping: 100 } } });
    w.placeBuilding(7, 12, BUILDING_POLICE);
    const t = traffic();
    expect(t.jobs.field.doorLoad[idx(7, 13)]).toBeGreaterThan(0);
    expect(w.layers.accessibility[idx(5, 14)]).toBe(before);
    expect(w.layers.accessibility[idx(6, 14)]).toBeGreaterThan(0);
    // With no zone to work or shop at, the station alone gives none at all.
    w.layers.devLevel[idx(24, 14)] = 0; w.layers.devLevel[idx(25, 14)] = 0;
    traffic();
    expect(w.layers.accessibility[idx(5, 14)]).toBe(0);
  });

  it('a full building passes the rest on', () => {
    for (const x of [14, 15]) zone(x, 14, ZONE_I, 3);
    rows({ [BUILDING_POLICE]: { takes: { jobs: 0.5 } } });
    w.placeBuilding(8, 12, BUILDING_POLICE);
    const t = traffic();
    const trips = 4 * T.tripsRtoI;
    expect(buildingTripsAt(w, 8, 12)!.takes[0].trips).toBeCloseTo(0.5);
    expect(t.jobs.volume[idx(12, 13)]).toBeCloseTo(trips - 0.5);   // the overflow goes on to the industry
  });

  it('what a building takes is shared between the roads that touch it', () => {
    for (let x = 4; x <= 28; x++) w.setRoad(x, 11, ROAD_STREET);
    rows({ [BUILDING_POLICE]: { takes: { jobs: 10 } } });
    w.placeBuilding(8, 12, BUILDING_POLICE);
    const t = traffic();
    expect(t.jobs.field.doorCap[idx(8, 13)]).toBeCloseTo(5);
    expect(t.jobs.field.doorCap[idx(8, 11)]).toBeCloseTo(5);
  });

  it('homes send visitors to a building that takes them, and the city is paid per visitor', () => {
    T.tripsVisitors = 0.5;
    rows({ [BUILDING_PARK]: { takes: { visitors: 100 }, incomePerTrip: { visitors: 3 } } });
    expect(sum(traffic().visitors.volume)).toBe(0);            // nowhere to visit yet
    w.placeBuilding(16, 12, BUILDING_PARK);
    const t = traffic();
    const trips = 4 * 0.5;
    expect(t.visitors.volume[idx(10, 13)]).toBeCloseTo(trips);
    expect(t.visitors.volume[idx(20, 13)]).toBe(0);
    expect(buildingTripsAt(w, 16, 12)).toMatchObject({ takes: [{ market: 'visitors', capacity: 100 }] });
    expect(buildingTripsAt(w, 16, 12)!.income).toBeCloseTo(trips * 3);
    expect(buildingTripIncome(w)).toBeCloseTo(trips * 3);
    // In the budget, on top of tax and untouched by the tax level.
    new EconomySystem().update(w);
    const withVisitors = w.budget.income;
    rows({ [BUILDING_PARK]: { takes: { visitors: 100 } } });
    new EconomySystem().update(w);
    expect(withVisitors - w.budget.income).toBeCloseTo(trips * 3);
  });

  it('a building is paid only for the trips it has room for', () => {
    T.tripsVisitors = 0.5;
    rows({ [BUILDING_PARK]: { takes: { visitors: 1 }, incomePerTrip: { visitors: 3 } } });
    w.placeBuilding(16, 12, BUILDING_PARK);
    traffic();
    expect(buildingTripsAt(w, 16, 12)!.takes[0].trips).toBeCloseTo(1);
    expect(buildingTripIncome(w)).toBeCloseTo(3);
  });

  it('with the building bulldozed the visitors market holds nothing again', () => {
    T.tripsVisitors = 0.5;
    rows({ [BUILDING_PARK]: { takes: { visitors: 100 }, incomePerTrip: { visitors: 3 } } });
    w.placeBuilding(16, 12, BUILDING_PARK);
    expect(sum(traffic().visitors.volume)).toBeGreaterThan(0);
    expect(w.clearTile(16, 12)).toBe(true);
    const t = traffic();
    expect(sum(t.visitors.volume)).toBe(0);
    expect(buildingTripIncome(w)).toBe(0);
  });

  it('a building that sends trips puts them on its road, bound for the nearest door', () => {
    for (const x of [24, 25]) zone(x, 14, ZONE_C, 3);
    rows({ [BUILDING_SCHOOL]: { sends: { shopping: 3 } } });
    w.placeBuilding(16, 12, BUILDING_SCHOOL);
    const t = traffic();
    const fromHomes = 4 * T.tripsRtoC;
    expect(t.shopping.volume[idx(10, 13)]).toBeCloseTo(fromHomes);       // west of the building: the homes' trips alone
    expect(t.shopping.volume[idx(20, 13)]).toBeCloseTo(fromHomes + 3);   // east of it: the building's too
    expect(t.shopping.field.demand).toBeCloseTo(fromHomes + 3);
    expect(buildingTripsAt(w, 16, 12)).toMatchObject({ sends: [{ market: 'shopping', trips: 3 }] });
  });

  it('trips a building sends with nowhere to go are stranded, as a zone\'s are', () => {
    rows({ [BUILDING_SCHOOL]: { sends: { jobs: 3 } } });
    w.placeBuilding(16, 12, BUILDING_SCHOOL);
    const t = traffic();
    expect(sum(t.jobs.volume)).toBe(0);
    expect(t.jobs.field.stranded).toBeCloseTo(4 * T.tripsRtoI + 3);
  });

  it('one building can feed another in a market no zone takes part in', () => {
    rows({ [BUILDING_SCHOOL]: { sends: { visitors: 2 } }, [BUILDING_PARK]: { takes: { visitors: 10 } } });
    w.placeBuilding(10, 12, BUILDING_SCHOOL);
    w.placeBuilding(20, 12, BUILDING_PARK);
    const t = traffic();
    expect(t.visitors.volume[idx(15, 13)]).toBeCloseTo(2);
    expect(buildingTripsAt(w, 20, 12)!.takes[0].trips).toBeCloseTo(2);
  });

  it('a building with no road to it does nothing', () => {
    T.tripsVisitors = 0.5;
    rows({ [BUILDING_PARK]: { takes: { visitors: 100 }, sends: { shopping: 3 }, incomePerTrip: { visitors: 3 }, demandMult: { C: 1.5 } } });
    w.placeBuilding(16, 5, BUILDING_PARK);
    const t = traffic();
    expect(sum(t.visitors.volume)).toBe(0);
    expect(t.shopping.field.demand).toBe(0);
    expect(buildingTripIncome(w)).toBe(0);
    expect(buildingDemandMult(w, 'C')).toBe(1);
    expect(buildingTripsAt(w, 16, 5)).toMatchObject({ connected: false, sends: [{ market: 'shopping', trips: 0 }] });
  });

  it('scales growth demand while one of the kind stands on a road, once however many there are', () => {
    rows({ [BUILDING_PARK]: { demandMult: { C: 1.5 } }, [BUILDING_SCHOOL]: { demandMult: { C: 2, I: 0.5 } } });
    expect(buildingDemandMult(w, 'C')).toBe(1);
    w.placeBuilding(16, 12, BUILDING_PARK);
    w.placeBuilding(18, 12, BUILDING_PARK);
    expect(buildingDemandMult(w, 'C')).toBe(1.5);
    expect(buildingDemandMult(w, 'I')).toBe(1);
    expect(buildingDemandMult(w, 'R')).toBe(1);
    w.placeBuilding(20, 12, BUILDING_SCHOOL);
    expect(buildingDemandMult(w, 'C')).toBe(3);
    expect(buildingDemandMult(w, 'I')).toBe(0.5);
  });
});
