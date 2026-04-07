import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { ZONE_R, ZONE_C, ROAD_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';

export class PaintZoneCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly newZone: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;

  constructor(tx: number, ty: number, newZone: number) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.newZone = newZone;
  }

  execute(world: World): boolean {
    if (!world.isBuildable(this.tx, this.ty)) return false;
    const cost = this.newZone === ZONE_R ? BALANCE.costs.zoneR
               : this.newZone === ZONE_C ? BALANCE.costs.zoneC
               : BALANCE.costs.zoneI;
    if (world.budget.money < cost) return false;
    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;
    world.budget.money -= cost;
    const i = world.grid.idx(this.tx, this.ty);
    if (world.layers.roadClass[i] !== ROAD_NONE) {
      world.layers.roadClass[i] = ROAD_NONE;
      world.roadNetDirty = true;
    }
    const ok = world.setZone(this.tx, this.ty, this.newZone);
    if (ok) world.events.emit('zonePainted', { tx: this.tx, ty: this.ty, zone: this.newZone, cost });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
  }
}
