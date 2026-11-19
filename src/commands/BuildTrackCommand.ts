import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { trackBuildCost } from '../sim/rail';

// Lays ground rail track on one tile (sim/rail.ts for where it may go).
// Costs BALANCE.rail.track[RAIL_GROUND].cost, times the bridge multiplier on
// water. No political capital: track near homes becomes a nuisance later
// (RAIL_DESIGN.md, after phase 1).

export class BuildTrackCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;

  constructor(tx: number, ty: number) {
    super();
    this.tx = tx;
    this.ty = ty;
  }

  execute(world: World): boolean {
    const cost = trackBuildCost(world, this.tx, this.ty);
    if (cost === null) return false;
    if (world.budget.money < cost) { this.failReason = 'funds'; return false; }
    this.snap = snapshotTile(world, this.tx, this.ty);
    if (!world.layTrack(this.tx, this.ty)) { this.snap = null; return false; }
    this.cost = cost;
    world.budget.money -= cost;
    world.events.emit('trackBuilt', { tx: this.tx, ty: this.ty, cost });
    return true;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
  }
}
