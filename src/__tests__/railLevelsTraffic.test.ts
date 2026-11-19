// Rail phase 2 (C): trips ride elevated and subway track, through ramps and subway stations.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { NODES_PER_TILE, railCapacity, railLoad, railNode, railSlot, railVolume, trafficVolume } from '../sim/TrafficData';
import { railFareIncome, stationPeak } from '../sim/rail';
import { routeFrom, routeTile } from '../render/TrafficOverlay';
import {
  BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, BUILDING_STATION, BUILDING_SUBWAY_STATION,
  RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_STREET, ZONE_C, ZONE_I, ZONE_R,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';

const T = BALANCE.transit as unknown as { flowInterval: number; buildings: Record<number, unknown> };
const RL = BALANCE.rail as unknown as { speedMult: number; capacity: number; boardTime: number; fare: number; rampTime: number; junction3: { capacityMult: number }; crossing: { carDelay: number; trainDelay: number } };
const shipped = structuredClone({ ...RL, track: undefined });
const shippedRows = T.buildings;

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
const HOME_ROAD = () => idx(5, 10);

// A SUBURB in the west (a street along y = 10, x 2–12, six homes north of it) and a TOWN in
// the east (a street along y = 10, x 48–60, industry north of it). No road joins them.
function suburbAndTown(): void {
  street(10, 2, 12);
  for (let x = 4; x <= 9; x++) zone(x, 9, ZONE_R, 2);
  street(10, 48, 60);
  for (let x = 55; x <= 58; x++) zone(x, 9, ZONE_I, 3);
}
/** A train station: platform x..x+2 on y = 12, a tile of plain track after it (x+3), and a one-tile street (x+1, 11) up to the street along y = 10. */
function trainStation(x: number): void {
  expect(w.placeBuilding(x, 12, BUILDING_STATION)).toBe(true);
  expect(w.layTrack(x + 3, 12)).toBe(true);
  expect(w.setRoad(x + 1, 11, ROAD_STREET)).toBe(true);
}
/** Train stations at both ends (platforms along y = 12: x 4–6 and x 50–52). */
function trainStations(): void {
  trainStation(4);
  trainStation(50);
}
/** Ground out of each station, a ramp up, elevated in between (x 15–43), a ramp down. */
function elevatedLine(): void {
  trainStations();
  track(12, 8, 12);
  expect(w.placeBuilding(13, 12, BUILDING_RAMP_ELEVATED, 0)).toBe(true);  // low end x 13, high end x 14
  track(12, 15, 43, RAIL_ELEVATED);
  expect(w.placeBuilding(45, 12, BUILDING_RAMP_ELEVATED, 2)).toBe(true);  // low end x 45, high end x 44
  track(12, 46, 49);
}
/** Subway stations at both ends (entrances at (6, 11) and (52, 11), platforms along y = 11) and a tunnel between. */
function subwayLine(): void {
  expect(w.placeBuilding(6, 11, BUILDING_SUBWAY_STATION, 0)).toBe(true);  // platform x 5–7
  expect(w.placeBuilding(52, 11, BUILDING_SUBWAY_STATION, 0)).toBe(true); // platform x 51–53
  track(11, 8, 50, RAIL_SUBWAY);
}

beforeEach(() => {
  T.buildings = {};
  w = landWorld(64);
  transit = new TransitSystem();
  pass = 0;
});
afterEach(() => { Object.assign(RL, structuredClone(shipped), { track: BALANCE.rail.track }); T.buildings = shippedRows; });

describe('the network', () => {
  it('has four nodes a tile: the road and the track on each level', () => {
    suburbAndTown();
    const t = traffic();
    expect(NODES_PER_TILE).toBe(4);
    expect(t.jobs.volume.length).toBe(4 * 64 * 64);
    expect([railSlot(RAIL_GROUND), railSlot(RAIL_ELEVATED), railSlot(RAIL_SUBWAY)]).toEqual([1, 2, 3]);
    expect(railNode(t, 7, RAIL_SUBWAY)).toBe(3 * t.tiles + 7);
    expect(routeTile(t.jobs.field, railNode(t, 7, RAIL_ELEVATED))).toBe(7);
  });
});

describe('an elevated line between two train stations', () => {
  it('carries the commuters: up one ramp, along, down the other', () => {
    suburbAndTown();
    elevatedLine();
    const t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    for (const x of [15, 30, 43]) expect(railVolume(t, idx(x, 12), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(30, 12))).toBe(0);                           // no ground track there
    expect(railVolume(t, idx(10, 12))).toBeCloseTo(TRIPS(), 3);           // ground, out of the station
    expect(railVolume(t, idx(13, 12))).toBeCloseTo(TRIPS(), 3);           // the ramp's low end (ground)
    expect(railVolume(t, idx(14, 12), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3); // … and its high end
    expect(railCapacity(t, idx(30, 12), RAIL_ELEVATED)).toBe(RL.capacity);
    expect(railCapacity(t, idx(30, 12))).toBe(0);
    expect(w.layers.accessibility[idx(5, 9)]).toBeGreaterThan(0);
  });

  it('each ramp costs rail.rampTime', () => {
    suburbAndTown();
    elevatedLine();
    RL.rampTime = 0;
    const free = traffic().jobs.field.dist[HOME_ROAD()];
    RL.rampTime = 3;
    expect(traffic().jobs.field.dist[HOME_ROAD()]).toBeCloseTo(free + 6, 1);
  });

  it('without the ramps the two levels do not join, though the track lies end to end', () => {
    suburbAndTown();
    trainStations();
    track(12, 8, 13);
    track(12, 14, 44, RAIL_ELEVATED);
    track(12, 45, 49);
    const t = traffic();
    expect(t.jobs.field.stranded).toBeGreaterThan(0);
    expect(railVolume(t, idx(30, 12), RAIL_ELEVATED)).toBe(0);
  });

  it('a ramp cleared cuts the line; put back, it carries again', () => {
    suburbAndTown();
    elevatedLine();
    expect(traffic().jobs.field.stranded).toBe(0);
    expect(w.clearTile(13, 12)).toBe(true);
    const cut = traffic();
    expect(cut.jobs.field.stranded).toBeGreaterThan(0);
    expect(railVolume(cut, idx(30, 12), RAIL_ELEVATED)).toBe(0);
    w.layTrack(13, 12);                                                   // the bulldozer took the low end's track with the tile
    expect(w.placeBuilding(13, 12, BUILDING_RAMP_ELEVATED, 0)).toBe(true);
    expect(traffic().jobs.field.stranded).toBe(0);
  });

  it('passes over a street with no level crossing: neither slows the other', () => {
    suburbAndTown();
    elevatedLine();
    const quiet = traffic().jobs.field.dist[HOME_ROAD()];
    // A local street under the line, with homes at one end that shop at the other.
    for (let y = 4; y <= 22; y++) expect(w.setRoad(30, y, ROAD_STREET)).toBe(true);
    for (let y = 4; y <= 7; y++) { zone(29, y, ZONE_R, 3); zone(31, y, ZONE_R, 3); }
    for (let y = 19; y <= 22; y++) { zone(29, y, ZONE_C, 3); zone(31, y, ZONE_C, 3); }
    const t = traffic();
    expect(trafficVolume(t, idx(30, 12))).toBeGreaterThan(0);             // cars under the line
    expect(t.jobs.field.dist[HOME_ROAD()]).toBeCloseTo(quiet, 3);         // the trains do not wait for them
  });

  it('a junction on the elevated level carries less, like one on the ground', () => {
    suburbAndTown();
    elevatedLine();
    for (let y = 13; y <= 16; y++) expect(w.layTrack(30, y, RAIL_ELEVATED)).toBe(true);
    const t = traffic();
    expect(railCapacity(t, idx(30, 12), RAIL_ELEVATED)).toBeCloseTo(RL.capacity * RL.junction3.capacityMult, 3);
    expect(railLoad(t, idx(30, 12), RAIL_ELEVATED)).toBeGreaterThan(railLoad(t, idx(25, 12), RAIL_ELEVATED));
  });

  it('the route of a rider follows the line tile by tile, ramps included', () => {
    suburbAndTown();
    elevatedLine();
    const t = traffic();
    const path = routeFrom(t.jobs.field, HOME_ROAD());
    expect(path).toContain(railNode(t, idx(30, 12), RAIL_ELEVATED));
    expect(path).toContain(railNode(t, idx(13, 12), RAIL_GROUND));
    const tiles = path.map(v => routeTile(t.jobs.field, v));
    for (const i of tiles) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(t.tiles); }
  });
});

describe('a subway between two subway stations', () => {
  it('carries the commuters under everything, and the stations take the fares', () => {
    suburbAndTown();
    // Homes, a street and a park-like block of industry over the tunnel's way.
    for (let x = 20; x <= 24; x++) zone(x, 11, ZONE_C, 1);
    for (let y = 8; y <= 14; y++) w.setRoad(30, y, ROAD_STREET);
    subwayLine();
    const t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    for (const x of [9, 22, 30, 50]) expect(railVolume(t, idx(x, 11), RAIL_SUBWAY)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(30, 11))).toBe(0);
    expect(t.rail.stations.map(s => s.anchor)).toEqual([idx(6, 11), idx(52, 11)]);
    expect(t.rail.stations[0].roads).toEqual([idx(6, 10)]);
    expect(t.rail.stations[0].boardings).toBeCloseTo(TRIPS(), 3);
    expect(railFareIncome(w)).toBeCloseTo(TRIPS() * RL.fare, 3);
    expect(w.layers.accessibility[idx(5, 9)]).toBeGreaterThan(0);
  });

  it('stationPeak reads the platform under the entrance, at both ends', () => {
    suburbAndTown();
    subwayLine();
    traffic();
    const from = stationPeak(w, 6, 11)!, to = stationPeak(w, 52, 11)!;
    expect(from.level).toBe(RAIL_SUBWAY);
    expect(from.riders).toBeCloseTo(TRIPS(), 3);
    expect(to.riders).toBeCloseTo(TRIPS(), 3);
    expect(stationPeak(w, 20, 20)).toBeNull();
  });

  it('a subway station with no road is no way in', () => {
    suburbAndTown();
    expect(w.placeBuilding(6, 13, BUILDING_SUBWAY_STATION, 0)).toBe(true); // two tiles from the street
    expect(w.placeBuilding(52, 11, BUILDING_SUBWAY_STATION, 0)).toBe(true);
    track(13, 8, 50, RAIL_SUBWAY);
    for (let y = 11; y <= 13; y++) w.layTrack(50, y, RAIL_SUBWAY);
    const t = traffic();
    expect(t.rail.stations[0].roads).toEqual([]);
    expect(t.jobs.field.stranded).toBeGreaterThan(0);
  });

  it('freight never rides it', () => {
    street(10, 2, 12);
    for (let x = 4; x <= 9; x++) zone(x, 9, ZONE_C, 2);                   // shops in the west want goods
    street(10, 48, 60);
    for (let x = 55; x <= 58; x++) zone(x, 9, ZONE_I, 3);
    subwayLine();
    const t = traffic();
    expect(t.goods.field.stranded).toBeGreaterThan(0);
    expect(t.goods.volume[railNode(t, idx(30, 11), RAIL_SUBWAY)]).toBe(0);
  });
});

describe('levels joined by ramps', () => {
  it('a train station at one end, a subway station at the other, a subway ramp between', () => {
    suburbAndTown();
    trainStation(4);                                                      // platform y 12, x 4–6
    track(12, 8, 19);
    expect(w.placeBuilding(20, 12, BUILDING_RAMP_SUBWAY, 0)).toBe(true);  // low end x 20, deep end x 21
    track(12, 22, 50, RAIL_SUBWAY);
    expect(w.layTrack(50, 11, RAIL_SUBWAY)).toBe(true);                   // up to the end of the station's platform
    expect(w.placeBuilding(52, 11, BUILDING_SUBWAY_STATION, 0)).toBe(true); // platform y 11, x 51–53
    const t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    expect(railVolume(t, idx(15, 12))).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(40, 12), RAIL_SUBWAY)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(40, 12))).toBe(0);
  });

  it('elevated passes over ground track without joining it', () => {
    suburbAndTown();
    elevatedLine();
    for (let y = 6; y <= 18; y++) expect(w.layTrack(30, y)).toBe(true);   // a ground line under the elevated one
    const t = traffic();
    expect(railCapacity(t, idx(30, 12), RAIL_ELEVATED)).toBe(RL.capacity);  // no junction
    expect(railVolume(t, idx(30, 12), RAIL_ELEVATED)).toBeCloseTo(TRIPS(), 3);
    expect(railVolume(t, idx(30, 12))).toBe(0);
  });
});
