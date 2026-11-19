// Rail phase 2 (A): elevated and subway track as levels of the rail layer (sim/rail.ts).

import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_PARK, BUILDING_STATION, RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_HIGHWAY, ROAD_STREET, TERRAIN_WATER, ZONE_R,
} from '../sim/constants';
import { LINK_E, LINK_N, LINK_S, LINK_W, isLevelCrossing, railLinks, trackBlocker, trackBuildCost, trackMaintenance } from '../sim/rail';
import { BuildTrackCommand, RemoveSubwayCommand } from '../commands/BuildTrackCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { commandForTool, isPaintTool, trackLevelForTool } from '../input/InputController';
import { serialize, deserialize } from '../persistence/Serializer';
import { canHoldTree } from '../sim/landscaping';
import { landWorld } from './pcTestWorld';

const T = BALANCE.rail.track;
let w: World;
const at = (x: number, y: number) => w.grid.idx(x, y);
const lay = (x: number, y: number, level: number) => expect(w.layTrack(x, y, level)).toBe(true);

beforeEach(() => { w = landWorld(24); w.budget.money = 1_000_000; });

describe('where each level may go', () => {
  it('elevated: over land, water, any road and ground track; not over a building or a zone', () => {
    w.setRoad(5, 5, ROAD_STREET); w.setRoad(6, 5, ROAD_HIGHWAY);
    w.layers.terrain[at(7, 5)] = TERRAIN_WATER;
    w.layTrack(8, 5);
    for (let x = 4; x <= 8; x++) expect(trackBlocker(w, x, 5, RAIL_ELEVATED)).toBeNull();
    w.placeBuilding(10, 5, BUILDING_PARK);
    w.setZone(11, 5, ZONE_R);
    expect(trackBlocker(w, 10, 5, RAIL_ELEVATED)).toBe('blocked');
    expect(trackBlocker(w, 11, 5, RAIL_ELEVATED)).toBe('blocked');
    expect(trackBlocker(w, 30, 5, RAIL_ELEVATED)).toBe('offMap');
    lay(5, 5, RAIL_ELEVATED);
    expect(trackBlocker(w, 5, 5, RAIL_ELEVATED)).toBe('hasTrack');
    expect(w.getRoad(5, 5)).toBe(ROAD_STREET);                            // the road stays, and it is no level crossing
    expect(isLevelCrossing(w, at(5, 5))).toBe(false);
  });

  it('subway: under anything', () => {
    w.setRoad(6, 5, ROAD_HIGHWAY);
    w.layers.terrain[at(7, 5)] = TERRAIN_WATER;
    w.placeBuilding(10, 5, BUILDING_PARK);
    w.setZone(11, 5, ZONE_R);
    for (const x of [4, 6, 7, 10, 11]) { expect(trackBlocker(w, x, 5, RAIL_SUBWAY)).toBeNull(); lay(x, 5, RAIL_SUBWAY); }
    expect(trackBlocker(w, 4, 5, RAIL_SUBWAY)).toBe('hasTrack');
    expect(trackBlocker(w, -1, 5, RAIL_SUBWAY)).toBe('offMap');
    expect(w.getBuilding(10, 5)).toBe(BUILDING_PARK);
    expect(w.getZone(11, 5)).toBe(ZONE_R);
  });

  it('one tile holds all three levels', () => {
    lay(5, 5, RAIL_GROUND); lay(5, 5, RAIL_ELEVATED); lay(5, 5, RAIL_SUBWAY);
    expect(w.getRail(5, 5)).toBe(RAIL_GROUND | RAIL_ELEVATED | RAIL_SUBWAY);
  });

  it('what may go on top afterwards: anything over a subway; a road but no zone or building under elevated', () => {
    lay(5, 5, RAIL_SUBWAY); lay(6, 5, RAIL_SUBWAY); lay(7, 5, RAIL_SUBWAY);
    expect(w.setZone(5, 5, ZONE_R)).toBe(true);
    expect(w.getZone(5, 5)).toBe(ZONE_R);
    expect(w.placeBuilding(6, 5, BUILDING_PARK)).toBe(true);
    expect(w.placeBuilding(6, 9, BUILDING_STATION)).toBe(true);
    expect(canHoldTree(w, at(7, 5))).toBe(true);
    lay(5, 12, RAIL_ELEVATED); lay(6, 12, RAIL_ELEVATED); lay(7, 12, RAIL_ELEVATED);
    w.setZone(5, 12, ZONE_R);
    expect(w.getZone(5, 12)).toBe(0);
    expect(w.placeBuilding(6, 12, BUILDING_PARK)).toBe(false);
    expect(w.setRoad(7, 12, ROAD_HIGHWAY)).toBe(true);
    expect(canHoldTree(w, at(5, 12))).toBe(false);
    expect(w.layTrack(6, 12)).toBe(true);                                 // ground track under elevated
  });
});

describe('joining', () => {
  it('track joins only track of its own level', () => {
    for (let x = 4; x <= 8; x++) lay(x, 5, RAIL_ELEVATED);
    for (let y = 2; y <= 8; y++) lay(6, y, RAIL_GROUND);                  // ground passes underneath
    for (let y = 2; y <= 8; y++) lay(5, y, RAIL_SUBWAY);
    expect(railLinks(w, at(6, 5), RAIL_ELEVATED)).toBe(LINK_E | LINK_W);
    expect(railLinks(w, at(6, 5))).toBe(LINK_N | LINK_S);
    expect(railLinks(w, at(5, 5), RAIL_SUBWAY)).toBe(LINK_N | LINK_S);
    expect(railLinks(w, at(5, 5), RAIL_GROUND)).toBe(0);
    expect(railLinks(w, at(4, 5), RAIL_ELEVATED)).toBe(LINK_E);
    lay(6, 4, RAIL_ELEVATED);                                             // a 3-way on the elevated level
    expect(railLinks(w, at(6, 5), RAIL_ELEVATED)).toBe(LINK_E | LINK_W | LINK_N);
  });
});

describe('money', () => {
  it('each level has its price; only ground pays the bridge multiplier', () => {
    expect(trackBuildCost(w, 5, 5, RAIL_ELEVATED)).toBe(T[RAIL_ELEVATED].cost);
    expect(trackBuildCost(w, 5, 5, RAIL_SUBWAY)).toBe(T[RAIL_SUBWAY].cost);
    w.layers.terrain[at(5, 5)] = TERRAIN_WATER;
    expect(trackBuildCost(w, 5, 5, RAIL_GROUND)).toBe(T[RAIL_GROUND].cost * BALANCE.costs.bridgeMultiplier);
    expect(trackBuildCost(w, 5, 5, RAIL_ELEVATED)).toBe(T[RAIL_ELEVATED].cost);
    expect(trackBuildCost(w, 5, 5, RAIL_SUBWAY)).toBe(T[RAIL_SUBWAY].cost);
    expect(T[RAIL_ELEVATED].cost).toBeGreaterThan(T[RAIL_GROUND].cost);
    expect(T[RAIL_SUBWAY].cost).toBeGreaterThan(T[RAIL_ELEVATED].cost);
  });

  it('upkeep adds up over the levels', () => {
    lay(5, 5, RAIL_GROUND); lay(5, 5, RAIL_ELEVATED); lay(6, 5, RAIL_SUBWAY);
    expect(trackMaintenance(w)).toBeCloseTo(T[RAIL_GROUND].maintenance + T[RAIL_ELEVATED].maintenance + T[RAIL_SUBWAY].maintenance, 6);
  });

  it('the command charges the level and undoes cleanly, leaving the other levels', () => {
    lay(5, 5, RAIL_GROUND);
    const cmd = new BuildTrackCommand(5, 5, RAIL_SUBWAY);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.money).toBe(1_000_000 - T[RAIL_SUBWAY].cost);
    cmd.undo(w);
    expect(w.getRail(5, 5)).toBe(RAIL_GROUND);
    expect(w.budget.money).toBe(1_000_000);
    w.budget.money = T[RAIL_SUBWAY].cost - 1;
    const poor = new BuildTrackCommand(6, 5, RAIL_SUBWAY);
    expect(poor.execute(w)).toBe(false);
    expect(poor.failReason).toBe('funds');
  });
});

describe('clearing', () => {
  it('the bulldozer takes ground and elevated track and leaves the subway', () => {
    lay(5, 5, RAIL_GROUND); lay(5, 5, RAIL_ELEVATED); lay(5, 5, RAIL_SUBWAY);
    const cmd = new BulldozeCommand(5, 5);
    expect(cmd.execute(w)).toBe(true);
    expect(w.getRail(5, 5)).toBe(RAIL_SUBWAY);
    cmd.undo(w);
    expect(w.getRail(5, 5)).toBe(RAIL_GROUND | RAIL_ELEVATED | RAIL_SUBWAY);
    // A tile with only a subway under it is nothing to the bulldozer.
    lay(8, 8, RAIL_SUBWAY);
    expect(new BulldozeCommand(8, 8).execute(w)).toBe(false);
  });

  it('in the underground view the bulldozer takes the subway and leaves the surface', () => {
    w.setRoad(5, 5, ROAD_STREET);
    lay(5, 5, RAIL_SUBWAY); lay(5, 5, RAIL_ELEVATED);
    const cmd = commandForTool('bulldoze', 5, 5, w, true)!;
    expect(cmd).toBeInstanceOf(RemoveSubwayCommand);
    const before = w.budget.money;
    expect(cmd.execute(w)).toBe(true);
    expect(w.getRail(5, 5)).toBe(RAIL_ELEVATED);
    expect(w.getRoad(5, 5)).toBe(ROAD_STREET);
    expect(w.budget.money).toBe(before - BALANCE.costs.bulldoze);
    cmd.undo(w);
    expect(w.getRail(5, 5)).toBe(RAIL_ELEVATED | RAIL_SUBWAY);
    expect(w.budget.money).toBe(before);
    expect(commandForTool('bulldoze', 9, 9, w, true)!.execute(w)).toBe(false);   // no subway there
  });
});

describe('tools and saving', () => {
  it("'railElevated' and 'railSubway' lay their levels and paint along a drag", () => {
    expect(trackLevelForTool('rail')).toBe(RAIL_GROUND);
    expect(trackLevelForTool('railElevated')).toBe(RAIL_ELEVATED);
    expect(trackLevelForTool('railSubway')).toBe(RAIL_SUBWAY);
    expect(trackLevelForTool('road')).toBeUndefined();
    expect(isPaintTool('railElevated')).toBe(true);
    expect(isPaintTool('railSubway')).toBe(true);
    expect(commandForTool('railElevated', 5, 5, w)!.execute(w)).toBe(true);
    expect(commandForTool('railSubway', 5, 5, w)!.execute(w)).toBe(true);
    expect(w.getRail(5, 5)).toBe(RAIL_ELEVATED | RAIL_SUBWAY);
  });

  it('all levels come back from a save', () => {
    lay(5, 5, RAIL_GROUND); lay(5, 5, RAIL_ELEVATED); lay(6, 5, RAIL_SUBWAY); lay(7, 5, RAIL_ELEVATED);
    const loaded = deserialize(serialize(w));
    expect(Array.from(loaded.layers.rail)).toEqual(Array.from(w.layers.rail));
    expect(railLinks(loaded, at(5, 5), RAIL_ELEVATED)).toBe(0);
    expect(railLinks(loaded, at(6, 5), RAIL_SUBWAY)).toBe(0);
    expect(LINK_S).toBe(4);
  });
});
