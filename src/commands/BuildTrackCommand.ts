import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { RAIL_GROUND, RAIL_SUBWAY } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { trackBuildCost } from '../sim/rail';
import type { PcCharges } from '../sim/politics';
import { NO_PC_CHARGES, pcQuote, chargeQuote, refundCharges } from '../sim/politics';

// Lays rail track of one level (ground, elevated or subway) on one tile
// (sim/rail.ts for where each may go). Costs BALANCE.rail.track[level].cost;
// ground track on water is a bridge and costs that times the bridge
// multiplier. Ground and elevated track near homes is a nuisance and costs
// political capital, like an industrial zone or a power plant (the quote's
// 'track' action; BALANCE.politicalCapital.nuisance.trackPerResident); a
// subway costs none.

export class BuildTrackCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly level: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  private pcCharges: PcCharges = NO_PC_CHARGES;

  constructor(tx: number, ty: number, level: number = RAIL_GROUND) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.level = level;
  }

  execute(world: World): boolean {
    const cost = trackBuildCost(world, this.tx, this.ty, this.level);
    if (cost === null) return false;
    if (world.budget.money < cost) { this.failReason = 'funds'; return false; }
    const quote = pcQuote(world, { type: 'track', tx: this.tx, ty: this.ty, level: this.level });
    if (!quote.affordable) { this.failReason = 'politicalCapital'; return false; }
    this.snap = snapshotTile(world, this.tx, this.ty);
    if (!world.layTrack(this.tx, this.ty, this.level)) { this.snap = null; return false; }
    this.cost = cost;
    world.budget.money -= cost;
    this.pcCharges = chargeQuote(world, quote, this.tx, this.ty);
    world.events.emit('trackBuilt', { tx: this.tx, ty: this.ty, cost });
    return true;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
    refundCharges(world, this.pcCharges, this.tx, this.ty);
    this.pcCharges = NO_PC_CHARGES;
  }
}

/**
 * Takes the subway track out from under one tile: what the bulldozer does in
 * the underground view. Costs BALANCE.costs.bulldoze, with no funds check
 * (like the bulldozer). The surface of the tile is not touched.
 */
export class RemoveSubwayCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private done = false;
  private cost = 0;

  constructor(tx: number, ty: number) {
    super();
    this.tx = tx;
    this.ty = ty;
  }

  execute(world: World): boolean {
    if (!world.removeSubway(this.tx, this.ty)) return false;
    this.done = true;
    this.cost = BALANCE.costs.bulldoze;
    world.budget.money -= this.cost;
    return true;
  }

  undo(world: World): void {
    if (!this.done) return;
    world.layers.rail[world.grid.idx(this.tx, this.ty)] |= RAIL_SUBWAY;
    world.railVersion++;
    world.grid.markDirty(this.tx, this.ty);
    world.budget.money += this.cost;
    this.done = false;
  }
}
