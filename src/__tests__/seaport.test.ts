// Seaport, phase 1: its shape (a yard on land, docks on water), rotation, the
// open-water rule, placing, clearing, undo and saving. No trade yet.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import {
  BUILDING_SEAPORT, BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_LARGE_POWER_PLANT,
  TERRAIN_WATER, TERRAIN_GRASS, ROAD_STREET, ZONE_R,
} from '../sim/constants';
import { buildingShape, shapeRoles, hasDocks, footprintTiles, setBuildingShape } from '../sim/buildingShapes';
import { openWater, isOpenWater, suggestRotation } from '../sim/openWater';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld, home } from './pcTestWorld';

const PORT = BUILDING_SEAPORT;
let w: World;
let h: CommandHistory;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const water = (x0: number, y0: number, x1: number, y1: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.layers.terrain[idx(x, y)] = TERRAIN_WATER;
};

// A 32×32 island: sea along the north (y 0–9) and the east (x 22–31), a pond in the south-west.
beforeEach(() => {
  w = landWorld();
  water(0, 0, 31, 9);
  water(22, 0, 31, 31);
  water(4, 22, 8, 26);
  h = new CommandHistory(w);
  w.budget.money = 1_000_000;
});

describe('seaport shape', () => {
  it('is a 4×3 yard with a row of four docks, anchored on a yard tile', () => {
    const shape = buildingShape(PORT), roles = shapeRoles(PORT);
    expect(shape.length).toBe(16);
    expect(roles.filter((r) => r === 'body').length).toBe(12);
    expect(roles.filter((r) => r === 'dock').length).toBe(4);
    expect(shape[0]).toEqual([0, 0]);
    expect(roles[0]).toBe('body');
    expect(shape.filter((_, k) => roles[k] === 'dock')).toEqual([[0, -1], [1, -1], [2, -1], [3, -1]]);
    expect(hasDocks(PORT)).toBe(true);
    expect(hasDocks(BUILDING_LARGE_POWER_PLANT)).toBe(false);
  });

  it('turns in quarter turns about its anchor, the docks facing north, east, south, west', () => {
    const docks = (rot: number) => buildingShape(PORT, rot).filter((_, k) => shapeRoles(PORT)[k] === 'dock');
    expect(docks(0).every(([, dy]) => dy === -1)).toBe(true);     // north of the yard
    expect(docks(1).every(([dx]) => dx === 1)).toBe(true);        // east
    expect(docks(2).every(([, dy]) => dy === 1)).toBe(true);      // south
    expect(docks(3).every(([dx]) => dx === -1)).toBe(true);       // west
    for (let rot = 0; rot < 4; rot++) {
      const shape = buildingShape(PORT, rot);
      expect(shape.length).toBe(16);
      expect(new Set(shape.map(([dx, dy]) => dx + ',' + dy)).size).toBe(16);
      expect(shape[0]).toEqual([0, 0]);                            // the anchor does not move
      expect(buildingShape(PORT, rot)).toBe(shape);                // the same array every time
    }
    expect(buildingShape(PORT, 4)).toBe(buildingShape(PORT, 0));
    expect(shapeRoles(PORT)).toBe(shapeRoles(PORT));
    expect(shapeRoles(BUILDING_LARGE_POWER_PLANT)).toBe(shapeRoles(BUILDING_LARGE_POWER_PLANT));
    // A one-tile kind has nothing to turn.
    expect(buildingShape(BUILDING_POWER_PLANT, 2)).toBe(buildingShape(BUILDING_POWER_PLANT));
  });

  it('a shape may not put its anchor on a dock', () => {
    expect(() => setBuildingShape(250, [[0, 0], [1, 0]], ['dock', 'body'])).toThrow();
    expect(() => setBuildingShape(250, [[0, 0], [1, 0]], ['body'])).toThrow();
  });
});

describe('open water', () => {
  it('is water that reaches the edge of the map; a pond is not', () => {
    const open = openWater(w);
    expect(open[idx(10, 5)]).toBe(1);             // the sea
    expect(open[idx(25, 20)]).toBe(1);
    expect(open[idx(6, 24)]).toBe(0);             // the pond
    expect(open[idx(15, 15)]).toBe(0);            // land
    expect(isOpenWater(w, idx(0, 0))).toBe(true);
    expect(openWater(w)).toBe(open);              // remembered while the terrain is the same
  });

  it('follows the terrain: a channel opens a pond, a dam closes a bay; bridges and docks do not', () => {
    water(4, 27, 4, 31);                          // a channel from the pond to the south edge
    expect(isOpenWater(w, idx(6, 24))).toBe(true);
    for (let y = 27; y <= 31; y++) w.layers.terrain[idx(4, y)] = TERRAIN_GRASS;
    expect(isOpenWater(w, idx(6, 24))).toBe(false);
    // A bridge across the channel does not close it.
    water(4, 27, 4, 31);
    w.setRoad(4, 29, ROAD_STREET);
    expect(isOpenWater(w, idx(6, 24))).toBe(true);
  });
});

describe('placing a seaport', () => {
  it('needs its yard on free land and its docks on open water', () => {
    expect(w.checkPlacement(10, 10, PORT)).toEqual({ ok: true, offMap: false, blocked: [], noWater: false, notOpenWater: [] });
    expect(w.placeBlocker(10, 10, PORT)).toBeNull();
    // Inland: the docks would be on land.
    const inland = w.checkPlacement(10, 14, PORT);
    expect(inland.ok).toBe(false);
    expect(inland.blocked.sort((a, b) => a - b)).toEqual([idx(10, 13), idx(11, 13), idx(12, 13), idx(13, 13)]);
    expect(w.placeBlocker(10, 14, PORT)).toBe('blocked');
    // Out to sea: the yard would be on water.
    expect(w.checkPlacement(10, 8, PORT).blocked.length).toBe(8);     // two yard rows in the sea
    // Beside the pond (pond y 22–26): docks on the pond's south row.
    const pond = w.checkPlacement(4, 27, PORT);
    expect(pond.ok).toBe(false);
    expect(pond.blocked).toEqual([]);
    expect(pond.notOpenWater.sort((a, b) => a - b)).toEqual([idx(4, 26), idx(5, 26), idx(6, 26), idx(7, 26)]);
    expect(w.placeBlocker(4, 27, PORT)).toBe('notOpenWater');
    // Off the map.
    expect(w.placeBlocker(30, 10, PORT)).toBe('offMap');
    // A bridge where a dock would go, or a building or road in the yard, blocks it.
    w.setRoad(11, 9, ROAD_STREET);
    expect(w.checkPlacement(10, 10, PORT).blocked).toEqual([idx(11, 9)]);
    w.setRoad(11, 9, 0);
    w.setRoad(12, 11, ROAD_STREET);
    expect(w.checkPlacement(10, 10, PORT).blocked).toEqual([idx(12, 11)]);
  });

  it('stands on all sixteen tiles as one building; the water under the docks stays water', () => {
    expect(w.placeBuilding(10, 10, PORT)).toBe(true);
    const tiles = footprintTiles(32, 32, 10, 10, PORT)!;
    for (const i of tiles) expect(w.layers.building[i]).toBe(PORT);
    expect(w.buildings).toEqual([{ tx: 10, ty: 10, kind: PORT }]);     // rotation 0 is not written
    for (let x = 10; x <= 13; x++) {
      expect(w.layers.terrain[idx(x, 9)]).toBe(TERRAIN_WATER);
      expect(w.buildingPartRoleAt(x, 9)).toBe('dock');
      expect(w.buildingPartRoleAt(x, 11)).toBe('body');
      expect(w.buildingAnchorAt(idx(x, 9))).toBe(idx(10, 10));
    }
    expect(w.buildingPartRoleAt(20, 20)).toBeNull();
    expect(w.buildingTilesAt(12, 9).length).toBe(16);
    // The docks do not close the sea behind them.
    expect(isOpenWater(w, idx(11, 9))).toBe(true);
    // A second port cannot share tiles; one right beside it can stand.
    expect(w.canPlaceBuilding(12, 10, PORT)).toBe(false);
    expect(w.canPlaceBuilding(14, 10, PORT)).toBe(true);
    // Clearing any tile, a dock included, takes the whole building.
    expect(w.clearTile(13, 9)).toBe(true);
    for (const i of tiles) expect(w.layers.building[i]).toBe(BUILDING_NONE);
    expect(w.buildings).toEqual([]);
    expect(w.layers.terrain[idx(13, 9)]).toBe(TERRAIN_WATER);
  });

  it('can be turned to face water on another side, and the turn is kept', () => {
    // On the east shore (sea from x = 22): only a quarter turn fits, docks at x = 22.
    expect(w.canPlaceBuilding(21, 14, PORT, 0)).toBe(false);
    expect(w.canPlaceBuilding(21, 14, PORT, 1)).toBe(true);
    expect(suggestRotation(w, 21, 14, PORT)).toBe(1);
    expect(suggestRotation(w, 21, 14, PORT, 2)).toBe(1);               // from 2: tries 2, 3, 0, then 1
    expect(suggestRotation(w, 10, 10, PORT)).toBe(0);
    expect(w.placeBuilding(21, 14, PORT, 1)).toBe(true);
    expect(w.buildings).toEqual([{ tx: 21, ty: 14, kind: PORT, rot: 1 }]);
    expect(w.buildingRotAt(idx(21, 14))).toBe(1);
    const tiles = footprintTiles(32, 32, 21, 14, PORT, 1)!;
    expect(w.buildingTilesAt(22, 16).slice().sort((a, b) => a - b)).toEqual(tiles.slice().sort((a, b) => a - b));
    for (let y = 14; y <= 17; y++) expect(w.buildingPartRoleAt(22, y)).toBe('dock');
    expect(w.buildingPartRoleAt(19, 15)).toBe('body');
    // Saved and loaded: the same building, the same tiles.
    const loaded = deserialize(serialize(w));
    expect(loaded.buildings).toEqual([{ tx: 21, ty: 14, kind: PORT, rot: 1 }]);
    expect(loaded.buildingRotAt(idx(21, 14))).toBe(1);
    expect(loaded.buildingTilesAt(22, 16).slice().sort((a, b) => a - b)).toEqual(tiles.slice().sort((a, b) => a - b));
    expect(loaded.buildingPartRoleAt(22, 16)).toBe('dock');
    // Nowhere fits inland: the suggestion is the turn with the fewest failing tiles, earliest first.
    expect(suggestRotation(w, 14, 20, PORT)).toBe(0);
  });
});

describe('seaport commands', () => {
  it('place charges the price, undo gives back the land and the water, redo brings the port back', () => {
    home(w, 11, 11);                                    // a home in the yard is displaced
    w.budget.politicalCapital = 500;
    const before = { money: w.budget.money, pc: w.budget.politicalCapital };
    expect(h.run(new PlaceBuildingCommand(10, 10, PORT))).toBe(true);
    expect(w.budget.money).toBe(before.money - BALANCE.buildings[PORT].cost);
    expect(w.budget.politicalCapital).toBeLessThan(before.pc);
    expect(w.layers.zone[idx(11, 11)]).toBe(0);
    h.undo();
    expect(w.budget).toMatchObject({ money: before.money, politicalCapital: before.pc });
    expect(w.buildings).toEqual([]);
    expect(w.layers.zone[idx(11, 11)]).toBe(ZONE_R);
    expect(w.layers.building[idx(11, 9)]).toBe(BUILDING_NONE);
    expect(w.layers.terrain[idx(11, 9)]).toBe(TERRAIN_WATER);
    h.redo();
    expect(w.buildings).toEqual([{ tx: 10, ty: 10, kind: PORT }]);
  });

  it('bulldozing any tile removes the port, and undo brings it back turned as it was', () => {
    expect(h.run(new PlaceBuildingCommand(21, 14, PORT, 1))).toBe(true);
    expect(h.run(new BulldozeCommand(22, 15))).toBe(true);            // a dock tile
    expect(w.buildings).toEqual([]);
    expect(w.buildingRotAt(idx(21, 14))).toBe(0);
    h.undo();
    expect(w.buildings).toEqual([{ tx: 21, ty: 14, kind: PORT, rot: 1 }]);
    expect(w.buildingPartRoleAt(22, 15)).toBe('dock');
    expect(w.buildingTilesAt(19, 14).length).toBe(16);
    h.undo();                                                         // the placement itself
    expect(w.buildings).toEqual([]);
    expect(w.layers.building[idx(22, 15)]).toBe(BUILDING_NONE);
  });

  it('is refused with a reason on a pond, and without one where the docks would be on land', () => {
    const onPond = new PlaceBuildingCommand(4, 27, PORT);
    expect(h.run(onPond)).toBe(false);
    expect(onPond.failReason).toBe('notOpenWater');
    const inland = new PlaceBuildingCommand(10, 14, PORT);
    expect(h.run(inland)).toBe(false);
    expect(inland.failReason).toBeNull();
    expect(w.budget.money).toBe(1_000_000);
  });

  it('no road or bridge can be built through its docks or its yard', () => {
    h.run(new PlaceBuildingCommand(10, 10, PORT));
    expect(h.run(new BuildRoadCommand(11, 9, ROAD_STREET))).toBe(false);
    expect(h.run(new BuildRoadCommand(11, 11, ROAD_STREET))).toBe(false);
    expect(h.run(new BuildRoadCommand(11, 8, ROAD_STREET))).toBe(true);      // open sea beyond the docks: a bridge may pass
  });
});
