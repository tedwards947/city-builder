// The water tools: EditWaterCommand and waterQuote.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  ROAD_STREET, TERRAIN_GRASS, TERRAIN_SAND, TERRAIN_WATER, ZONE_R, ZONE_NONE,
  BUILDING_PARK, BUILDING_SEAPORT, BUILDING_LARGE_POWER_PLANT, BUILDING_NONE,
} from '../sim/constants';
import { waterQuote } from '../sim/landscaping';
import { isOpenWater } from '../sim/openWater';
import { shipRoute } from '../sim/seaport';
import { EditWaterCommand } from '../commands/EditWaterCommand';
import { CommandHistory } from '../commands/CommandHistory';
import { landWorld, home, displacementCost } from './pcTestWorld';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { BUILDING_LARGE_WATER_PLANT } from '../sim/constants';

const C = BALANCE.costs as Record<string, number>;
const bulldoze = C.bulldoze;
let w: World;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const terrain = (x: number, y: number) => w.layers.terrain[idx(x, y)];
const row = (y: number, x0: number, x1: number) => Array.from({ length: x1 - x0 + 1 }, (_, k) => terrain(x0 + k, y));
const G = TERRAIN_GRASS, S = TERRAIN_SAND, W = TERRAIN_WATER;

beforeEach(() => { w = landWorld(); w.budget.money = 1000; w.budget.politicalCapital = 100; });
afterEach(() => { C.water = 0; C.bulldoze = bulldoze; });

describe('adding water', () => {
  it('ships free', () => expect(BALANCE.costs.water).toBe(0));

  it('floods land, lays a beach round it, removes trees, and undoes all of it', () => {
    w.layers.vegetation[idx(5, 5)] = 3;
    w.layers.vegetation[idx(6, 5)] = 2;                      // beside the water: stays
    C.water = 7;
    const events: unknown[] = [];
    w.events.on('waterEdited', (e: unknown) => events.push(e));
    const edits = w.grid.edits;
    const cmd = new EditWaterCommand([idx(5, 5), idx(5, 5)], true);
    expect(cmd.execute(w)).toBe(true);
    expect(row(4, 3, 7)).toEqual([G, S, S, S, G]);
    expect(row(5, 3, 7)).toEqual([G, S, W, S, G]);
    expect(row(6, 3, 7)).toEqual([G, S, S, S, G]);
    expect(w.layers.vegetation[idx(5, 5)]).toBe(0);
    expect(w.layers.vegetation[idx(6, 5)]).toBe(2);
    expect(w.budget.money).toBe(993);
    expect(events).toEqual([{ tiles: [idx(5, 5)], add: true, cost: 7 }]);
    expect(w.grid.edits).toBeGreaterThan(edits);
    cmd.undo(w);
    expect(w.layers.terrain.every((t) => t === G)).toBe(true);
    expect(w.layers.vegetation[idx(5, 5)]).toBe(3);
    expect(w.budget.money).toBe(1000);
  });

  it('roads block the water; water already there is left out', () => {
    w.setRoad(4, 4, ROAD_STREET);
    w.layers.terrain[idx(6, 4)] = W;
    const tiles = [idx(4, 4), idx(5, 4), idx(6, 4)];
    expect(waterQuote(w, tiles, true)).toMatchObject({ tiles: [idx(5, 4)], blocked: [idx(4, 4)], demolished: [], cost: 0, affordable: true });
    expect(new EditWaterCommand(tiles, true).execute(w)).toBe(true);
    expect(terrain(4, 4)).not.toBe(W);
    expect(terrain(5, 4)).toBe(W);
    const none = new EditWaterCommand([idx(4, 4), idx(6, 4)], true);
    expect(none.execute(w)).toBe(false);
    expect(none.failReason).toBeNull();
  });

  it('bulldozes the buildings and homes it covers, a building whole and once, with the displacement PC', () => {
    home(w, 3, 3);
    expect(w.placeBuilding(8, 8, BUILDING_LARGE_POWER_PLANT)).toBe(true);
    const port = w.buildingTilesAt(8, 8);
    w.placeBuilding(12, 3, BUILDING_PARK);
    C.water = 2;
    const tiles = [idx(3, 3), port[0], port[1], idx(12, 3), idx(20, 20)];
    const q = waterQuote(w, tiles, true);
    expect(q.demolished).toEqual([idx(3, 3), idx(8, 8), idx(12, 3)]);
    expect(q.cost).toBe(5 * 2 + 3 * bulldoze);
    expect(q.pc.cost).toBe(displacementCost());
    expect(q.pc.displacedPopulation).toBeGreaterThan(0);
    const money = w.budget.money, pc = w.budget.politicalCapital, buildings = w.buildings.length;
    const h = new CommandHistory(w);
    expect(h.run(new EditWaterCommand(tiles, true))).toBe(true);
    expect(w.budget.money).toBe(money - q.cost);
    expect(w.budget.politicalCapital).toBe(pc - q.pc.cost);
    expect(w.layers.zone[idx(3, 3)]).toBe(ZONE_NONE);
    expect(w.buildings.length).toBe(buildings - 2);
    expect(port.every((i) => w.layers.building[i] === BUILDING_NONE)).toBe(true);     // the whole plant
    expect(port.filter((i) => w.layers.terrain[i] === W).length).toBe(2);             // only the stroke floods
    h.undo();
    expect(w.budget.money).toBe(money);
    expect(w.budget.politicalCapital).toBe(pc);
    expect(w.layers.zone[idx(3, 3)]).toBe(ZONE_R);
    expect(w.layers.devLevel[idx(3, 3)]).toBe(2);
    expect(w.buildings.length).toBe(buildings);
    expect(port.every((i) => w.layers.building[i] === BUILDING_LARGE_POWER_PLANT)).toBe(true);
    expect(w.layers.terrain.every((t) => t === G)).toBe(true);
  });

  it('is all or nothing: refused for money or political capital, nothing changes', () => {
    home(w, 3, 3);
    home(w, 4, 3);
    w.budget.politicalCapital = displacementCost() * 1.5;    // one home, not two
    const tiles = [idx(3, 3), idx(4, 3)];
    expect(waterQuote(w, tiles, true).pc.affordable).toBe(false);
    const noPc = new EditWaterCommand(tiles, true);
    expect(noPc.execute(w)).toBe(false);
    expect(noPc.failReason).toBe('politicalCapital');
    expect(w.layers.zone[idx(3, 3)]).toBe(ZONE_R);
    expect(w.budget.politicalCapital).toBe(displacementCost() * 1.5);
    C.water = 600;
    const noMoney = new EditWaterCommand([idx(10, 10), idx(11, 10)], true);
    expect(noMoney.execute(w)).toBe(false);
    expect(noMoney.failReason).toBe('funds');
    C.water = 0;
    w.budget.money = -1;
    const broke = new EditWaterCommand([idx(10, 10)], true);
    expect(broke.execute(w)).toBe(false);
    expect(broke.failReason).toBe('funds');
    expect(w.layers.terrain.every((t) => t === G)).toBe(true);
  });
});

describe('removing water', () => {
  beforeEach(() => {
    // A sea over y 0–9 with its beach along y = 10.
    for (let y = 0; y <= 9; y++) for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, y)] = W;
    for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, 10)] = S;
  });

  it('new land is sand by the water and grass away from it; the old beach moves; undo restores', () => {
    const tiles: number[] = [];
    for (let y = 7; y <= 9; y++) for (let x = 10; x <= 14; x++) tiles.push(idx(x, y));
    const before = Array.from(w.layers.terrain);
    C.water = 1;
    const cmd = new EditWaterCommand([...tiles, idx(10, 11)], false);        // the land tile is left out
    expect(cmd.execute(w)).toBe(true);
    expect(row(6, 9, 15)).toEqual([W, W, W, W, W, W, W]);
    expect(row(7, 9, 15)).toEqual([W, S, S, S, S, S, W]);
    expect(row(8, 9, 15)).toEqual([W, S, G, G, G, S, W]);
    expect(row(9, 9, 15)).toEqual([W, S, G, G, G, S, W]);
    expect(row(10, 9, 15)).toEqual([S, S, G, G, G, S, S]);                  // the old beach behind it is grass now
    expect(w.budget.money).toBe(985);
    cmd.undo(w);
    expect(Array.from(w.layers.terrain)).toEqual(before);
    expect(w.budget.money).toBe(1000);
  });

  it('bridges and docks block it', () => {
    w.setRoad(5, 9, ROAD_STREET);
    w.setRoad(5, 10, ROAD_STREET);
    expect(w.placeBuilding(10, 10, BUILDING_SEAPORT)).toBe(true);            // docks on y = 9
    const dock = idx(10, 9);
    expect(w.layers.building[dock]).toBe(BUILDING_SEAPORT);
    const tiles = [idx(5, 9), dock, idx(20, 9)];
    expect(waterQuote(w, tiles, false)).toMatchObject({ tiles: [idx(20, 9)], blocked: [idx(5, 9), dock], demolished: [] });
    expect(new EditWaterCommand(tiles, false).execute(w)).toBe(true);
    expect(terrain(5, 9)).toBe(W);
    expect(terrain(10, 9)).toBe(W);
    expect(terrain(20, 9)).toBe(S);
  });

  it('open water and ship routes follow the edit: a port can be cut off and dug out again', () => {
    expect(w.placeBuilding(10, 10, BUILDING_SEAPORT)).toBe(true);
    const anchor = idx(10, 10);
    expect(shipRoute(w, anchor)).not.toBeNull();
    // Fill in everything but a pond in front of the docks.
    const fill: number[] = [];
    for (let y = 0; y <= 9; y++) for (let x = 0; x < 32; x++) if (!(y >= 8 && x >= 9 && x <= 15)) fill.push(idx(x, y));
    const cmd = new EditWaterCommand(fill, false);
    expect(cmd.execute(w)).toBe(true);
    expect(terrain(11, 8)).toBe(W);
    expect(isOpenWater(w, idx(11, 8))).toBe(false);
    expect(shipRoute(w, anchor)).toBeNull();
    // A canal to the top edge.
    const canal = Array.from({ length: 8 }, (_, y) => idx(12, y));
    expect(new EditWaterCommand(canal, true).execute(w)).toBe(true);
    expect(isOpenWater(w, idx(11, 8))).toBe(true);
    expect(shipRoute(w, anchor)!.length).toBeGreaterThan(0);
  });
});

describe('a water plant left dry', () => {
  it('supplies nothing once the water beside it is gone, and again when it is back', () => {
    for (let y = 0; y <= 9; y++) for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, y)] = W;
    for (let x = 5; x <= 12; x++) w.setRoad(x, 12, ROAD_STREET);
    expect(w.placeBuilding(8, 10, BUILDING_LARGE_WATER_PLANT)).toBe(true);   // x 8–9, y 10–11: the sea is above it
    const anchor = idx(8, 10);
    const sys = new WaterSystem();
    sys.update(w);
    expect(w.stats.waterSupply).toBe(BALANCE.water.largePlantOutput);

    // One of the two water tiles beside it: still wet.
    expect(waterQuote(w, [idx(8, 9)], false).pumpsDry).toEqual([]);
    // Both: dry.
    const both = [idx(8, 9), idx(9, 9)];
    expect(waterQuote(w, both, false)).toMatchObject({ tiles: both, pumpsDry: [anchor], portsCutOff: [] });
    const cmd = new EditWaterCommand(both, false);
    expect(cmd.execute(w)).toBe(true);
    sys.update(w);
    expect(w.stats.waterSupply).toBe(0);
    expect(w.layers.water[anchor]).toBe(0);
    expect(w.buildings.length).toBe(1);                      // still standing
    cmd.undo(w);
    sys.update(w);
    expect(w.stats.waterSupply).toBe(BALANCE.water.largePlantOutput);
    // Flooding the plant itself is a demolition, not a dry pump.
    expect(waterQuote(w, [anchor], true)).toMatchObject({ demolished: [anchor], pumpsDry: [] });
  });
});
