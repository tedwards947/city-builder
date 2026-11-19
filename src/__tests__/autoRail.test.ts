// Auto mode for the rail tool: the line the game finds between two clicks (input/autoRail.ts).

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PARK, BUILDING_STATION, RAIL_GROUND, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_R } from '../sim/constants';
import { railLinks } from '../sim/rail';
import { autoRailPath, planAutoRail } from '../input/autoRail';
import type { TilePos } from '../input/dragPath';
import { landWorld } from './pcTestWorld';

const TRACK = BALANCE.rail.track[RAIL_GROUND].cost;

let w: World;
const P = (tx: number, ty: number): TilePos => ({ tx, ty });
const track = (x: number, y: number) => expect(w.layTrack(x, y)).toBe(true);
const bends = (path: TilePos[]): number => {
  let n = 0;
  for (let k = 2; k < path.length; k++) {
    if (path[k].tx - path[k - 1].tx !== path[k - 1].tx - path[k - 2].tx || path[k].ty - path[k - 1].ty !== path[k - 1].ty - path[k - 2].ty) n++;
  }
  return n;
};
const has = (path: TilePos[], tx: number, ty: number): boolean => path.some(p => p.tx === tx && p.ty === ty);
/** Lay the path (as the tool does) and count the tiles of the whole map that are junctions. */
const layAndCountJunctions = (path: TilePos[]): number => {
  for (const { tx, ty } of path) if (!(w.getRail(tx, ty) & RAIL_GROUND)) expect(w.layTrack(tx, ty)).toBe(true);
  let n = 0;
  for (let i = 0; i < w.layers.rail.length; i++) {
    const l = railLinks(w, i);
    if ((l & 1) + ((l >> 1) & 1) + ((l >> 2) & 1) + ((l >> 3) & 1) >= 3) n++;
  }
  return n;
};
const connected = (path: TilePos[]): void => {
  for (let k = 1; k < path.length; k++) expect(Math.abs(path[k].tx - path[k - 1].tx) + Math.abs(path[k].ty - path[k - 1].ty)).toBe(1);
};

beforeEach(() => { w = landWorld(32); w.budget.money = 1_000_000; });

describe('on open land', () => {
  it('a straight line between two tiles in a row', () => {
    const path = autoRailPath(w, P(5, 5), P(15, 5))!;
    expect(path).toEqual(Array.from({ length: 11 }, (_, k) => P(5 + k, 5)));
  });

  it('one bend when the ends are not in line; a single tile when they are the same', () => {
    const path = autoRailPath(w, P(5, 5), P(12, 10))!;
    expect(path.length).toBe(13);
    expect(path[0]).toEqual(P(5, 5));
    expect(path[12]).toEqual(P(12, 10));
    expect(bends(path)).toBe(1);
    connected(path);
    expect(autoRailPath(w, P(5, 5), P(5, 5))).toEqual([P(5, 5)]);
  });

  it('the plan prices the new track, with a bridge over water', () => {
    for (let y = 0; y < 32; y++) w.layers.terrain[w.grid.idx(10, y)] = TERRAIN_WATER;
    const plan = planAutoRail(w, autoRailPath(w, P(5, 5), P(15, 5)));
    expect(plan.found).toBe(true);
    expect(plan.buildCount).toBe(11);
    expect(plan.cost).toBe(10 * TRACK + TRACK * BALANCE.costs.bridgeMultiplier);
    expect(plan.affordable).toBe(true);
    w.budget.money = plan.cost - 1;
    expect(planAutoRail(w, plan.tiles).affordable).toBe(false);
  });
});

describe('what is in the way', () => {
  it('goes round a building and a zone', () => {
    expect(w.placeBuilding(10, 5, BUILDING_PARK)).toBe(true);
    w.setZone(12, 5, ZONE_R); w.setZone(12, 4, ZONE_R); w.setZone(12, 6, ZONE_R);
    const path = autoRailPath(w, P(5, 5), P(15, 5))!;
    connected(path);
    for (const p of path) {
      expect(w.getBuilding(p.tx, p.ty)).toBe(0);
      expect(w.getZone(p.tx, p.ty)).toBe(0);
    }
    expect(layAndCountJunctions(path)).toBe(0);
  });

  it('an end on a building, or off the map, has no line; nor has a way walled off by a highway', () => {
    w.placeBuilding(10, 5, BUILDING_PARK);
    expect(autoRailPath(w, P(5, 5), P(10, 5))).toBeNull();
    expect(autoRailPath(w, P(5, 5), P(40, 5))).toBeNull();
    for (let y = 0; y < 32; y++) w.setRoad(20, y, ROAD_HIGHWAY);
    expect(autoRailPath(w, P(5, 5), P(25, 5))).toBeNull();
    expect(planAutoRail(w, null).found).toBe(false);
  });

  it('crosses a street it cannot get round, straight and at right angles', () => {
    for (let y = 0; y < 32; y++) w.setRoad(10, y, ROAD_STREET);
    const path = autoRailPath(w, P(5, 5), P(15, 9))!;
    connected(path);
    const on = path.filter(p => p.tx === 10);
    expect(on.length).toBe(1);                                            // one tile of road: across, not along
    expect(has(path, 9, on[0].ty)).toBe(true);
    expect(has(path, 11, on[0].ty)).toBe(true);
    for (const { tx, ty } of path) expect(w.layTrack(tx, ty)).toBe(true); // every tile is one the hand tool allows
  });

  it('goes round the end of a street rather than make a level crossing, when that costs no more track', () => {
    for (let y = 5; y <= 9; y++) w.setRoad(10, y, ROAD_STREET);
    const path = autoRailPath(w, P(5, 5), P(15, 4))!;
    expect(path.length).toBe(12);
    for (const p of path) expect(w.getRoad(p.tx, p.ty)).toBe(ROAD_NONE);
  });
});

describe('track that is already there', () => {
  it('carries on from the end of a line with no junction, and pays only for the new tiles', () => {
    for (let x = 3; x <= 8; x++) track(x, 5);
    const fromEnd = autoRailPath(w, P(8, 5), P(15, 5))!;
    expect(planAutoRail(w, fromEnd).buildCount).toBe(7);
    expect(planAutoRail(w, fromEnd).cost).toBe(7 * TRACK);
    const along = autoRailPath(w, P(3, 5), P(15, 5))!;                    // starts back down the line: follows it
    expect(along.length).toBe(13);
    expect(planAutoRail(w, along).buildCount).toBe(7);
    expect(layAndCountJunctions(along)).toBe(0);
  });

  it('goes round the end of a short line rather than cross it (a crossing is a 4-way junction)', () => {
    for (let y = 3; y <= 7; y++) track(10, y);
    const path = autoRailPath(w, P(5, 5), P(15, 5))!;
    connected(path);
    expect(has(path, 10, 5)).toBe(false);
    expect(layAndCountJunctions(path)).toBe(0);                           // … and far enough round not to join its end
  });

  it('gets across a line it cannot get round by two 3-way junctions a tile apart, not a 4-way', () => {
    for (let y = 0; y < 32; y++) track(10, y);
    const path = autoRailPath(w, P(5, 15), P(15, 15))!;
    connected(path);
    expect(path.filter(p => p.tx === 10).length).toBe(2);
    expect(layAndCountJunctions(path)).toBe(2);
    for (let y = 0; y < 32; y++) expect(railLinks(w, w.grid.idx(10, y))).not.toBe(15);
  });

  it('does not run right beside a line, where every tile would join it', () => {
    for (let x = 3; x <= 20; x++) track(x, 6);
    const path = autoRailPath(w, P(5, 4), P(15, 5))!;                     // the end is beside the line: one join there
    connected(path);
    expect(path.filter(p => p.ty === 5).length).toBe(1);
    expect(layAndCountJunctions(path)).toBeLessThanOrEqual(2);
  });

  it('joins a station at the end of its platform, never through its side', () => {
    expect(w.placeBuilding(10, 10, BUILDING_STATION)).toBe(true);         // platform y 11, x 10–13
    const path = autoRailPath(w, P(5, 5), P(11, 11))!;                    // the end is a platform tile
    connected(path);
    expect(has(path, 9, 11)).toBe(true);                                  // in by the west end
    expect(has(path, 10, 11)).toBe(true);
    expect(autoRailPath(w, P(5, 5), P(11, 10))).toBeNull();               // the building itself
    expect(layAndCountJunctions(path)).toBe(0);
  });
});
