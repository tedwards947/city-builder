// Rail phase 2 (B): the two ramps and the subway station.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_NONE, BUILDING_PARK, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, BUILDING_SUBWAY_STATION,
  RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_STREET, ZONE_R,
} from '../sim/constants';
import { buildingShape, rampLevel, shapeRoles, subwayPlatform } from '../sim/buildingShapes';
import { LINK_E, LINK_N, LINK_S, LINK_W, railLinks, rampOther, trackBlocker } from '../sim/rail';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { buildingKindForPlacing, commandForTool } from '../input/InputController';
import { meetsTrack, placementFor, resetPlacementTurn } from '../input/placement';
import { serialize, deserialize } from '../persistence/Serializer';
import { landWorld } from './pcTestWorld';

let w: World;
const at = (x: number, y: number) => w.grid.idx(x, y);
const lay = (x: number, y: number, level = RAIL_GROUND) => expect(w.layTrack(x, y, level)).toBe(true);
const links = (x: number, y: number, level = RAIL_GROUND) => railLinks(w, at(x, y), level);

beforeEach(() => { w = landWorld(32); w.budget.money = 1_000_000; resetPlacementTurn(); });

describe('ramp shapes', () => {
  it('2×1: the anchor is the ground end, (1, 0) the high or deep end; four turns', () => {
    for (const kind of [BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY]) {
      expect(buildingShape(kind)).toEqual([[0, 0], [1, 0]]);
      expect(shapeRoles(kind)).toEqual(['rampLow', 'rampHigh']);
      expect(buildingShape(kind, 1)).toEqual([[0, 0], [0, 1]]);          // ground end north, high end south
      expect(buildingShape(kind, 2)).toEqual([[0, 0], [-1, 0]]);
      expect(buildingShape(kind, 3)).toEqual([[0, 0], [0, -1]]);
    }
    expect(rampLevel(BUILDING_RAMP_ELEVATED)).toBe(RAIL_ELEVATED);
    expect(rampLevel(BUILDING_RAMP_SUBWAY)).toBe(RAIL_SUBWAY);
    expect(rampLevel(BUILDING_PARK)).toBe(0);
  });
});

describe('an elevated ramp', () => {
  it('lays ground track at its low end and elevated at its high end, each joined only straight out', () => {
    expect(w.placeBuilding(10, 10, BUILDING_RAMP_ELEVATED)).toBe(true);
    expect(w.getRail(10, 10)).toBe(RAIL_GROUND);
    expect(w.getRail(11, 10)).toBe(RAIL_ELEVATED);
    lay(9, 10); lay(10, 9); lay(10, 11);                                  // ground: west of the low end, and beside it
    lay(12, 10, RAIL_ELEVATED); lay(11, 9, RAIL_ELEVATED);                // elevated: east of the high end, and beside it
    expect(links(10, 10)).toBe(LINK_W);
    expect(links(9, 10)).toBe(LINK_E);
    expect(links(10, 9)).toBe(0);
    expect(links(11, 10, RAIL_ELEVATED)).toBe(LINK_E);
    expect(links(12, 10, RAIL_ELEVATED)).toBe(LINK_W);
    expect(links(11, 9, RAIL_ELEVATED)).toBe(0);
    // The ramp joins its two ends across the levels; railLinks never does.
    expect(rampOther(w, at(10, 10))).toEqual({ tile: at(11, 10), level: RAIL_ELEVATED });
    expect(rampOther(w, at(11, 10))).toEqual({ tile: at(10, 10), level: RAIL_GROUND });
    expect(rampOther(w, at(9, 10))).toBeNull();
  });

  it('turned, its ends turn with it', () => {
    expect(w.placeBuilding(10, 10, BUILDING_RAMP_ELEVATED, 1)).toBe(true); // ground end north, high end south
    lay(10, 9); lay(10, 12, RAIL_ELEVATED);
    expect(links(10, 10)).toBe(LINK_N);
    expect(links(10, 11, RAIL_ELEVATED)).toBe(LINK_S);
    expect(rampOther(w, at(10, 10))).toEqual({ tile: at(10, 11), level: RAIL_ELEVATED });
  });

  it('goes down at the end of lines that are there: low end on ground track, high end on elevated', () => {
    for (let x = 4; x <= 10; x++) lay(x, 10);
    for (let x = 11; x <= 16; x++) lay(x, 10, RAIL_ELEVATED);
    expect(w.canPlaceBuilding(10, 10, BUILDING_RAMP_ELEVATED)).toBe(true);
    expect(w.canPlaceBuilding(9, 10, BUILDING_RAMP_ELEVATED)).toBe(false); // its high end would be on ground track
    expect(w.canPlaceBuilding(11, 10, BUILDING_RAMP_ELEVATED)).toBe(false); // its low end would be under elevated track
    expect(w.placeBuilding(10, 10, BUILDING_RAMP_ELEVATED)).toBe(true);
    expect(links(9, 10)).toBe(LINK_E | LINK_W);
    expect(links(10, 10)).toBe(LINK_W);
    expect(links(11, 10, RAIL_ELEVATED)).toBe(LINK_E);
  });

  it('does not stand on a road or a building', () => {
    w.setRoad(11, 10, ROAD_STREET);
    expect(w.canPlaceBuilding(10, 10, BUILDING_RAMP_ELEVATED)).toBe(false);
    w.placeBuilding(11, 14, BUILDING_PARK);
    expect(w.canPlaceBuilding(10, 14, BUILDING_RAMP_ELEVATED)).toBe(false);
  });

  it('cleared, its two ends stay as plain track on their levels; undo of placing takes them back', () => {
    const cmd = new PlaceBuildingCommand(10, 10, BUILDING_RAMP_ELEVATED, 0);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.money).toBe(1_000_000 - BALANCE.buildings[BUILDING_RAMP_ELEVATED].cost);
    cmd.undo(w);
    expect(w.getRail(10, 10)).toBe(0);
    expect(w.getRail(11, 10)).toBe(0);
    w.placeBuilding(10, 10, BUILDING_RAMP_ELEVATED);
    expect(w.clearTile(11, 10)).toBe(true);
    expect(w.getBuilding(10, 10)).toBe(BUILDING_NONE);
    expect(w.getRail(10, 10)).toBe(RAIL_GROUND);                          // like a station's platform, the track stays
    expect(w.getRail(11, 10)).toBe(RAIL_ELEVATED);
    expect(links(10, 10)).toBe(0);                                        // … and the two levels no longer join
    expect(w.buildings.length).toBe(0);
  });
});

describe('a subway ramp', () => {
  it('joins ground track outside its low end to subway track outside its deep end', () => {
    expect(w.placeBuilding(10, 10, BUILDING_RAMP_SUBWAY)).toBe(true);
    expect(w.getRail(10, 10)).toBe(RAIL_GROUND);
    expect(w.getRail(11, 10)).toBe(RAIL_SUBWAY);
    lay(9, 10); lay(12, 10, RAIL_SUBWAY); lay(11, 11, RAIL_SUBWAY);
    expect(links(10, 10)).toBe(LINK_W);
    expect(links(11, 10, RAIL_SUBWAY)).toBe(LINK_E);
    expect(links(11, 11, RAIL_SUBWAY)).toBe(0);                           // beside the deep end: not joined
    expect(rampOther(w, at(10, 10))).toEqual({ tile: at(11, 10), level: RAIL_SUBWAY });
  });

  it('another subway line may pass under its low end without joining it', () => {
    for (let y = 6; y <= 14; y++) lay(10, y, RAIL_SUBWAY);
    expect(w.placeBuilding(10, 10, BUILDING_RAMP_SUBWAY)).toBe(true);
    expect(links(10, 10, RAIL_SUBWAY)).toBe(LINK_N | LINK_S);
    expect(links(11, 10, RAIL_SUBWAY)).toBe(0);
  });

  it('its deep end cannot be dug out while the ramp stands', () => {
    w.placeBuilding(10, 10, BUILDING_RAMP_SUBWAY);
    expect(w.removeSubway(11, 10)).toBe(false);
    w.clearTile(10, 10);
    expect(w.getRail(11, 10)).toBe(RAIL_SUBWAY);                          // the tunnel stays when the ramp goes
    expect(w.removeSubway(11, 10)).toBe(true);
  });
});

describe('a subway station', () => {
  it('is a one-tile entrance over three tiles of subway platform, west–east or north–south', () => {
    expect(buildingShape(BUILDING_SUBWAY_STATION)).toEqual([[0, 0]]);
    expect(subwayPlatform(BUILDING_SUBWAY_STATION, 0)).toEqual([[-1, 0], [0, 0], [1, 0]]);
    expect(subwayPlatform(BUILDING_SUBWAY_STATION, 1)).toEqual([[0, -1], [0, 0], [0, 1]]);
    expect(subwayPlatform(BUILDING_SUBWAY_STATION, 2)).toEqual(subwayPlatform(BUILDING_SUBWAY_STATION, 0));
    expect(subwayPlatform(BUILDING_PARK)).toEqual([]);
    expect(w.placeBuilding(10, 10, BUILDING_SUBWAY_STATION)).toBe(true);
    for (let x = 9; x <= 11; x++) expect(w.getRail(x, 10)).toBe(RAIL_SUBWAY);
    expect(w.getRail(8, 10)).toBe(0);
    expect(w.getRail(12, 10)).toBe(0);
    expect(w.getBuilding(10, 10)).toBe(BUILDING_SUBWAY_STATION);
    expect(w.getBuilding(11, 10)).toBe(BUILDING_NONE);                    // only the entrance is on the surface
    expect(links(10, 10, RAIL_SUBWAY)).toBe(LINK_E | LINK_W);
  });

  it('turned, the platform runs north–south; a turn of 2 or 3 is 0 or 1', () => {
    expect(w.placeBuilding(10, 10, BUILDING_SUBWAY_STATION, 3)).toBe(true);
    expect(w.buildings[0].rot).toBe(1);
    for (let y = 9; y <= 11; y++) expect(w.getRail(10, y)).toBe(RAIL_SUBWAY);
    expect(w.getRail(10, 12)).toBe(0);
    expect(w.getRail(11, 10)).toBe(0);
  });

  it('its platform may lie under homes, roads and buildings, and over a line that is there', () => {
    w.setZone(9, 10, ZONE_R); w.setRoad(11, 10, ROAD_STREET); w.placeBuilding(12, 10, BUILDING_PARK);
    for (let x = 4; x <= 20; x++) lay(x, 10, RAIL_SUBWAY);
    expect(w.placeBuilding(10, 10, BUILDING_SUBWAY_STATION)).toBe(true);
    expect(w.getZone(9, 10)).toBe(ZONE_R);
    expect(w.getRoad(11, 10)).toBe(ROAD_STREET);
    expect(w.buildingAccessRoads(10, 10)).toEqual([at(11, 10)]);
  });

  it('needs its whole platform under the map', () => {
    expect(w.checkPlacement(0, 10, BUILDING_SUBWAY_STATION, 0).offMap).toBe(true);
    expect(w.canPlaceBuilding(0, 10, BUILDING_SUBWAY_STATION, 1)).toBe(true);
    expect(w.checkPlacement(31, 10, BUILDING_SUBWAY_STATION, 0).offMap).toBe(true);
    expect(w.canPlaceBuilding(30, 10, BUILDING_SUBWAY_STATION, 0)).toBe(true);
  });

  it('its platform cannot be dug out while it stands; cleared, the tunnel stays', () => {
    w.placeBuilding(10, 10, BUILDING_SUBWAY_STATION);
    lay(12, 10, RAIL_SUBWAY);
    expect(w.removeSubway(9, 10)).toBe(false);
    expect(w.removeSubway(11, 10)).toBe(false);
    expect(w.removeSubway(12, 10)).toBe(true);
    expect(w.clearTile(10, 10)).toBe(true);
    for (let x = 9; x <= 11; x++) expect(w.getRail(x, 10)).toBe(RAIL_SUBWAY);
    expect(w.removeSubway(9, 10)).toBe(true);
  });

  it('no tunnel may be dug beside its platform, and it cannot be placed beside one; other levels are free', () => {
    w.placeBuilding(10, 10, BUILDING_SUBWAY_STATION);
    for (let x = 9; x <= 11; x++) {
      expect(trackBlocker(w, x, 9, RAIL_SUBWAY)).toBe('blocked');
      expect(trackBlocker(w, x, 11, RAIL_SUBWAY)).toBe('blocked');
      expect(trackBlocker(w, x, 9, RAIL_GROUND)).toBeNull();
    }
    expect(trackBlocker(w, 8, 10, RAIL_SUBWAY)).toBeNull();               // straight on from an end
    expect(trackBlocker(w, 8, 9, RAIL_SUBWAY)).toBeNull();
    for (let x = 4; x <= 20; x++) lay(x, 21, RAIL_SUBWAY);
    expect(w.canPlaceBuilding(10, 20, BUILDING_SUBWAY_STATION, 0)).toBe(false);
    expect(w.canPlaceBuilding(10, 19, BUILDING_SUBWAY_STATION, 0)).toBe(true);
    expect(w.canPlaceBuilding(10, 21, BUILDING_SUBWAY_STATION, 0)).toBe(true);   // on the tunnel
    w.clearTile(10, 10);
    expect(trackBlocker(w, 10, 9, RAIL_SUBWAY)).toBeNull();
  });

  it('undo of placing takes back the platform it dug and leaves a tunnel that was there', () => {
    lay(9, 10, RAIL_SUBWAY);
    const cmd = new PlaceBuildingCommand(10, 10, BUILDING_SUBWAY_STATION, 0);
    expect(cmd.execute(w)).toBe(true);
    cmd.undo(w);
    expect(w.getRail(9, 10)).toBe(RAIL_SUBWAY);
    for (let x = 10; x <= 11; x++) expect(w.getRail(x, 10)).toBe(0);
    expect(w.getBuilding(10, 10)).toBe(BUILDING_NONE);
  });
});

describe('tools, turning and saving', () => {
  it('the three tools place the three kinds', () => {
    expect(buildingKindForPlacing('rampElevated')).toBe(BUILDING_RAMP_ELEVATED);
    expect(buildingKindForPlacing('rampSubway')).toBe(BUILDING_RAMP_SUBWAY);
    expect(buildingKindForPlacing('subwayStation')).toBe(BUILDING_SUBWAY_STATION);
    expect(commandForTool('subwayStation', 12, 12, w)).toBeInstanceOf(PlaceBuildingCommand);
  });

  it('a ramp held at the end of a line turns its low end to it', () => {
    for (let y = 2; y <= 9; y++) lay(15, y);                              // a line coming down from the north
    const p = placementFor(w, BUILDING_RAMP_ELEVATED, 15, 10);
    expect(p.check.ok).toBe(true);
    expect(meetsTrack(w, BUILDING_RAMP_ELEVATED, p.tx, p.ty, p.rot)).toBe(true);
    expect(p.rot).toBe(1);                                                // ground end north
    expect({ tx: p.tx, ty: p.ty }).toEqual({ tx: 15, ty: 10 });
  });

  it('a subway station held over a tunnel turns its platform along it', () => {
    for (let y = 2; y <= 20; y++) lay(15, y, RAIL_SUBWAY);
    const p = placementFor(w, BUILDING_SUBWAY_STATION, 15, 10);
    expect(p.check.ok).toBe(true);
    expect(p.rot).toBe(1);
    const q = placementFor(w, BUILDING_SUBWAY_STATION, 5, 25);
    expect(q.rot).toBe(0);
  });

  it('ramps and a subway station come back from a save', () => {
    w.placeBuilding(10, 10, BUILDING_RAMP_ELEVATED, 2);
    w.placeBuilding(10, 14, BUILDING_RAMP_SUBWAY, 1);
    w.placeBuilding(20, 10, BUILDING_SUBWAY_STATION, 1);
    const loaded = deserialize(serialize(w));
    expect(loaded.buildings).toEqual(w.buildings);
    expect(Array.from(loaded.layers.rail)).toEqual(Array.from(w.layers.rail));
    for (const level of [RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY]) {
      for (let i = 0; i < w.layers.rail.length; i++) expect(railLinks(loaded, i, level)).toBe(railLinks(w, i, level));
    }
    expect(loaded.removeSubway(20, 9)).toBe(false);                       // still the station's platform
  });
});
