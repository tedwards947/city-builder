// The tree brush and the tree eraser (LANDSCAPING_DESIGN.md). One command per
// brush stroke, so one undo puts a whole stroke back.

import { Command } from './Command';
import type { World } from '../sim/World';
import { VEG_NONE } from '../sim/constants';
import { treeQuote } from '../sim/landscaping';

abstract class TreeStrokeCommand extends Command {
  protected readonly tiles: number[];
  protected readonly species: number;
  private changed: number[] = [];
  private before: number[] = [];
  private cost = 0;

  constructor(tiles: readonly number[], species: number) {
    super();
    this.tiles = [...tiles];
    this.species = species;
  }

  execute(world: World): boolean {
    const quote = treeQuote(world, this.tiles, this.species);
    if (quote.tiles.length === 0) return false;
    if (!quote.affordable) { this.failReason = 'funds'; return false; }
    const veg = world.layers.vegetation, width = world.grid.width;
    this.changed = quote.tiles;
    this.before = quote.tiles.map((i) => veg[i]);
    this.cost = quote.cost;
    world.budget.money -= quote.cost;
    for (const i of quote.tiles) {
      veg[i] = this.species;
      world.grid.markDirty(i % width, (i - (i % width)) / width);
    }
    if (this.species === VEG_NONE) world.events.emit('treesCleared', { tiles: quote.tiles, cost: quote.cost });
    else world.events.emit('treesPlanted', { tiles: quote.tiles, species: this.species, cost: quote.cost });
    return true;
  }

  undo(world: World): void {
    const veg = world.layers.vegetation, width = world.grid.width;
    this.changed.forEach((i, k) => {
      veg[i] = this.before[k];
      world.grid.markDirty(i % width, (i - (i % width)) / width);
    });
    world.budget.money += this.cost;
    this.changed = [];
    this.before = [];
    this.cost = 0;
  }
}

/**
 * Plants `species` (1–6) on each of `tiles` (tile indices) that can take it:
 * land with no road, building or zone, not already that species. A different
 * species already there is replanted. Costs BALANCE.costs.tree per tree; the
 * whole stroke or nothing ('funds').
 */
export class PlantTreesCommand extends TreeStrokeCommand {
  constructor(tiles: readonly number[], species: number) { super(tiles, species); }
}

/** Removes the trees on `tiles` (tile indices). Costs BALANCE.costs.treeClear per tree; never refused for money. */
export class ClearTreesCommand extends TreeStrokeCommand {
  constructor(tiles: readonly number[]) { super(tiles, VEG_NONE); }
}
