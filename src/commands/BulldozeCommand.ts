import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { ZONE_NONE, ZONE_R, ROAD_NONE, BUILDING_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';

export class BulldozeCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  private pcCost = 0;

  constructor(tx: number, ty: number) {
    super();
    this.tx = tx;
    this.ty = ty;
  }

  execute(world: World): boolean {
    if (!world.grid.inBounds(this.tx, this.ty)) return false;
    const i = world.grid.idx(this.tx, this.ty);
    if (world.layers.zone[i] === ZONE_NONE &&
        world.layers.roadClass[i] === ROAD_NONE &&
        world.layers.building[i] === BUILDING_NONE) return false;
    if (world.budget.money < BALANCE.costs.bulldoze) return false;

    const displacedPopulation =
      world.layers.zone[i] === ZONE_R
        ? (BALANCE.growth.popPerLevel[world.layers.devLevel[i]] ?? 0)
        : 0;

    // Gate on political capital when displacing residents.
    const pcCost = displacedPopulation > 0
      ? displacedPopulation * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop
      : 0;
    if (pcCost > 0 && world.budget.politicalCapital < pcCost) return false;

    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = BALANCE.costs.bulldoze;
    this.pcCost = pcCost;

    world.budget.money -= this.cost;
    if (this.pcCost > 0) world.budget.politicalCapital -= this.pcCost;

    const ok = world.clearTile(this.tx, this.ty);
    if (ok) world.events.emit('tileCleared', {
      tx: this.tx, ty: this.ty,
      displacedPopulation,
      pcCost: this.pcCost,
      hadBuilding: this.snap.building,
      hadZone: this.snap.zone,
      devLevel: this.snap.dev,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
    if (this.pcCost > 0) world.budget.politicalCapital += this.pcCost;
  }
}
