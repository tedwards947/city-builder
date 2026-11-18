// Landscaping: what the tree brush and the tree eraser would do
// (LANDSCAPING_DESIGN.md). Pure: nothing here changes the world. The commands
// in src/commands/TreeCommands.ts apply it.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, ROAD_NONE, TERRAIN_WATER, VEG_NONE, VEG_TREE_6, ZONE_NONE } from './constants';

/** Tree species run from 1 to this. */
export const TREE_SPECIES_MAX = VEG_TREE_6;

export interface TreeQuote {
  /** The tiles (indices) that would change, in the order given, each once. */
  tiles: number[];
  /** Money for the whole stroke. */
  cost: number;
  /**
   * Whether the city may pay. Planting follows the rule for zoning and
   * building: a city in the red plants nothing, even at a price of 0.
   * Clearing, like bulldozing, is never refused for money.
   */
  affordable: boolean;
}

/** Whether a tree may stand on tile `i`: land with no road, building or zone. */
export function canHoldTree(world: World, i: number): boolean {
  const L = world.layers;
  return i >= 0 && i < L.terrain.length
    && L.terrain[i] !== TERRAIN_WATER
    && L.roadClass[i] === ROAD_NONE
    && L.building[i] === BUILDING_NONE
    && L.zone[i] === ZONE_NONE;
}

/**
 * What painting `species` (1–6) over `tiles` would do, or clearing them when
 * `species` is 0. A tile changes when it can hold a tree and does not already
 * have that species (planting), or when it has any tree (clearing). Cheap
 * enough to call on every pointer move.
 */
export function treeQuote(world: World, tiles: readonly number[], species: number): TreeQuote {
  const veg = world.layers.vegetation;
  const out: number[] = [];
  const seen = new Set<number>();
  const planting = species !== VEG_NONE;
  if (planting && !(Number.isInteger(species) && species >= 1 && species <= TREE_SPECIES_MAX)) {
    return { tiles: out, cost: 0, affordable: true };
  }
  for (const i of tiles) {
    if (seen.has(i)) continue;
    seen.add(i);
    if (i < 0 || i >= veg.length) continue;
    if (planting ? (canHoldTree(world, i) && veg[i] !== species) : veg[i] !== VEG_NONE) out.push(i);
  }
  const cost = out.length * (planting ? BALANCE.costs.tree : BALANCE.costs.treeClear);
  return { tiles: out, cost, affordable: planting ? world.budget.money >= cost : true };
}
