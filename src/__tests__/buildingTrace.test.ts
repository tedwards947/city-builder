// Hover route hints on buildings (render/buildingTrace.ts): a station shows
// who rides in and where the ride goes; the airport shows where visitors come
// from and where arrivals go.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { BUILDING_STATION, BUILDING_AIRPORT, ROAD_STREET, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { MARKET_DEFS, railNode } from '../sim/TrafficData';
import { stationPeak } from '../sim/rail';
import { buildingTrace } from '../render/buildingTrace';
import { markUpstream, routeFrom, routeTile } from '../render/TrafficOverlay';
import { landWorld } from './pcTestWorld';

const T = BALANCE.transit as unknown as { flowInterval: number };
let w: World;
let transit: TransitSystem;
let pass = 0;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, z: number, level: number) => {
  w.layers.zone[idx(x, y)] = z; w.layers.devLevel[idx(x, y)] = level; w.layers.landValue[idx(x, y)] = 128;
};
const street = (y: number, x0: number, x1: number) => { for (let x = x0; x <= x1; x++) expect(w.setRoad(x, y, ROAD_STREET)).toBe(true); };
const traffic = () => {
  for (let k = 0; k < 12; k++) { w.tick = ++pass * T.flowInterval; transit.update(w); }
  return w.traffic!;
};
const market = (key: string) => MARKET_DEFS.findIndex(d => d.key === key);

beforeEach(() => { w = landWorld(64); transit = new TransitSystem(); pass = 0; });
afterEach(() => { /* rows are the shipped ones: nothing to restore */ });

describe('station hints', () => {
  it('a station with riders: its platform node is the target, and the homes that ride in are upstream of it', () => {
    // A suburb (homes by a street, a station) joined by track to a town with jobs.
    street(10, 2, 12);
    for (let x = 4; x <= 9; x++) zone(x, 9, ZONE_R, 2);
    street(10, 48, 60);
    for (let x = 55; x <= 58; x++) zone(x, 9, ZONE_I, 3);
    // Platforms on y 12 (x 4–6 and x 50–52), each with a one-tile street up to its street.
    expect(w.placeBuilding(4, 12, BUILDING_STATION)).toBe(true);
    expect(w.placeBuilding(50, 12, BUILDING_STATION)).toBe(true);
    expect(w.setRoad(5, 11, ROAD_STREET)).toBe(true);
    expect(w.setRoad(51, 11, ROAD_STREET)).toBe(true);
    for (let x = 7; x <= 49; x++) expect(w.layTrack(x, 12)).toBe(true);
    const t = traffic();

    const trace = buildingTrace(w, t, idx(5, 12))!;     // the suburb's station
    expect(trace).not.toBeNull();
    const peak = stationPeak(w, 5, 12)!;
    const node = railNode(t, peak.tile, peak.level);
    const jobs = market('jobs');
    expect(trace.targets[jobs]).toEqual([node]);
    expect(trace.routes[jobs]).toEqual([node]);

    // The ride on: along the track, off at the town's station, then the drive to the industry.
    const tiles = routeFrom(t.jobs.field, node).map(v => routeTile(t.jobs.field, v));
    expect(tiles.some(i => i === idx(30, 12))).toBe(true);
    expect(tiles[tiles.length - 1]).toBeGreaterThanOrEqual(idx(48, 10));

    // Who rides in: the suburb's street is upstream, the town's is not.
    const up = new Uint8Array(t.jobs.field.dist.length);
    markUpstream(t.jobs.field, node, up);
    expect(up[idx(5, 10)]).toBe(1);
    expect(up[idx(55, 10)]).toBe(0);
  });

  it('a station nobody uses, and an empty tile, give no hints', () => {
    street(10, 2, 12);
    expect(w.placeBuilding(4, 12, BUILDING_STATION)).toBe(true);
    const t = traffic();
    expect(buildingTrace(w, t, idx(5, 12))).toBeNull();
    expect(buildingTrace(w, t, idx(30, 30))).toBeNull();
  });
});

describe('airport hints', () => {
  it('visitors: their catchment starts at its door roads; arrivals: routes run from its road to the shops and jobs', () => {
    street(13, 4, 40);
    for (const x of [5, 6, 7, 8]) zone(x, 14, ZONE_R, 3);
    for (const x of [30, 31]) zone(x, 12, ZONE_C, 3);
    for (const x of [34, 35]) zone(x, 12, ZONE_I, 3);
    w.budget.money = 10_000_000;
    expect(w.placeBuilding(10, 14, BUILDING_AIRPORT)).toBe(true);
    const t = traffic();

    const trace = buildingTrace(w, t, idx(12, 15))!;     // any tile of the airport
    expect(trace).not.toBeNull();
    const visitors = market('visitors'), shopping = market('shopping');
    expect(trace.targets[visitors].length).toBeGreaterThan(0);
    for (const ri of trace.targets[visitors]) expect(t.visitors.field.doorCap[ri]).toBeGreaterThan(0);

    expect(trace.routes[shopping]).toHaveLength(1);
    const path = routeFrom(t.shopping.field, trace.routes[shopping][0]).map(v => routeTile(t.shopping.field, v));
    expect(path[0]).toBe(trace.routes[shopping][0]);
    expect(path[path.length - 1]).toBeGreaterThanOrEqual(idx(29, 13));         // ends at a shop's door
    expect(path[path.length - 1]).toBeLessThanOrEqual(idx(32, 13));

    // Homes feed the airport's doors.
    const up = new Uint8Array(t.visitors.field.dist.length);
    markUpstream(t.visitors.field, trace.targets[visitors][0], up);
    expect(up[idx(5, 13)]).toBe(1);
  });
});
