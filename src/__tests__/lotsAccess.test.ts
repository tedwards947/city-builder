// Merged 2×2 lots, phase 4 (sim/lots.ts, BIG_LOTS_DESIGN.md): one way in. A
// tile of a merged lot with no street of its own (the player took the road on
// that side away) uses its building's road: for trips, accessibility and the
// "no road" warning. Plus the counts the lab reads.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ROAD_HIGHWAY, ROAD_STREET, TERRAIN_GRASS, VEG_NONE, ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';
import { doorTile, levelWeight, lotCounts, mergeLot, LOT_LEVEL } from '../sim/lots';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { bestAccessRoad } from '../sim/TrafficData';
import { roadProblem } from '../render/clay/problemPins';

const TOP = BALANCE.growth.maxLevel;
const T = BALANCE.transit;

function land(size = 20): World {
  const w = new World(size, size, 0);
  w.layers.terrain.fill(TERRAIN_GRASS);
  w.layers.vegetation.fill(VEG_NONE);
  return w;
}
function zoneAt(w: World, x: number, y: number, zone: number, level: number): void {
  w.layers.zone[w.grid.idx(x, y)] = zone;
  w.layers.devLevel[w.grid.idx(x, y)] = level;
}
function roadRow(w: World, x0: number, x1: number, y: number, cls = ROAD_STREET): void {
  for (let x = x0; x <= x1; x++) w.layers.roadClass[w.grid.idx(x, y)] = cls;
}
/** Homes on the 2×2 at (2, 3)–(3, 4), merged or not, with a street along row 5 only, and shops at its far end. */
function town(merge: boolean): World {
  const w = land();
  roadRow(w, 2, 12, 5);
  for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]]) zoneAt(w, x, y, ZONE_R, TOP);
  for (let x = 9; x <= 12; x++) { zoneAt(w, x, 4, ZONE_C, TOP); zoneAt(w, x, 6, ZONE_C, TOP); }
  if (merge) expect(mergeLot(w, 2, 3)).toBe(true);
  w.tick = T.flowInterval;
  new TransitSystem().update(w);
  return w;
}

describe('the way in', () => {
  it('an ordinary tile uses its own roads, and so does a merged tile that has one', () => {
    const w = land();
    roadRow(w, 2, 12, 5);
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]]) zoneAt(w, x, y, ZONE_R, TOP);
    const at = (x: number, y: number) => w.grid.idx(x, y);
    expect(doorTile(w, at(2, 3))).toBe(at(2, 3));                     // not merged: itself, road or no road
    mergeLot(w, 2, 3);
    expect(doorTile(w, at(2, 4))).toBe(at(2, 4));
    expect(doorTile(w, at(3, 4))).toBe(at(3, 4));
    // The two tiles away from the street go out through the first tile of the building that has one.
    expect(doorTile(w, at(2, 3))).toBe(at(2, 4));
    expect(doorTile(w, at(3, 3))).toBe(at(2, 4));
  });

  it('a highway is not a way in, and with no road at all the tile is left as it is', () => {
    const w = land();
    roadRow(w, 2, 12, 5, ROAD_HIGHWAY);
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]]) zoneAt(w, x, y, ZONE_R, TOP);
    mergeLot(w, 2, 3);
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]]) {
      expect(doorTile(w, w.grid.idx(x, y))).toBe(w.grid.idx(x, y));
      expect(roadProblem(w, w.grid.idx(x, y))).toBe(true);
    }
  });
});

describe('traffic', () => {
  it('every tile of a merged lot sends its trips, through the building\'s road', () => {
    const w = town(true);
    const at = (x: number, y: number) => w.grid.idx(x, y);
    const shopping = w.traffic!.shopping;
    expect(bestAccessRoad(w, at(2, 3), shopping.field)).toBe(at(2, 5));
    expect(bestAccessRoad(w, at(3, 3), shopping.field)).toBe(at(2, 5));
    // All four tiles' shopping trips pass along the street: 4 × 4.5 lots' worth.
    expect(shopping.volume[at(6, 5)]).toBeCloseTo(4 * levelWeight(LOT_LEVEL) * T.tripsRtoC, 6);
    // The far tiles are as reachable as the tile they go out through.
    expect(w.layers.accessibility[at(2, 3)]).toBe(w.layers.accessibility[at(2, 4)]);
    expect(w.layers.accessibility[at(3, 3)]).toBe(w.layers.accessibility[at(2, 4)]);
    expect(w.layers.accessibility[at(2, 3)]).toBeGreaterThan(0);
    for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]]) expect(roadProblem(w, at(x, y))).toBe(false);
  });

  it('four ordinary lots there are judged one by one, as before', () => {
    const w = town(false);
    const at = (x: number, y: number) => w.grid.idx(x, y);
    const shopping = w.traffic!.shopping;
    expect(bestAccessRoad(w, at(2, 3), shopping.field)).toBe(-1);
    expect(shopping.volume[at(6, 5)]).toBeCloseTo(2 * TOP * T.tripsRtoC, 6);       // only the two lots on the street
    expect(w.layers.accessibility[at(2, 3)]).toBe(0);
    expect(roadProblem(w, at(2, 3))).toBe(true);
    expect(roadProblem(w, at(2, 4))).toBe(false);
  });
});

describe('counts for the lab', () => {
  it('counts merged lots by zone', () => {
    const w = land();
    const blocks: [number, number, number][] = [[2, 2, ZONE_R], [6, 2, ZONE_R], [10, 2, ZONE_C], [14, 2, ZONE_I], [2, 8, ZONE_I]];
    for (const [x, y, zone] of blocks) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) w.setZone(x + dx, y + dy, zone);
    for (const [x, y] of blocks.slice(0, 4)) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) w.layers.devLevel[w.grid.idx(x + dx, y + dy)] = TOP;
    expect(lotCounts(w)).toEqual({ total: 0, byZone: [0, 0, 0, 0] });
    for (const [x, y] of blocks) mergeLot(w, x, y);                     // the last block is not built up: it does not merge
    const byZone = [0, 0, 0, 0];
    byZone[ZONE_R] = 2; byZone[ZONE_C] = 1; byZone[ZONE_I] = 1;
    expect(lotCounts(w)).toEqual({ total: 4, byZone });
  });
});
