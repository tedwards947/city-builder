// The water tools (LANDSCAPING_DESIGN.md): turn a brush stroke's tiles to
// water or to land. One command per stroke, so one undo puts it all back.

import { Command } from './Command';
import { BulldozeCommand } from './BulldozeCommand';
import type { World } from '../sim/World';
import { TERRAIN_GRASS, TERRAIN_WATER, VEG_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { waterQuote, relaySand } from '../sim/landscaping';

/**
 * `add`: floods each of `tiles` (tile indices) that is land. A road blocks
 * the water (the tile is skipped); a building or zoned lot is bulldozed, with
 * its displacement PC and bulldozing cost; trees go.
 * Not `add`: fills in each tile that is water, unless a road (a bridge) or a
 * building (a dock) stands on it.
 * Either way the beach is laid again round the edit, and the stroke costs
 * BALANCE.costs.water per tile: the whole stroke or nothing ('funds',
 * 'politicalCapital').
 */
export class EditWaterCommand extends Command {
  private readonly tiles: number[];
  private readonly add: boolean;
  private demolitions: BulldozeCommand[] = [];
  private before: { i: number; terrain: number; veg: number }[] = [];
  private sand: { i: number; before: number }[] = [];
  private cost = 0;

  constructor(tiles: readonly number[], add: boolean) {
    super();
    this.tiles = [...tiles];
    this.add = add;
  }

  execute(world: World): boolean {
    const quote = waterQuote(world, this.tiles, this.add);
    if (quote.tiles.length === 0) return false;
    if (!quote.affordable) { this.failReason = 'funds'; return false; }
    if (!quote.pc.affordable) { this.failReason = 'politicalCapital'; return false; }
    const { width } = world.grid;
    const L = world.layers;

    // Clear what the water would cover, exactly as the bulldozer does.
    this.demolitions = [];
    for (const t of quote.demolished) {
      const cmd = new BulldozeCommand(t % width, (t - (t % width)) / width);
      if (!cmd.execute(world)) {
        for (let k = this.demolitions.length - 1; k >= 0; k--) this.demolitions[k].undo(world);
        this.demolitions = [];
        this.failReason = cmd.failReason ?? 'politicalCapital';
        return false;
      }
      this.demolitions.push(cmd);
    }

    this.cost = quote.tiles.length * BALANCE.costs.water;
    world.budget.money -= this.cost;
    this.before = quote.tiles.map((i) => ({ i, terrain: L.terrain[i], veg: L.vegetation[i] }));
    for (const i of quote.tiles) {
      L.terrain[i] = this.add ? TERRAIN_WATER : TERRAIN_GRASS;
      if (this.add) L.vegetation[i] = VEG_NONE;
      world.grid.markDirty(i % width, (i - (i % width)) / width);
    }
    this.sand = relaySand(world, quote.tiles);
    world.events.emit('waterEdited', { tiles: quote.tiles, add: this.add, cost: quote.cost });
    return true;
  }

  undo(world: World): void {
    const { width } = world.grid;
    const L = world.layers;
    for (const { i, before } of this.sand) { L.terrain[i] = before; world.grid.markDirty(i % width, (i - (i % width)) / width); }
    for (const { i, terrain, veg } of this.before) {
      L.terrain[i] = terrain;
      L.vegetation[i] = veg;
      world.grid.markDirty(i % width, (i - (i % width)) / width);
    }
    world.budget.money += this.cost;
    for (let k = this.demolitions.length - 1; k >= 0; k--) this.demolitions[k].undo(world);
    this.demolitions = [];
    this.before = [];
    this.sand = [];
    this.cost = 0;
  }
}
