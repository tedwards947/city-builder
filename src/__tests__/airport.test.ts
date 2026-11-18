// The airport's engine side: a 12×5 building, one per city, never turned,
// entered only from roads along its terminal frontage (the north edge at
// dx 2–9). Its traffic comes from its row in BALANCE.transit.buildings
// (Balance Lab numbers, owner-approved 2026-11-18).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { buildingTripIncome, buildingDemandMult, buildingTripsAt } from '../sim/buildingTraffic';
import { BUILDING_AIRPORT, ROAD_STREET, ROAD_HIGHWAY, ZONE_R } from '../sim/constants';
import { buildingShape, shapeRoles, isLargeBuilding, hasDocks, placementRules } from '../sim/buildingShapes';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { placementFor, placementScore } from '../input/placement';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE, type BuildingTrafficRow } from '../data/balance';
import { landWorld } from './pcTestWorld';

const AIRPORT = BUILDING_AIRPORT;
const T = BALANCE.transit as unknown as { buildings: Record<number, BuildingTrafficRow>; tripsVisitors: number; flowInterval: number };
const shipped = { rows: T.buildings, tripsVisitors: T.tripsVisitors };

let w: World;
const idx = (x: number, y: number) => w.grid.idx(x, y);

beforeEach(() => { w = landWorld(48); w.budget.money = 10_000_000; });
afterEach(() => { T.buildings = shipped.rows; T.tripsVisitors = shipped.tripsVisitors; });

describe('the airport', () => {
  it('is a 12×4 block over an 18-tile runway row, with a terminal frontage along the north edge at dx 2–9', () => {
    const shape = buildingShape(AIRPORT), roles = shapeRoles(AIRPORT);
    expect(shape.length).toBe(66);
    expect(shape.filter(([, dy]) => dy === 4).map(([dx]) => dx)).toEqual(Array.from({ length: 18 }, (_, k) => k - 3));
    expect(isLargeBuilding(AIRPORT)).toBe(true);
    expect(hasDocks(AIRPORT)).toBe(false);
    const frontage = shape.filter((_, k) => roles[k] === 'frontage');
    expect(frontage).toEqual([2, 3, 4, 5, 6, 7, 8, 9].map((dx) => [dx, 0]));
    expect(roles.filter((r) => r === 'body').length).toBe(58);
    expect(BALANCE.buildings[AIRPORT].cost).toBeGreaterThan(BALANCE.buildings[12].cost);
  });

  it('is never turned: every rotation gives the same shape, and it is stored at rotation 0', () => {
    expect(placementRules(AIRPORT).noRotation).toBe(true);
    for (const rot of [1, 2, 3]) expect(buildingShape(AIRPORT, rot)).toBe(buildingShape(AIRPORT));
    expect(w.placeBuilding(10, 10, AIRPORT, 2)).toBe(true);
    expect(w.buildings[0]).toMatchObject({ kind: AIRPORT, tx: 10, ty: 10 });
    expect(w.buildings[0].rot ?? 0).toBe(0);
    expect(w.buildingTilesAt(10, 10).length).toBe(66);
    expect(w.getBuilding(24, 14)).toBe(AIRPORT);          // the runway's far end at rotation 0
    expect(w.getBuilding(22, 13)).not.toBe(AIRPORT);      // beside the block, above the runway's overrun
    expect(placementFor(w, AIRPORT, 30, 30).rot).toBe(0);
  });

  it('is one per city: a second cannot be placed until the first is gone', () => {
    expect(w.placeBuilding(4, 4, AIRPORT)).toBe(true);
    expect(w.canPlaceBuilding(4, 20, AIRPORT)).toBe(false);
    expect(w.checkPlacement(4, 20, AIRPORT)).toMatchObject({ ok: false, blocked: [], alreadyBuilt: true });
    expect(w.placeBlocker(4, 20, AIRPORT)).toBe('alreadyBuilt');
    expect(placementScore(w.checkPlacement(4, 20, AIRPORT))).toBeGreaterThan(0);
    const second = new PlaceBuildingCommand(4, 20, AIRPORT);
    const money = w.budget.money;
    expect(second.execute(w)).toBe(false);
    expect(second.failReason).toBe('alreadyBuilt');
    expect(w.budget.money).toBe(money);
    expect(w.buildings.length).toBe(1);
    expect(w.clearTile(8, 6)).toBe(true);                 // bulldoze it by any of its tiles
    expect(w.buildings.length).toBe(0);
    expect(new PlaceBuildingCommand(4, 20, AIRPORT).execute(w)).toBe(true);
  });

  it('is entered only from streets and avenues along its terminal frontage', () => {
    w.placeBuilding(10, 10, AIRPORT);                     // x 10–21, y 10–14
    expect(w.buildingAccessRoads(10, 10)).toEqual([]);
    // Roads along the runway (south), both ends (east and west) and the tower and hangar corners: none count.
    for (let x = 9; x <= 22; x++) w.setRoad(x, 15, ROAD_STREET);
    for (let y = 9; y <= 15; y++) { w.setRoad(9, y, ROAD_STREET); w.setRoad(22, y, ROAD_STREET); }
    for (const x of [10, 11, 20, 21]) w.setRoad(x, 9, ROAD_STREET);
    expect(w.buildingAccessRoads(10, 10)).toEqual([]);
    // A highway along the frontage gives no access either.
    w.setRoad(14, 9, ROAD_HIGHWAY);
    expect(w.buildingAccessRoads(10, 10)).toEqual([]);
    // Streets along the frontage: one access road per tile.
    for (let x = 12; x <= 19; x++) w.setRoad(x, 9, ROAD_STREET);
    expect(w.buildingAccessRoads(10, 10).sort((a, b) => a - b)).toEqual([12, 13, 14, 15, 16, 17, 18, 19].map((x) => idx(x, 9)));
    expect(w.buildingAccessRoads(21, 14)).toEqual(w.buildingAccessRoads(10, 10));   // asked by any tile
  });

  it('ships with the Balance Lab numbers: passengers pay, arrivals go shopping and job hunting, shops are in more demand', () => {
    const row = shipped.rows[AIRPORT];
    expect(row).toEqual({ takes: { visitors: 100 }, incomePerTrip: { visitors: 6 }, sends: { shopping: 30, jobs: 10 }, demandMult: { C: 1.1 } });
    expect(shipped.tripsVisitors).toBe(0.05);
    expect(BALANCE.buildings[AIRPORT]).toEqual({ cost: 2_000_000, maintenance: 150 });
    w.placeBuilding(10, 10, AIRPORT);
    for (let x = 4; x <= 30; x++) w.setRoad(x, 9, ROAD_STREET);
    w.setZone(5, 8, ZONE_R); w.layers.devLevel[idx(5, 8)] = 3;
    const transit = new TransitSystem();
    w.tick = T.flowInterval; transit.update(w);
    const trips = 3 * 0.05;
    expect(buildingTripsAt(w, 10, 10)!.takes[0].trips).toBeCloseTo(trips);
    expect(buildingTripIncome(w)).toBeCloseTo(trips * 6);
    expect(buildingDemandMult(w, 'C')).toBeCloseTo(1.1);
    expect(buildingTripsAt(w, 10, 10)!.sends).toEqual([{ market: 'shopping', trips: 30 }, { market: 'jobs', trips: 10 }]);
  });

  it('with numbers in its row, shares its passengers between the exits along the frontage', () => {
    T.tripsVisitors = 0.5;
    T.buildings = { [AIRPORT]: { takes: { visitors: 80 }, incomePerTrip: { visitors: 2 }, sends: { shopping: 4 }, demandMult: { C: 1.2 } } };
    w.placeBuilding(10, 10, AIRPORT);
    for (let x = 4; x <= 30; x++) w.setRoad(x, 9, ROAD_STREET);
    w.setZone(5, 8, ZONE_R); w.layers.devLevel[idx(5, 8)] = 3;
    const transit = new TransitSystem();
    w.tick = T.flowInterval; transit.update(w);
    const visitors = w.traffic!.visitors;
    for (let x = 12; x <= 19; x++) expect(visitors.field.doorCap[idx(x, 9)]).toBeCloseTo(10);
    expect(visitors.field.doorCap[idx(11, 9)]).toBe(0);
    expect(visitors.field.doorCap[idx(20, 9)]).toBe(0);
    const trips = 3 * 0.5;
    expect(buildingTripsAt(w, 10, 10)!.takes[0].trips).toBeCloseTo(trips);
    expect(buildingTripIncome(w)).toBeCloseTo(trips * 2);
    expect(buildingDemandMult(w, 'C')).toBe(1.2);
    // Its arrivals have no shops to go to here: they are stranded, not lost.
    expect(w.traffic!.shopping.field.stranded).toBeCloseTo(3 * BALANCE.transit.tripsRtoC + 4);
  });

  it('survives a save and a load', () => {
    w.placeBuilding(10, 10, AIRPORT);
    const loaded = deserialize(serialize(w));
    expect(loaded.buildings).toEqual(w.buildings);
    expect(loaded.buildingTilesAt(15, 12).length).toBe(66);
    expect(loaded.canPlaceBuilding(10, 30, AIRPORT)).toBe(false);
  });
});
