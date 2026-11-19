// Auto mode for the rail tool: the line the game finds between two clicks (input/autoRail.ts).

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PARK, BUILDING_RAMP_ELEVATED, BUILDING_STATION, RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_R } from '../sim/constants';
import { railLinks } from '../sim/rail';
import { autoRailPath, planAutoRail } from '../input/autoRail';
import type { AutoRailStep } from '../input/autoRail';
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
/** Build the path as the tool does (track of each tile's level, ramps from their low ends) and count the junctions on the whole map, every level. */
const layAndCountJunctions = (path: AutoRailStep[]): number => {
  for (const s of path) {
    if (s.ramp === 'low') expect(w.placeBuilding(s.tx, s.ty, BUILDING_RAMP_ELEVATED, s.rot ?? 0)).toBe(true);
    else if (!s.ramp && !(w.getRail(s.tx, s.ty) & s.level)) expect(w.layTrack(s.tx, s.ty, s.level)).toBe(true);
  }
  let n = 0;
  for (const level of [RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY]) {
    for (let i = 0; i < w.layers.rail.length; i++) {
      const l = railLinks(w, i, level);
      if ((l & 1) + ((l >> 1) & 1) + ((l >> 2) & 1) + ((l >> 3) & 1) >= 3) n++;
    }
  }
  return n;
};
const xy = (path: AutoRailStep[]): TilePos[] => path.map(({ tx, ty }) => ({ tx, ty }));
const connected = (path: TilePos[]): void => {
  for (let k = 1; k < path.length; k++) expect(Math.abs(path[k].tx - path[k - 1].tx) + Math.abs(path[k].ty - path[k - 1].ty)).toBe(1);
};

beforeEach(() => { w = landWorld(32); w.budget.money = 1_000_000; });

describe('on open land', () => {
  it('a straight line between two tiles in a row', () => {
    const path = autoRailPath(w, P(5, 5), P(15, 5))!;
    expect(xy(path)).toEqual(Array.from({ length: 11 }, (_, k) => P(5 + k, 5)));
    expect(path.every(s => s.level === RAIL_GROUND && !s.ramp)).toBe(true);
  });

  it('one bend when the ends are not in line; a single tile when they are the same', () => {
    const path = autoRailPath(w, P(5, 5), P(12, 10))!;
    expect(path.length).toBe(13);
    expect(path[0]).toMatchObject(P(5, 5));
    expect(path[12]).toMatchObject(P(12, 10));
    expect(bends(path)).toBe(1);
    connected(path);
    expect(xy(autoRailPath(w, P(5, 5), P(5, 5))!)).toEqual([P(5, 5)]);
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

  it('an end on a building, or off the map, has no line; nor has a way walled off by homes', () => {
    w.placeBuilding(10, 5, BUILDING_PARK);
    expect(autoRailPath(w, P(5, 5), P(10, 5))).toBeNull();
    expect(autoRailPath(w, P(5, 5), P(40, 5))).toBeNull();
    for (let y = 0; y < 32; y++) w.setZone(20, y, ZONE_R);                 // no track on a zone, and no bridge over one
    expect(autoRailPath(w, P(5, 5), P(25, 5))).toBeNull();
    expect(planAutoRail(w, null).found).toBe(false);
  });

  it('bridges a highway it cannot get round: a ramp up, elevated track over it, a ramp down', () => {
    for (let y = 0; y < 32; y++) w.setRoad(20, y, ROAD_HIGHWAY);
    const path = autoRailPath(w, P(12, 5), P(28, 5))!;
    connected(path);
    expect(path.filter(s => s.ramp === 'low').length).toBe(2);
    const overRoad = path.find(s => s.tx === 20)!;
    expect(overRoad.level).toBe(RAIL_ELEVATED);
    expect(layAndCountJunctions(path)).toBe(0);
    expect(w.getRoad(20, overRoad.ty)).toBe(ROAD_HIGHWAY);
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

  it('bridges a line it cannot get round: ramps on either side, elevated over it, no junction', () => {
    for (let y = 0; y < 32; y++) track(10, y);
    const path = autoRailPath(w, P(4, 15), P(16, 15))!;
    connected(path);
    // Straight across: ground, ramp (low, high), elevated over the line, ramp (high, low), ground.
    expect(xy(path)).toEqual(Array.from({ length: 13 }, (_, k) => P(4 + k, 15)));
    const kinds = path.map(s => s.ramp ?? (s.level === RAIL_ELEVATED ? 'over' : 'ground'));
    expect(kinds.filter(k => k === 'low').length).toBe(2);
    expect(kinds.filter(k => k === 'high').length).toBe(2);
    expect(path.find(s => s.tx === 10)).toMatchObject({ level: RAIL_ELEVATED });
    expect(path.find(s => s.tx === 10)!.ramp).toBeUndefined();
    // Each ramp's low end is its outer tile, turned so the high end faces the line.
    const lows = path.filter(s => s.ramp === 'low');
    expect(lows[0].tx).toBeLessThan(10);
    expect(lows[0].rot).toBe(0);                                          // high end east
    expect(lows[1].tx).toBeGreaterThan(10);
    expect(lows[1].rot).toBe(2);                                          // high end west
    const plan = planAutoRail(w, path);
    expect(plan.ramps).toBe(2);
    const elevated = path.filter(s => !s.ramp && s.level === RAIL_ELEVATED).length, groundNew = path.filter(s => !s.ramp && s.level === RAIL_GROUND).length;
    expect(plan.cost).toBe(2 * BALANCE.buildings[BUILDING_RAMP_ELEVATED].cost + elevated * BALANCE.rail.track[RAIL_ELEVATED].cost + groundNew * TRACK);
    expect(layAndCountJunctions(path)).toBe(0);
    expect(railLinks(w, w.grid.idx(10, 15))).toBe(5);                     // the old line is untouched: north and south only
    expect(w.buildings.filter(b => b.kind === BUILDING_RAMP_ELEVATED).length).toBe(2);
  });

  it('with no room for ramps it joins the line, follows it a tile and leaves: two 3-ways, never a 4-way', () => {
    for (let y = 0; y < 32; y++) track(10, y);
    // Water everywhere but under the line: track can bridge it, a ramp cannot stand in it.
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (x !== 10) w.layers.terrain[w.grid.idx(x, y)] = TERRAIN_WATER;
    const path = autoRailPath(w, P(6, 15), P(14, 15))!;
    connected(path);
    expect(path.some(s => s.ramp)).toBe(false);
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

  it('runs straight into the end of a platform two tiles away (the tile beside the platform is a fine place to end)', () => {
    // Owner's case: a station whose platform (row 11) ends at x 13; a line whose free end is at (16,11).
    expect(w.placeBuilding(10, 10, BUILDING_STATION, 0)).toBe(true);
    for (let x = 16; x <= 20; x++) track(x, 11);
    for (const [from, to] of [[P(16, 11), P(14, 11)], [P(14, 11), P(16, 11)], [P(16, 11), P(13, 11)], [P(15, 11), P(14, 11)]] as const) {
      const path = autoRailPath(w, from, to)!;
      expect(path.every(s => s.ty === 11)).toBe(true);
      expect(path.length).toBe(Math.abs(from.tx - to.tx) + 1);
    }
    const plan = planAutoRail(w, autoRailPath(w, P(16, 11), P(14, 11)));
    expect(plan.cost).toBe(2 * TRACK);
    expect(layAndCountJunctions(plan.tiles)).toBe(0);
  });

  it('ends beside the free end of a line or the low end of a ramp without going round', () => {
    for (let x = 16; x <= 20; x++) track(x, 11);
    expect(xy(autoRailPath(w, P(12, 11), P(15, 11))!)).toEqual([P(12, 11), P(13, 11), P(14, 11), P(15, 11)]);
    expect(w.placeBuilding(10, 20, BUILDING_RAMP_ELEVATED, 2)).toBe(true);   // low end (10,20), high end west of it
    expect(xy(autoRailPath(w, P(14, 20), P(11, 20))!)).toEqual([P(14, 20), P(13, 20), P(12, 20), P(11, 20)]);
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

describe('the elevated and subway tools', () => {
  it('elevated: straight over a street and a ground line, with no ramps and no junction', () => {
    for (let y = 0; y < 32; y++) w.setRoad(10, y, ROAD_STREET);
    for (let y = 0; y < 32; y++) track(14, y);
    const path = autoRailPath(w, P(5, 5), P(20, 5), RAIL_ELEVATED)!;
    expect(xy(path)).toEqual(Array.from({ length: 16 }, (_, k) => P(5 + k, 5)));
    expect(path.every(s => s.level === RAIL_ELEVATED && !s.ramp)).toBe(true);
    expect(planAutoRail(w, path).cost).toBe(16 * BALANCE.rail.track[RAIL_ELEVATED].cost);
    expect(layAndCountJunctions(path)).toBe(0);
    expect(w.getRoad(10, 5)).toBe(ROAD_STREET);
  });

  it('elevated: round a building and homes; not beside elevated track that is there', () => {
    w.placeBuilding(10, 5, BUILDING_PARK);
    w.setZone(12, 5, ZONE_R); w.setZone(12, 4, ZONE_R); w.setZone(12, 6, ZONE_R);
    for (let x = 3; x <= 22; x++) w.layTrack(x, 9, RAIL_ELEVATED);
    const path = autoRailPath(w, P(5, 5), P(20, 5), RAIL_ELEVATED)!;
    connected(path);
    for (const s of path) { expect(w.getBuilding(s.tx, s.ty)).toBe(0); expect(w.getZone(s.tx, s.ty)).toBe(0); }
    expect(layAndCountJunctions(path)).toBe(0);
  });

  it('subway: straight under everything', () => {
    w.placeBuilding(10, 5, BUILDING_PARK);
    w.setZone(12, 5, ZONE_R);
    for (let y = 0; y < 32; y++) w.setRoad(14, y, ROAD_HIGHWAY);
    for (let y = 0; y < 32; y++) w.layers.terrain[w.grid.idx(16, y)] = TERRAIN_WATER;
    const path = autoRailPath(w, P(5, 5), P(20, 5), RAIL_SUBWAY)!;
    expect(xy(path)).toEqual(Array.from({ length: 16 }, (_, k) => P(5 + k, 5)));
    expect(path.every(s => s.level === RAIL_SUBWAY)).toBe(true);
    expect(planAutoRail(w, path).cost).toBe(16 * BALANCE.rail.track[RAIL_SUBWAY].cost);
  });

  it('subway: goes round a tunnel that is there rather than cross it, and carries on from its end', () => {
    for (let y = 3; y <= 7; y++) w.layTrack(10, y, RAIL_SUBWAY);
    const on = autoRailPath(w, P(10, 7), P(10, 14), RAIL_SUBWAY)!;
    expect(planAutoRail(w, on).buildCount).toBe(7);
    const round = autoRailPath(w, P(5, 5), P(15, 5), RAIL_SUBWAY)!;
    expect(has(round, 10, 5)).toBe(false);
    expect(layAndCountJunctions(round)).toBe(0);
  });
});
