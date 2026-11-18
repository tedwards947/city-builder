// Landscaping (LANDSCAPING_DESIGN.md): what the tree brush, the tree eraser
// and the water tools would do. The quotes are pure: they change nothing. The
// commands in src/commands (TreeCommands.ts, EditWaterCommand.ts) apply them.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { BUILDING_NONE, ROAD_NONE, TERRAIN_GRASS, TERRAIN_SAND, TERRAIN_WATER, VEG_NONE, VEG_TREE_6, ZONE_NONE } from './constants';
import { pcQuote } from './politics';

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

// ── Water ───────────────────────────────────────────────────────────────────

export interface WaterQuote {
  /** The tiles (indices) whose terrain would change, in the order given, each once. */
  tiles: number[];
  /**
   * Tiles the stroke covers that cannot change: a road (a bridge included)
   * when adding water; a road or any building (a seaport's docks included)
   * when removing it. The player must bulldoze these first.
   */
  blocked: number[];
  /**
   * What adding water would demolish: one tile per building (its anchor) or
   * zoned lot under the stroke. Each is bulldozed as the bulldozer would,
   * with its displacement PC and BALANCE.costs.bulldoze. Empty when removing.
   */
  demolished: number[];
  /** Money for the whole stroke: BALANCE.costs.water per tile, plus the bulldozing. */
  cost: number;
  /** A city in the red edits no water, even at a price of 0 (as with zoning). */
  affordable: boolean;
  /** Political capital for the demolitions, summed. */
  pc: { cost: number; reward: number; displacedPopulation: number; affordable: boolean };
}

/**
 * What turning `tiles` to water (`add`) or to land would do. Tiles that are
 * already what is asked for are left out. Cheap enough for every pointer move.
 */
export function waterQuote(world: World, tiles: readonly number[], add: boolean): WaterQuote {
  const L = world.layers;
  const out: number[] = [], blocked: number[] = [], demolished: number[] = [];
  const seen = new Set<number>(), targets = new Set<number>();
  for (const i of tiles) {
    if (seen.has(i) || i < 0 || i >= L.terrain.length) continue;
    seen.add(i);
    const isWater = L.terrain[i] === TERRAIN_WATER;
    if (isWater === add) continue;
    if (L.roadClass[i] !== ROAD_NONE || (!add && L.building[i] !== BUILDING_NONE)) { blocked.push(i); continue; }
    out.push(i);
    if (!add) continue;
    const target = L.building[i] !== BUILDING_NONE ? world.buildingAnchorAt(i) : L.zone[i] !== ZONE_NONE ? i : -1;
    if (target >= 0 && !targets.has(target)) { targets.add(target); demolished.push(target); }
  }
  const pc = { cost: 0, reward: 0, displacedPopulation: 0, affordable: true };
  const width = world.grid.width;
  for (const t of demolished) {
    const q = pcQuote(world, { type: 'bulldoze', tx: t % width, ty: (t - (t % width)) / width });
    pc.cost += q.cost; pc.reward += q.reward; pc.displacedPopulation += q.displacedPopulation;
  }
  // The rule for one action: any cost at all is refused while PC is below 0.
  const have = world.budget.politicalCapital;
  pc.affordable = pc.cost <= 0 || (have >= 0 && have >= pc.cost);
  const cost = out.length * BALANCE.costs.water + demolished.length * BALANCE.costs.bulldoze;
  return { tiles: out, blocked, demolished, cost, affordable: world.budget.money >= cost, pc };
}

/**
 * Lay the beach again round tiles whose terrain has just changed: every land
 * tile on or beside them is sand if water is among its eight neighbours and
 * grass if not (the rule the map generator uses). Looks only. Returns what it
 * changed, with the terrain before, for undo.
 */
export function relaySand(world: World, changed: readonly number[]): { i: number; before: number }[] {
  const { width, height } = world.grid;
  const t = world.layers.terrain;
  const done = new Set<number>();
  const out: { i: number; before: number }[] = [];
  for (const c of changed) {
    const cx = c % width, cy = (c - cx) / width;
    for (let y = Math.max(0, cy - 1); y <= Math.min(height - 1, cy + 1); y++) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(width - 1, cx + 1); x++) {
        const i = y * width + x;
        if (done.has(i) || t[i] === TERRAIN_WATER) continue;
        done.add(i);
        let nearWater = false;
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1) && !nearWater; ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            if (t[ny * width + nx] === TERRAIN_WATER) { nearWater = true; break; }
          }
        }
        const want = nearWater ? TERRAIN_SAND : TERRAIN_GRASS;
        if (t[i] !== want) {
          out.push({ i, before: t[i] });
          t[i] = want;
          world.grid.markDirty(x, y);
        }
      }
    }
  }
  return out;
}
