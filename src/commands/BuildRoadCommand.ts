import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { ROAD_NONE, ROAD_STREET } from '../sim/constants';
import { BALANCE } from '../data/balance';

// Builds a new road OR upgrades an existing road to a higher class.
//
// Rules:
//   - Cannot build on water or building tiles.
//   - Cannot downgrade (current >= target → no-op).
//   - New road: costs roadClasses[target].cost in full.
//   - Upgrade: costs roadClasses[target].cost − roadClasses[current].cost (delta only).
//
// targetClass defaults to ROAD_STREET for backward compatibility.

export class BuildRoadCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly targetClass: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;

  constructor(tx: number, ty: number, targetClass = ROAD_STREET) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.targetClass = targetClass;
  }

  execute(world: World): boolean {
    if (!world.isBuildable(this.tx, this.ty)) return false;

    const i = world.grid.idx(this.tx, this.ty);
    const current = world.layers.roadClass[i];
    if (current >= this.targetClass) return false; // already same or better class

    const targetCost  = BALANCE.roadClasses[this.targetClass].cost;
    const currentCost = current !== ROAD_NONE ? BALANCE.roadClasses[current].cost : 0;
    const cost = targetCost - currentCost;

    if (world.budget.money < cost) return false;

    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;
    world.budget.money -= cost;
    const ok = world.setRoad(this.tx, this.ty, this.targetClass);
    if (ok) world.events.emit('roadBuilt', { tx: this.tx, ty: this.ty, cost });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
  }
}
