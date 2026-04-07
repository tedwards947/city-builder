import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';

export class PlaceServiceBuildingCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly kind: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;

  constructor(tx: number, ty: number, kind: number) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.kind = kind;
  }

  execute(world: World): boolean {
    if (!world.isBuildable(this.tx, this.ty)) return false;
    const cost = BALANCE.costs.service[this.kind] ?? 0;
    if (world.budget.money < cost) return false;
    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;
    world.budget.money -= this.cost;
    return world.placeBuilding(this.tx, this.ty, this.kind);
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
  }
}
