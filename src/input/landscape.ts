// The Landscape tools' settings and brush (art/clay-set/landscape-tools.html,
// owner's picks A1 + C1): a round brush 1, 3 or 5 tiles across, and the tree
// species to plant, Mixed by default. The commands are the engine's
// (src/commands/TreeCommands.ts, EditWaterCommand.ts); quotes come from
// src/sim/landscaping.ts.

import type { World } from '../sim/World';
import { TREE_SPECIES_MAX } from '../sim/landscaping';

/** Brush radius in tiles: 0, 1 or 2 (1, 3 or 5 across). */
export const BRUSH_RADII = [0, 1, 2] as const;
export type BrushRadius = typeof BRUSH_RADII[number];

/** 0 = Mixed (each tile gets a species of its own); 1–6 = one species. */
export type TreeChoice = number;

let brush: BrushRadius = 1;
let species: TreeChoice = 0;

export function landscapeBrush(): BrushRadius { return brush; }
export function setLandscapeBrush(r: BrushRadius): void { brush = r; }
/** The [ and ] keys: a size smaller or bigger, stopping at the ends. */
export function stepLandscapeBrush(d: -1 | 1): void { brush = BRUSH_RADII[Math.max(0, Math.min(BRUSH_RADII.length - 1, BRUSH_RADII.indexOf(brush) + d))]; }
export function treeChoice(): TreeChoice { return species; }
export function setTreeChoice(s: TreeChoice): void { species = Math.max(0, Math.min(TREE_SPECIES_MAX, Math.round(s))); }

/** Tile indices under a round brush of radius `r` centred on (tx, ty), on the map. */
export function brushTiles(world: World, tx: number, ty: number, r: number): number[] {
  const out: number[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r) continue;   // round: 3 across is the full square, 5 across loses its corners
    const x = tx + dx, y = ty + dy;
    if (world.grid.inBounds(x, y)) out.push(world.grid.idx(x, y));
  }
  return out;
}

/** The species Mixed plants on tile `i`: fixed per tile, so the preview shows what a stroke will plant. */
export function mixedSpecies(i: number): number {
  let n = Math.imul(i ^ 0x5bd1e995, 0x27d4eb2d); n ^= n >>> 15; n = Math.imul(n, 0x85ebca6b); n ^= n >>> 13;
  return 1 + ((n >>> 0) % TREE_SPECIES_MAX);
}

/** The tiles of a stroke grouped by the species each gets: one group unless Mixed. */
export function speciesGroups(tiles: readonly number[], choice: TreeChoice): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  for (const i of tiles) {
    const s = choice > 0 ? choice : mixedSpecies(i);
    let g = groups.get(s);
    if (!g) groups.set(s, g = []);
    g.push(i);
  }
  return groups;
}
