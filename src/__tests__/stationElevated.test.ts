// The elevated train station (BUILDING_STATION_ELEVATED, owner 2026-11-21): a three-tile platform
// OVERHEAD on elevated track and nothing on the ground (buildingShapes.overheadPlatform). It has no
// tile in the building layer: it goes over whatever elevated track may cross (land, water, a road,
// ground track), and what is under it keeps its tile.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { railVolume, trafficVolume } from '../sim/TrafficData';
import { LINK_E, LINK_W, LINK_N, LINK_S, railFareIncome, railLinks, stationPeak, trackBlocker } from '../sim/rail';
import { hasPlatforms, overheadPlatform, placementRules, platformLevel, platformSides, stationPlatform, subwayPlatform, buildingShape } from '../sim/buildingShapes';
import { NEEDS_ROAD, roadSnapshot, cutOffSince } from '../sim/roadCutoff';
import { pcQuote } from '../sim/politics';
import { meetsTrack, placementFor } from '../input/placement';
import { buildingKindForPlacing } from '../input/InputController';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { serialize, deserialize } from '../persistence/Serializer';
import { en } from '../i18n/locales/en';
import {
  BUILDING_NONE, BUILDING_POLICE, BUILDING_RAMP_ELEVATED, BUILDING_STATION, BUILDING_STATION_ELEVATED, BUILDING_STATION_L, BUILDING_SUBWAY_STATION,
  RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_STREET, TERRAIN_WATER, VEG_NONE, ZONE_C, ZONE_I, ZONE_R,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, homes } from './pcTestWorld';

const T = BALANCE.transit as unknown as { flowInterval: number; buildings: Record<number, unknown> };
const shippedRows = T.buildings;
const E = BUILDING_STATION_ELEVATED;

let w: World;
let transit: TransitSystem;
let pass = 0;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, z: number, level: number) => {
  w.layers.zone[idx(x, y)] = z; w.layers.devLevel[idx(x, y)] = level; w.layers.landValue[idx(x, y)] = 128;
};
const street = (y: number, x0: number, x1: number) => { for (let x = x0; x <= x1; x++) expect(w.setRoad(x, y, ROAD_STREET)).toBe(true); };
const track = (y: number, x0: number, x1: number, level = RAIL_GROUND) => { for (let x = x0; x <= x1; x++) expect(w.layTrack(x, y, level)).toBe(true); };
const traffic = () => {
  for (let k = 0; k < 12; k++) { w.tick = ++pass * T.flowInterval; transit.update(w); }
  return w.traffic!;
};
const TRIPS = () => 6 * 2 * BALANCE.transit.tripsRtoI;                  // six level-2 homes

// A suburb in the west (a street along y = 10, six homes north of it) and a town in the east
// (a street along y = 10, industry north of it). No road joins them.
function suburbAndTown(): void {
  street(10, 2, 12);
  for (let x = 4; x <= 9; x++) zone(x, 9, ZONE_R, 2);
  street(10, 48, 60);
  for (let x = 55; x <= 58; x++) zone(x, 9, ZONE_I, 3);
}

beforeEach(() => {
  T.buildings = {};
  w = landWorld(64);
  w.budget.money = 1_000_000;
  transit = new TransitSystem();
  pass = 0;
});
afterEach(() => { T.buildings = shippedRows; });

describe('the kind', () => {
  it('is a three-tile platform overhead, on elevated track, with no tile on the ground', () => {
    expect(E).toBe(33);
    expect(buildingShape(E)).toEqual([]);                                 // nothing on the ground
    expect(buildingShape(E, 1)).toEqual([]);
    expect(hasPlatforms(E)).toBe(false);                                  // no platform tile in its shape
    expect(platformLevel(E)).toBe(RAIL_ELEVATED);
    expect(placementRules(E).twoWay).toBe(true);
    expect(overheadPlatform(E, 0)).toEqual([[-1, 0], [0, 0], [1, 0]]);     // west to east, the anchor in the middle
    expect(overheadPlatform(E, 1)).toEqual([[0, -1], [0, 0], [0, 1]]);     // north to south
    expect(overheadPlatform(E, 2)).toBe(overheadPlatform(E, 0));
    expect(overheadPlatform(E, 3)).toBe(overheadPlatform(E, 1));
    for (let r = 0; r < 4; r++) expect(stationPlatform(E, r)).toBe(overheadPlatform(E, r));
    expect(stationPlatform(BUILDING_SUBWAY_STATION, 1)).toBe(subwayPlatform(BUILDING_SUBWAY_STATION, 1));
    expect(overheadPlatform(BUILDING_SUBWAY_STATION, 0)).toEqual([]);
    expect(stationPlatform(BUILDING_STATION, 0)).toEqual([]);
    // Beside the platform: the row north of it and the row south of it; not the two ends.
    expect(platformSides(E, 0).map(([x, y]) => `${x},${y}`).sort()).toEqual(['-1,-1', '-1,1', '0,-1', '0,1', '1,-1', '1,1']);
    expect([platformLevel(BUILDING_STATION), platformLevel(BUILDING_STATION_L), platformLevel(BUILDING_SUBWAY_STATION), platformLevel(BUILDING_POLICE), platformLevel(BUILDING_RAMP_ELEVATED)])
      .toEqual([RAIL_GROUND, RAIL_GROUND, RAIL_SUBWAY, 0, 0]);
  });

  it('costs twice a ground station to build and to keep up, and needs a road like any station', () => {
    const ground = BALANCE.buildings[BUILDING_STATION], up = BALANCE.buildings[E];
    expect(up.cost).toBe(2 * ground.cost);
    expect(up.maintenance).toBe(2 * ground.maintenance);
    expect(NEEDS_ROAD.has(E)).toBe(true);
  });

  it('has a tool name and its words', () => {
    expect(buildingKindForPlacing('stationElevated')).toBe(E);
    expect(en.buildings.stationElevated).toBeTruthy();
    expect(en.ui.toolbar.stationElevated).toBeTruthy();
    expect(en.ui.toolbarDesc.stationElevated).toBeTruthy();
  });
});

describe('placing it', () => {
  it('on empty land: elevated track on its three tiles, an entry in the list, and nothing in the building layer', () => {
    w.layers.vegetation[idx(10, 12)] = 3;
    expect(w.placeBuilding(11, 12, E)).toBe(true);
    for (const x of [10, 11, 12]) {
      expect(w.layers.building[idx(x, 12)]).toBe(BUILDING_NONE);
      expect(w.layers.rail[idx(x, 12)]).toBe(RAIL_ELEVATED);
      expect(w.overheadStationAt(idx(x, 12))).toBe(w.buildings[0]);
      expect(w.buildingAt(x, 12)).toBe(w.buildings[0]);
    }
    expect(w.overheadStationAt(idx(13, 12))).toBeNull();
    expect(w.overheadStationAt(idx(11, 13))).toBeNull();
    expect(w.layers.vegetation[idx(10, 12)]).toBe(VEG_NONE);
    expect(w.buildings).toEqual([{ tx: 11, ty: 12, kind: E }]);
    expect(w.buildingTilesAt(11, 12)).toEqual([]);
    expect(w.overheadStationTiles(w.buildings[0])).toEqual([idx(10, 12), idx(11, 12), idx(12, 12)]);
  });

  it('turns two ways', () => {
    expect(w.placeBuilding(20, 20, E, 1)).toBe(true);
    for (const y of [19, 20, 21]) expect(w.layers.rail[idx(20, y)]).toBe(RAIL_ELEVATED);
    expect(railLinks(w, idx(20, 20), RAIL_ELEVATED)).toBe(LINK_N | LINK_S);
    expect(w.placeBuilding(30, 20, E, 2)).toBe(true);                      // a half turn is no turn
    for (const x of [29, 30, 31]) expect(w.layers.rail[idx(x, 20)]).toBe(RAIL_ELEVATED);
    expect(w.placeBuilding(40, 20, E, 3)).toBe(true);
    for (const y of [19, 20, 21]) expect(w.layers.rail[idx(40, y)]).toBe(RAIL_ELEVATED);
    expect(w.buildings.map((b) => b.rot)).toEqual([1, undefined, 1]);
  });

  it('over a street: the street stays, and it is the station\'s door', () => {
    street(20, 2, 30);
    expect(w.placeBuilding(10, 20, E)).toBe(true);
    for (const x of [9, 10, 11]) {
      expect(w.layers.roadClass[idx(x, 20)]).toBe(ROAD_STREET);
      expect(w.layers.rail[idx(x, 20)]).toBe(RAIL_ELEVATED);
      expect(w.layers.building[idx(x, 20)]).toBe(BUILDING_NONE);
    }
    const roads = w.buildingAccessRoads(10, 20);
    for (const x of [8, 9, 10, 11, 12]) expect(roads).toContain(idx(x, 20));
    expect(w.buildingAccessRoads(9, 20)).toEqual(roads);                   // asked at any of its tiles
    // The street can still be widened under the platform.
    expect(w.setRoad(10, 20, ROAD_AVENUE)).toBe(true);
    expect(w.layers.rail[idx(10, 20)]).toBe(RAIL_ELEVATED);
    expect(w.buildings.length).toBe(1);
  });

  it('over water, ground track and an avenue, and beside a zone', () => {
    w.layers.terrain[idx(9, 20)] = TERRAIN_WATER;
    expect(w.layTrack(10, 20)).toBe(true);                                // ground track under the middle
    expect(w.setRoad(11, 20, ROAD_AVENUE)).toBe(true);
    zone(9, 21, ZONE_R, 2);
    expect(w.placeBuilding(10, 20, E)).toBe(true);
    expect(w.layers.rail[idx(9, 20)]).toBe(RAIL_ELEVATED);
    expect(w.layers.rail[idx(10, 20)]).toBe(RAIL_GROUND | RAIL_ELEVATED);
    expect(w.layers.roadClass[idx(11, 20)]).toBe(ROAD_AVENUE);
    expect(w.layers.terrain[idx(9, 20)]).toBe(TERRAIN_WATER);
    expect(w.layers.zone[idx(9, 21)]).toBe(ZONE_R);
  });

  it('a road beside the platform is a door; a highway is not', () => {
    expect(w.placeBuilding(10, 20, E)).toBe(true);
    expect(w.buildingAccessRoads(10, 20)).toEqual([]);
    expect(w.setRoad(10, 21, ROAD_STREET)).toBe(true);                     // south of the middle
    expect(w.buildingAccessRoads(10, 20)).toEqual([idx(10, 21)]);
    w.clearTile(10, 21);
    expect(w.setRoad(11, 19, ROAD_STREET)).toBe(true);                     // north of an end
    expect(w.buildingAccessRoads(10, 20)).toEqual([idx(11, 19)]);
    w.clearTile(11, 19);
    expect(w.setRoad(11, 19, ROAD_HIGHWAY)).toBe(true);
    expect(w.buildingAccessRoads(10, 20)).toEqual([]);
    expect(w.buildings.length).toBe(1);
  });

  it('on a straight run of elevated track that is already there, and joins it', () => {
    track(12, 5, 20, RAIL_ELEVATED);
    expect(w.placeBuilding(11, 12, E)).toBe(true);
    for (const x of [9, 10, 11, 12, 13]) expect(railLinks(w, idx(x, 12), RAIL_ELEVATED)).toBe(LINK_E | LINK_W);
  });

  it('is refused with a building or a zone under it, with elevated track beside it, or off the map', () => {
    expect(w.placeBuilding(12, 12, BUILDING_POLICE)).toBe(true);
    expect(w.checkPlacement(11, 12, E).blocked).toEqual([idx(12, 12)]);
    w.clearTile(12, 12);
    zone(10, 12, ZONE_C, 1);
    expect(w.checkPlacement(11, 12, E).blocked).toEqual([idx(10, 12)]);
    w.setZone(10, 12, 0);
    expect(w.canPlaceBuilding(11, 12, E)).toBe(true);
    expect(w.layTrack(11, 11, RAIL_ELEVATED)).toBe(true);                 // elevated track alongside
    expect(w.checkPlacement(11, 12, E).blocked).toEqual([idx(11, 11)]);
    w.clearTile(11, 11);
    expect(w.layTrack(11, 11)).toBe(true);                                // ground track alongside is fine
    expect(w.canPlaceBuilding(11, 12, E)).toBe(true);
    expect(w.checkPlacement(0, 5, E).offMap).toBe(true);                  // its west end would be off the map
    expect(w.checkPlacement(1, 0, E).ok).toBe(true);
    expect(w.checkPlacement(1, 0, E, 1).offMap).toBe(true);
  });

  it('once it stands: elevated track joins at the ends only, and none may be laid beside it', () => {
    expect(w.placeBuilding(11, 12, E)).toBe(true);
    for (const [x, y] of [[10, 11], [11, 11], [12, 11], [10, 13], [11, 13], [12, 13]]) expect(trackBlocker(w, x, y, RAIL_ELEVATED), `${x},${y}`).toBe('blocked');
    expect(trackBlocker(w, 11, 12, RAIL_ELEVATED)).toBe('hasTrack');
    expect(trackBlocker(w, 9, 12, RAIL_ELEVATED)).toBeNull();
    expect(trackBlocker(w, 13, 12, RAIL_ELEVATED)).toBeNull();
    expect(trackBlocker(w, 11, 11, RAIL_GROUND)).toBeNull();
    expect(trackBlocker(w, 11, 11, RAIL_SUBWAY)).toBeNull();
    track(12, 13, 15, RAIL_ELEVATED);
    expect(railLinks(w, idx(12, 12), RAIL_ELEVATED)).toBe(LINK_E | LINK_W);
    expect(railLinks(w, idx(10, 12), RAIL_ELEVATED)).toBe(LINK_E);         // the dead end
    // A ramp's high end is elevated track too: not beside the platform. Straight on from its end is fine.
    expect(w.canPlaceBuilding(10, 10, BUILDING_RAMP_ELEVATED, 1)).toBe(false);   // high end at (10, 11)
    expect(w.canPlaceBuilding(7, 12, BUILDING_RAMP_ELEVATED, 0)).toBe(true);     // high end at (8, 12), then (9, 12) to lay
    // Another elevated station: not alongside, not on top, not into its side; end to end is fine.
    expect(w.canPlaceBuilding(11, 11, E)).toBe(false);
    expect(w.canPlaceBuilding(12, 12, E)).toBe(false);
    expect(w.checkPlacement(11, 14, E, 1).blocked).toEqual([idx(11, 13)]);
    expect(w.canPlaceBuilding(7, 12, E)).toBe(true);                      // (6..8, 12), west of the dead end
    // Zones and buildings stay off its tiles, as under any elevated track.
    expect(w.setZone(11, 12, ZONE_R)).toBe(false);
    expect(w.canPlaceBuilding(11, 12, BUILDING_POLICE)).toBe(false);
    // A road and ground track may go under it afterwards.
    expect(w.setRoad(10, 12, ROAD_STREET)).toBe(true);
    expect(w.layTrack(12, 12)).toBe(true);
    expect(w.buildings.length).toBe(1);
  });

  it('the bulldozer takes the station first and leaves the track and the street; again takes those', () => {
    street(20, 2, 30);
    expect(w.placeBuilding(10, 20, E)).toBe(true);
    const money = w.budget.money;
    const down = new BulldozeCommand(9, 20);                              // any of its three tiles
    expect(down.execute(w)).toBe(true);
    expect(w.buildings).toEqual([]);
    expect(w.budget.money).toBe(money - BALANCE.costs.bulldoze);
    for (const x of [9, 10, 11]) {
      expect(w.layers.rail[idx(x, 20)]).toBe(RAIL_ELEVATED);              // plain elevated track now
      expect(w.layers.roadClass[idx(x, 20)]).toBe(ROAD_STREET);
    }
    expect(trackBlocker(w, 10, 19, RAIL_ELEVATED)).toBeNull();            // nothing to stay clear of any more
    down.undo(w);
    expect(w.buildings).toEqual([{ tx: 10, ty: 20, kind: E }]);
    expect(w.budget.money).toBe(money);
    expect(trackBlocker(w, 10, 19, RAIL_ELEVATED)).toBe('blocked');
    // Again, then once more on the tile: the street and the track go, as under any elevated track.
    expect(new BulldozeCommand(10, 20).execute(w)).toBe(true);
    expect(w.buildings).toEqual([]);
    expect(new BulldozeCommand(10, 20).execute(w)).toBe(true);
    expect(w.layers.rail[idx(10, 20)]).toBe(0);
    expect(w.layers.roadClass[idx(10, 20)]).toBe(0);
    expect(new BulldozeCommand(10, 20).execute(w)).toBe(false);
  });

  it('undo takes back the station and only the track it laid, and gives back the trees', () => {
    street(20, 2, 30);
    expect(w.layTrack(9, 20, RAIL_ELEVATED)).toBe(true);                  // already there over the street
    w.layers.vegetation[idx(20, 30)] = 2;
    const cmd = new PlaceBuildingCommand(10, 20, E);
    const tree = new PlaceBuildingCommand(20, 30, E, 1);
    const before = w.budget.money;
    expect(cmd.execute(w)).toBe(true);
    expect(tree.execute(w)).toBe(true);
    expect(w.budget.money).toBe(before - 2 * BALANCE.buildings[E].cost);
    expect(w.buildings.length).toBe(2);
    for (const x of [9, 10, 11]) expect(w.layers.rail[idx(x, 20)]).toBe(RAIL_ELEVATED);
    expect(w.layers.vegetation[idx(20, 30)]).toBe(VEG_NONE);
    tree.undo(w);
    cmd.undo(w);
    expect(w.budget.money).toBe(before);
    expect(w.buildings).toEqual([]);
    expect(w.layers.vegetation[idx(20, 30)]).toBe(2);
    for (const y of [29, 30, 31]) expect(w.layers.rail[idx(20, y)]).toBe(0);
    expect(w.layers.rail[idx(9, 20)]).toBe(RAIL_ELEVATED);
    expect(w.layers.rail[idx(10, 20)]).toBe(0);
    expect(w.layers.rail[idx(11, 20)]).toBe(0);
    for (const x of [9, 10, 11]) expect(w.layers.roadClass[idx(x, 20)]).toBe(ROAD_STREET);
    expect(trackBlocker(w, 10, 19, RAIL_ELEVATED)).toBeNull();
  });

  it('the pointer holds its middle, and it turns to lie along an elevated line', () => {
    for (let y = 4; y <= 30; y++) expect(w.layTrack(20, y, RAIL_ELEVATED)).toBe(true);   // a line running north to south
    const p = placementFor(w, E, 20, 12);                                  // pointing at the line
    expect(p.check.ok).toBe(true);
    expect([p.tx, p.ty, p.rot]).toEqual([20, 12, 1]);
    expect(meetsTrack(w, E, p.tx, p.ty, p.rot)).toBe(true);
    const open = placementFor(w, E, 40, 12);                               // on open land: where it is pointed
    expect([open.tx, open.ty, open.check.ok]).toEqual([40, 12, true]);
    // Ground track does not count as meeting it.
    track(40, 4, 9);
    expect(meetsTrack(w, E, 11, 40, 0)).toBe(false);                      // platform (10..12, 40), ground track ending at (9, 40)
    expect(w.layTrack(13, 40, RAIL_ELEVATED)).toBe(true);
    expect(meetsTrack(w, E, 11, 40, 0)).toBe(true);
  });

  it('is kept by a save, and by the fit to shapes after a load', () => {
    street(12, 2, 30);
    expect(w.placeBuilding(11, 12, E)).toBe(true);
    expect(w.placeBuilding(40, 40, E, 1)).toBe(true);
    const back = deserialize(serialize(w));
    expect(back.fitBuildingsToShapes()).toEqual({ grown: [], removed: [] });
    expect(back.buildings).toEqual([{ tx: 11, ty: 12, kind: E }, { tx: 40, ty: 40, kind: E, rot: 1 }]);
    for (const x of [10, 11, 12]) {
      expect(back.layers.building[idx(x, 12)]).toBe(BUILDING_NONE);
      expect(back.layers.rail[idx(x, 12)]).toBe(RAIL_ELEVATED);
      expect(back.layers.roadClass[idx(x, 12)]).toBe(ROAD_STREET);
      expect(back.overheadStationAt(idx(x, 12))).toEqual({ tx: 11, ty: 12, kind: E });
    }
    expect(back.overheadStationAt(idx(40, 41))?.rot).toBe(1);
    expect(back.buildingAccessRoads(11, 12)).toContain(idx(11, 12));
    expect(trackBlocker(back, 11, 11, RAIL_ELEVATED)).toBe('blocked');
  });

  it('is reported with its three tiles when its road is taken away', () => {
    expect(w.placeBuilding(11, 12, E)).toBe(true);
    expect(w.setRoad(11, 13, ROAD_STREET)).toBe(true);
    const before = roadSnapshot(w);
    w.clearTile(11, 13);
    const cut = cutOffSince(w, before);
    expect(cut.length).toBe(1);
    expect(cut[0].tiles).toEqual([{ x: 10, y: 12 }, { x: 11, y: 12 }, { x: 12, y: 12 }]);
  });
});

describe('riders', () => {
  it('ride between two elevated stations over the streets, and cars still drive under them', () => {
    suburbAndTown();
    expect(w.placeBuilding(5, 10, E)).toBe(true);                          // over the suburb's street, (4..6, 10)
    expect(w.placeBuilding(51, 10, E)).toBe(true);                         // and over the town's, (50..52, 10)
    track(10, 7, 49, RAIL_ELEVATED);                                      // along and beyond both streets
    const t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    for (const x of [8, 30, 48]) expect(railVolume(t, idx(x, 10), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(30, 10))).toBe(0);                           // no ground track anywhere
    expect(t.rail.stations.length).toBe(2);
    expect(t.rail.stations[0].anchor).toBe(idx(5, 10));
    expect(t.rail.stations[0].boardings).toBeCloseTo(TRIPS(), 3);
    expect(t.rail.boardings).toBeGreaterThan(0);
    expect(railFareIncome(w)).toBeCloseTo(t.rail.boardings * BALANCE.rail.fare, 6);
    const peak = stationPeak(w, 4, 10)!;                                   // asked at an end tile
    expect(peak.level).toBe(RAIL_ELEVATED);
    expect(peak.tile).toBe(idx(5, 10));
    expect(peak.riders).toBeCloseTo(TRIPS(), 3);
    // The street under the town's platform carries the riders on to work.
    expect(trafficVolume(t, idx(54, 10))).toBeGreaterThan(0);
    expect(w.layers.roadClass[idx(51, 10)]).toBe(ROAD_STREET);
    expect(w.layers.accessibility[idx(5, 9)]).toBeGreaterThan(0);
    // Take one station down: the track is still there, the riders are not.
    expect(new BulldozeCommand(51, 10).execute(w)).toBe(true);
    const after = traffic();
    expect(after.rail.stations.length).toBe(1);
    expect(railVolume(after, idx(30, 10), RAIL_ELEVATED)).toBe(0);
  });

  it('ride from an elevated station, down a ramp, to a ground station', () => {
    suburbAndTown();
    expect(w.placeBuilding(5, 12, E)).toBe(true);                          // platform (4..6, 12)
    expect(w.setRoad(5, 11, ROAD_STREET)).toBe(true);                      // beside the platform, up to the street
    track(12, 7, 43, RAIL_ELEVATED);
    expect(w.placeBuilding(45, 12, BUILDING_RAMP_ELEVATED, 2)).toBe(true);  // low end x 45, high end x 44
    track(12, 46, 49);
    expect(w.placeBuilding(50, 12, BUILDING_STATION)).toBe(true);
    expect(w.setRoad(51, 11, ROAD_STREET)).toBe(true);
    const t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    expect(railVolume(t, idx(30, 12), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(47, 12))).toBeCloseTo(TRIPS(), 3);
  });

  it('do not ride from a station with no road', () => {
    suburbAndTown();
    expect(w.placeBuilding(5, 12, E)).toBe(true);
    expect(w.placeBuilding(51, 12, E)).toBe(true);
    expect(w.setRoad(51, 11, ROAD_STREET)).toBe(true);
    track(12, 7, 49, RAIL_ELEVATED);
    const t = traffic();
    expect(w.buildingAccessRoads(5, 12)).toEqual([]);
    expect(railVolume(t, idx(30, 12), RAIL_ELEVATED)).toBe(0);
    expect(t.rail.boardings).toBe(0);
  });
});

describe('political capital', () => {
  const nuisanceOf = (q: ReturnType<typeof pcQuote>) => q.parts.filter((p) => p.reason === 'nuisance').reduce((s, p) => s - p.amount, 0);

  it('homes nearby object as they do to the same three tiles of elevated track', () => {
    homes(w, 8, 10, 16, 10, 2);
    w.budget.politicalCapital = 1000;
    let asTrack = 0;
    for (const x of [10, 11, 12]) asTrack += nuisanceOf(pcQuote(w, { type: 'track', tx: x, ty: 12, level: RAIL_ELEVATED }));
    expect(asTrack).toBeGreaterThan(0);
    const q = pcQuote(w, { type: 'building', tx: 11, ty: 12, kind: E });
    expect(nuisanceOf(q)).toBeCloseTo(asTrack, 9);
    expect(q.cost).toBeCloseTo(asTrack, 9);
    // Turned, it is the tiles the platform is then over.
    let turned = 0;
    for (const y of [12, 13, 14]) turned += nuisanceOf(pcQuote(w, { type: 'track', tx: 12, ty: y, level: RAIL_ELEVATED }));
    expect(nuisanceOf(pcQuote(w, { type: 'building', tx: 12, ty: 13, kind: E, rot: 1 }))).toBeCloseTo(turned, 9);
    // A ground station still costs nothing.
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 12, kind: BUILDING_STATION }).cost).toBe(0);
  });

  it('over elevated track that is already there it costs only for the tiles it adds', () => {
    homes(w, 8, 10, 16, 10, 2);
    w.budget.politicalCapital = 1000;
    const third = nuisanceOf(pcQuote(w, { type: 'track', tx: 12, ty: 12, level: RAIL_ELEVATED }));
    track(12, 10, 11, RAIL_ELEVATED);
    expect(nuisanceOf(pcQuote(w, { type: 'building', tx: 11, ty: 12, kind: E }))).toBeCloseTo(third, 9);
    track(12, 12, 12, RAIL_ELEVATED);
    expect(pcQuote(w, { type: 'building', tx: 11, ty: 12, kind: E }).cost).toBe(0);
  });

  it('with no homes near it costs nothing', () => {
    expect(pcQuote(w, { type: 'building', tx: 11, ty: 12, kind: E }).cost).toBe(0);
    expect(ZONE_I).toBeGreaterThan(0);
  });
});
