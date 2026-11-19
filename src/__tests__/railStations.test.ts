// Train stations (sim/buildingShapes.ts, sim/rail.ts): the platform tiles
// carry track, track joins at the platform's ends only, roads reach the
// building but not the platform, and a station can go down over a line.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { commandForTool, buildingKindForPlacing } from '../input/InputController';
import { placementFor, meetsTrack, resetPlacementTurn } from '../input/placement';
import { railLinks, LINK_N, LINK_E, LINK_S, LINK_W } from '../sim/rail';
import { buildingShape, shapeRoles, platformEnds, hasPlatforms } from '../sim/buildingShapes';
import { BUILDING_STATION, BUILDING_STATION_L, BUILDING_NONE, BUILDING_PARK, RAIL_GROUND, RAIL_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY } from '../sim/constants';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';

let w: World;
const at = (x: number, y: number) => w.grid.idx(x, y);
const links = (x: number, y: number) => railLinks(w, at(x, y));
const rail = (x: number, y: number) => w.getRail(x, y);
const track = (x: number, y: number) => expect(w.layTrack(x, y)).toBe(true);

beforeEach(() => { w = landWorld(32); w.budget.money = 1_000_000; resetPlacementTurn(); });

describe('station shapes', () => {
  it('straight: 4×3, the middle row is the platform, track joins at its west and east ends', () => {
    const shape = buildingShape(BUILDING_STATION), roles = shapeRoles(BUILDING_STATION);
    expect(shape.length).toBe(12);
    expect(shape.filter((_, k) => roles[k] === 'platform')).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]]);
    expect(platformEnds(BUILDING_STATION)).toEqual([[-1, 1], [4, 1]]);
    expect(hasPlatforms(BUILDING_STATION)).toBe(true);
    expect(hasPlatforms(BUILDING_PARK)).toBe(false);
  });

  it('elbow: 3×3, the platform runs from the west side to the centre and out of the north side', () => {
    const shape = buildingShape(BUILDING_STATION_L), roles = shapeRoles(BUILDING_STATION_L);
    expect(shape.filter((_, k) => roles[k] === 'platform')).toEqual([[1, 0], [0, 1], [1, 1]]);
    expect(platformEnds(BUILDING_STATION_L)).toEqual([[1, -1], [-1, 1]]);
  });

  it('the ends turn with the building', () => {
    // A quarter turn clockwise takes (dx, dy) to (−dy, dx).
    expect(platformEnds(BUILDING_STATION, 1)).toEqual([[-1, -1], [-1, 4]]);
    expect(platformEnds(BUILDING_STATION_L, 2)).toEqual([[-1, 1], [1, -1]]);
  });
});

describe('placing a station', () => {
  it('lays track on its platform, joined along it and out of both ends, not sideways', () => {
    expect(w.placeBuilding(10, 10, BUILDING_STATION)).toBe(true);
    for (let x = 10; x <= 13; x++) {
      expect(rail(x, 11)).toBe(RAIL_GROUND);
      expect(rail(x, 10)).toBe(RAIL_NONE);
      expect(rail(x, 12)).toBe(RAIL_NONE);
    }
    expect(links(10, 11)).toBe(LINK_E);
    expect(links(11, 11)).toBe(LINK_E | LINK_W);
    track(9, 11); track(14, 11);
    track(11, 13);                                       // track along the south wall: not joined to anything
    expect(links(10, 11)).toBe(LINK_E | LINK_W);
    expect(links(13, 11)).toBe(LINK_E | LINK_W);
    expect(links(11, 11)).toBe(LINK_E | LINK_W);
    expect(links(11, 13)).toBe(0);
    expect(links(9, 11)).toBe(LINK_E);
  });

  it('the elbow joins round its corner and out of its two ends only', () => {
    expect(w.placeBuilding(10, 10, BUILDING_STATION_L)).toBe(true);
    for (const [x, y] of [[10, 10], [12, 10], [12, 11], [10, 12], [11, 12], [12, 12]]) expect(rail(x, y)).toBe(RAIL_NONE);
    track(11, 9); track(9, 11);                          // at the two ends
    track(13, 11);                                       // beside the east wall: not joined
    expect(links(11, 10)).toBe(LINK_N | LINK_S);
    expect(links(11, 11)).toBe(LINK_N | LINK_W);
    expect(links(10, 11)).toBe(LINK_E | LINK_W);
    expect(links(11, 9)).toBe(LINK_S);
    expect(links(9, 11)).toBe(LINK_E);
    expect(links(13, 11)).toBe(0);
  });

  it('goes down over a line: the platform may stand on ground track, the building may not', () => {
    for (let x = 4; x <= 20; x++) track(x, 11);
    expect(w.canPlaceBuilding(10, 11, BUILDING_STATION)).toBe(false);      // its north row would be on the line
    expect(w.checkPlacement(10, 11, BUILDING_STATION).blocked).toEqual([at(10, 11), at(11, 11), at(12, 11), at(13, 11)]);
    expect(w.placeBuilding(10, 10, BUILDING_STATION)).toBe(true);
    expect(links(9, 11)).toBe(LINK_E | LINK_W);
    expect(links(10, 11)).toBe(LINK_E | LINK_W);
  });

  it('does not stand on a level crossing', () => {
    for (let y = 8; y <= 16; y++) w.setRoad(11, y, ROAD_STREET);
    for (let x = 4; x <= 20; x++) track(x, 11);
    w.clearTile(11, 10); w.clearTile(11, 12);
    expect(w.checkPlacement(10, 10, BUILDING_STATION).blocked).toEqual([at(11, 11)]);
  });

  it('cleared, the station goes and its platform stays as plain track', () => {
    track(9, 11); track(14, 11);
    w.placeBuilding(10, 10, BUILDING_STATION);
    expect(w.clearTile(11, 10)).toBe(true);
    expect(w.getBuilding(11, 11)).toBe(BUILDING_NONE);
    expect(w.getBuilding(11, 12)).toBe(BUILDING_NONE);
    for (let x = 9; x <= 14; x++) expect(rail(x, 11)).toBe(RAIL_GROUND);
    expect(links(11, 11)).toBe(LINK_E | LINK_W);
    expect(w.buildings.length).toBe(0);
  });

  it('undo takes back the platform track it laid, and leaves track that was there before', () => {
    track(10, 11);
    const cmd = new PlaceBuildingCommand(10, 10, BUILDING_STATION, 0);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.money).toBe(1_000_000 - BALANCE.buildings[BUILDING_STATION].cost);
    cmd.undo(w);
    expect(rail(10, 11)).toBe(RAIL_GROUND);
    expect(rail(11, 11)).toBe(RAIL_NONE);
    expect(w.getBuilding(10, 10)).toBe(BUILDING_NONE);
  });
});

describe('roads to a station', () => {
  it('a street or avenue beside any building tile reaches it; one at the end of the platform does not; nor a highway', () => {
    w.placeBuilding(10, 10, BUILDING_STATION);
    w.setRoad(9, 11, ROAD_STREET);                                        // where the track would leave
    expect(w.buildingAccessRoads(10, 10)).toEqual([]);
    w.setRoad(11, 9, ROAD_HIGHWAY);
    expect(w.buildingAccessRoads(10, 10)).toEqual([]);
    w.setRoad(12, 9, ROAD_STREET);                                        // the north side
    w.setRoad(14, 12, ROAD_STREET);                                       // the east end of the south half
    w.setRoad(11, 13, ROAD_AVENUE);                                       // the south side
    expect(w.buildingAccessRoads(10, 10).sort((a, b) => a - b)).toEqual([at(12, 9), at(14, 12), at(11, 13)]);
  });

  it('the elbow: a road beside any of its six building tiles reaches it, the lone corner too', () => {
    w.placeBuilding(10, 10, BUILDING_STATION_L);
    w.setRoad(9, 10, ROAD_STREET);                                        // beside the north-west corner tile
    expect(w.buildingAccessRoads(10, 10)).toEqual([at(9, 10)]);
    w.setRoad(13, 11, ROAD_STREET);                                       // the east side
    expect(w.buildingAccessRoads(10, 10).sort((a, b) => a - b)).toEqual([at(9, 10), at(13, 11)]);
  });
});

describe('the station tools', () => {
  it("'station' and 'stationL' place the two kinds", () => {
    expect(buildingKindForPlacing('station')).toBe(BUILDING_STATION);
    expect(buildingKindForPlacing('stationL')).toBe(BUILDING_STATION_L);
    expect(commandForTool('station', 12, 12, w)).toBeInstanceOf(PlaceBuildingCommand);
  });

  it('held over a line, a station turns so its platform meets the track', () => {
    for (let y = 2; y <= 28; y++) track(15, y);                          // a north–south line
    const p = placementFor(w, BUILDING_STATION, 15, 14);
    expect(p.check.ok).toBe(true);
    expect(p.rot & 1).toBe(1);                                           // turned: the platform runs north–south
    expect(meetsTrack(w, BUILDING_STATION, p.tx, p.ty, p.rot)).toBe(true);
    // Away from any track it takes the first way that fits.
    const q = placementFor(w, BUILDING_STATION, 5, 5);
    expect(q.check.ok).toBe(true);
    expect(q.rot).toBe(0);
  });
});

describe('saving', () => {
  it('a station and its platform track come back from a save', () => {
    track(9, 12);
    w.placeBuilding(10, 10, BUILDING_STATION_L, 1);
    const loaded = deserialize(serialize(w));
    expect(loaded.buildings).toEqual(w.buildings);
    expect(Array.from(loaded.layers.rail)).toEqual(Array.from(w.layers.rail));
    for (let i = 0; i < w.layers.rail.length; i++) expect(railLinks(loaded, i)).toBe(railLinks(w, i));
  });
});
