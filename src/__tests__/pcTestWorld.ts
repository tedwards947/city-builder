// Shared helpers for political capital tests: a small all-land world and
// quick ways to put occupied homes on it.

import { World } from '../sim/World';
import { ZONE_R } from '../sim/constants';
import { BALANCE } from '../data/balance';
import type { NuisanceConfig } from '../sim/politics';

/** A world with every tile bare land, so tests can build anywhere. */
export function landWorld(size = 32): World {
  const w = new World(size, size, 999);
  w.layers.terrain.fill(0);
  w.layers.vegetation.fill(0);
  return w;
}

/** An occupied home of the given level (1–3) at (tx, ty). */
export function home(w: World, tx: number, ty: number, level = 2): void {
  w.setZone(tx, ty, ZONE_R);
  w.layers.devLevel[w.grid.idx(tx, ty)] = level;
}

/** Occupied homes of one level on every tile of the rectangle (x0, y0)–(x1, y1), inclusive. */
export function homes(w: World, x0: number, y0: number, x1: number, y1: number, level = 2): void {
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) home(w, tx, ty, level);
}

/** Residents in a home of the given level. */
export function residents(level = 2): number {
  return BALANCE.growth.popPerLevel[level];
}

/** PC charged for displacing one home of the given level. */
export function displacementCost(level = 2): number {
  return residents(level) * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;
}

/**
 * Nuisance settings with costs switched on, for tests (the shipped rates are
 * 0). Round numbers: 1 PC per resident at full weight, bands at 2 / 4 / 6.
 */
export const TEST_NUISANCE: NuisanceConfig = {
  bands: [
    { within: 2, weight: 1 },
    { within: 4, weight: 0.5 },
    { within: 6, weight: 0.25 },
  ],
  industrialPerResident: 1,
  buildingPerResident: { 1: 2, 3: 1 },
};
