// The elevated train station (BUILDING_STATION_ELEVATED, owner 2026-11-21): the straight station's
// shape, with a platform that carries ELEVATED track. Version 1 stands on empty land only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { railVolume } from '../sim/TrafficData';
import { LINK_E, LINK_W, LINK_N, LINK_S, railFareIncome, railLinks, stationPeak, trackBlocker } from '../sim/rail';
import { hasPlatforms, platformEnds, platformLevel, buildingShape } from '../sim/buildingShapes';
import { NEEDS_ROAD } from '../sim/roadCutoff';
import { pcQuote } from '../sim/politics';
import { meetsTrack, placementFor } from '../input/placement';
import { buildingKindForPlacing } from '../input/InputController';
import { serialize, deserialize } from '../persistence/Serializer';
import { en } from '../i18n/locales/en';
import {
  BUILDING_NONE, BUILDING_POLICE, BUILDING_RAMP_ELEVATED, BUILDING_STATION, BUILDING_STATION_ELEVATED, BUILDING_STATION_L, BUILDING_SUBWAY_STATION,
  RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_STREET, ZONE_I, ZONE_R,
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
  transit = new TransitSystem();
  pass = 0;
});
afterEach(() => { T.buildings = shippedRows; });

describe('the kind', () => {
  it('is a station of three platform tiles in a row whose track is elevated', () => {
    expect(E).toBe(33);
    expect(buildingShape(E)).toEqual([[0, 0], [1, 0], [2, 0]]);
    expect(buildingShape(E, 1)).toEqual([[0, 0], [0, 1], [0, 2]]);
    expect(hasPlatforms(E)).toBe(true);
    expect(platformLevel(E)).toBe(RAIL_ELEVATED);
    expect(platformEnds(E, 0).sort()).toEqual([[-1, 0], [3, 0]]);
    // The others, unchanged.
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
  it('on empty land lays elevated track on its three tiles, and no ground track', () => {
    expect(w.placeBuilding(10, 12, E)).toBe(true);
    for (const x of [10, 11, 12]) {
      expect(w.layers.building[idx(x, 12)]).toBe(E);
      expect(w.layers.rail[idx(x, 12)]).toBe(RAIL_ELEVATED);
    }
    expect(w.buildings).toEqual([{ tx: 10, ty: 12, kind: E }]);
  });

  it('stands on a straight run of elevated track that is already there, and joins it', () => {
    track(12, 5, 20, RAIL_ELEVATED);
    expect(w.placeBuilding(10, 12, E)).toBe(true);
    for (const x of [10, 11, 12]) expect(railLinks(w, idx(x, 12), RAIL_ELEVATED)).toBe(LINK_E | LINK_W);
    expect(railLinks(w, idx(9, 12), RAIL_ELEVATED) & LINK_E).toBe(LINK_E);
    expect(railLinks(w, idx(13, 12), RAIL_ELEVATED) & LINK_W).toBe(LINK_W);
  });

  it('turns: at rotation 1 it runs north to south', () => {
    expect(w.placeBuilding(10, 12, E, 1)).toBe(true);
    for (const y of [12, 13, 14]) expect(w.layers.rail[idx(10, y)]).toBe(RAIL_ELEVATED);
    expect(railLinks(w, idx(10, 13), RAIL_ELEVATED)).toBe(LINK_N | LINK_S);
  });

  it('is refused on a road (version 1), on ground track, on a building, and with elevated track beside it', () => {
    expect(w.setRoad(11, 12, ROAD_STREET)).toBe(true);
    expect(w.canPlaceBuilding(10, 12, E)).toBe(false);
    w.clearTile(11, 12);
    expect(w.layTrack(11, 12)).toBe(true);                                // ground track under the middle
    expect(w.canPlaceBuilding(10, 12, E)).toBe(false);
    w.clearTile(11, 12);
    expect(w.placeBuilding(11, 12, BUILDING_POLICE)).toBe(true);
    expect(w.canPlaceBuilding(10, 12, E)).toBe(false);
    w.clearTile(11, 12);
    expect(w.canPlaceBuilding(10, 12, E)).toBe(true);
    expect(w.layTrack(11, 13, RAIL_ELEVATED)).toBe(true);                 // elevated track alongside
    expect(w.checkPlacement(10, 12, E).blocked).toEqual([idx(11, 13)]);
    w.clearTile(11, 13);
    expect(w.layTrack(11, 13)).toBe(true);                                // ground track alongside is fine
    expect(w.canPlaceBuilding(10, 12, E)).toBe(true);
  });

  it('once it stands: elevated track joins at its ends only, none may run beside it, and ground track may', () => {
    expect(w.placeBuilding(10, 12, E)).toBe(true);
    expect(trackBlocker(w, 11, 11, RAIL_ELEVATED)).toBe('blocked');
    expect(trackBlocker(w, 12, 13, RAIL_ELEVATED)).toBe('blocked');
    expect(trackBlocker(w, 11, 12, RAIL_ELEVATED)).toBe('blocked');        // the building itself
    expect(trackBlocker(w, 9, 12, RAIL_ELEVATED)).toBeNull();
    expect(trackBlocker(w, 13, 12, RAIL_ELEVATED)).toBeNull();
    expect(trackBlocker(w, 11, 11, RAIL_GROUND)).toBeNull();
    expect(trackBlocker(w, 11, 11, RAIL_SUBWAY)).toBeNull();
    track(12, 13, 15, RAIL_ELEVATED);
    expect(railLinks(w, idx(12, 12), RAIL_ELEVATED)).toBe(LINK_E | LINK_W);
    expect(railLinks(w, idx(10, 12), RAIL_ELEVATED)).toBe(LINK_E);         // the dead end
    // A ground station is not troubled by elevated track beside it, as before.
    expect(w.placeBuilding(30, 12, BUILDING_STATION)).toBe(true);
    expect(trackBlocker(w, 31, 11, RAIL_ELEVATED)).toBeNull();
    expect(trackBlocker(w, 31, 11, RAIL_GROUND)).toBe('blocked');
  });

  it('bulldozed, it leaves its elevated track as plain track', () => {
    expect(w.placeBuilding(10, 12, E)).toBe(true);
    expect(w.clearTile(11, 12)).toBe(true);
    for (const x of [10, 11, 12]) {
      expect(w.layers.building[idx(x, 12)]).toBe(BUILDING_NONE);
      expect(w.layers.rail[idx(x, 12)]).toBe(RAIL_ELEVATED);
    }
    expect(w.buildings).toEqual([]);
    expect(trackBlocker(w, 11, 11, RAIL_ELEVATED)).toBeNull();
  });

  it('the pointer turns it to meet elevated track, not ground track', () => {
    for (let y = 4; y <= 10; y++) expect(w.layTrack(20, y, RAIL_ELEVATED)).toBe(true);   // a line coming down to (20, 10)
    const p = placementFor(w, E, 20, 12);
    expect(p.check.ok).toBe(true);
    expect(p.rot & 1).toBe(1);                                             // north to south
    expect(meetsTrack(w, E, p.tx, p.ty, p.rot)).toBe(true);
    track(30, 4, 9);                                                      // ground track ending at (9, 30)
    expect(meetsTrack(w, E, 10, 30, 0)).toBe(false);
    expect(meetsTrack(w, BUILDING_STATION, 10, 30, 0)).toBe(true);
  });

  it('is kept by a save', () => {
    track(12, 5, 9, RAIL_ELEVATED);
    expect(w.placeBuilding(10, 12, E)).toBe(true);
    const back = deserialize(serialize(w));
    expect(back.buildings).toEqual([{ tx: 10, ty: 12, kind: E }]);
    for (const x of [10, 11, 12]) {
      expect(back.layers.building[idx(x, 12)]).toBe(E);
      expect(back.layers.rail[idx(x, 12)]).toBe(RAIL_ELEVATED);
      expect(back.buildingAnchorAt(idx(x, 12))).toBe(idx(10, 12));
    }
    expect(railLinks(back, idx(10, 12), RAIL_ELEVATED)).toBe(LINK_E | LINK_W);
  });
});

describe('riders', () => {
  /** Elevated stations at both ends (platforms along y = 12: x 4–6 and x 50–52), each with a one-tile street up to y = 10, and elevated track between. */
  function elevatedStations(): void {
    expect(w.placeBuilding(4, 12, E)).toBe(true);
    expect(w.placeBuilding(50, 12, E)).toBe(true);
    expect(w.setRoad(5, 11, ROAD_STREET)).toBe(true);
    expect(w.setRoad(51, 11, ROAD_STREET)).toBe(true);
    track(12, 7, 49, RAIL_ELEVATED);
  }

  it('ride between two elevated stations on elevated track alone', () => {
    suburbAndTown();
    elevatedStations();
    const t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    for (const x of [8, 30, 48]) expect(railVolume(t, idx(x, 12), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(30, 12))).toBe(0);                           // no ground track anywhere
    expect(t.rail.stations.length).toBe(2);
    expect(t.rail.stations[0].boardings).toBeCloseTo(TRIPS(), 3);
    expect(railFareIncome(w)).toBeCloseTo(t.rail.boardings * BALANCE.rail.fare, 6);
    expect(t.rail.boardings).toBeGreaterThan(0);
    const peak = stationPeak(w, 4, 12)!;
    expect(peak.level).toBe(RAIL_ELEVATED);
    expect(peak.riders).toBeCloseTo(TRIPS(), 3);
    expect(w.layers.accessibility[idx(5, 9)]).toBeGreaterThan(0);
  });

  it('ride from an elevated station, down a ramp, to a ground station', () => {
    suburbAndTown();
    expect(w.placeBuilding(4, 12, E)).toBe(true);
    expect(w.setRoad(5, 11, ROAD_STREET)).toBe(true);
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
    expect(w.placeBuilding(4, 12, E)).toBe(true);
    expect(w.placeBuilding(50, 12, E)).toBe(true);
    expect(w.setRoad(51, 11, ROAD_STREET)).toBe(true);
    track(12, 7, 49, RAIL_ELEVATED);
    const t = traffic();
    expect(w.buildingAccessRoads(4, 12)).toEqual([]);
    expect(railVolume(t, idx(30, 12), RAIL_ELEVATED)).toBe(0);
    expect(t.rail.boardings).toBe(0);
  });

  it('do not get onto ground track that passes under the same tiles of a ground station', () => {
    // A ground station and an elevated one side by side, each on its own line: the levels stay apart.
    suburbAndTown();
    elevatedStations();
    track(13, 2, 60);                                                     // ground track right beside both platforms, joined to nothing
    const t = traffic();
    expect(railVolume(t, idx(30, 13))).toBe(0);
    expect(railVolume(t, idx(30, 12), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3);
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
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 12, kind: E });
    expect(nuisanceOf(q)).toBeCloseTo(asTrack, 9);
    expect(q.cost).toBeCloseTo(asTrack, 9);
    // A ground station still costs nothing.
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 12, kind: BUILDING_STATION }).cost).toBe(0);
  });

  it('over elevated track that is already there it costs only for the tiles it adds', () => {
    homes(w, 8, 10, 16, 10, 2);
    w.budget.politicalCapital = 1000;
    const third = nuisanceOf(pcQuote(w, { type: 'track', tx: 12, ty: 12, level: RAIL_ELEVATED }));
    track(12, 10, 11, RAIL_ELEVATED);
    expect(nuisanceOf(pcQuote(w, { type: 'building', tx: 10, ty: 12, kind: E }))).toBeCloseTo(third, 9);
    track(12, 12, 12, RAIL_ELEVATED);
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 12, kind: E }).cost).toBe(0);
  });

  it('with no homes near it costs nothing', () => {
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 12, kind: E }).cost).toBe(0);
    expect(ZONE_R).toBeGreaterThan(0);
  });
});
