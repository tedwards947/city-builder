// Rail in the traffic system (TransitSystem, RAIL_DESIGN.md): stations are
// portals, a trip rides when that is faster, freight never rides, track has a
// capacity, junctions and level crossings cost time, and riders pay a fare.

import { routeFrom, routeTile } from '../render/TrafficOverlay';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { railVolume, railLoad, trafficVolume } from '../sim/TrafficData';
import { railFareIncome } from '../sim/rail';
import { BUILDING_STATION, ROAD_STREET, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';

const T = BALANCE.transit as unknown as { flowInterval: number; buildings: Record<number, unknown> };
const RL = BALANCE.rail as unknown as {
  speedMult: number; capacity: number; boardTime: number; fare: number; congestionDelay: number;
  jam: { from: number; delay: number; power: number };
  junction3: { delay: number; capacityMult: number }; junction4: { delay: number; capacityMult: number }; crossing: { delay: number };
};
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
const track = (y: number, x0: number, x1: number) => { for (let x = x0; x <= x1; x++) expect(w.layTrack(x, y)).toBe(true); };
/** Traffic passes until settled (each call starts on a new traffic tick). */
const traffic = () => {
  for (let k = 0; k < 12; k++) { w.tick = ++pass * T.flowInterval; transit.update(w); }
  return w.traffic!;
};

// A SUBURB in the west: a street along y = 10 (x 2–12) with homes on its north side, and a
// station south of it (y 11–13, x 4–7; the platform is its middle row, y 12).
// A TOWN in the east: a street along y = 10 (x 48–60) with industry on its north side, and a
// station (platform y 12, x 50–53). The line runs along y = 12 between the platforms.
// No road joins the two.
const HOME_ROAD = () => idx(5, 10);
function suburbAndTown(line = true): void {
  street(10, 2, 12);
  for (let x = 4; x <= 9; x++) zone(x, 9, ZONE_R, 2);
  street(10, 48, 60);
  for (let x = 55; x <= 58; x++) zone(x, 9, ZONE_I, 3);
  if (!line) return;
  expect(w.placeBuilding(4, 11, BUILDING_STATION)).toBe(true);
  expect(w.placeBuilding(50, 11, BUILDING_STATION)).toBe(true);
  track(12, 8, 49);
}

beforeEach(() => {
  T.buildings = {};
  w = landWorld(64);
  transit = new TransitSystem();
  pass = 0;
});
afterEach(() => { Object.assign(RL, structuredClone(shipped), { track: BALANCE.rail.track }); T.buildings = shippedRows; });

describe('a suburb joined to town only by rail', () => {
  it('without the line its commuters are stranded and its homes have no access', () => {
    suburbAndTown(false);
    const t = traffic();
    expect(t.jobs.field.dist[HOME_ROAD()]).toBe(Infinity);
    expect(t.jobs.field.stranded).toBeGreaterThan(0);
    expect(w.layers.accessibility[idx(5, 9)]).toBe(0);
    expect(t.rail.stations).toEqual([]);
  });

  it('with the line they ride: trips on the track, homes with access, both ways', () => {
    suburbAndTown();
    const t = traffic();
    const trips = 6 * 2 * BALANCE.transit.tripsRtoI;                     // six level-2 homes
    expect(t.jobs.field.stranded).toBe(0);
    expect(t.jobs.field.dist[HOME_ROAD()]).toBeLessThan(BALANCE.transit.commuteMax);
    for (const x of [10, 30, 49]) expect(railVolume(t, idx(x, 12))).toBeCloseTo(trips, 3);
    expect(railVolume(t, idx(30, 11))).toBe(0);
    expect(w.layers.accessibility[idx(5, 9)]).toBeGreaterThan(0);          // homes reach jobs
    expect(w.layers.accessibility[idx(56, 9)]).toBeGreaterThan(0);         // industry reaches workers
    // The riders are on the streets at both ends, not in between.
    expect(trafficVolume(t, idx(5, 10))).toBeGreaterThan(0);
    expect(trafficVolume(t, idx(54, 10))).toBeCloseTo(trips, 3);
    expect(t.tiles).toBe(64 * 64);
  });

  it('riders board at the suburb station and pay the fare', () => {
    suburbAndTown();
    const t = traffic();
    const trips = 6 * 2 * BALANCE.transit.tripsRtoI;
    expect(t.rail.stations.map((s) => s.anchor)).toEqual([idx(4, 11), idx(50, 11)]);
    expect(t.rail.stations[0].boardings).toBeCloseTo(trips, 3);
    expect(t.rail.stations[1].boardings).toBe(0);
    expect(t.rail.boardings).toBeCloseTo(trips, 3);
    expect(railFareIncome(w)).toBeCloseTo(trips * RL.fare, 3);
  });

  it('a station with no road is no portal; clearing a station ends the service', () => {
    suburbAndTown();
    traffic();
    for (let x = 2; x <= 12; x++) w.clearTile(x, 10);                     // the suburb's street goes …
    street(8, 2, 12);                                                     // … to the far side of the homes
    let t = traffic();
    expect(t.rail.stations[0].roads).toEqual([]);
    expect(t.jobs.field.stranded).toBeGreaterThan(0);
    expect(railVolume(t, idx(30, 12))).toBe(0);
    for (let x = 2; x <= 12; x++) w.clearTile(x, 8);
    street(10, 2, 12);
    t = traffic();
    expect(t.jobs.field.stranded).toBe(0);
    w.clearTile(50, 11);                                                  // the town station (its platform stays as track)
    t = traffic();
    expect(t.rail.stations.length).toBe(1);
    expect(t.jobs.field.stranded).toBeGreaterThan(0);
    expect(railVolume(t, idx(30, 12))).toBe(0);
    expect(railFareIncome(w)).toBe(0);
  });
});

describe('the faster of driving or rail', () => {
  it('with a street all the way as well, most ride; with slow trains, they drive', () => {
    suburbAndTown();
    street(10, 13, 47);
    let t = traffic();
    const trips = 6 * 2 * BALANCE.transit.tripsRtoI;
    expect(railVolume(t, idx(30, 12))).toBeGreaterThan(trips * 0.9);
    expect(trafficVolume(t, idx(30, 10))).toBeLessThan(trips * 0.1);
    RL.speedMult = 0.5;                                                   // a tile of track now takes twice a street tile
    t = traffic();
    expect(railVolume(t, idx(30, 12))).toBeLessThan(trips * 0.1);
    expect(trafficVolume(t, idx(30, 10))).toBeGreaterThan(trips * 0.9);
  });
});

describe('freight never rides', () => {
  it('shops joined to industry only by rail get no goods, though shoppers and workers ride', () => {
    suburbAndTown();
    for (let x = 10; x <= 11; x++) zone(x, 9, ZONE_C, 2);                  // shops in the suburb; the only industry is in town
    const t = traffic();
    expect(t.goods.field.stranded).toBeGreaterThan(0);
    expect(t.goods.field.dist[idx(10, 10)]).toBe(Infinity);
    expect(t.goods.volume[t.tiles + idx(30, 12)]).toBe(0);
    expect(t.jobs.volume[t.tiles + idx(30, 12)]).toBeGreaterThan(0);
  });
});

describe('the route of a trip that rides', () => {
  it('holds track nodes; routeTile puts every one on the map, each next to the one before', () => {
    suburbAndTown();
    const t = traffic();
    const path = routeFrom(t.jobs.field, HOME_ROAD());
    expect(path.some(v => v >= t.tiles)).toBe(true);
    const tiles = path.map(v => routeTile(t.jobs.field, v));
    expect(tiles.filter(i => i === idx(30, 12)).length).toBe(1);          // along the line
    for (let k = 0; k < tiles.length; k++) {
      expect(tiles[k]).toBeGreaterThanOrEqual(0);
      expect(tiles[k]).toBeLessThan(t.tiles);
      if (k === 0) continue;
      const step = Math.abs(tiles[k] % 64 - tiles[k - 1] % 64) + Math.abs(Math.floor(tiles[k] / 64) - Math.floor(tiles[k - 1] / 64));
      // One tile at a time, but for getting on or off: from the road to the middle of the platform.
      expect(step).toBeLessThanOrEqual(path[k] >= t.tiles === path[k - 1] >= t.tiles ? 1 : 5);
    }
  });
});

describe('track capacity and junctions', () => {
  it('a junction carries less than plain track, a 4-way much less', () => {
    suburbAndTown();
    for (let y = 13; y <= 16; y++) expect(w.layTrack(20, y)).toBe(true);  // a 3-way at (20, 12)
    for (let y = 8; y <= 16; y++) if (y !== 12) expect(w.layTrack(35, y)).toBe(true);   // a 4-way at (35, 12)
    const t = traffic();
    expect(t.rail.capacity[idx(30, 12)]).toBe(RL.capacity);
    expect(t.rail.capacity[idx(20, 12)]).toBeCloseTo(RL.capacity * RL.junction3.capacityMult, 3);
    expect(t.rail.capacity[idx(35, 12)]).toBeCloseTo(RL.capacity * RL.junction4.capacityMult, 3);
    expect(t.rail.capacity[idx(30, 11)]).toBe(0);
    expect(railLoad(t, idx(35, 12))).toBeGreaterThan(railLoad(t, idx(30, 12)));
  });

  it('passing a junction takes extra time, a 4-way more than a 3-way', () => {
    suburbAndTown();
    const plain = traffic().jobs.field.dist[HOME_ROAD()];
    for (let y = 13; y <= 16; y++) w.layTrack(20, y);
    const with3 = traffic().jobs.field.dist[HOME_ROAD()];
    for (let y = 8; y <= 11; y++) w.layTrack(20, y);
    const with4 = traffic().jobs.field.dist[HOME_ROAD()];
    expect(with3 - plain).toBeCloseTo(RL.junction3.delay, 1);
    expect(with4 - plain).toBeCloseTo(RL.junction4.delay, 1);
  });

  it('an overloaded line slows down', () => {
    suburbAndTown();
    const free = traffic().jobs.field.dist[HOME_ROAD()];
    RL.capacity = 2;                                                      // about four trips ride it
    const t = traffic();
    expect(railLoad(t, idx(30, 12))).toBeGreaterThan(1);
    expect(t.jobs.field.dist[HOME_ROAD()]).toBeGreaterThan(free + 1);
  });

  it('past jam.from a line jams: every tile takes jam.delay × (load − from) street tiles longer', () => {
    suburbAndTown();
    RL.capacity = 2; RL.jam.delay = 0;
    const t0 = traffic();
    const mild = t0.jobs.field.dist[HOME_ROAD()];
    const load = railLoad(t0, idx(30, 12));
    expect(load).toBeGreaterThan(1.5);                                    // the riders have no other way
    RL.jam = { from: 1, delay: 0.5, power: 1 };
    const t = traffic();
    expect(railLoad(t, idx(30, 12))).toBeCloseTo(load, 2);                // … so they still ride
    // 42 tiles of plain track and 8 of platform (lighter loaded, as riders board in the middle).
    expect(t.jobs.field.dist[HOME_ROAD()] - mild).toBeGreaterThan(42 * 0.5 * (load - 1));
    expect(t.jobs.field.dist[HOME_ROAD()] - mild).toBeLessThanOrEqual(50 * 0.5 * (load - 1) + 0.01);
    RL.jam = { from: 1, delay: 0.5, power: 2 };
    const squared = traffic().jobs.field.dist[HOME_ROAD()] - mild;
    expect(squared).toBeGreaterThan(42 * 0.5 * (load - 1) ** 2);
    expect(squared).toBeLessThanOrEqual(50 * 0.5 * (load - 1) ** 2 + 0.01);
  });

  it('a jammed line sends riders to a second, slower line; with no jam they all crowd the fast one', () => {
    suburbAndTown();
    // A second pair of stations further down a side street at each end, and a second line along y = 16.
    for (let y = 11; y <= 17; y++) { expect(w.setRoad(2, y, ROAD_STREET)).toBe(true); expect(w.setRoad(60, y, ROAD_STREET)).toBe(true); }
    expect(w.placeBuilding(3, 15, BUILDING_STATION)).toBe(true);
    expect(w.placeBuilding(56, 15, BUILDING_STATION)).toBe(true);
    track(16, 7, 55);
    RL.capacity = 2; RL.jam.delay = 0;
    const none = traffic();
    const crowded = railLoad(none, idx(30, 12)), quiet = railLoad(none, idx(30, 16));
    expect(crowded).toBeGreaterThan(1.5);
    expect(quiet).toBeLessThan(0.2);
    RL.jam = { from: 1, delay: 4, power: 1 };
    const t = traffic();
    const first = railLoad(t, idx(30, 12)), second = railLoad(t, idx(30, 16));
    expect(first).toBeLessThan(crowded * 0.65);
    expect(second).toBeGreaterThan(crowded * 0.35);
    expect(first).toBeGreaterThan(second);                                // the first line is still the shorter way
    expect(first + second).toBeCloseTo(crowded + quiet, 1);              // nobody gave up
    // … and the split holds from pass to pass.
    const again = traffic();
    expect(railLoad(again, idx(30, 12))).toBeCloseTo(first, 1);
    expect(railLoad(again, idx(30, 16))).toBeCloseTo(second, 1);
  });
});

describe('level crossings', () => {
  // A local street runs north–south across the line at x = 30, joined to neither station:
  // homes at its north end shop at its south end.
  function localStreet(): void {
    for (let y = 4; y <= 22; y++) expect(w.setRoad(30, y, ROAD_STREET)).toBe(true);
  }
  function localTraffic(): void {
    for (let y = 4; y <= 7; y++) { zone(29, y, ZONE_R, 3); zone(31, y, ZONE_R, 3); }
    for (let y = 19; y <= 22; y++) { zone(29, y, ZONE_C, 3); zone(31, y, ZONE_C, 3); }
  }

  it('cars at the crossing slow the trains', () => {
    suburbAndTown();
    localStreet();
    const quiet = traffic().jobs.field.dist[HOME_ROAD()];
    localTraffic();
    const t = traffic();
    expect(trafficVolume(t, idx(30, 12))).toBeGreaterThan(0);
    expect(t.jobs.field.dist[HOME_ROAD()]).toBeGreaterThan(quiet + 0.2);
    expect(t.jobs.field.dist[HOME_ROAD()]).toBeLessThanOrEqual(quiet + RL.crossing.delay + 1e-3);
  });

  it('trains at the crossing slow the cars', () => {
    suburbAndTown(false);
    w.placeBuilding(4, 11, BUILDING_STATION); w.placeBuilding(50, 11, BUILDING_STATION);
    localStreet();
    track(12, 8, 49);
    localTraffic();
    RL.capacity = 4;                                                      // the commuters fill the line
    const withTrains = traffic().shopping.field.dist[idx(30, 6)];
    for (let x = 4; x <= 9; x++) w.layers.devLevel[idx(x, 9)] = 0;        // the suburb empties: no riders
    const without = traffic().shopping.field.dist[idx(30, 6)];
    expect(withTrains).toBeGreaterThan(without + 0.5);
  });
});
