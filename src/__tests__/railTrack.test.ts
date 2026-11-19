// Rail track (sim/rail.ts): where ground track may go, level crossings, how
// track tiles join, what track keeps off its tile, cost, upkeep, undo and saving.

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BuildTrackCommand } from '../commands/BuildTrackCommand';
import { BuildRoadCommand, roadBuildCost } from '../commands/BuildRoadCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { commandForTool, isPaintTool } from '../input/InputController';
import { railLinks, isLevelCrossing, trackBlocker, trackBuildCost, trackMaintenance, LINK_N, LINK_E, LINK_S, LINK_W } from '../sim/rail';
import { canHoldTree } from '../sim/landscaping';
import {
  RAIL_GROUND, RAIL_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_NONE, ZONE_R, ZONE_NONE,
  BUILDING_AIRPORT, BUILDING_PARK, TERRAIN_WATER, VEG_NONE,
} from '../sim/constants';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld } from './pcTestWorld';

const COST = BALANCE.rail.track[RAIL_GROUND].cost;
let w: World;
const at = (x: number, y: number) => w.grid.idx(x, y);
const links = (x: number, y: number) => railLinks(w, at(x, y));
/** Track along row y from x0 to x1. */
const row = (y: number, x0: number, x1: number) => { for (let x = x0; x <= x1; x++) expect(w.layTrack(x, y)).toBe(true); };
const col = (x: number, y0: number, y1: number) => { for (let y = y0; y <= y1; y++) expect(w.layTrack(x, y)).toBe(true); };
const road = (x: number, y: number, cls = ROAD_STREET) => w.setRoad(x, y, cls);

beforeEach(() => { w = landWorld(24); w.budget.money = 10_000; });

describe('laying ground track', () => {
  it('goes on empty land and on water, not on a building, a zone or off the map', () => {
    expect(w.layTrack(5, 5)).toBe(true);
    expect(w.getRail(5, 5)).toBe(RAIL_GROUND);
    expect(trackBlocker(w, 5, 5)).toBe('hasTrack');
    w.layers.terrain[at(6, 5)] = TERRAIN_WATER;
    expect(w.layTrack(6, 5)).toBe(true);
    w.setZone(7, 5, ZONE_R);
    expect(trackBlocker(w, 7, 5)).toBe('blocked');
    expect(w.placeBuilding(8, 5, BUILDING_PARK)).toBe(true);
    expect(trackBlocker(w, 8, 5)).toBe('blocked');
    expect(trackBlocker(w, -1, 5)).toBe('offMap');
    expect(w.layTrack(7, 5) || w.layTrack(8, 5) || w.layTrack(-1, 5)).toBe(false);
  });

  it('clears the trees on its tile', () => {
    w.layers.vegetation[at(5, 5)] = 3;
    w.layTrack(5, 5);
    expect(w.layers.vegetation[at(5, 5)]).toBe(VEG_NONE);
  });

  it('joins the track tiles that touch: a line, a bend and junctions', () => {
    row(10, 4, 8);
    expect(links(4, 10)).toBe(LINK_E);
    expect(links(6, 10)).toBe(LINK_E | LINK_W);
    col(6, 11, 13);
    expect(links(6, 10)).toBe(LINK_E | LINK_W | LINK_S);                 // a 3-way junction
    expect(links(6, 13)).toBe(LINK_N);
    col(6, 7, 9);
    expect(links(6, 10)).toBe(LINK_N | LINK_E | LINK_S | LINK_W);        // a 4-way junction
    expect(links(5, 5)).toBe(0);                                          // no track, no links
  });
});

describe('level crossings', () => {
  it('track crosses a straight street or avenue, and both stay', () => {
    for (let y = 2; y <= 12; y++) road(10, y, y < 8 ? ROAD_STREET : ROAD_AVENUE);
    row(5, 7, 13);
    row(10, 7, 13);
    expect(isLevelCrossing(w, at(10, 5))).toBe(true);
    expect(isLevelCrossing(w, at(10, 10))).toBe(true);
    expect(w.getRoad(10, 5)).toBe(ROAD_STREET);
    expect(w.getRoad(10, 10)).toBe(ROAD_AVENUE);
    expect(links(10, 5)).toBe(LINK_E | LINK_W);
  });

  it('track does not cross a highway, a bend or a junction of roads', () => {
    for (let y = 2; y <= 12; y++) road(10, y, ROAD_HIGHWAY);
    expect(trackBlocker(w, 10, 5)).toBe('crossing');
    for (let x = 3; x <= 7; x++) road(x, 15);
    for (let y = 15; y <= 19; y++) road(5, y);                           // T junction at (5, 15); the road ends at (5, 19)
    road(6, 19);                                                         // and bends there
    expect(trackBlocker(w, 5, 15)).toBe('crossing');
    expect(trackBlocker(w, 5, 19)).toBe('crossing');
    expect(trackBlocker(w, 5, 17)).toBe(null);
    expect(w.layTrack(5, 15)).toBe(false);
  });

  it('a road crosses straight track, but not a bend or junction of track, and never runs along it', () => {
    row(10, 4, 12);
    col(8, 11, 14);                                                      // junction at (8, 10)
    for (let y = 6; y <= 9; y++) expect(road(6, y)).toBe(true);
    expect(road(6, 10)).toBe(true);                                      // across the line
    expect(isLevelCrossing(w, at(6, 10))).toBe(true);
    expect(road(6, 11)).toBe(true);
    expect(road(8, 9)).toBe(true);
    expect(road(8, 10)).toBe(false);                                     // the junction
    expect(road(4, 9)).toBe(true);
    expect(road(4, 10)).toBe(true);                                      // crossing at the end of the line
    expect(road(5, 10)).toBe(false);                                     // along the track, from a crossing
    expect(road(10, 10, ROAD_HIGHWAY)).toBe(false);                      // a highway never crosses at level
    expect(w.getRoad(10, 10)).toBe(ROAD_NONE);
  });

  it('a crossing joins only along its track, and its road cannot be turned into a bend or raised to a highway', () => {
    for (let y = 4; y <= 12; y++) road(10, y);
    row(8, 8, 12);
    w.layTrack(10, 7);                                                   // a second crossing right beside the first, with no line yet
    expect(links(10, 8)).toBe(LINK_E | LINK_W);                          // not joined up the road
    expect(links(10, 7)).toBe(0);
    expect(road(10, 8, ROAD_AVENUE)).toBe(true);                         // an upgrade is fine
    expect(road(10, 8, ROAD_HIGHWAY)).toBe(false);
    expect(roadBuildCost(w, 10, 8, ROAD_HIGHWAY)).toBeNull();
    // A road joining the crossing from the side: only possible where the track is, and refused there.
    expect(road(9, 8)).toBe(false);
    // The track ends on a crossing: a road joining it from the open side is refused too.
    for (let x = 14; x <= 18; x++) road(x, 16);
    col(16, 14, 16);
    expect(road(16, 17)).toBe(false);
    expect(road(19, 16)).toBe(true);
  });

  it('BuildRoadCommand refuses where track is in the way and charges nothing', () => {
    row(10, 4, 12);
    col(8, 11, 14);
    const cmd = new BuildRoadCommand(8, 10, ROAD_STREET);
    expect(cmd.execute(w)).toBe(false);
    expect(w.budget.money).toBe(10_000);
  });
});

describe('what track keeps off its tile', () => {
  it('no zone, no building, no tree and no change of water', () => {
    w.layTrack(5, 5);
    expect(w.setZone(5, 5, ZONE_R)).toBe(false);
    expect(w.getZone(5, 5)).toBe(ZONE_NONE);
    expect(w.setZone(5, 5, ZONE_NONE)).toBe(true);
    expect(w.canPlaceBuilding(5, 5, BUILDING_PARK)).toBe(false);          // a one-tile building
    expect(w.checkPlacement(4, 5, BUILDING_AIRPORT).blocked).toEqual([at(5, 5)]);   // under a large building's shape
    expect(canHoldTree(w, at(5, 5))).toBe(false);
  });
});

describe('the track command and the rail tool', () => {
  it('charges the price per tile, three times on water, and undoes cleanly', () => {
    const cmd = new BuildTrackCommand(5, 5);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.money).toBe(10_000 - COST);
    cmd.undo(w);
    expect(w.getRail(5, 5)).toBe(RAIL_NONE);
    expect(w.budget.money).toBe(10_000);
    w.layers.terrain[at(6, 5)] = TERRAIN_WATER;
    expect(trackBuildCost(w, 6, 5)).toBe(COST * BALANCE.costs.bridgeMultiplier);
  });

  it('refuses without the money, saying so, and where track cannot go', () => {
    w.budget.money = COST - 1;
    const poor = new BuildTrackCommand(5, 5);
    expect(poor.execute(w)).toBe(false);
    expect(poor.failReason).toBe('funds');
    w.budget.money = 10_000;
    w.setZone(6, 6, ZONE_R);
    const zoned = new BuildTrackCommand(6, 6);
    expect(zoned.execute(w)).toBe(false);
    expect(zoned.failReason).toBeNull();
    expect(w.budget.money).toBe(10_000);
  });

  it('undoing track laid over a road leaves the road', () => {
    for (let y = 2; y <= 8; y++) road(10, y);
    const cmd = new BuildTrackCommand(10, 5);
    expect(cmd.execute(w)).toBe(true);
    cmd.undo(w);
    expect(w.getRail(10, 5)).toBe(RAIL_NONE);
    expect(w.getRoad(10, 5)).toBe(ROAD_STREET);
  });

  it('the bulldozer clears track, and a crossing with its road, and undo brings both back', () => {
    for (let y = 2; y <= 8; y++) road(10, y);
    row(5, 8, 12);
    const plain = new BulldozeCommand(8, 5);
    expect(plain.execute(w)).toBe(true);
    expect(w.getRail(8, 5)).toBe(RAIL_NONE);
    const crossing = new BulldozeCommand(10, 5);
    expect(crossing.execute(w)).toBe(true);
    expect(w.getRail(10, 5)).toBe(RAIL_NONE);
    expect(w.getRoad(10, 5)).toBe(ROAD_NONE);
    crossing.undo(w);
    expect(isLevelCrossing(w, at(10, 5))).toBe(true);
    plain.undo(w);
    expect(w.getRail(8, 5)).toBe(RAIL_GROUND);
  });

  it("the 'rail' tool paints along a drag and issues the track command", () => {
    expect(isPaintTool('rail')).toBe(true);
    expect(commandForTool('rail', 3, 3, w)).toBeInstanceOf(BuildTrackCommand);
  });
});

describe('upkeep and saving', () => {
  it('track upkeep is per tile and follows what is laid and cleared', () => {
    expect(trackMaintenance(w)).toBe(0);
    row(5, 2, 11);
    expect(trackMaintenance(w)).toBeCloseTo(10 * BALANCE.rail.track[RAIL_GROUND].maintenance);
    w.clearTile(2, 5);
    expect(trackMaintenance(w)).toBeCloseTo(9 * BALANCE.rail.track[RAIL_GROUND].maintenance);
  });

  it('track is saved, and a save from before rail loads with none', () => {
    for (let y = 2; y <= 8; y++) road(10, y);
    row(5, 8, 12);
    const loaded = deserialize(serialize(w));
    expect(Array.from(loaded.layers.rail)).toEqual(Array.from(w.layers.rail));
    expect(isLevelCrossing(loaded, at(10, 5))).toBe(true);
    expect(trackMaintenance(loaded)).toBeCloseTo(trackMaintenance(w));
    const old = serialize(w);
    delete (old.layers as { rail?: unknown }).rail;
    expect(deserialize(old).layers.rail.some((r) => r !== 0)).toBe(false);
  });
});
