import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { ROAD_NONE, ROAD_STREET } from '../sim/constants';
import { BALANCE } from '../data/balance';

export class BuildRoadCommand extends Command {
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
    if (world.layers.roadClass[world.grid.idx(this.tx, this.ty)] !== ROAD_NONE) return false;
    if (world.budget.money < BALANCE.costs.road) return false;
    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = BALANCE.costs.road;
    world.budget.money -= this.cost;
    const ok = world.setRoad(this.tx, this.ty, ROAD_STREET);
    if (ok) world.events.emit('roadBuilt', { tx: this.tx, ty: this.ty, cost: this.cost });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
  }
}
