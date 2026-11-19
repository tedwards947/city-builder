// What trees do to the city (LANDSCAPING_DESIGN.md): land value nearby and the
// green vibe. Both ship switched off.

import { describe, it, expect, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ROAD_STREET } from '../sim/constants';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { PlantTreesCommand, ClearTreesCommand } from '../commands/TreeCommands';
import { landWorld, home } from './pcTestWorld';

const LV = BALANCE.landValue as Record<string, number>;
const GREEN = BALANCE.character.nudges.green as Record<string, number>;
const shipped = { lv: { ...LV }, green: { ...GREEN } };
afterEach(() => { Object.assign(LV, shipped.lv); Object.assign(GREEN, shipped.green); });

/** A home on a street, with `trees` planted at the given tiles; land value run until it settles. */
function settled(trees: [number, number][]): World {
  const w = landWorld();
  for (let x = 8; x <= 14; x++) w.setRoad(x, 11, ROAD_STREET);
  home(w, 10, 10);
  for (const [x, y] of trees) w.layers.vegetation[w.grid.idx(x, y)] = 1;
  const sys = new LandValueSystem();
  for (let k = 1; k <= 60; k++) { w.tick = k * BALANCE.growth.tickInterval; sys.update(w); }
  return w;
}
const at = (w: World, x: number, y: number) => w.layers.landValue[w.grid.idx(x, y)];

describe('trees and land value', () => {
  it('ships at the lab-tuned numbers (owner 2026-11-19); at treeBonus 0 trees change no land value', () => {
    expect([shipped.lv.treeBonus, shipped.lv.treeRadius, shipped.lv.treeBonusMax]).toEqual([3, 2, 16]);
    LV.treeBonus = 0;
    const bare = settled([]), wooded = settled([[10, 9], [11, 9], [9, 8]]);
    expect(Array.from(wooded.layers.landValue)).toEqual(Array.from(bare.layers.landValue));
  });

  it('each tree within the radius adds the bonus, up to the cap; trees further off add nothing', () => {
    LV.treeBonus = 10; LV.treeRadius = 2; LV.treeBonusMax = 35;
    const bare = settled([]);
    const base = at(bare, 10, 10);
    // Land value eases toward its target in whole steps and stops within one of it.
    const gain = (w: World, x = 10, y = 10) => at(w, x, y) - at(bare, x, y);
    const about = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(2);
    expect(base).toBeGreaterThan(0);
    about(gain(settled([[10, 8]])), 10);                                      // two tiles off
    about(gain(settled([[10, 8], [12, 9]])), 20);
    expect(gain(settled([[10, 7], [13, 10]]))).toBe(0);                       // three tiles off
    const grove: [number, number][] = [[8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [8, 9], [9, 9]];
    about(gain(settled(grove)), 35);                                          // seven trees, capped
    // An empty lot beside the tree gains too, so the overlay shows where trees help.
    about(gain(settled([[10, 8]]), 12, 9), 10);
  });
});

describe('trees and the green vibe', () => {
  function world(): { w: World; green: (x: number, y: number) => number } {
    const w = landWorld();
    w.budget.money = 1000;
    new VibeSystem().update(w);                              // registers its listeners
    return { w, green: (x, y) => w.layers.vibeGreen[w.grid.idx(x, y)] };
  }

  it('ships at ±0.05 a tree (owner 2026-11-19); at 0 planting and clearing move no vibe', () => {
    expect(shipped.green.treePlanted).toBe(0.05);
    expect(shipped.green.treeCleared).toBe(-0.05);
    GREEN.treePlanted = 0; GREEN.treeCleared = 0;
    const { w, green } = world();
    const before = green(5, 5);
    new PlantTreesCommand([w.grid.idx(5, 5)], 2).execute(w);
    new ClearTreesCommand([w.grid.idx(5, 5)]).execute(w);
    expect(green(5, 5)).toBe(before);
  });

  it('each tree planted nudges its tile green; each tree cleared nudges it by the clearing number', () => {
    GREEN.treePlanted = 1; GREEN.treeCleared = -2;
    const { w, green } = world();
    const before = green(5, 5);
    const step = BALANCE.vibe.nudgeByteScale;
    new PlantTreesCommand([w.grid.idx(5, 5), w.grid.idx(6, 5)], 2).execute(w);
    expect(green(5, 5)).toBe(before + step);
    expect(green(6, 5)).toBe(before + step);
    expect(green(7, 5)).toBe(before);
    new ClearTreesCommand([w.grid.idx(5, 5)]).execute(w);
    expect(green(5, 5)).toBe(before + step - 2 * step);
    expect(green(6, 5)).toBe(before + step);
  });
});
