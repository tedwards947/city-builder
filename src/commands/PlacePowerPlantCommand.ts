import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { BUILDING_POWER_PLANT } from '../sim/constants';
import { BALANCE } from '../data/balance';

export class PlacePowerPlantCommand extends Command {
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
    if (!world.isBuildable(this.tx, this.ty)) return false;
    if (world.budget.money < BALANCE.costs.powerPlant) return false;
    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = BALANCE.costs.powerPlant;
    world.budget.money -= this.cost;
    const ok = world.placeBuilding(this.tx, this.ty, BUILDING_POWER_PLANT);
    if (ok) world.events.emit('powerPlantBuilt', { tx: this.tx, ty: this.ty, cost: this.cost });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
  }
}
