// The tree brush and eraser: PlantTreesCommand, ClearTreesCommand, treeQuote.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ROAD_STREET, TERRAIN_SAND, TERRAIN_WATER, ZONE_R, BUILDING_PARK } from '../sim/constants';
import { treeQuote } from '../sim/landscaping';
import { PlantTreesCommand, ClearTreesCommand } from '../commands/TreeCommands';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { CommandHistory } from '../commands/CommandHistory';
import { landWorld } from './pcTestWorld';

const C = BALANCE.costs as Record<string, number>;
let w: World;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const veg = (x: number, y: number) => w.layers.vegetation[idx(x, y)];

beforeEach(() => { w = landWorld(); w.budget.money = 1000; });
afterEach(() => { C.tree = 0; C.treeClear = 0; });

describe('planting trees', () => {
  it('ships at the lab-tuned prices (owner 2026-11-19): 200 a tree, 5 to clear one', () => {
    expect(BALANCE.costs.tree).toBe(200);
    expect(BALANCE.costs.treeClear).toBe(5);
  });

  it('plants on open land and sand; skips water, roads, buildings, zones and the same species', () => {
    w.layers.terrain[idx(2, 1)] = TERRAIN_WATER;
    w.layers.terrain[idx(3, 1)] = TERRAIN_SAND;
    w.setRoad(4, 1, ROAD_STREET);
    w.placeBuilding(5, 1, BUILDING_PARK);
    w.setZone(6, 1, ZONE_R);
    w.layers.vegetation[idx(7, 1)] = 3;                      // already this species
    w.layers.vegetation[idx(8, 1)] = 5;                      // another species: replanted
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8].map((x) => idx(x, 1));
    C.tree = 4;
    const want = [idx(1, 1), idx(3, 1), idx(8, 1)];
    expect(treeQuote(w, [...tiles, idx(1, 1), -1, 1e9], 3)).toEqual({ tiles: want, cost: 12, affordable: true });
    const events: unknown[] = [];
    w.events.on('treesPlanted', (e: unknown) => events.push(e));
    const edits = w.grid.edits;
    expect(new PlantTreesCommand(tiles, 3).execute(w)).toBe(true);
    expect(tiles.map((i) => w.layers.vegetation[i])).toEqual([3, 0, 3, 0, 0, 0, 3, 3]);
    expect(w.budget.money).toBe(988);
    expect(events).toEqual([{ tiles: want, species: 3, cost: 12 }]);
    expect(w.grid.edits).toBeGreaterThan(edits);             // chunks are redrawn
  });

  it('one undo puts the whole stroke and the money back, and redo plants it again', () => {
    w.layers.vegetation[idx(2, 2)] = 6;
    C.tree = 10;
    const h = new CommandHistory(w);
    expect(h.run(new PlantTreesCommand([idx(1, 2), idx(2, 2), idx(3, 2)], 1))).toBe(true);
    expect([veg(1, 2), veg(2, 2), veg(3, 2)]).toEqual([1, 1, 1]);
    expect(w.budget.money).toBe(970);
    h.undo();
    expect([veg(1, 2), veg(2, 2), veg(3, 2)]).toEqual([0, 6, 0]);
    expect(w.budget.money).toBe(1000);
    h.redo();
    expect([veg(1, 2), veg(2, 2), veg(3, 2)]).toEqual([1, 1, 1]);
    expect(w.budget.money).toBe(970);
  });

  it('is all or nothing on money, and a city in the red plants nothing even when trees are free', () => {
    C.tree = 600;
    const cmd = new PlantTreesCommand([idx(1, 1), idx(2, 1)], 2);
    expect(treeQuote(w, [idx(1, 1), idx(2, 1)], 2).affordable).toBe(false);
    expect(cmd.execute(w)).toBe(false);
    expect(cmd.failReason).toBe('funds');
    expect([veg(1, 1), veg(2, 1)]).toEqual([0, 0]);
    expect(w.budget.money).toBe(1000);
    C.tree = 0;
    w.budget.money = -1;
    const broke = new PlantTreesCommand([idx(1, 1)], 2);
    expect(broke.execute(w)).toBe(false);
    expect(broke.failReason).toBe('funds');
  });

  it('does nothing, with no reason given, when no tile would change or the species is not one', () => {
    w.layers.vegetation[idx(1, 1)] = 2;
    const same = new PlantTreesCommand([idx(1, 1)], 2);
    expect(same.execute(w)).toBe(false);
    expect(same.failReason).toBeNull();
    expect(new PlantTreesCommand([idx(3, 3)], 7).execute(w)).toBe(false);
    expect(new PlantTreesCommand([idx(3, 3)], 1.5).execute(w)).toBe(false);
    expect(veg(3, 3)).toBe(0);
  });
});

describe('clearing trees', () => {
  it('removes trees, charges per tree, works in the red, and undoes', () => {
    w.layers.vegetation[idx(1, 1)] = 2;
    w.layers.vegetation[idx(2, 1)] = 4;
    C.treeClear = 3;
    w.budget.money = -50;
    const tiles = [idx(1, 1), idx(2, 1), idx(3, 1)];
    expect(treeQuote(w, tiles, 0)).toEqual({ tiles: [idx(1, 1), idx(2, 1)], cost: 6, affordable: true });
    const events: unknown[] = [];
    w.events.on('treesCleared', (e: unknown) => events.push(e));
    const cmd = new ClearTreesCommand(tiles);
    expect(cmd.execute(w)).toBe(true);
    expect([veg(1, 1), veg(2, 1)]).toEqual([0, 0]);
    expect(w.budget.money).toBe(-56);
    expect(events).toEqual([{ tiles: [idx(1, 1), idx(2, 1)], cost: 6 }]);
    cmd.undo(w);
    expect([veg(1, 1), veg(2, 1)]).toEqual([2, 4]);
    expect(w.budget.money).toBe(-50);
    expect(new ClearTreesCommand([idx(9, 9)]).execute(w)).toBe(false);
  });

  it('the bulldozer still leaves a tile with only a tree alone', () => {
    w.layers.vegetation[idx(1, 1)] = 2;
    expect(new BulldozeCommand(1, 1).execute(w)).toBe(false);
    expect(veg(1, 1)).toBe(2);
  });
});
