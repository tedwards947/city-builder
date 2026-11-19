// Train stations (sim/buildingShapes.ts, sim/rail.ts): the platform tiles
// carry track, track joins at the platform's ends only and never runs beside
// it, roads beside any of its tiles reach it, and a station can go down over a line.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { commandForTool, buildingKindForPlacing } from '../input/InputController';
import { placementFor, meetsTrack, resetPlacementTurn } from '../input/placement';
import { railLinks, trackBlocker, LINK_N, LINK_E, LINK_S, LINK_W } from '../sim/rail';
import { buildingShape, shapeRoles, platformEnds, platformSides, hasPlatforms } from '../sim/buildingShapes';
import { BUILDING_STATION, BUILDING_STATION_L, BUILDING_NONE, BUILDING_PARK, RAIL_GROUND, RAIL_ELEVATED, RAIL_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY } from '../sim/constants';
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
  it('straight: three tiles in a row, all platform, track joins at its west and east ends', () => {
    const shape = buildingShape(BUILDING_STATION), roles = shapeRoles(BUILDING_STATION);
    expect(shape).toEqual([[0, 0], [1, 0], [2, 0]]);
    expect(roles).toEqual(['platform', 'platform', 'platform']);
    expect(platformEnds(BUILDING_STATION)).toEqual([[-1, 0], [3, 0]]);
    expect(platformSides(BUILDING_STATION).sort()).toEqual([[0, -1], [0, 1], [1, -1], [1, 1], [2, -1], [2, 1]]);
    expect(hasPlatforms(BUILDING_STATION)).toBe(true);
    expect(hasPlatforms(BUILDING_PARK)).toBe(false);
  });

  it('curved: 2×2, the house at the top-left, the platform from the west side round the corner and out of the north side', () => {
    const shape = buildingShape(BUILDING_STATION_L), roles = shapeRoles(BUILDING_STATION_L);
    expect(shape.length).toBe(4);
    expect(shape.filter((_, k) => roles[k] === 'platform')).toEqual([[0, 1], [1, 1], [1, 0]]);
    expect(shape.filter((_, k) => roles[k] === 'body')).toEqual([[0, 0]]);
    expect(platformEnds(BUILDING_STATION_L)).toEqual([[-1, 1], [1, -1]]);
    // Beside it: below the bottom row and right of the right column (the two outer sides of the corner included).
    expect(platformSides(BUILDING_STATION_L).sort()).toEqual([[0, 2], [1, 2], [2, 0], [2, 1]]);
  });

  it('the ends turn with the building', () => {
    // A quarter turn clockwise takes (dx, dy) to (−dy, dx).
    expect(platformEnds(BUILDING_STATION, 1)).toEqual([[0, -1], [0, 3]]);
    expect(platformEnds(BUILDING_STATION, 2)).toEqual([[1, 0], [-3, 0]]);
    expect(platformEnds(BUILDING_STATION_L, 2)).toEqual([[1, -1], [-1, 1]]);
  });
});

describe('placing a station', () => {
  it('lays track on its platform, joined along it and out of both ends', () => {
    expect(w.placeBuilding(10, 11, BUILDING_STATION)).toBe(true);
    for (let x = 10; x <= 12; x++) {
      expect(rail(x, 11)).toBe(RAIL_GROUND);
      expect(w.getBuilding(x, 11)).toBe(BUILDING_STATION);
      expect(w.getBuilding(x, 10)).toBe(BUILDING_NONE);
      expect(w.getBuilding(x, 12)).toBe(BUILDING_NONE);
    }
    expect(links(10, 11)).toBe(LINK_E);
    expect(links(11, 11)).toBe(LINK_E | LINK_W);
    track(9, 11); track(13, 11);
    expect(links(10, 11)).toBe(LINK_E | LINK_W);
    expect(links(12, 11)).toBe(LINK_E | LINK_W);
    expect(links(9, 11)).toBe(LINK_E);
  });

  it('turns four ways about its anchor', () => {
    expect(w.placeBuilding(10, 10, BUILDING_STATION, 1)).toBe(true);      // south from the anchor
    for (let y = 10; y <= 12; y++) expect(rail(10, y)).toBe(RAIL_GROUND);
    expect(w.placeBuilding(20, 10, BUILDING_STATION, 2)).toBe(true);      // west from the anchor
    for (let x = 18; x <= 20; x++) expect(rail(x, 10)).toBe(RAIL_GROUND);
    expect(w.placeBuilding(20, 20, BUILDING_STATION, 3)).toBe(true);      // north from the anchor
    for (let y = 18; y <= 20; y++) expect(rail(20, y)).toBe(RAIL_GROUND);
    expect(w.buildings.map(b => b.rot)).toEqual([1, 2, 3]);
  });

  it('the curved station joins round its corner and out of its two ends only', () => {
    expect(w.placeBuilding(10, 10, BUILDING_STATION_L)).toBe(true);
    expect(rail(10, 10)).toBe(RAIL_NONE);                                 // the house
    track(11, 9); track(9, 11);                                           // at the two ends
    expect(links(11, 10)).toBe(LINK_N | LINK_S);
    expect(links(11, 11)).toBe(LINK_N | LINK_W);
    expect(links(10, 11)).toBe(LINK_E | LINK_W);
    expect(links(11, 9)).toBe(LINK_S);
    expect(links(9, 11)).toBe(LINK_E);
  });

  it('goes down over a line', () => {
    for (let x = 4; x <= 20; x++) track(x, 11);
    expect(w.placeBuilding(10, 11, BUILDING_STATION)).toBe(true);
    expect(links(9, 11)).toBe(LINK_E | LINK_W);
    expect(links(10, 11)).toBe(LINK_E | LINK_W);
    expect(links(13, 11)).toBe(LINK_E | LINK_W);
  });

  it('does not stand on a level crossing', () => {
    for (let y = 8; y <= 16; y++) w.setRoad(11, y, ROAD_STREET);
    for (let x = 4; x <= 20; x++) track(x, 11);
    expect(w.checkPlacement(10, 11, BUILDING_STATION).blocked).toEqual([at(11, 11)]);
  });

  it('cleared, the station goes and its platform stays as plain track', () => {
    track(9, 11); track(13, 11);
    w.placeBuilding(10, 11, BUILDING_STATION);
    expect(w.clearTile(11, 11)).toBe(true);
    for (let x = 10; x <= 12; x++) expect(w.getBuilding(x, 11)).toBe(BUILDING_NONE);
    for (let x = 9; x <= 13; x++) expect(rail(x, 11)).toBe(RAIL_GROUND);
    expect(links(11, 11)).toBe(LINK_E | LINK_W);
    expect(w.buildings.length).toBe(0);
  });

  it('undo takes back the platform track it laid, and leaves track that was there before', () => {
    track(10, 11);
    const cmd = new PlaceBuildingCommand(10, 11, BUILDING_STATION, 0);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.money).toBe(1_000_000 - BALANCE.buildings[BUILDING_STATION].cost);
    cmd.undo(w);
    expect(rail(10, 11)).toBe(RAIL_GROUND);
    expect(rail(11, 11)).toBe(RAIL_NONE);
    expect(w.getBuilding(10, 11)).toBe(BUILDING_NONE);
  });
});

describe('no track beside a platform', () => {
  it('ground track cannot be laid along either side of a straight station, only at its ends', () => {
    w.placeBuilding(10, 11, BUILDING_STATION);
    for (let x = 10; x <= 12; x++) {
      expect(trackBlocker(w, x, 10)).toBe('blocked');
      expect(trackBlocker(w, x, 12)).toBe('blocked');
      expect(w.layTrack(x, 10)).toBe(false);
    }
    for (const [x, y] of [[9, 11], [13, 11], [9, 10], [13, 12], [11, 9]]) expect(trackBlocker(w, x, y)).toBeNull();
    // Elevated track may pass alongside: only the platform's own level is kept clear.
    expect(trackBlocker(w, 11, 10, RAIL_ELEVATED)).toBeNull();
  });

  it('nor along the outer sides of a curved station, the two sides of its corner included', () => {
    w.placeBuilding(10, 10, BUILDING_STATION_L);
    for (const [x, y] of [[12, 10], [12, 11], [10, 12], [11, 12]]) expect(trackBlocker(w, x, y)).toBe('blocked');
    // Its ends, and the tiles beside the house, are free.
    for (const [x, y] of [[11, 9], [9, 11], [10, 9], [9, 10]]) expect(trackBlocker(w, x, y)).toBeNull();
  });

  it('a station cannot be placed with its platform alongside track, nor two platforms side by side', () => {
    for (let x = 4; x <= 20; x++) track(x, 12);
    expect(w.canPlaceBuilding(10, 11, BUILDING_STATION)).toBe(false);
    expect(w.checkPlacement(10, 11, BUILDING_STATION).blocked).toEqual([at(10, 12), at(11, 12), at(12, 12)]);
    expect(w.canPlaceBuilding(10, 10, BUILDING_STATION)).toBe(true);       // a tile away
    expect(w.placeBuilding(10, 20, BUILDING_STATION)).toBe(true);
    expect(w.canPlaceBuilding(10, 21, BUILDING_STATION)).toBe(false);
    expect(w.canPlaceBuilding(13, 20, BUILDING_STATION)).toBe(true);       // end to end is fine
  });

  it('once the station is cleared the tiles beside its old platform take track again', () => {
    w.placeBuilding(10, 11, BUILDING_STATION);
    w.clearTile(10, 11);
    expect(trackBlocker(w, 11, 10)).toBeNull();
  });
});

describe('roads to a station', () => {
  it('a street or avenue beside any platform tile reaches it, from either long side; a highway does not', () => {
    w.placeBuilding(10, 11, BUILDING_STATION);
    expect(w.buildingAccessRoads(10, 11)).toEqual([]);
    w.setRoad(11, 10, ROAD_HIGHWAY);
    expect(w.buildingAccessRoads(10, 11)).toEqual([]);
    w.setRoad(12, 10, ROAD_STREET);                                       // the north side
    w.setRoad(10, 12, ROAD_AVENUE);                                       // the south side
    w.setRoad(14, 10, ROAD_STREET);                                       // not beside it
    expect(w.buildingAccessRoads(11, 11).sort((a, b) => a - b)).toEqual([at(12, 10), at(10, 12)]);
  });

  it('the curved station: a road beside its house or beside its platform reaches it', () => {
    w.placeBuilding(10, 10, BUILDING_STATION_L);
    w.setRoad(9, 10, ROAD_STREET);                                        // beside the house
    expect(w.buildingAccessRoads(10, 10)).toEqual([at(9, 10)]);
    w.setRoad(12, 11, ROAD_STREET);                                       // beside the corner of the platform
    expect(w.buildingAccessRoads(10, 10).sort((a, b) => a - b)).toEqual([at(9, 10), at(12, 11)]);
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
