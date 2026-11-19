import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { railResult, starterLineCost, starterLineUpkeep, STARTER_TILES } from './rail';
import { buildLivingCity } from '../__tests__/fixtures/testCity';
import { startSim } from './world';
import { landWorld } from '../__tests__/pcTestWorld';
import {
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL,
  BUILDING_STATION, RAIL_GROUND, ROAD_STREET, ZONE_R,
} from '../sim/constants';

describe('balance lab: rail probe', () => {
  it('builds the suburb, street and line on copies and leaves the city and BALANCE as they were', () => {
    const before = JSON.stringify(BALANCE);
    const { world } = buildLivingCity();
    const buildings = world.buildings.length, money = world.budget.money;
    const r = railResult(world, 3);
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(world.buildings.length).toBe(buildings);
    expect(world.budget.money).toBe(money);
    if (r.lineTiles !== null) {
      expect(r.streetTiles).toBeGreaterThanOrEqual(25);
      expect(r.freightOnTrack).toBe(0);
    } else {
      expect(r.note).toBeTruthy();
    }
  }, 120_000);

  it('a starter line is two stations and 60 tiles of ground track, in cost and upkeep', () => {
    expect(starterLineCost()).toBe(2 * BALANCE.buildings[BUILDING_STATION].cost + STARTER_TILES * BALANCE.rail.track[RAIL_GROUND].cost);
    expect(starterLineUpkeep()).toBe(2 * BALANCE.buildings[BUILDING_STATION].maintenance + STARTER_TILES * BALANCE.rail.track[RAIL_GROUND].maintenance);
  });
});

// What a rail suburb's long street brings (owner 2026-11-18: services come by road, even a long
// street). Power, water and sewage cover a whole connected road network however long; each
// service reaches BALANCE.service.coverageRange road steps along it.
describe('reach along a long street', () => {
  it('utilities reach the far end of a 120-tile street; services stop at their road-step reach', () => {
    const w = landWorld(128);
    const y = 10;
    for (let x = 1; x <= 121; x++) expect(w.setRoad(x, y, ROAD_STREET)).toBe(true);
    // The plants and services at the west end, south of the street.
    const kinds = [BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL];
    kinds.forEach((b, k) => expect(w.placeBuilding(1 + k, y + 1, b)).toBe(true));
    // Empty home lots north of the street at every tile (they draw almost nothing).
    for (let x = 1; x <= 121; x++) w.layers.zone[w.grid.idx(x, y - 1)] = ZONE_R;
    w.grid.markAllDirty();
    const sim = startSim(w);
    sim.tick(BALANCE.ticksPerDay);
    const far = (layer: Uint8Array) => { let m = -1; for (let x = 1; x <= 121; x++) if (layer[w.grid.idx(x, y - 1)]) m = x; return m; };
    expect(far(w.layers.power)).toBe(121);
    expect(far(w.layers.water)).toBe(121);
    expect(far(w.layers.sewage)).toBe(121);
    const R = BALANCE.service.coverageRange;
    // Each building stands at 1 + k; its reach is counted in road steps from the street tile beside it.
    const reach = (layer: Uint8Array, k: number, kind: number) => far(layer) - (1 + k) - R[kind];
    expect(Math.abs(reach(w.layers.police, 3, BUILDING_POLICE))).toBeLessThanOrEqual(1);
    expect(Math.abs(reach(w.layers.fireStation, 4, BUILDING_FIRE))).toBeLessThanOrEqual(1);
    expect(Math.abs(reach(w.layers.school, 5, BUILDING_SCHOOL))).toBeLessThanOrEqual(1);
    expect(Math.abs(reach(w.layers.hospital, 6, BUILDING_HOSPITAL))).toBeLessThanOrEqual(1);
  }, 60_000);
});
