// Buildings of more than one tile: shapes, the per-tile building id, placing,
// clearing, undo, connection along the edge. No real kind has a shape yet, so
// these use two test-only kinds: a 2×2 block and an L whose anchor is not the
// top-left corner of its bounding box.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../sim/World';
import {
  ZONE_R, ZONE_NONE, ROAD_STREET, ROAD_HIGHWAY, ROAD_NONE, BUILDING_NONE,
  BUILDING_POWER_PLANT, BUILDING_POLICE, BUILDING_PARK, BUILDING_WATER_TOWER, TERRAIN_WATER,
  BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT,
} from '../sim/constants';
import {
  buildingShape, isLargeBuilding, setBuildingShape, clearBuildingShape, block, footprintTiles, footprintEdge,
  placementRules, setPlacementRules,
} from '../sim/buildingShapes';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { spreadUtility } from '../sim/systems/utilityCoverage';
import { computeServiceCoverage } from '../sim/systems/ServiceSystem';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';
import { pcQuote } from '../sim/politics';

const SQUARE = 200;   // 2×2, anchor top-left
const ELL = 201;      // anchor (0,0), one tile above it, one up and to the left:  X X
                      //                                                             A
const ELL_SHAPE = [[0, 0], [0, -1], [-1, -1]] as const;

beforeEach(() => {
  setBuildingShape(SQUARE, block(2, 2));
  setBuildingShape(ELL, ELL_SHAPE);
});
afterEach(() => {
  clearBuildingShape(SQUARE);
  clearBuildingShape(ELL);
});

const at = (w: World, x: number, y: number) => w.grid.idx(x, y);

/** buildingId as a full rebuild from the list would make it. */
function rebuilt(w: World): Uint32Array {
  const live = new Uint32Array(w.buildingId);
  w.rebuildBuildingIds();
  const fresh = new Uint32Array(w.buildingId);
  w.buildingId.set(live);
  return fresh;
}

/** Everything about buildings that must be consistent, checked from scratch. */
function checkConsistent(w: World): void {
  expect(Array.from(w.buildingId)).toEqual(Array.from(rebuilt(w)));
  const { width, height } = w.grid;
  const claimed = new Map<number, number>();
  for (const b of w.buildings) {
    const tiles = footprintTiles(width, height, b.tx, b.ty, b.kind)!;
    expect(tiles).not.toBeNull();
    for (const i of tiles) {
      expect(claimed.has(i)).toBe(false);          // no two buildings share a tile
      claimed.set(i, b.kind);
      expect(w.layers.building[i]).toBe(b.kind);
    }
  }
  for (let i = 0; i < w.layers.building.length; i++) {
    if (w.layers.building[i] !== BUILDING_NONE) expect(claimed.get(i)).toBe(w.layers.building[i]); // no orphan tiles
    else expect(w.buildingId[i]).toBe(0);
  }
  const anchors = w.buildings.map(b => b.ty * width + b.tx);
  expect(new Set(anchors).size).toBe(anchors.length); // no duplicate entities
}

describe('building shapes', () => {
  it('every real kind is one tile: nothing in the game has a shape yet', () => {
    for (let kind = 1; kind <= 8; kind++) {
      expect(buildingShape(kind)).toEqual([[0, 0]]);
      expect(isLargeBuilding(kind)).toBe(false);
    }
  });

  it('refuses a shape without the anchor, with a repeated tile or with fractions', () => {
    expect(() => setBuildingShape(250, [[1, 0], [1, 1]])).toThrow(/anchor/);
    expect(() => setBuildingShape(250, [[0, 0], [1, 0], [1, 0]])).toThrow(/twice/);
    expect(() => setBuildingShape(250, [[0, 0], [0.5, 0]])).toThrow(/whole/);
    expect(buildingShape(250)).toEqual([[0, 0]]);
  });

  it('footprintTiles follows the offsets and is null off the map', () => {
    expect(footprintTiles(10, 10, 3, 4, SQUARE)).toEqual([43, 44, 53, 54]);
    expect(footprintTiles(10, 10, 3, 4, ELL)).toEqual([43, 33, 32]);
    expect(footprintTiles(10, 10, 9, 4, SQUARE)).toBeNull();
    expect(footprintTiles(10, 10, 0, 4, ELL)).toBeNull();
    expect(footprintTiles(10, 10, 3, 0, ELL)).toBeNull();
  });

  it('footprintEdge of one tile is its west, east, north, south, in that order', () => {
    expect(footprintEdge(10, 10, [44])).toEqual([43, 45, 34, 54]);
    expect(footprintEdge(10, 10, [0])).toEqual([1, 10]);
  });

  it('footprintEdge of a shape is each outside neighbour once, and no tile of the shape', () => {
    const edge = footprintEdge(10, 10, footprintTiles(10, 10, 3, 4, SQUARE)!);
    expect([...edge].sort((a, b) => a - b)).toEqual([33, 34, 42, 45, 52, 55, 63, 64]);
    const ell = footprintEdge(10, 10, footprintTiles(10, 10, 3, 4, ELL)!);
    expect([...ell].sort((a, b) => a - b)).toEqual([22, 23, 31, 34, 42, 44, 53]);
  });
});

describe('placing and clearing a building of several tiles', () => {
  let w: World;
  beforeEach(() => { w = landWorld(16); });

  it('stands on every tile of its shape, as one entity at the anchor', () => {
    expect(w.placeBuilding(4, 4, SQUARE)).toBe(true);
    expect(w.buildings).toEqual([{ tx: 4, ty: 4, kind: SQUARE }]);
    for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]]) {
      expect(w.layers.building[at(w, x, y)]).toBe(SQUARE);
      expect(w.buildingAnchorAt(at(w, x, y))).toBe(at(w, 4, 4));
      expect(w.buildingAt(x, y)).toBe(w.buildings[0]);
      expect(w.buildingTilesAt(x, y)).toEqual([at(w, 4, 4), at(w, 5, 4), at(w, 4, 5), at(w, 5, 5)]);
    }
    expect(w.buildingAnchorAt(at(w, 6, 4))).toBe(-1);
    expect(w.buildingAt(6, 4)).toBeNull();
    expect(w.buildingTilesAt(6, 4)).toEqual([]);
    checkConsistent(w);
  });

  it('an L is anchored on a real tile of itself, and tells its parts apart', () => {
    expect(w.placeBuilding(6, 6, ELL)).toBe(true);
    expect(w.buildings).toEqual([{ tx: 6, ty: 6, kind: ELL }]);
    expect(w.layers.building[at(w, 6, 6)]).toBe(ELL);
    expect(w.layers.building[at(w, 6, 5)]).toBe(ELL);
    expect(w.layers.building[at(w, 5, 5)]).toBe(ELL);
    expect(w.layers.building[at(w, 5, 6)]).toBe(BUILDING_NONE);   // the empty corner of its bounding box
    expect(w.buildingPartAt(6, 6)).toBe(0);
    expect(w.buildingPartAt(6, 5)).toBe(1);
    expect(w.buildingPartAt(5, 5)).toBe(2);
    expect(w.buildingPartAt(5, 6)).toBe(-1);
    expect(w.placeBuilding(5, 6, BUILDING_PARK)).toBe(true);       // which is free for something else
    checkConsistent(w);
  });

  it('refuses if any tile is off the map, water, built on, or a road', () => {
    expect(w.canPlaceBuilding(15, 4, SQUARE)).toBe(false);          // off the right edge
    expect(w.canPlaceBuilding(0, 4, ELL)).toBe(false);              // off the left edge
    w.layers.terrain[at(w, 5, 5)] = 1;                              // water under one corner
    expect(w.canPlaceBuilding(4, 4, SQUARE)).toBe(false);
    w.layers.terrain[at(w, 5, 5)] = 0;
    w.placeBuilding(5, 5, BUILDING_PARK);
    expect(w.canPlaceBuilding(4, 4, SQUARE)).toBe(false);
    w.clearTile(5, 5);
    w.setRoad(5, 4, ROAD_STREET);
    expect(w.canPlaceBuilding(4, 4, SQUARE)).toBe(false);
    expect(w.placeBuilding(4, 4, SQUARE)).toBe(false);
    expect(w.buildings).toEqual([]);
    w.setRoad(5, 4, ROAD_NONE);
    expect(w.canPlaceBuilding(4, 4, SQUARE)).toBe(true);
    checkConsistent(w);
  });

  it('a one-tile building still replaces a road under it, as before', () => {
    w.setRoad(4, 4, ROAD_STREET);
    expect(w.canPlaceBuilding(4, 4, BUILDING_PARK)).toBe(true);
    expect(w.placeBuilding(4, 4, BUILDING_PARK)).toBe(true);
    expect(w.layers.roadClass[at(w, 4, 4)]).toBe(ROAD_NONE);
  });

  it('wipes zones under the whole shape', () => {
    w.setZone(5, 5, ZONE_R);
    w.layers.devLevel[at(w, 5, 5)] = 2;
    w.placeBuilding(4, 4, SQUARE);
    expect(w.layers.zone[at(w, 5, 5)]).toBe(ZONE_NONE);
    expect(w.layers.devLevel[at(w, 5, 5)]).toBe(0);
  });

  it('roads and zones are refused on every tile of it', () => {
    w.placeBuilding(4, 4, SQUARE);
    expect(w.setRoad(5, 5, ROAD_STREET)).toBe(false);
    expect(w.setZone(5, 5, ZONE_R)).toBe(false);
    expect(w.isBuildable(5, 5)).toBe(false);
  });

  it('clearing any tile of it removes the whole building', () => {
    for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]]) {
      w.placeBuilding(4, 4, SQUARE);
      w.placeBuilding(9, 9, ELL);
      expect(w.clearTile(x, y)).toBe(true);
      expect(w.buildings).toEqual([{ tx: 9, ty: 9, kind: ELL }]);
      for (const [cx, cy] of [[4, 4], [5, 4], [4, 5], [5, 5]]) expect(w.layers.building[at(w, cx, cy)]).toBe(BUILDING_NONE);
      checkConsistent(w);
      w.clearTile(8, 8);                                            // a non-anchor tile of the L
      expect(w.buildings).toEqual([]);
      checkConsistent(w);
    }
  });

  it('a building written straight into the layers still counts as its one tile', () => {
    w.layers.building[at(w, 3, 3)] = BUILDING_PARK;
    w.buildings.push({ tx: 3, ty: 3, kind: BUILDING_PARK });
    expect(w.buildingId[at(w, 3, 3)]).toBe(0);
    expect(w.buildingAnchorAt(at(w, 3, 3))).toBe(at(w, 3, 3));
    expect(w.buildingAt(3, 3)).toBe(w.buildings[0]);
    expect(w.buildingTilesAt(3, 3)).toEqual([at(w, 3, 3)]);
    expect(w.clearTile(3, 3)).toBe(true);
    expect(w.buildings).toEqual([]);
  });
});

describe('commands and undo with buildings of several tiles', () => {
  let w: World;
  let history: CommandHistory;
  beforeEach(() => {
    w = landWorld(16);
    w.budget.money = 1e6;
    history = new CommandHistory(w);
  });

  it('placing can be undone and redone, restoring what was under every tile', () => {
    w.setZone(5, 5, ZONE_R);
    w.layers.devLevel[at(w, 5, 5)] = 1;
    w.layers.vegetation[at(w, 4, 5)] = 2;
    expect(history.run(new PlaceBuildingCommand(4, 4, SQUARE))).toBe(true);
    expect(w.buildings).toHaveLength(1);
    checkConsistent(w);
    history.undo();
    expect(w.buildings).toEqual([]);
    expect(w.layers.zone[at(w, 5, 5)]).toBe(ZONE_R);
    expect(w.layers.devLevel[at(w, 5, 5)]).toBe(1);
    expect(w.layers.vegetation[at(w, 4, 5)]).toBe(2);
    for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]]) expect(w.layers.building[at(w, x, y)]).toBe(BUILDING_NONE);
    checkConsistent(w);
    history.redo();
    expect(w.buildings).toEqual([{ tx: 4, ty: 4, kind: SQUARE }]);
    checkConsistent(w);
  });

  it('placing is refused, and charges nothing, where the shape does not fit', () => {
    w.setRoad(5, 5, ROAD_STREET);
    const money = w.budget.money;
    expect(history.run(new PlaceBuildingCommand(4, 4, SQUARE))).toBe(false);
    expect(w.budget.money).toBe(money);
    expect(w.buildings).toEqual([]);
  });

  it('bulldozing any tile removes it whole, charges once, and undo brings back one building', () => {
    for (const [x, y] of [[9, 9], [9, 8], [8, 8]]) {
      history.run(new PlaceBuildingCommand(9, 9, ELL));
      const money = w.budget.money;
      expect(history.run(new BulldozeCommand(x, y))).toBe(true);
      expect(w.budget.money).toBe(money - BALANCE.costs.bulldoze);
      expect(w.buildings).toEqual([]);
      checkConsistent(w);
      history.undo();
      expect(w.budget.money).toBe(money);
      expect(w.buildings).toEqual([{ tx: 9, ty: 9, kind: ELL }]);   // one entity, not three
      checkConsistent(w);
      history.undo();                                               // the placement
      expect(w.buildings).toEqual([]);
      checkConsistent(w);
    }
  });

  it('a bulldoze drag across one building charges it once: the later tiles find nothing', () => {
    history.run(new PlaceBuildingCommand(4, 4, SQUARE));
    const money = w.budget.money;
    const results = [[4, 4], [5, 4], [4, 5], [5, 5]].map(([x, y]) => history.run(new BulldozeCommand(x, y)));
    expect(results).toEqual([true, false, false, false]);
    expect(w.budget.money).toBe(money - BALANCE.costs.bulldoze);
  });

  it('one-tile buildings undo exactly as before', () => {
    history.run(new BuildRoadCommand(4, 4, ROAD_STREET));
    history.run(new PlaceBuildingCommand(4, 4, BUILDING_POLICE));   // replaces the road
    expect(w.buildings).toEqual([{ tx: 4, ty: 4, kind: BUILDING_POLICE }]);
    history.run(new BulldozeCommand(4, 4));
    expect(w.buildings).toEqual([]);
    history.undo();
    expect(w.buildings).toEqual([{ tx: 4, ty: 4, kind: BUILDING_POLICE }]);
    history.undo();
    expect(w.buildings).toEqual([]);
    expect(w.layers.roadClass[at(w, 4, 4)]).toBe(ROAD_STREET);
    checkConsistent(w);
  });

  it('after any mix of placing, bulldozing, roads, zones, undo and redo, the ids match a full rebuild', () => {
    let seed = 12345;
    const rnd = (n: number) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed % n; };
    const kinds = [SQUARE, ELL, BUILDING_PARK, BUILDING_POLICE, BUILDING_POWER_PLANT];
    for (let step = 0; step < 1500; step++) {
      const x = rnd(16), y = rnd(16);
      switch (rnd(8)) {
        case 0: case 1: case 2: history.run(new PlaceBuildingCommand(x, y, kinds[rnd(kinds.length)])); break;
        case 3: case 4: history.run(new BulldozeCommand(x, y)); break;
        case 5: history.run(rnd(2) ? new BuildRoadCommand(x, y, ROAD_STREET) : new PaintZoneCommand(x, y, ZONE_R)); break;
        case 6: history.undo(); break;
        default: history.redo();
      }
      if (step % 25 === 0) checkConsistent(w);
    }
    checkConsistent(w);
    for (let k = 0; k < 2000; k++) history.undo();                  // all the way back
    checkConsistent(w);
    expect(w.buildings).toEqual([]);
  });
});

describe('saving and loading a building of several tiles', () => {
  it('comes back as one building with its ids rebuilt; nothing new is saved', () => {
    const w = landWorld(16);
    w.placeBuilding(4, 4, SQUARE);
    w.placeBuilding(9, 9, ELL);
    w.placeBuilding(1, 1, BUILDING_PARK);
    const snapshot = serialize(w);
    expect(Object.keys(snapshot.layers)).not.toContain('buildingId');
    const loaded = deserialize(JSON.parse(JSON.stringify(snapshot, (_k, v) => ArrayBuffer.isView(v) ? { __typed: v.constructor.name, data: Array.from(v as never as number[]) } : v),
      (_k, v) => v && v.__typed ? new (globalThis as never as Record<string, new (a: number[]) => unknown>)[v.__typed](v.data) : v));
    expect(loaded.buildings).toEqual(w.buildings);
    expect(Array.from(loaded.buildingId)).toEqual(Array.from(w.buildingId));
    expect(loaded.buildingAt(5, 5)).toEqual({ tx: 4, ty: 4, kind: SQUARE });
    expect(loaded.buildingAt(8, 8)).toEqual({ tx: 9, ty: 9, kind: ELL });
    checkConsistent(loaded);
  });
});

describe('connection and coverage from the edge of a shape', () => {
  it('a utility is connected by a street on any tile along its edge, and not by a highway', () => {
    const { width } = { width: 16 };
    const edge = footprintEdge(16, 16, footprintTiles(16, 16, 4, 4, SQUARE)!);
    for (const road of edge) {
      const w = landWorld(16);
      w.placeBuilding(4, 4, SQUARE);
      w.setRoad(road % width, (road - (road % width)) / width, ROAD_STREET);
      new NetworkSystem().update(w);
      const layer = new Uint8Array(16 * 16);
      expect(spreadUtility(w, layer, SQUARE, 100, 2)).toBe(100);
      for (const i of footprintTiles(16, 16, 4, 4, SQUARE)!) expect(layer[i]).toBe(1);
    }
    const w = landWorld(16);
    w.placeBuilding(4, 4, SQUARE);
    w.setRoad(6, 6, ROAD_STREET);                                   // touches only a corner: not connected
    w.setRoad(3, 4, ROAD_HIGHWAY);                                  // a highway gives no access
    new NetworkSystem().update(w);
    const layer = new Uint8Array(16 * 16);
    expect(spreadUtility(w, layer, SQUARE, 100, 2)).toBe(0);
    expect(layer[at(w, 4, 4)]).toBe(0);
  });

  it('one building supplies once, however many of its tiles touch roads', () => {
    const w = landWorld(16);
    w.placeBuilding(4, 4, SQUARE);
    for (let x = 3; x <= 6; x++) { w.setRoad(x, 3, ROAD_STREET); w.setRoad(x, 6, ROAD_STREET); }
    new NetworkSystem().update(w);
    expect(spreadUtility(w, new Uint8Array(16 * 16), SQUARE, 100, 2)).toBe(100);
  });

  it('service coverage starts from a road beside any tile of the shape', () => {
    const w = landWorld(16);
    for (let x = 2; x <= 12; x++) w.setRoad(x, 7, ROAD_STREET);    // runs under the L's anchor (6, 6)
    const covered = computeServiceCoverage(w, 6, 6, ELL, 3);
    expect(covered.has(at(w, 6, 6))).toBe(true);
    expect(covered.has(at(w, 6, 5))).toBe(true);
    expect(covered.has(at(w, 5, 5))).toBe(true);
    expect(covered.has(at(w, 9, 7))).toBe(true);                    // 3 road steps east
    expect(covered.has(at(w, 11, 7))).toBe(false);
    // A road beside only the far tile of the L reaches too.
    const w2 = landWorld(16);
    for (let y = 2; y <= 5; y++) w2.setRoad(4, y, ROAD_STREET);     // west of (5, 5)
    expect(computeServiceCoverage(w2, 6, 6, ELL, 3).has(at(w2, 4, 2))).toBe(true);
    expect(computeServiceCoverage(w2, 6, 6, BUILDING_POLICE, 3).has(at(w2, 4, 2))).toBe(false); // one tile at (6, 6) does not
  });
});

describe("a kind that must stand at the water's edge", () => {
  const PUMP = 220;     // test kind: 2×1, needs water beside it
  let w: World;
  beforeEach(() => {
    setBuildingShape(PUMP, [[0, 0], [1, 0]]);
    setPlacementRules(PUMP, { needsWaterEdge: true });
    w = landWorld(16);
    w.budget.money = 1e6;
    for (let y = 0; y < 16; y++) w.layers.terrain[at(w, 10, y)] = TERRAIN_WATER;   // a river down column 10
  });
  afterEach(() => {
    clearBuildingShape(PUMP);
    setPlacementRules(PUMP);
  });

  it('the large water plant is such a kind; the small tower and the other large plants are not', () => {
    expect(placementRules(BUILDING_LARGE_WATER_PLANT)).toEqual({ needsWaterEdge: true });
    for (const kind of [BUILDING_WATER_TOWER, BUILDING_POWER_PLANT, BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_PARK]) {
      expect(placementRules(kind)).toEqual({});
    }
  });

  it('goes where a tile beside its shape is water, whichever of its tiles is the one beside it', () => {
    expect(w.placeBlocker(8, 5, PUMP)).toBeNull();                 // its far tile (9, 5) touches the river
    expect(w.canPlaceBuilding(8, 5, PUMP)).toBe(true);
    expect(w.placeBlocker(11, 5, PUMP)).toBeNull();                // its anchor touches it from the other bank
    expect(w.placeBuilding(8, 5, PUMP)).toBe(true);
  });

  it('is refused away from water, with the reason', () => {
    expect(w.placeBlocker(4, 5, PUMP)).toBe('noWater');
    expect(w.placeBlocker(7, 5, PUMP)).toBe('noWater');            // one tile short of the bank
    expect(w.checkPlacement(4, 5, PUMP)).toEqual({ ok: false, offMap: false, blocked: [], noWater: true });
    expect(w.canPlaceBuilding(4, 5, PUMP)).toBe(false);
    expect(w.placeBuilding(4, 5, PUMP)).toBe(false);
    expect(w.buildings).toEqual([]);
  });

  it('water at a corner only does not count', () => {
    const pond = landWorld(16);
    pond.layers.terrain[at(pond, 6, 4)] = TERRAIN_WATER;           // diagonal to (5, 5), the pump's far tile
    expect(pond.placeBlocker(4, 5, PUMP)).toBe('noWater');
    pond.layers.terrain[at(pond, 5, 4)] = TERRAIN_WATER;           // straight above it
    expect(pond.placeBlocker(4, 5, PUMP)).toBeNull();
  });

  it('still cannot stand on the water itself, and that is reported as blocked, not as no water', () => {
    expect(w.placeBlocker(9, 5, PUMP)).toBe('blocked');            // its far tile would be in the river
    expect(w.checkPlacement(9, 5, PUMP).blocked).toEqual([at(w, 10, 5)]);
    expect(w.placeBlocker(15, 5, PUMP)).toBe('offMap');
  });

  it('the command says why it refused, charges nothing, and quotes nothing', () => {
    const history = new CommandHistory(w);
    const away = new PlaceBuildingCommand(4, 5, PUMP);
    expect(history.run(away)).toBe(false);
    expect(away.failReason).toBe('noWater');
    expect(w.budget.money).toBe(1e6);
    expect(pcQuote(w, { type: 'building', tx: 4, ty: 5, kind: PUMP }).parts).toEqual([]);

    const inRiver = new PlaceBuildingCommand(9, 5, PUMP);          // blocked: no special reason
    expect(history.run(inRiver)).toBe(false);
    expect(inRiver.failReason).toBeNull();

    const onBank = new PlaceBuildingCommand(8, 5, PUMP);
    expect(history.run(onBank)).toBe(true);
    history.undo();
    expect(w.buildings).toEqual([]);
    history.redo();
    expect(w.buildings).toEqual([{ tx: 8, ty: 5, kind: PUMP }]);
  });

  it('the real large water plant: refused inland, placed on the shore, and it still needs a road to supply', () => {
    expect(w.placeBlocker(4, 5, BUILDING_LARGE_WATER_PLANT)).toBe('noWater');
    expect(w.placeBlocker(8, 5, BUILDING_LARGE_WATER_PLANT)).toBeNull();   // covers x 8–9, y 5–6: the river is beside it
    expect(w.placeBuilding(8, 5, BUILDING_LARGE_WATER_PLANT)).toBe(true);
    new NetworkSystem().update(w);
    expect(spreadUtility(w, new Uint8Array(256), BUILDING_LARGE_WATER_PLANT, 100, 1)).toBe(0);   // on the shore, but no road
    w.setRoad(7, 5, ROAD_STREET);
    new NetworkSystem().update(w);
    expect(spreadUtility(w, new Uint8Array(256), BUILDING_LARGE_WATER_PLANT, 100, 1)).toBe(100);
    // A small water tower goes anywhere.
    expect(w.placeBlocker(2, 2, BUILDING_WATER_TOWER)).toBeNull();
  });
});
