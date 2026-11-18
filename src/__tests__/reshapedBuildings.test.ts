// A building's tiles are not saved: they come from its anchor and its kind's
// shape. When a shape changes after a city was saved (the airport's runway
// grew), loading fits each building to the new shape: it takes the extra
// tiles if they are free, or is removed and paid back if they are not.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BUILDING_AIRPORT, BUILDING_NONE, BUILDING_POLICE, ROAD_STREET, ZONE_R, VEG_TREE_1, VEG_NONE, TERRAIN_WATER } from '../sim/constants';
import { buildingShape, shapeRoles, setBuildingShape, block, type ShapeOffset, type PartRole } from '../sim/buildingShapes';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';

const AIRPORT = BUILDING_AIRPORT;
const shipped = { shape: buildingShape(AIRPORT).map(([dx, dy]) => [dx, dy] as const), roles: [...shapeRoles(AIRPORT)] };
const role = ([dx, dy]: ShapeOffset): PartRole => (dy === 0 && dx >= 2 && dx <= 9 ? 'frontage' : 'body');
// The shape a city is saved under, and a longer one it is loaded under: the runway row three tiles longer at each end.
const OLD = block(12, 5);
const LONGER: ShapeOffset[] = [...OLD, [-3, 4], [-2, 4], [-1, 4], [12, 4], [13, 4], [14, 4]];
const use = (shape: readonly ShapeOffset[]) => setBuildingShape(AIRPORT, shape, shape.map(role));

let w: World;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const count = (world: World, kind: number) => world.layers.building.reduce((n, b) => n + (b === kind ? 1 : 0), 0);

beforeEach(() => { use(OLD); w = landWorld(48); });
afterEach(() => { setBuildingShape(AIRPORT, shipped.shape, shipped.roles); });

describe('loading a city whose building shape has changed', () => {
  it('does nothing when the shapes still match', () => {
    w.placeBuilding(10, 10, AIRPORT);
    w.placeBuilding(40, 40, BUILDING_POLICE);
    const money = w.budget.money;
    const loaded = deserialize(serialize(w));
    expect(loaded.buildings).toEqual(w.buildings);
    expect(loaded.budget.money).toBe(money);
    expect(loaded.fitBuildingsToShapes()).toEqual({ grown: [], removed: [] });
    expect(count(loaded, AIRPORT)).toBe(60);
  });

  it('the building takes the extra tiles when they are free', () => {
    w.placeBuilding(10, 10, AIRPORT);                       // x 10–21, y 10–14; the longer runway is x 7–24 at y 14
    w.layers.vegetation[idx(8, 14)] = VEG_TREE_1;
    const saved = serialize(w);
    use(LONGER);
    const loaded = deserialize(saved);
    expect(loaded.buildings).toEqual([{ kind: AIRPORT, tx: 10, ty: 10 }].map((b) => expect.objectContaining(b)));
    expect(count(loaded, AIRPORT)).toBe(66);
    expect(loaded.buildingTilesAt(15, 12).length).toBe(66);
    for (const x of [7, 8, 9, 22, 23, 24]) {
      expect(loaded.getBuilding(x, 14)).toBe(AIRPORT);
      expect(loaded.buildingAnchorAt(idx(x, 14))).toBe(idx(10, 10));
    }
    expect(loaded.layers.vegetation[idx(8, 14)]).toBe(VEG_NONE);
    expect(loaded.budget.money).toBe(w.budget.money);
    // Bulldozing it clears all 66 tiles and nothing else.
    expect(loaded.clearTile(7, 14)).toBe(true);
    expect(count(loaded, AIRPORT)).toBe(0);
    expect(loaded.buildings.length).toBe(0);
  });

  it('is removed and paid back when something stands on the extra tiles, which are left alone', () => {
    w.placeBuilding(10, 10, AIRPORT);
    w.setRoad(8, 14, ROAD_STREET);                          // a street where the longer runway would go
    w.setZone(23, 14, ZONE_R); w.layers.devLevel[idx(23, 14)] = 2;
    w.placeBuilding(40, 40, BUILDING_POLICE);
    const saved = serialize(w);
    use(LONGER);
    const loaded = deserialize(saved);
    expect(loaded.buildings.map((b) => b.kind)).toEqual([BUILDING_POLICE]);
    expect(count(loaded, AIRPORT)).toBe(0);
    expect(loaded.buildingTilesAt(15, 12)).toEqual([]);
    expect(loaded.budget.money).toBe(w.budget.money + BALANCE.buildings[AIRPORT].cost);
    expect(loaded.layers.roadClass[idx(8, 14)]).toBe(ROAD_STREET);
    expect(loaded.layers.zone[idx(23, 14)]).toBe(ZONE_R);
    expect(loaded.layers.devLevel[idx(23, 14)]).toBe(2);
    expect(loaded.getBuilding(40, 40)).toBe(BUILDING_POLICE);
    // The site is free again, and so is the one-per-city slot.
    expect(loaded.canPlaceBuilding(10, 30, AIRPORT)).toBe(true);
  });

  it('is removed and paid back when the extra tiles are water or off the map', () => {
    w.placeBuilding(10, 10, AIRPORT);
    w.layers.terrain[idx(24, 14)] = TERRAIN_WATER;
    const wet = serialize(w);
    const w2 = landWorld(48);
    w2.placeBuilding(1, 10, AIRPORT);                       // the longer runway would start at x = −2
    const edge = serialize(w2);
    use(LONGER);
    for (const [saved, before] of [[wet, w], [edge, w2]] as const) {
      const loaded = deserialize(saved);
      expect(loaded.buildings).toEqual([]);
      expect(count(loaded, AIRPORT)).toBe(0);
      expect(loaded.layers.building.every((b) => b === BUILDING_NONE)).toBe(true);
      expect(loaded.budget.money).toBe(before.budget.money + BALANCE.buildings[AIRPORT].cost);
    }
  });
});
