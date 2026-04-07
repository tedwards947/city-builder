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
  private pcCost = 0;

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

    const i = world.grid.idx(this.tx, this.ty);
    // Painting over a populated residential zone displaces residents — same
    // PC cost as bulldozing, since the effect on citizens is identical.
    const displacedPopulation =
      world.layers.zone[i] === ZONE_R && world.layers.zone[i] !== this.newZone
        ? (BALANCE.growth.popPerLevel[world.layers.devLevel[i]] ?? 0)
        : 0;
    const pcCost = displacedPopulation > 0
      ? displacedPopulation * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop
      : 0;
    if (pcCost > 0 && world.budget.politicalCapital < pcCost) return false;

    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;
    this.pcCost = pcCost;

    world.budget.money -= cost;
    if (this.pcCost > 0) world.budget.politicalCapital -= this.pcCost;

    if (world.layers.roadClass[i] !== ROAD_NONE) {
      world.layers.roadClass[i] = ROAD_NONE;
      world.roadNetDirty = true;
    }
    const ok = world.setZone(this.tx, this.ty, this.newZone);
    if (ok) world.events.emit('zonePainted', {
      tx: this.tx, ty: this.ty,
      zone: this.newZone,
      cost,
      displacedPopulation,
      pcCost: this.pcCost,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
    if (this.pcCost > 0) world.budget.politicalCapital += this.pcCost;
  }
}
